mod actor;
mod decoder;
mod error;
mod player;
mod resampler;

use tauri::Manager;

use self::actor::{Act, Actor};
use self::player::{
    file::AudioPlayerFile,
    output::{AudioOutput, DefaultAudioOutput},
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

    // Initialize audio playback device
    pub fn initialize(
        &self,
        app_handle: tauri::AppHandle,
    ) -> Result<(), Box<dyn std::error::Error>> {
        // check if we already got initialized
        if self.command_sender.lock().unwrap().is_some() {
            return Err(string_error::new_err(
                "Audio playback already is initialized",
            ));
        }

        match PlaybackActor::new(app_handle) {
            Ok(playback_impl) => {
                let actor =
                    PlaybackActor::spawn_with_default_cap("audio_playback_manager", move |_| {
                        playback_impl
                    });
                *self.command_sender.lock().unwrap() = Some(actor.sender());
                *self.init_error.lock().unwrap() = None;
                Ok(())
            }
            Err(err) => {
                *self.init_error.lock().unwrap() = Some(err.to_string());
                Err(string_error::new_err(&err))
            }
        }
    }

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

// Playback actor: receives and forwards playback events from the UI to the playback manager
struct PlaybackActor {
    #[allow(dead_code)]
    audio_output: DefaultAudioOutput,
    playback_manager: PlaybackManager,
}

impl PlaybackActor {
    fn new(app_handle: tauri::AppHandle) -> Result<PlaybackActor, String> {
        // Open default device
        match DefaultAudioOutput::open().map_err(|err| err.to_string()) {
            Err(err) => Err(err),
            Ok(audio_output) => {
                // create playback manager
                let (event_sx, event_rx) = crossbeam_channel::unbounded();
                let playback_manager = PlaybackManager::new(audio_output.sink(), event_sx);

                // handle events from playback manager
                Self::process_playback_manager_events(app_handle, event_rx);

                Ok(Self {
                    audio_output,
                    playback_manager,
                })
            }
        }
    }

    fn process_playback_manager_events(
        app_handle: tauri::AppHandle,
        event_rx: crossbeam_channel::Receiver<PlaybackEvent>,
    ) {
        std::thread::Builder::new()
            .name("audio_playback_events".to_string())
            .spawn(move || loop {
                match event_rx.recv() {
                    Ok(event) => match event {
                        PlaybackEvent::Position { path, position } => {
                            send_playback_position_event(&app_handle, path, position)
                        }
                        PlaybackEvent::EndOfFile { path } => {
                            send_playback_finished_event(&app_handle, path)
                        }
                    },
                    Err(err) => {
                        log::info!("Playback event channel closed: '{err}'");
                        break;
                    }
                }
            })
            .unwrap();
    }
}

impl Actor for PlaybackActor {
    type Message = PlaybackCommand;
    type Error = String;

    fn handle(&mut self, msg: PlaybackCommand) -> Result<Act<Self>, Self::Error> {
        match msg {
            // Play
            PlaybackCommand::Play { file_path, source } => {
                log::info!("Start playing file: '{file_path}'");
                self.playback_manager.play(source);
                Ok(Act::Continue)
            }
            // Seek
            PlaybackCommand::Seek {
                file_path,
                seek_pos_seconds,
            } => {
                log::info!("Stop playing file: '{file_path}'");
                if let Some(playing_file_path) = self.playback_manager.playing_file() {
                    if file_path == playing_file_path {
                        self.playback_manager.seek(std::time::Duration::from_millis(
                            (seek_pos_seconds as u64) * 1000,
                        ));
                    }
                }
                Ok(Act::Continue)
            }
            // Stop
            PlaybackCommand::Stop { file_path } => {
                log::info!("Stop playing file: '{file_path}'");
                if let Some(playing_file_path) = self.playback_manager.playing_file() {
                    if file_path == playing_file_path {
                        self.playback_manager.stop();
                    }
                }
                Ok(Act::Continue)
            }
            // StopAll
            PlaybackCommand::StopAll => {
                log::info!("Stop all playing files");
                self.playback_manager.stop();
                Ok(Act::Continue)
            }
        }
    }
}

// -------------------------------------------------------------------------------------------------

// Initialize audio playback device
#[tauri::command]
pub fn initialize_audio(
    playback: tauri::State<Playback>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    playback
        .initialize(app_handle)
        .map_err(|err| err.to_string())
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

// Send a playback position event to the frontend
pub fn send_playback_position_event(
    app_handle: &tauri::AppHandle,
    path: String,
    position: std::time::Duration,
) {
    #[derive(Clone, serde::Serialize)]
    struct PlaybackPositionEvent {
        path: String,
        position: f64,
    }
    if let Err(error) = app_handle.emit_all(
        "audio_playback_position",
        PlaybackPositionEvent {
            path,
            position: (position.as_millis() as f64) / 1000.0,
        },
    ) {
        log::warn!("Failed to send app event: {error}")
    }
}

// Send a playback finished event to the frontend

pub fn send_playback_finished_event(app_handle: &tauri::AppHandle, path: String) {
    #[derive(Clone, serde::Serialize)]
    struct PlaybackFinishedEvent {
        path: String,
    }
    if let Err(error) =
        app_handle.emit_all("audio_playback_finished", PlaybackFinishedEvent { path })
    {
        log::warn!("Failed to send app event: {error}")
    }
}
