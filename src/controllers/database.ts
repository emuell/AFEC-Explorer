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
  async fetchFiles(searchString: string): Promise<File[]> {
    if (! this._db) {
      throw new Error("Database is closed");
    }
 
    const searchWords = searchString.split(' ').filter(v => v.length > 0);

    let sql = 'SELECT * FROM assets WHERE status="succeeded"';
    let values: any[] = []; 
    
    // add filename matches, if may
    if (searchWords.length) {
      sql += " AND " + searchWords
        .map(_ => `filename LIKE ?`)
        .join(" AND ");
      values = searchWords.map(v => `%${v}%`);
    }

    // fetch results in batches to avoid allocating too much memory in the IPC conversion
    const batchSize = 1000;
    let batchOffset = 0;

    let filesResult: any[] | undefined = undefined;
    do {
      const batchResult = await this._db.select<any>(
        `${sql} LIMIT ${batchSize} OFFSET ${batchOffset}`, values);
      if (! batchResult || ! batchResult.length) {
        break;
      }
      filesResult = filesResult || [];
      filesResult.push(...batchResult)
      batchOffset += batchSize;
    } while (true)
    
    if (!filesResult) {
      throw new Error("Failed to read 'files' from database. Is this a high-level AFEC db?")
    }

    // convert JSON data, if needed
    filesResult.forEach(f => {
      for (const key of Object.keys(f)) {
        if (key.endsWith("_VR") || key.endsWith("_VVR") || 
            key.endsWith("_VS") ||key.endsWith("_VVS")) {
          const oldValue = f[key];
          if (! Array.isArray(oldValue)) {
            f[key] = JSON.parse(oldValue);
          }
        }
      }
    });

    return filesResult as File[];
  }
    
  private _db?: SQLite = undefined;
  private _classNames: string[] = [];
  private _categoryNames: string[] = [];
}
