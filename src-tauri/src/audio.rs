use afplay::{
    AudioFilePlaybackId, AudioFilePlaybackStatusEvent, AudioFilePlayer, AudioOutput,
    DefaultAudioOutput, FilePlaybackOptions, AudioFilePlaybackStatusContext,
};
use std::{sync::Mutex, time::Duration};
use tauri::Manager;

// -------------------------------------------------------------------------------------------------

// Global audio playback state, held in a Tauri State.
pub struct Playback {
    init_error: Mutex<Option<String>>,
    player: Mutex<Option<AudioFilePlayer>>,
}

impl Playback {
    // Create a new uninitialized playback state
    pub fn new() -> Playback {
        Playback {
            init_error: Mutex::new(None),
            player: Mutex::new(None),
        }
    }

    // Initialize audio playback state
    pub fn initialize(
        &self,
        app_handle: tauri::AppHandle,
    ) -> Result<(), Box<dyn std::error::Error>> {
        // check if we already got initialized
        if self.player.lock().unwrap().is_some() {
            return Err(string_error::new_err(
                "Audio playback already is initialized",
            ));
        }
        // Open default device
        match DefaultAudioOutput::open() {
            Err(err) => {
                // memorize error
                *self.init_error.lock().unwrap() = Some(err.to_string());
                Err(string_error::new_err(err.to_string().as_str()))
            }
            Ok(audio_output) => {
                // create player
                let (event_sx, event_rx) = crossbeam_channel::unbounded();
                let player = AudioFilePlayer::new(audio_output.sink(), Some(event_sx));
                // handle events from playback manager
                Self::process_playback_manager_events(app_handle, event_rx);
                // memorize player instance
                *self.player.lock().unwrap() = Some(player);
                Ok(())
            }
        }
    }

    fn process_playback_manager_events(
        app_handle: tauri::AppHandle,
        event_rx: crossbeam_channel::Receiver<AudioFilePlaybackStatusEvent>,
    ) {
        std::thread::Builder::new()
            .name("audio_playback_events".to_string())
            .spawn(move || loop {
                match event_rx.recv() {
                    Ok(event) => match event {
                        AudioFilePlaybackStatusEvent::Position { id, path, position, context } => {
                            send_playback_position_event(&app_handle, id, (*path).to_string(), position, context)
                        }
                        AudioFilePlaybackStatusEvent::Stopped {
                            id,
                            path,
                            exhausted: _,
                            context
                        } => send_playback_finished_event(&app_handle, id, (*path).to_string(), context),
                    },
                    Err(err) => {
                        log::info!("Playback event channel closed: '{err}'");
                        break;
                    }
                }
            })
            .unwrap();
    }

    pub fn play(
        &self,
        file_path: String,
    ) -> Result<AudioFilePlaybackId, Box<dyn std::error::Error>> {
        log::info!("Decoding audio file for playback: '{file_path}'");

        // handle initialize errors
        if self.init_error.lock().unwrap().is_some() {
            return Err(string_error::new_err(
                "Can't play file: Audio playback failed to intialize.",
            ));
        }

        // start playing
        if let Some(player) = self.player.lock().unwrap().as_mut() {
            let file_id = player.play_file(
                file_path.as_str(),
                FilePlaybackOptions::default()
                    .streamed()
                    .playback_pos_emit_rate(Duration::from_secs_f64(1.0 / 30.0)),
            )?;
            log::info!("Decoded audio file has the id #{file_id}");
            Ok(file_id)
        } else {
            Err(string_error::new_err("Playback not initialized"))
        }
    }

    pub fn seek(
        &self,
        file_id: AudioFilePlaybackId,
        seek_pos_seconds: f64,
    ) -> Result<(), Box<dyn std::error::Error>> {
        log::info!("Seeking audio file #{file_id}");

        // handle initialize errors
        if self.init_error.lock().unwrap().is_some() {
            return Err(string_error::new_err(
                "Can't seek file: Audio playback failed to intialize.",
            ));
        }
        // send the source to the playback thread and start playing
        if let Some(player) = self.player.lock().unwrap().as_mut() {
            player.seek_source(
                file_id,
                std::time::Duration::from_millis((seek_pos_seconds * 1000.0) as u64),
            )?;
            Ok(())
        } else {
            Err(string_error::new_err("Playback not initialized"))
        }
    }

    pub fn stop(&self, file_id: AudioFilePlaybackId) -> Result<(), Box<dyn std::error::Error>> {
        log::info!("Stopping audio file #{file_id}");

        // handle initialize errors
        if self.init_error.lock().unwrap().is_some() {
            return Err(string_error::new_err(
                "Can't play file: Audio playback failed to intialize.",
            ));
        }
        // stop playing
        if let Some(player) = self.player.lock().unwrap().as_mut() {
            player.stop_source(file_id)?;
            Ok(())
        } else {
            Err(string_error::new_err("Playback not initialized"))
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

// Play a single audio file. Playback must once be initialized via `initialize_audio`.
// returns a file id which can be used to seek or stop the file later on.
#[tauri::command]
pub fn play_audio_file(
    file_path: String,
    playback: tauri::State<Playback>,
) -> Result<AudioFilePlaybackId, String> {
    playback.play(file_path).map_err(|err| err.to_string())
}

// Seek given audio file. Nothing happens when the file isn't playing
#[tauri::command]
pub fn seek_audio_file(
    file_id: AudioFilePlaybackId,
    seek_pos_seconds: f64,
    playback: tauri::State<Playback>,
) -> Result<(), String> {
    playback
        .seek(file_id, seek_pos_seconds)
        .map_err(|err| err.to_string())
}

// Stop given audio file. Nothing happens when the file isn't playing
#[tauri::command]
pub fn stop_audio_file(
    file_id: AudioFilePlaybackId,
    playback: tauri::State<Playback>,
) -> Result<(), String> {
    playback.stop(file_id).map_err(|err| err.to_string())
}

// Send a playback position event to the frontend
pub fn send_playback_position_event(
    app_handle: &tauri::AppHandle,
    file_id: AudioFilePlaybackId,
    file_path: String,
    position: std::time::Duration,
    _context: Option<AudioFilePlaybackStatusContext>
) {
    #[derive(Clone, serde::Serialize)]
    struct PlaybackPositionEvent {
        file_id: AudioFilePlaybackId,
        file_path: String,
        position: f64,
    }
    if let Err(error) = app_handle.emit_all(
        "audio_playback_position",
        PlaybackPositionEvent {
            file_id,
            file_path,
            position: (position.as_millis() as f64) / 1000.0,
        },
    ) {
        log::warn!("Failed to send app event: {error}")
    }
}

// Send a playback finished event to the frontend

pub fn send_playback_finished_event(
    app_handle: &tauri::AppHandle,
    file_id: AudioFilePlaybackId,
    file_path: String,
    _context: Option<AudioFilePlaybackStatusContext>
) {
    #[derive(Clone, serde::Serialize)]
    struct PlaybackFinishedEvent {
        file_id: AudioFilePlaybackId,
        file_path: String,
    }
    if let Err(error) = app_handle.emit_all(
        "audio_playback_finished",
        PlaybackFinishedEvent { file_id, file_path },
    ) {
        log::warn!("Failed to send app event: {error}")
    }
}
