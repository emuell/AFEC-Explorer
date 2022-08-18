use super::database;
use bhtsne;
use rstats::Vecg;

#[derive(serde::Serialize, Debug, Default)]
pub struct PlotEntry {
    filename: String,
    x: f32,
    y: f32,
    categories: Vec<String>,
    classes: Vec<String>,
}

#[tauri::command]
pub async fn create_plot(
    db_path: String,
    theta: f32,
    perplexity: f32,
    epochs: usize,
) -> Result<Vec<PlotEntry>, String> {
    // validate args
    if theta <= 0.0 || theta > 1.0 {
        return Err(format!(
            "Invalid TSNE arg: 'theta' must be in (0, 1]): {}",
            theta
        ));
    }
    if perplexity < 5.0 || perplexity > 50.0 {
        return Err(format!(
            "Invalid TSNE arg: 'perplexity' must be in [5, 50]): {}",
            perplexity
        ));
    }
    if epochs <= 0 {
        return Err(format!(
            "Invalid TSNE arg: 'epochs' must be > 0: {}",
            epochs
        ));
    }
    // read database input
    let rows = database::get_tsne_features(db_path).map_err(|e| e.to_string())?;
    if rows.len() == 0 {
        return Ok(vec![]);
    }

    // convert to 2d float array
    let mut samples: Vec<&[f32]> = Vec::with_capacity(rows.len());
    for row in rows.iter() {
        samples.push(&row.data);
    }

    // run tsne
    const NO_DIMS: u8 = 2;

    // let metric = <&[f32]>::cityblockd::<f32>;
    let metric = <&[f32]>::vdistsq::<f32>;

    let mut tsne = bhtsne::tSNE::new(&samples);
    tsne.embedding_dim(NO_DIMS)
        .perplexity(perplexity)
        .epochs(epochs)
        .barnes_hut(theta, |sample_a, sample_b| {
            metric(sample_a, sample_b) as f32
        });

    let embedding = tsne.embedding();
    let points = embedding.chunks_exact(usize::from(NO_DIMS));
    assert_eq!(points.len(), rows.len());

    // convert results
    let mut vec = Vec::new();
    let mut row_index = 0;
    for point in points {
        let row = rows.get(row_index).unwrap();
        vec.push(PlotEntry {
            filename: row.filename.clone(),
            x: point[0],
            y: point[1],
            categories: row.categories.clone(),
            classes: row.classes.clone(),
        });
        row_index = row_index + 1;
    }

    Ok(vec)
}
