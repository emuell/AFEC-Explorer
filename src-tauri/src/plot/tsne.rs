use super::database;
use rstats::Vecg;
use string_error::*;

// -------------------------------------------------------------------------------------------------

// Description of a single AFEC sample row in the t-SNE plot
#[derive(serde::Serialize, Debug, Default)]
pub struct PlotEntry {
    filename: Box<str>,
    x: f32,
    y: f32,
    categories: Vec<Box<str>>,
    classes: Vec<Box<str>>,
}

// -------------------------------------------------------------------------------------------------

pub fn create_plot(
    db_path: String,
    theta: f32,
    perplexity: f32,
    epochs: usize,
) -> Result<Vec<PlotEntry>, Box<dyn std::error::Error>> {
    log::info!("Creating t-SNE plot for db: {db_path} theta: {theta} perplexity: {perplexity} epochs: {epochs}");

    // validate args
    if !(0.0..1.0).contains(&theta) {
        return Err(into_err(format!(
            "Invalid TSNE arg: 'theta' must be in (0, 1)): {}",
            theta
        )));
    }
    if !(5.0..=50.0).contains(&perplexity) {
        return Err(into_err(format!(
            "Invalid TSNE arg: 'perplexity' must be in [5, 50]): {}",
            perplexity
        )));
    }
    if !(1..=10_000).contains(&epochs) {
        return Err(into_err(format!(
            "Invalid TSNE arg: 'epochs' must be in [1, 10000] {}",
            epochs
        )));
    }

    // read database input
    let mut rows = database::get_tsne_features(db_path)?;
    if rows.is_empty() {
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

    // avoid that bhtsne panics: see check_perplexity in mod.rs
    if samples.len() as f32 - 1.0 < 3.0 * perplexity {
        return Err(new_err("Can't generate map: too litte samples"));
    }

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
    let mut vec = Vec::with_capacity(rows.len());
    for point in points {
        // pop row entry, so the compiler can reuse/move existing row values
        let row = rows.pop_front().unwrap();
        vec.push(PlotEntry {
            filename: row.filename,
            x: point[0],
            y: point[1],
            categories: row.categories,
            classes: row.classes,
        });
    }

    Ok(vec)
}
