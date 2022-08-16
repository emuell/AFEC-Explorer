use serde_json;
use sqlite::Connection;

#[derive(Debug, Default)]
pub struct TsneFeatureRow {
    pub filename: String,
    pub data: Vec<f32>,
    pub classes: Vec<String>,
    pub categories: Vec<String>,
}

pub fn get_tsne_data(path: String) -> Result<Vec<TsneFeatureRow>, sqlite::Error> {
    let connection = Connection::open(&path)?;
    let columns = vec![
        "filename",
        "classes_VS",
        "categories_VS",
        "class_signature_VR",
        "category_signature_VR",
    ];
    let sql =
        "SELECT ".to_string() + &columns.join(",") + " FROM assets WHERE status=\"succeeded\"";
    let statement = connection.prepare(&sql)?;

    let mut column_names: Vec<String> = Vec::new();
    for name in statement.column_names() {
        column_names.push(name.to_string());
    }

    let mut cursor = statement.into_cursor();
    let mut result: Vec<TsneFeatureRow> = Vec::new();

    while let Some(row) = cursor.next()? {
        let mut feature_row = TsneFeatureRow::default();
        for (i, name) in column_names.iter().enumerate() {
            let value = row.get(i).unwrap();
            let value_string = value.as_string().unwrap();
            match name.as_str() {
                "filename" => feature_row.filename = value_string.to_string(),
                "classes_VS" => feature_row.classes = serde_json::from_str(value_string).unwrap(),
                "categories_VS" => {
                    feature_row.categories = serde_json::from_str(value_string).unwrap()
                }
                "class_signature_VR" => {
                    let mut array: Vec<f32> = serde_json::from_str(value_string).unwrap();
                    feature_row.data.append(&mut array);
                }
                "category_signature_VR" => {
                    let mut array: Vec<f32> = serde_json::from_str(value_string).unwrap();
                    feature_row.data.append(&mut array);
                }
                &_ => {
                    return Err(sqlite::Error {
                        code: None,
                        message: Some(format!("Unexpected column name {}", name)),
                    });
                }
            };
        }
        result.push(feature_row);
    }

    Ok(result)
}
