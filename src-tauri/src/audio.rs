use std::sync::*;

// Decoded audio file source, which gets passed form the main to the audio comman thread
type DecodedFileSource = rodio::Decoder<std::io::BufReader<std::fs::File>>;

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

// Global shared tauri state. Only memorizes a Sender to invoke commands in the audio playback thread.
pub struct PlaybackState {
    command_sender: Mutex<Option<mpsc::Sender<PlaybackCommand>>>,
    init_error: Mutex<Option<String>>,
}

impl PlaybackState {
    pub fn new() -> PlaybackState {
        PlaybackState {
            command_sender: Mutex::new(None),
            init_error: Mutex::new(None),
        }
    }
}

// Initialize audio playback device
#[tauri::command]
pub fn initialize_audio(playback: tauri::State<'_, PlaybackState>) -> Result<(), String> {
    log::info!("Initializing audio playback...");

    // check if we already got initialized
    if playback.command_sender.lock().unwrap().is_some() {
        return Err("Audio playback already is initialized".to_string());
    }

    // create command and init channels
    let (command_sx, command_rx) = mpsc::channel::<PlaybackCommand>();
    let (init_sx, init_rx) = mpsc::sync_channel::<Option<String>>(1);

    // store command sender in our shared state
    *playback.command_sender.lock().unwrap() = Some(command_sx);

    // start our detached audio command thread
    std::thread::spawn(move || {
        // Open default device
        let _stream: rodio::OutputStream; // retain! dropping this will shut down the device!
        let stream_handle: rodio::OutputStreamHandle;
        match rodio::OutputStream::try_default() {
            Ok((stream, handle)) => {
                _stream = stream;
                stream_handle = handle;
            }
            Err(err) => {
                init_sx.send(Some(err.to_string())).unwrap();
                return;
            }
        };

        // Signal that initialization finished without errors
        init_sx.send(None).unwrap();

        // Run playback command loop
        let mut playing_files = Vec::<(String, rodio::Sink)>::new();

        for command in command_rx {
            match command {
                // Play
                PlaybackCommand::Play { file_path, source } => {
                    log::info!("Start playing file: '{file_path}'");
                    if let Ok(sink) = rodio::Sink::try_new(&stream_handle) {
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
    });

    // wait for init to finish, memorize error and return it
    if let Some(err) = init_rx.recv().unwrap() {
        *playback.init_error.lock().unwrap() = Some(err.to_string());
        log::error!("Audio playpack init failed: {err}");
        Err(err)
    } else {
        Ok(())
    }
}

// Play a single audio file. Playback must once be initialized via `initialize_playback`
#[tauri::command]
pub fn play_audio_file(
    file_path: String,
    playback: tauri::State<'_, PlaybackState>,
) -> Result<(), String> {
    log::info!("Decoding audio file for playback: '{file_path}'");

    // handle initialize errors
    if playback.init_error.lock().unwrap().is_some() {
        return Err("Can't play file: Audio playback failed to intialize.".to_string());
    }
    // load sound from given file path
    let file = std::io::BufReader::new(
        std::fs::File::open(file_path.clone()).map_err(|err| err.to_string())?,
    );
    // decode that sound file into a source
    let source = rodio::Decoder::new(file).map_err(|err| err.to_string())?;

    // send the source to the playback thread and start playing
    if let Some(sender) = playback.command_sender.lock().unwrap().as_ref() {
        sender
            .send(PlaybackCommand::StopAll)
            .map_err(|err| err.to_string())?;
        sender
            .send(PlaybackCommand::Play { file_path, source })
            .map_err(|err| err.to_string())?;
        Ok(())
    } else {
        Err("Playback command channel not initialized".to_string())
    }
}
