mod error;
mod player;
mod source;

use tauri::Manager;

use self::player::{
    file::AudioPlayerFile,
    output::{AudioOutput, DefaultAudioOutput},
    {PlaybackEvent, PlaybackManager},
};
use std::sync::Mutex;

// -------------------------------------------------------------------------------------------------

// Global audio playback state, shared in Tauri.
pub struct Playback {
    init_error: Mutex<Option<String>>,
    playback_manager: Mutex<Option<PlaybackManager>>,
}

impl Playback {
    // Create a new uninitialized playback state
    pub fn new() -> Playback {
        Playback {
            init_error: Mutex::new(None),
            playback_manager: Mutex::new(None),
        }
    }

    // Initialize audio playback state
    pub fn initialize(
        &self,
        app_handle: tauri::AppHandle,
    ) -> Result<(), Box<dyn std::error::Error>> {
        // check if we already got initialized
        if self.playback_manager.lock().unwrap().is_some() {
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
                // create playback manager
                let (event_sx, event_rx) = crossbeam_channel::unbounded();
                *self.playback_manager.lock().unwrap() =
                    Some(PlaybackManager::new(audio_output.sink(), event_sx));
                // handle events from playback manager
                Self::process_playback_manager_events(app_handle, event_rx);
                Ok(())
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

    pub fn playing_file(&self) -> Result<Option<String>, Box<dyn std::error::Error>> {
        if let Some(playback_manager) = self.playback_manager.lock().unwrap().as_ref() {
            Ok(playback_manager.playing_file())
        } else {
            Err(string_error::new_err("Playback not initialized"))
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
        let source = AudioPlayerFile::new(file_path)?;

        // send the source to the decoder thread and start playing
        if let Some(playback_manager) = self.playback_manager.lock().unwrap().as_mut() {
            playback_manager.play(source);
            Ok(())
        } else {
            Err(string_error::new_err("Playback not initialized"))
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
                "Can't seek file: Audio playback failed to intialize.",
            ));
        }
        // send the source to the playback thread and start playing
        if let Some(playback_manager) = self.playback_manager.lock().unwrap().as_ref() {
            playback_manager.seek(std::time::Duration::from_millis(
                (seek_pos_seconds * 1000.0) as u64,
            ));
            Ok(())
        } else {
            Err(string_error::new_err("Playback not initialized"))
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
        // stop playing
        if let Some(playback_manager) = self.playback_manager.lock().unwrap().as_ref() {
            if let Some(playing_file) = playback_manager.playing_file() {
                if playing_file == file_path {
                    playback_manager.stop();
                }
            }
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

// Currently playing file or an empty string when none is playing. Playback positions are
// sent as global events: see \function send_playback_position_event for details.
#[tauri::command]
pub fn playing_audio_file(playback: tauri::State<Playback>) -> Result<String, String> {
    match playback.playing_file() {
        Ok(file) => Ok(file.unwrap_or_default()),
        Err(err) => Err(err.to_string()),
    }
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
