use super::super::{decode::AudioDecoder, error::Error};

// -------------------------------------------------------------------------------------------------

pub struct AudioFile {
    pub file_path: String,
    pub source: AudioDecoder,
    pub norm_factor: f32,
}

impl AudioFile {
    pub fn new(file_path: String) -> Result<AudioFile, Error> {
        let source = AudioDecoder::new(file_path.clone())?;
        let norm_factor = 1.0f32;
        Ok(AudioFile {
            file_path,
            source,
            norm_factor,
        })
    }
}
