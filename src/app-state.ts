import * as mobx from 'mobx';

import { Database } from './controllers/database';
import { File } from './models/file';

// -------------------------------------------------------------------------------------------------

/*!
 * Global application state and controller
!*/

class AppState {

  // repository setup
  @mobx.observable
  databasePath: string = "";

  @mobx.observable
  databaseError: string = "";

  @mobx.observable
  isLoadingDatabase: number = 0;

  @mobx.observable
  isLoadingFiles: number = 0;

  @mobx.observable
  isGeneratingMap: number = 0;

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

  private _database = new Database();
}

// -------------------------------------------------------------------------------------------------

export const appState = new AppState();
