import { invoke } from '@tauri-apps/api/tauri'

// -------------------------------------------------------------------------------------------------

/* 
  Result for a single entry of an AFEC high level database tSNE map 
  struct PlotEntry in `src-tauri/plot`
 */

export interface PlotEntry {
  filename: string,
  x: number,
  y: number,
  categories: Array<string>,
  classes: Array<string> 
}

// -------------------------------------------------------------------------------------------------

/* 
  Calculate TSNE plot of an AFEC high level database tSNE map 
  fn create_plot `src-tauri/plot`
 */

export function createPlot(dbPath: string, perplexity: number, theta: number, epochs: number) {
  return invoke<PlotEntry[]>('create_plot', { dbPath, perplexity, theta, epochs });
}
