#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod tsne;
use tsne::plot::create_plot;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sqlite::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .invoke_handler(tauri::generate_handler![create_plot])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
