import { invoke } from '@tauri-apps/api/core';
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
export function playingAudioFiles(): { id: FileId, path: String }[] {
  let ret = [];
  for (let [id, path] of playingFiles) {
    ret.push({ id, path })
  }
  return ret;
}

// -------------------------------------------------------------------------------------------------

// Play back a single audio file. This stops all previously playing files.
export async function playAudioFile(filePath: string): Promise<FileId> {
  // stop all playing files
  for (let id of Array.from(playingFiles.keys())) {
    try {
      await invoke<void>('stop_audio_file', { fileId: id });
    } catch (err) {
      // file maybe already got stopped without a proper notification
      playingFiles.delete(id);
      console.error('Failed to stop audio file {id}', err);
    }
  }
  // start playback of the new file
  let fileId = await invoke<FileId>('play_audio_file', { filePath: filePath });
  playingFiles.set(fileId, filePath);
  return fileId;
}

// -------------------------------------------------------------------------------------------------

// register a new playback position change listener. returns a function to remove the listener again.
export interface PlaybackPositionEvent {
  fileId: FileId,
  filePath: string,
  position: number
};

export function addPlaybackPositionEventListener(
  listener: (event: PlaybackPositionEvent) => void
): () => void {
  const id = (uniqueListenerId += 1);
  playbackPositionListeners.push({ id, func: listener });

  return () => {
    const index = playbackPositionListeners.findIndex(l => l.id === id);
    if (index !== -1) {
      playbackPositionListeners = playbackPositionListeners.splice(index, 1)
    }
  };
}

// register a new playback finished listener. returns a function to remove the listener again.
export interface PlaybackFinishedEvent {
  fileId: FileId,
  filePath: string,
};

export function addPlaybackFinishedEventListener(
  listener: (event: PlaybackFinishedEvent) => void
): () => void {
  const id = (uniqueListenerId += 1);
  playbackFinishedListeners.push({ id, func: listener });

  return () => {
    const index = playbackFinishedListeners.findIndex(l => l.id === id);
    if (index !== -1) {
      playbackFinishedListeners = playbackFinishedListeners.splice(index, 1)
    }
  };
}

// private listener impls
let uniqueListenerId: number = 0;

let playbackPositionListeners = Array<{ id: number, func: (event: PlaybackPositionEvent) => void }>();
let playbackFinishedListeners = Array<{ id: number, func: (event: PlaybackFinishedEvent) => void }>();

// Receive playback status from backend and forward to listeners 
listen<PlaybackPositionEvent>("audio_playback_position", (event) => {
  playbackPositionListeners.forEach(l => l.func(event.payload));
});

listen<PlaybackFinishedEvent>("audio_playback_finished", (event) => {
  playingFiles.delete(event.payload.fileId);
  playbackFinishedListeners.forEach(l => l.func(event.payload));
});
