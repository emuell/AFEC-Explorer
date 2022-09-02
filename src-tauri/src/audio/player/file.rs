use crate::audio::error::Error;
use crate::audio::source::decoder::AudioDecoder;

// -------------------------------------------------------------------------------------------------

pub struct AudioPlayerFile {
    pub file_path: String,
    pub source: AudioDecoder,
    pub norm_factor: f32,
}

impl AudioPlayerFile {
    pub fn new(file_path: String) -> Result<AudioPlayerFile, Error> {
        let source = AudioDecoder::new(file_path.clone())?;
        let norm_factor = 1.0f32;
        Ok(AudioPlayerFile {
            file_path,
            source,
            norm_factor,
        })
    }
}
