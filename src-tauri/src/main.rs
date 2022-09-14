#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod audio;
mod plot;
mod waveform;

use simplelog::*;

// -------------------------------------------------------------------------------------------------

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // create term logger
            let mut loggers: Vec<Box<dyn SharedLogger>> = vec![TermLogger::new(
                LevelFilter::Warn,
                Config::default(),
                TerminalMode::Mixed,
                ColorChoice::Auto,
            )];
            // try creating a file log as well, but don't panic
            match (|| -> Result<Box<WriteLogger<std::fs::File>>, Box<dyn std::error::Error>> {
                let log_path = app
                    .path_resolver()
                    .log_dir()
                    .ok_or_else(|| string_error::static_err("Failed to resolve log directory"))?;
                std::fs::create_dir_all(log_path.as_path())?;
                let mut log_file_path = log_path;
                log_file_path.push("App.log");
                Ok(WriteLogger::new(
                    LevelFilter::Info,
                    Config::default(),
                    std::fs::File::create(log_file_path.as_path())?,
                ))
            })() {
                Err(err) => eprintln!("Failed to create log file: {err}"),
                Ok(logger) => loggers.push(logger),
            }
            // initialize
            CombinedLogger::init(loggers)
                .unwrap_or_else(|err| eprintln!("Failed to create logger: {err}"));
            log::info!("Starting application...");
            Ok(())
        })
        .plugin(tauri_plugin_sqlite::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .manage(audio::Playback::new())
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
}
