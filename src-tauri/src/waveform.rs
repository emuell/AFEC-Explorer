use phonic::{sources::PreloadedFileSource, utils::waveform, FilePlaybackOptions};

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
    // decode sample file
    let file_source =
        PreloadedFileSource::from_file(file_path, None, FilePlaybackOptions::default(), 44100)
            .map_err(|e| e.to_string())?;
    let file_buffer = file_source.file_buffer();
    // generate waveform
    let data = waveform::mixed_down(
        file_buffer.buffer(),
        file_buffer.channel_count(),
        file_buffer.sample_rate(),
        resolution,
    );
    Ok(data
        .iter()
        .map(|v| WaveformPoint {
            time: v.time.as_secs_f32(),
            min: v.min,
            max: v.max,
        })
        .collect())
}
