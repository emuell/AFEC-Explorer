import { invoke } from '@tauri-apps/api/tauri'
import * as path from '@tauri-apps/api/path'

// -------------------------------------------------------------------------------------------------

/*
  Initialize playback engine when the DOM loads
*/
invoke<void>('initialize_audio')
  .catch(err => {
    console.error("Audio playback failed to initialize", err)
  });

// -------------------------------------------------------------------------------------------------

/* 
  Play back a single audio file from a database. This stops all previously playing files.
 */

export async function playAudioFile(dbPath: string, filePath: string): Promise<void> {
  let absPath = filePath;
  if (absPath.startsWith("./") ||  !path.isAbsolute(absPath)) {
    absPath = await path.join(await path.dirname(dbPath), absPath);
  }
  return invoke<void>('play_audio_file', { filePath: absPath });
}
