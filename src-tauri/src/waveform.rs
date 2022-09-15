// -------------------------------------------------------------------------------------------------

#[derive(serde::Serialize, Debug, Default)]
pub struct WaveformPoint {
    time: f32,
    min: f32,
    max: f32,
}

// -------------------------------------------------------------------------------------------------

// Create waveform data for the given sample
// This should be async, as waveform generation may take a long while to compute.
#[tauri::command(async)]
pub fn generate_waveform(
    file_path: String,
    resolution: usize,
) -> Result<Vec<WaveformPoint>, String> {
    match afplay::generate_mono_waveform_from_file(file_path.as_str(), resolution) {
        Ok(data) => Ok(data
            .iter()
            .map(|v| WaveformPoint {
                time: v.time.as_secs_f32(),
                min: v.min,
                max: v.max,
            })
            .collect()),
        Err(err) => Err(err.to_string()),
    }
}
