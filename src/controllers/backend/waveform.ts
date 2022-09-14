import { path } from '@tauri-apps/api';
import { invoke } from '@tauri-apps/api/tauri'

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

export async function generateWaveform(dbPath: string, filePath: string, resolution: number) {
  let absPath = filePath;
  if (!await path.isAbsolute(absPath)) {
    absPath = await path.join(await path.dirname(dbPath), absPath);
  }
  return invoke<WaveformPoint[]>('generate_waveform', { filePath: absPath, resolution: Math.round(resolution) });
}

