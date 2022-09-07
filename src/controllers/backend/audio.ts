import * as path from '@tauri-apps/api/path'
import { invoke } from '@tauri-apps/api/tauri'
import { listen } from '@tauri-apps/api/event'

// -------------------------------------------------------------------------------------------------

// Unique file reference to identify played files 
export declare type FileId = number;

// -------------------------------------------------------------------------------------------------

// Initialize playback engine when the DOM loads
invoke<void>('initialize_audio')
  .catch(err => {
    console.error("Audio playback failed to initialize", err)
  });

// -------------------------------------------------------------------------------------------------

let playingFiles = new Map<FileId, String>();

// Ids and paths of currently playing back audio files, if any.
// See also \function addPlaybackPositionEventListener 
export function playingAudioFiles(): {id: FileId, path: String}[] {
  let ret = [];
  for (let e of playingFiles) {
    ret.push({id: e[0], path: e[1]})
  }
  return ret;
}

// -------------------------------------------------------------------------------------------------

// Play back a single audio file from a database. This stops all previously playing files.
export async function playAudioFile(dbPath: string, filePath: string): Promise<FileId> {
  let absPath = filePath;
  if (!await path.isAbsolute(absPath)) {
    absPath = await path.join(await path.dirname(dbPath), absPath);
  }
  // stop all playing files
  for (let id of playingFiles.keys()) {
    await invoke<void>('stop_audio_file', { fileId: id });
  }
  // start playback of the new file
  let fileId = await invoke<FileId>('play_audio_file', { filePath: absPath });
  playingFiles.set(fileId, filePath);
  return fileId;
}

// -------------------------------------------------------------------------------------------------

// register a new playback position change listener. returns a function to remove the listener again.
export interface PlaybackPositionEvent {
  file_id: FileId, 
  position: number 
};

export function addPlaybackPositionEventListener(
  listener: (event: PlaybackPositionEvent) => void
): () => void {
  const id = (uniqueListenerId += 1);
  playbackPositionListeners.push({id, func: listener});

  return () => {
    const index = playbackPositionListeners.findIndex(l => l.id === id);
    if (index !== -1) {
      playbackPositionListeners = playbackPositionListeners.splice(index, 1)
    }
  };
}

// register a new playback finished listener. returns a function to remove the listener again.
export interface PlaybackFinishedEvent {
  file_id: FileId 
};

export function addPlaybackFinishedEventListener(
  listener: (event: PlaybackFinishedEvent) => void
): () => void {
  const id = (uniqueListenerId += 1);
  playbackFinishedListeners.push({id, func: listener});

  return () => {
    const index = playbackFinishedListeners.findIndex(l => l.id === id);
    if (index !== -1) {
      playbackFinishedListeners = playbackFinishedListeners.splice(index, 1)
    }
  };
}

// private listener impls
let uniqueListenerId: number = 0;

let playbackPositionListeners = Array<{id: number, func: (event: PlaybackPositionEvent) => void}>();
let playbackFinishedListeners = Array<{id: number, func: (event: PlaybackFinishedEvent) => void}>();

// Receive playback status from backend and forward to listeners 
listen<PlaybackPositionEvent>("audio_playback_position", (event) => {
  playbackPositionListeners.forEach(l => l.func(event.payload));
});

listen<PlaybackFinishedEvent>("audio_playback_finished", (event) => {
  playingFiles.delete(event.payload.file_id);
  playbackFinishedListeners.forEach(l => l.func(event.payload));
});
