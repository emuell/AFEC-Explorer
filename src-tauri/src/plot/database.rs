use std::collections::VecDeque;

use anyhow::anyhow;
use sqlx::{query, sqlite::SqlitePool, Row};

// -------------------------------------------------------------------------------------------------

// Features pulled from the AFEC database in order to create a t-SNE plot
#[derive(Debug, Default)]
pub struct TsneFeatureRow {
    pub filename: Box<str>,
    pub data: Vec<f32>,
    pub classes: Vec<Box<str>>,
    pub categories: Vec<Box<str>>,
}

// -------------------------------------------------------------------------------------------------

pub async fn get_tsne_features(path: String) -> anyhow::Result<VecDeque<TsneFeatureRow>> {
    let pool = SqlitePool::connect(&path).await?;
    let column_names = [
        "filename",
        "classes_VS",
        "categories_VS",
        "class_signature_VR",
        "category_signature_VR",
    ];
    let sql = format!(
        "SELECT {} FROM assets WHERE status=\"succeeded\"",
        &column_names.join(",")
    );

    let rows = query(&sql).fetch_all(&pool).await?;
    let mut result = VecDeque::with_capacity(rows.len());

    for row in rows {
        let mut feature_row = TsneFeatureRow::default();
        for (i, column_name) in column_names.iter().enumerate() {
            let value: String = row
                .try_get(i)
                .map_err(|_| anyhow!("Failed to fetch column '{}' value", column_name))?;
            match *column_name {
                "filename" => feature_row.filename = Box::from(value),
                "classes_VS" => feature_row.classes = serde_json::from_str(&value)?,
                "categories_VS" => feature_row.categories = serde_json::from_str(&value)?,
                "class_signature_VR" | "category_signature_VR" => {
                    let mut array: Vec<f32> = serde_json::from_str(&value)?;
                    feature_row.data.append(&mut array);
                }
                _ => {
                    return Err(anyhow!("Unexpected column name {}", column_name));
                }
            };
        }
        result.push_back(feature_row);
    }

    Ok(result)
}
