import { invoke } from '@tauri-apps/api/core';

// -------------------------------------------------------------------------------------------------

/* 
  Single point in the generated waveform data.
  struct WaveformPoint in `src-tauri/waveform`
 */

export interface WaveformPoint {
  time: number,
  min: number,
  max: number,
}

// -------------------------------------------------------------------------------------------------

/* 
  Calculate mono waveform data for the given file. 
  fn generate_waveform `src-tauri/waveform`
 */

export async function generateWaveform(filePath: string, resolution: number) {
  return invoke<WaveformPoint[]>('generate_waveform', { filePath: filePath, resolution: Math.round(resolution) });
}

