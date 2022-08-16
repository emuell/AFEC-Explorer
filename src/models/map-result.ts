// -------------------------------------------------------------------------------------------------

/* 
  Result for a single entry of an AFEC high level database tSNE map 
  To be kept in sync with struct PlotEntry in `src-tauri/plot`
 */

export interface MapResult {
  filename: String,
  x: number,
  y: number,
  categories: Array<string>,
  classes: Array<string> 
}