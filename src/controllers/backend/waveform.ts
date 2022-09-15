import { invoke } from '@tauri-apps/api/tauri'
import path from 'path-browserify';

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
  let absPath = path.normalize(filePath.replace(/\\/g, "/"));
  if (! path.isAbsolute(absPath)) {
    let dirname = path.dirname(dbPath.replace(/\\/g, "/"));
    absPath = path.join(dirname, absPath);
  } 
  return invoke<WaveformPoint[]>('generate_waveform', { filePath: absPath, resolution: Math.round(resolution) });
}

