mod actor;
mod decoder;
mod error;
mod player;
mod resampler;

use self::player::{
    file::AudioPlayerFile,
    output::{AudioOutput, DefaultAudioOutput, DefaultAudioSink},
    {PlaybackEvent, PlaybackManager},
};
use std::sync::Mutex;

// -------------------------------------------------------------------------------------------------

// Commands which are send to the audio playback thread
#[allow(clippy::large_enum_variant, dead_code)]
enum PlaybackCommand {
    Play {
        file_path: String,
        source: AudioPlayerFile,
    },
    Seek {
        file_path: String,
        seek_pos_seconds: f64,
    },
    Stop {
        file_path: String,
    },
    StopAll,
}

// -------------------------------------------------------------------------------------------------

// Global audio playback state, shared in Tauri.
pub struct Playback {
    command_sender: Mutex<Option<crossbeam_channel::Sender<PlaybackCommand>>>,
    init_error: Mutex<Option<String>>,
}

impl Playback {
    // Create a new uninitialized playback state
    pub fn new() -> Playback {
        Playback {
            command_sender: Mutex::new(None),
            init_error: Mutex::new(None),
        }
    }

    // apply playback commands send to our audio worker thread
    fn run_command_loop(
        command_rx: &crossbeam_channel::Receiver<PlaybackCommand>,
        event_rx: &crossbeam_channel::Receiver<PlaybackEvent>,
        manager: &mut PlaybackManager,
    ) -> ! {
        loop {
            crossbeam_channel::select! {
                recv(command_rx) -> msg => {
                    match msg.unwrap() {
                        // Play
                        PlaybackCommand::Play { file_path, source } => {
                            log::info!("Start playing file: '{file_path}'");
                            manager.play(source);
                        }
                        // Seek
                        PlaybackCommand::Seek { file_path, seek_pos_seconds } => {
                            log::info!("Stop playing file: '{file_path}'");
                            if let Some(playing_file_path) = manager.playing_file() {
                                if file_path == playing_file_path {
                                    manager.seek(std::time::Duration::from_millis(seek_pos_seconds as u64 * 1000));
                                }
                            }
                        }// Stop
                        PlaybackCommand::Stop { file_path } => {
                            log::info!("Stop playing file: '{file_path}'");
                            if let Some(playing_file_path) = manager.playing_file() {
                                if file_path == playing_file_path {
                                    manager.stop();
                                }
                            }
                        }
                        // StopAll
                        PlaybackCommand::StopAll => {
                            log::info!("Stop all playing files");
                            manager.stop();
                        }
                    }
                },
                recv(event_rx) -> msg => {
                    match msg.unwrap() {
                        PlaybackEvent::Position{..} => (),
                        PlaybackEvent::EndOfFile => (),
                    }
                }
            }
        }
    }

    // Initialize audio playback device
    pub fn initialize(&self) -> Result<(), Box<dyn std::error::Error>> {
        // check if we already got initialized
        if self.command_sender.lock().unwrap().is_some() {
            return Err(string_error::new_err(
                "Audio playback already is initialized",
            ));
        }

        // create command and init channels
        let (command_sx, command_rx) = crossbeam_channel::unbounded::<PlaybackCommand>();
        let (init_sx, init_rx) = crossbeam_channel::bounded::<Result<(), String>>(1);

        // store command sender in our shared state
        *self.command_sender.lock().unwrap() = Some(command_sx);

        // start our detached audio command thread
        std::thread::spawn(move || {
            // Open default device
            match DefaultAudioOutput::open().map_err(|err| err.to_string()) {
                Err(err) => init_sx.send(Err(err)).unwrap(),
                Ok(device) => {
                    let device_sink: DefaultAudioSink = device.sink();

                    let (event_sx, event_rx) = crossbeam_channel::unbounded();
                    let mut manager = PlaybackManager::new(device_sink, event_sx);

                    init_sx.send(Ok(())).unwrap();

                    // Run playback command loop
                    Playback::run_command_loop(&command_rx, &event_rx, &mut manager);
                }
            }
        });

        // wait for init to finish, memorize error and return it
        if let Err(err) = init_rx.recv().unwrap() {
            *self.init_error.lock().unwrap() = Some(err.to_string());
            log::error!("Audio playpack init failed: {err}");
            return Err(string_error::new_err(err.as_str()));
        }
        Ok(())
    }

    // Play a single audio file and stop all others
    pub fn play(&self, file_path: String) -> Result<(), Box<dyn std::error::Error>> {
        log::info!("Decoding audio file for playback: '{file_path}'");

        // handle initialize errors
        if self.init_error.lock().unwrap().is_some() {
            return Err(string_error::new_err(
                "Can't play file: Audio playback failed to intialize.",
            ));
        }
        // load sound from given file path
        let source = AudioPlayerFile::new(file_path.to_owned()).map_err(|err| err.to_string())?;

        // send the source to the playback thread and start playing
        if let Some(sender) = self.command_sender.lock().unwrap().as_ref() {
            sender.send(PlaybackCommand::StopAll)?;
            sender.send(PlaybackCommand::Play { file_path, source })?;
            Ok(())
        } else {
            Err(string_error::new_err(
                "Playback command channel not initialized",
            ))
        }
    }

    pub fn seek(
        &self,
        file_path: String,
        seek_pos_seconds: f64,
    ) -> Result<(), Box<dyn std::error::Error>> {
        log::info!("Decoding audio file for playback: '{file_path}'");

        // handle initialize errors
        if self.init_error.lock().unwrap().is_some() {
            return Err(string_error::new_err(
                "Can't play file: Audio playback failed to intialize.",
            ));
        }
        // send the source to the playback thread and start playing
        if let Some(sender) = self.command_sender.lock().unwrap().as_ref() {
            sender.send(PlaybackCommand::Seek {
                file_path,
                seek_pos_seconds,
            })?;
            Ok(())
        } else {
            Err(string_error::new_err(
                "Playback command channel not initialized",
            ))
        }
    }

    pub fn stop(&self, file_path: String) -> Result<(), Box<dyn std::error::Error>> {
        log::info!("Stopping audio file playback: '{file_path}'");

        // handle initialize errors
        if self.init_error.lock().unwrap().is_some() {
            return Err(string_error::new_err(
                "Can't play file: Audio playback failed to intialize.",
            ));
        }
        // send the source to the playback thread and start playing
        if let Some(sender) = self.command_sender.lock().unwrap().as_ref() {
            sender.send(PlaybackCommand::Stop { file_path })?;
            Ok(())
        } else {
            Err(string_error::new_err(
                "Playback command channel not initialized",
            ))
        }
    }
}

// -------------------------------------------------------------------------------------------------

// Initialize audio playback device
#[tauri::command]
pub fn initialize_audio(playback: tauri::State<Playback>) -> Result<(), String> {
    playback.initialize().map_err(|err| err.to_string())
}

// Play a single audio file. Playback must once be initialized via `initialize_audio`
#[tauri::command]
pub fn play_audio_file(file_path: String, playback: tauri::State<Playback>) -> Result<(), String> {
    playback.play(file_path).map_err(|err| err.to_string())
}

// Seek given audio file. Nothing happens when the file isn't playing
#[tauri::command]
pub fn seek_audio_file(
    file_path: String,
    seek_pos_seconds: f64,
    playback: tauri::State<Playback>,
) -> Result<(), String> {
    playback
        .seek(file_path, seek_pos_seconds)
        .map_err(|err| err.to_string())
}

// Stop given audio file. Nothing happens when the file isn't playing
#[tauri::command]
pub fn stop_audio_file(file_path: String, playback: tauri::State<Playback>) -> Result<(), String> {
    playback.stop(file_path).map_err(|err| err.to_string())
}
