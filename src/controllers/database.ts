import SQLite from 'tauri-plugin-sqlite-api'

import { File } from '../models/file';

// -------------------------------------------------------------------------------------------------

/* Opens and fetched items from an AFEC high-level database */

export class Database {

  // Open an AFEC database and check if it's valid
  async open(filename: string) {
    if (this._db) {
      await this.close();
    }

    this._db = await SQLite.open(filename);

    const classNameResult = await this._db.select(
      'SELECT classes FROM classes WHERE classifier="Classifiers"') as Array<any>;
    if (!classNameResult || !classNameResult.length) {
      throw new Error("Failed to read 'classes' from database. Is this a high-level AFEC db?")
    }
    this._classNames = JSON.parse(classNameResult[0]["classes"]) as Array<string>;

    const categoryNameResult = await this._db.select(
      'SELECT classes FROM classes WHERE classifier="OneShot-Categories"') as Array<any>;
    if (!categoryNameResult || !categoryNameResult.length) {
      throw new Error("Failed to read 'categories' from database. Is this a high-level AFEC db?")
    }
    this._categoryNames = JSON.parse(categoryNameResult[0]["classes"]) as Array<string>;
  }

  // Close a previously opened database 
  async close() {
    if (this._db) {
      await this._db.close();
    }
  }

  // class/category name access
  get classNames(): string[] {
    return this._classNames;
  }
  get categoryNames(): string[] {
    return this._categoryNames;
  }

  // Fetch all suceeded files from database
  async fetchFiles(rootPath: string): Promise<File[]> {
    if (! this._db) {
      throw new Error("Database is closed");
    }
  
    let filesResult: Array<any>;
    if (rootPath && rootPath != "/") {
      let validatedRootPath = rootPath;
      if (!validatedRootPath.startsWith("/")) {
        validatedRootPath = "/" + validatedRootPath;
      }
      if (!validatedRootPath.endsWith("/")) {
        validatedRootPath = validatedRootPath + "/";
      }
      filesResult = await this._db.select(
        'SELECT * FROM assets WHERE status="succeeded" AND ' + 
          '(filename LIKE ? OR filename LIKE ?)', [`.${validatedRootPath}%`, `${validatedRootPath}%`]);
    } 
    else {
      filesResult = await this._db.select(
        'SELECT * FROM assets WHERE status="succeeded"');
    }
 
    if (!filesResult) {
      throw new Error("Failed to read 'files' from database. Is this a high-level AFEC db?")
    }

    // convert JSON strings, if needed
    const files = filesResult.map(f => {
      for (const key of Object.keys(f)) {
        if (key.endsWith("_VR") || key.endsWith("_VVR") || 
            key.endsWith("_VS") ||key.endsWith("_VVS")) {
          const oldValue = f[key];
          if (! Array.isArray(oldValue)) {
            f[key] = JSON.parse(oldValue);
          }
        }
      }
      return f;
    }) as any as File[];

    return files;
  }
    
  private _db?: SQLite = undefined;
  private _classNames: string[] = [];
  private _categoryNames: string[] = [];
}
