pub mod cpal;
pub type DefaultAudioOutput = cpal::CpalOutput;

// OR pub mod cubeb;
// pub type DefaultAudioOutput = cubeb::CubebOutput;

pub type DefaultAudioSink = <DefaultAudioOutput as AudioOutput>::Sink;
use crate::audio::player::source::AudioSource;

// -------------------------------------------------------------------------------------------------

pub trait AudioSink {
    fn channel_count(&self) -> usize;
    fn sample_rate(&self) -> u32;
    fn set_volume(&self, volume: f32);
    fn play(&self, source: impl AudioSource);
    fn pause(&self);
    fn resume(&self);
    fn stop(&self);
    fn close(&self);
}

// -------------------------------------------------------------------------------------------------

pub trait AudioOutput {
    type Sink: AudioSink;
    fn sink(&self) -> Self::Sink;
}
