use std::{error, fmt, io};

// -------------------------------------------------------------------------------------------------

#[derive(Debug)]
pub enum Error {
    MediaFileNotFound,
    MediaFileProbeError,
    MediaFileSeekError,
    AudioDecodingError(Box<dyn error::Error + Send>),
    AudioOutputError(Box<dyn error::Error + Send>),
    ResamplingError(i32),
    IoError(io::Error),
    SendError,
}

impl error::Error for Error {}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::MediaFileNotFound => write!(f, "Audio file not found"),
            Self::MediaFileProbeError => write!(f, "Audio file failed to probe"),
            Self::MediaFileSeekError => write!(f, "Audio file failed to seek"),
            Self::ResamplingError(code) => {
                write!(f, "Resampling failed with error code {}", code)
            }
            Self::AudioDecodingError(err) | Self::AudioOutputError(err) => err.fmt(f),
            Self::IoError(err) => err.fmt(f),
            Self::SendError => write!(f, "Failed to send into a channel"),
        }
    }
}

impl From<io::Error> for Error {
    fn from(err: io::Error) -> Error {
        Error::IoError(err)
    }
}

impl<T> From<crossbeam_channel::SendError<T>> for Error {
    fn from(_: crossbeam_channel::SendError<T>) -> Self {
        Error::SendError
    }
}
