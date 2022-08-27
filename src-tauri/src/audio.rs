pub mod playback;
use playback::Playback;

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
