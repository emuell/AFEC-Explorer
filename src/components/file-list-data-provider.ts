import {
  GridDataProviderCallback, GridDataProviderParams, GridSorterDefinition
} from '@vaadin/grid';

import { File } from '../models/file';

// -------------------------------------------------------------------------------------------------

// column sorting helper functions, shamelessly copied from @vaadin-grid/array-data-provider.js

function normalizeEmptyValue(value: any): any {
  if ([undefined, null].includes(value)) {
    return '';
  } else if (isNaN(value)) {
    return value.toString();
  }
  return value;
}

function getValue(path: string, object: any): any {
  return path.split('.').reduce((obj, property) => obj[property], object);
}

function compare(a: any, b: any): number {
  a = normalizeEmptyValue(a);
  b = normalizeEmptyValue(b);
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
}

// -------------------------------------------------------------------------------------------------

// Vaadin grid compatible data provider for Files.
// Applies custom sorting and caches already sorted files to speed up paged access from the grid.

export class FileListDataProvider {

  private _files: File[] = [];
  private _sortedFiles: File[] = [];
  private _sortedFilesOrder?: GridSorterDefinition = undefined;

  constructor() {
    // bind this to the callback
    this.provider = this.provider.bind(this);
  }

  // get actual raw, unsorted file list
  get files(): File[] {
    return this._files;
  }

  // set a new file list
  set files(files: File[]) {
    this._files = files;
    // force recalculating caches
    this._sortedFiles = [];
    this._sortedFilesOrder = undefined;
  }

  // the actual grids data provider callback
  provider(
    params: GridDataProviderParams<File>,
    callback: GridDataProviderCallback<File>
  ) {
    const items = this._getSortedFiles(params);
    const count = Math.min(items.length, params.pageSize);
    const start = params.page * count;
    const end = start + count;
    if (start !== 0 || end !== items.length) {
      callback(items.slice(start, end), items.length);
    } else {
      callback(items, items.length);
    }
  }

  // sort files or get already sorted files from cache
  private _getSortedFiles(params: GridDataProviderParams<File>): File[] {
    // get sort order (multi sorting not supported ATM)
    let sortOrder: GridSorterDefinition = {
      path: "name",
      direction: "asc"
    };
    if (params.sortOrders && params.sortOrders.length) {
      if (params.sortOrders[0].direction) {
        sortOrder = params.sortOrders[0];
      }
    }
    // return cached values if the sort order did not change
    if (this._sortedFilesOrder &&
      this._sortedFilesOrder.direction === sortOrder.direction &&
      this._sortedFilesOrder.path === sortOrder.path) {
      return this._sortedFiles;
    }
    // get items from files and apply our customized sorting
    this._sortedFilesOrder = sortOrder;
    this._sortedFiles = Array.from(this._files);
    this._sortedFiles.sort((a: File, b: File) => {
      // keep directories at top or bottom when sorting by name
      if (sortOrder.path === "name") {
        // and do a "natural" sort on names
        const options = { numeric: true, sensitivity: "base" };
        if (sortOrder.direction === 'asc') {
          return a.filename.localeCompare(b.filename, undefined, options);
        } else {
          return b.filename.localeCompare(a.filename, undefined, options);
        }
      } else {
        // apply custom sorting 
        if (sortOrder.direction === 'asc') {
          return compare(getValue(sortOrder.path, a), getValue(sortOrder.path, b));
        } else {
          return compare(getValue(sortOrder.path, b), getValue(sortOrder.path, a));
        }
      }
    });
    return this._sortedFiles;
  }
}
