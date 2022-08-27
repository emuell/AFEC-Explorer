mod database;
mod tsne;

// -------------------------------------------------------------------------------------------------

// Create a t-SNE plot for the given AFEC database with the given parameters
// This should be async, as plot generation takes a long while.
#[tauri::command(async)]
pub fn create_tsne_plot(
    db_path: String,
    theta: f32,
    perplexity: f32,
    epochs: usize,
) -> Result<Vec<tsne::PlotEntry>, String> {
    tsne::create_plot(db_path, theta, perplexity, epochs).map_err(|err| err.to_string())
}
