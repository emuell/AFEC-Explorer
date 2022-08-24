import * as mobx from 'mobx';

import { Database } from './controllers/database';

import { File } from './models/file';

import { createPlot, PlotEntry } from './controllers/backend/plot';
import { isRunningInTauriDev } from './controllers/tools';

// -------------------------------------------------------------------------------------------------

/*!
 * Global application state and controller
!*/

class AppState {

  // database
  @mobx.observable
  databasePath: string = "";
  
  @mobx.observable
  databaseError: string = "";
  
  @mobx.observable
  isLoadingDatabase: number = 0;

  @mobx.observable
  isLoadingFiles: number = 0;

  // map generation
  @mobx.observable
  isGeneratingMap: number = 0;
  
  @mobx.observable
  mapEpochs: number = isRunningInTauriDev() ? 100 : 1000;

  @mobx.observable
  mapPerplexity: number = 10;

  @mobx.observable
  mapTheta: number = 0.5;

  // audio playback
  @mobx.observable
  autoPlayFiles: boolean = true;
  
  // initialize app state
  constructor() {
    mobx.makeObservable(this);
  }

  // open a new database
  @mobx.action
  async openDatabase(filename: string): Promise<void> {
    ++this.isLoadingDatabase;
    try {
      await this._database.open(filename);
      this.databasePath = filename;
      this.databaseError = "";
    }
    catch (err) {
      this.databasePath = filename;
      this.databaseError = (err as any).message || String(err);
      throw err;
    } 
    finally {
      --this.isLoadingDatabase; 
    }
  }

  // access class names from the currently database
  get databaseClassNames(): string[]{
    return this._database.classNames;
  } 

  // access category names from the currently database
  get databaseCategoryNames(): string[]{
    return this._database.categoryNames;
  } 

  // fetch files at \param rootPath
  @mobx.action
  async fetchFiles(rootPath: string): Promise<File[]> {
    ++this.isLoadingFiles;
    try {
      return await this._database.fetchFiles(rootPath);
    }
    finally {
      --this.isLoadingFiles; 
    }
  }

  // generatre plot for the given database
  @mobx.action
  async generateMap(): Promise<PlotEntry[]> {
    
    ++this.isGeneratingMap;
    try {
      return await createPlot(this.databasePath, this.mapPerplexity, this.mapTheta, this.mapEpochs);
    }
    finally {
      --this.isGeneratingMap; 
    }
  }

  private _database = new Database();
}

// -------------------------------------------------------------------------------------------------

export const appState = new AppState();
