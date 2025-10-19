use simplelog::*;
use tauri::Manager;

// -------------------------------------------------------------------------------------------------

mod audio;
mod plot;
mod waveform;

// -------------------------------------------------------------------------------------------------

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() -> Result<(), Box<dyn std::error::Error>> {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .manage(audio::Playback::new())
        .setup(|app| {
            // create term logger
            let mut loggers: Vec<Box<dyn SharedLogger>> = vec![TermLogger::new(
                LevelFilter::Warn,
                Config::default(),
                TerminalMode::Mixed,
                ColorChoice::Auto,
            )];
            // try creating a file log as well, but don't panic
            let result: anyhow::Result<Box<WriteLogger<std::fs::File>>> = {
                let log_path = app.path().app_config_dir()?;
                std::fs::create_dir_all(log_path.as_path()).ok();
                let mut log_file_path = log_path;
                log_file_path.push("App.log");
                Ok(WriteLogger::new(
                    LevelFilter::Info,
                    Config::default(),
                    std::fs::File::create(log_file_path.as_path())?,
                ))
            };
            match result {
                Err(err) => eprintln!("Failed to create log file: {err}"),
                Ok(logger) => loggers.push(logger),
            }
            // initialize
            CombinedLogger::init(loggers)
                .unwrap_or_else(|err| eprintln!("Failed to create logger: {err}"));
            log::info!("Starting application...");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            plot::create_tsne_plot,
            audio::initialize_audio,
            audio::play_audio_file,
            audio::seek_audio_file,
            audio::stop_audio_file,
            waveform::generate_waveform,
        ])
        .run(tauri::generate_context!())
        .expect("Error while running tauri application");
    Ok(())
}
