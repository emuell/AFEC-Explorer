use super::database;
use bhtsne;

#[derive(serde::Serialize, Debug, Default)]
pub struct PlotEntry {
    filename: String,
    x: f32,
    y: f32,
    categories: Vec<String>,
    classes: Vec<String>,
}

#[tauri::command]
pub async fn create_plot(db_path: String) -> Result<Vec<PlotEntry>, String> {
    // read database input
    let mut rows = database::get_tsne_data(db_path).map_err(|op| op.message.unwrap())?;
    if rows.len() == 0 {
        return Ok(vec![]);
    }

    // convert to 2d float array
    let mut samples: Vec<&[f32]> = Vec::new();
    for row in rows.iter_mut() {
        samples.push(&row.data);
    }

    // run tsne
    const NO_DIMS: u8 = 2;
    const THETA: f32 = 0.5;
    const PERPLEXITY: f32 = 10.0; // Perplexity of the conditional distribution.
    const EPOCHS: usize = 1000;

    let mut tsne = bhtsne::tSNE::new(&samples);
    tsne.embedding_dim(NO_DIMS)
        .perplexity(PERPLEXITY)
        .epochs(EPOCHS)
        .barnes_hut(THETA, |sample_a, sample_b| {
            sample_a
                .iter()
                .zip(sample_b.iter())
                .map(|(a, b)| (a - b).powi(2))
                .sum::<f32>()
                .sqrt()
        });

    let embedding = tsne.embedding();
    let points: Vec<_> = embedding.chunks(NO_DIMS as usize).collect();
    assert_eq!(points.len(), samples.len());

    // convert results
    let mut vec = Vec::new();
    let mut row_index = 0;
    for row in rows.iter() {
        let point = points.get(row_index).unwrap();
        vec.push(PlotEntry {
            filename: row.filename.clone(),
            x: *point.get(0).unwrap(),
            y: *point.get(1).unwrap(),
            categories: row.categories.clone(),
            classes: row.classes.clone(),
        });
        row_index = row_index + 1;
    }

    Ok(vec)
}
