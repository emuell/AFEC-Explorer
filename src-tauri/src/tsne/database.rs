use serde_json;
use sqlite::Connection;

#[derive(Debug, Default)]
pub struct TsneFeatureRow {
    pub filename: String,
    pub data: Vec<f32>,
    pub classes: Vec<String>,
    pub categories: Vec<String>,
}

pub fn get_tsne_features(path: String) -> Result<Vec<TsneFeatureRow>, Box<dyn std::error::Error>> {
    let connection = Connection::open(&path)?;
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
    let statement = connection.prepare(&sql)?;
    let column_count = statement.column_count();
    assert_eq!(column_names.len(), column_count);

    let mut cursor = statement.into_cursor();
    let mut result: Vec<TsneFeatureRow> = Vec::new();

    while let Some(row) = cursor.next()? {
        let mut feature_row = TsneFeatureRow::default();
        for i in 0..column_count {
            let column_name = *column_names.get(i).unwrap();
            let value = row
                .get(i)
                .ok_or_else(|| format!("Failed to fetch column '{}' value", column_name))?;
            let value_string = value.as_string().ok_or_else(|| {
                format!("Failed to convert column '{}' string value", column_name)
            })?;
            match column_name {
                "filename" => feature_row.filename = value_string.to_string(),
                "classes_VS" => feature_row.classes = serde_json::from_str(value_string)?,
                "categories_VS" => feature_row.categories = serde_json::from_str(value_string)?,
                "class_signature_VR" | "category_signature_VR" => {
                    let mut array: Vec<f32> = serde_json::from_str(value_string)?;
                    feature_row.data.append(&mut array);
                }
                _ => {
                    return Err(format!("Unexpected column name {}", column_name).into());
                }
            };
        }
        result.push(feature_row);
    }

    Ok(result)
}
