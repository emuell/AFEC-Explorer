use std::sync::*;
use string_error::*;

// -------------------------------------------------------------------------------------------------

// Decoded audio file source, which gets passed form the main to the audio comman thread
type DecodedFileSource = rodio::Decoder<std::io::BufReader<std::fs::File>>;

// -------------------------------------------------------------------------------------------------

// Commands which are send to the audio playback thread
#[allow(clippy::large_enum_variant, dead_code)]
enum PlaybackCommand {
    Play {
        file_path: String,
        source: DecodedFileSource,
    },
    Stop {
        file_path: String,
    },
    StopAll,
}

// -------------------------------------------------------------------------------------------------

// Global audio playback state, shared in Tauri.
pub struct Playback {
    command_sender: Mutex<Option<mpsc::Sender<PlaybackCommand>>>,
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
        command_rx: &mpsc::Receiver<PlaybackCommand>,
        stream_handle: &rodio::OutputStreamHandle,
    ) {
        let mut playing_files = Vec::<(String, rodio::Sink)>::new();
        for command in command_rx {
            match command {
                // Play
                PlaybackCommand::Play { file_path, source } => {
                    log::info!("Start playing file: '{file_path}'");
                    if let Ok(sink) = rodio::Sink::try_new(stream_handle) {
                        sink.append(source);
                        playing_files.push((file_path, sink));
                    }
                }
                // Stop
                PlaybackCommand::Stop { file_path } => {
                    log::info!("Stop playing file: '{file_path}'");
                    for (index, (name, sink)) in playing_files.iter().enumerate() {
                        if *name == file_path {
                            sink.stop();
                            playing_files.remove(index);
                            break;
                        }
                    }
                }
                // StopAll
                PlaybackCommand::StopAll => {
                    log::info!("Stop all playing files");
                    for (_, sink) in playing_files.iter() {
                        sink.stop();
                    }
                    playing_files.clear();
                }
            }
        }
    }

    // Initialize audio playback device
    pub fn initialize(&self) -> Result<(), Box<dyn std::error::Error>> {
        // check if we already got initialized
        if self.command_sender.lock().unwrap().is_some() {
            return Err(new_err("Audio playback already is initialized"));
        }

        // create command and init channels
        let (command_sx, command_rx) = mpsc::channel::<PlaybackCommand>();
        let (init_sx, init_rx) = mpsc::channel::<Result<(), String>>();

        // store command sender in our shared state
        *self.command_sender.lock().unwrap() = Some(command_sx);

        // start our detached audio command thread
        std::thread::spawn(move || {
            // Open default device
            let _stream: rodio::OutputStream; // retain! dropping this will shut down the device!
            let stream_handle: rodio::OutputStreamHandle;
            match rodio::OutputStream::try_default() {
                Ok((stream, handle)) => {
                    _stream = stream;
                    stream_handle = handle;
                    init_sx.send(Ok(())).unwrap();
                }
                Err(err) => {
                    init_sx.send(Err(err.to_string())).unwrap();
                    return;
                }
            };
            // Run playback command loop
            Playback::run_command_loop(&command_rx, &stream_handle);
        });

        // wait for init to finish, memorize error and return it
        if let Err(err) = init_rx.recv().unwrap() {
            *self.init_error.lock().unwrap() = Some(err.to_string());
            log::error!("Audio playpack init failed: {err}");
            return Err(new_err(err.as_str()));
        }
        Ok(())
    }

    // Play a single audio file and stop all others
    pub fn play(&self, file_path: String) -> Result<(), Box<dyn std::error::Error>> {
        log::info!("Decoding audio file for playback: '{file_path}'");

        // handle initialize errors
        if self.init_error.lock().unwrap().is_some() {
            return Err(new_err(
                "Can't play file: Audio playback failed to intialize.",
            ));
        }
        // load sound from given file path
        let file = std::fs::File::open(file_path.clone())?;
        // decode that sound file into a source
        let source = rodio::Decoder::new(std::io::BufReader::new(file))?;

        // send the source to the playback thread and start playing
        if let Some(sender) = self.command_sender.lock().unwrap().as_ref() {
            sender.send(PlaybackCommand::StopAll)?;
            sender.send(PlaybackCommand::Play { file_path, source })?;
            Ok(())
        } else {
            Err(new_err("Playback command channel not initialized"))
        }
    }
}
