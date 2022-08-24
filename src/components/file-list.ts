import { css, html, PropertyValues, render } from 'lit'
import { customElement, query, state } from 'lit/decorators.js'
import { MobxLitElement } from '@adobe/lit-mobx';
import * as mobx from 'mobx'
import prettyBytes from 'pretty-bytes';

import { 
  Grid, GridActiveItemChangedEvent, GridColumn, GridItemModel
} from '@vaadin/grid';

import { appState } from '../app-state';
import { File } from '../models/file';
import { playAudioFile } from '../controllers/backend/audio';

import { FileListDataProvider } from './file-list-data-provider';
import './error-message';
import './spinner';

import '@vaadin/grid';
import '@vaadin/grid/vaadin-grid-sort-column.js';
import '@vaadin/text-field';
import '@vaadin/button';
import '@vaadin/notification';

// -------------------------------------------------------------------------------------------------
 
// File list / table.

@customElement('afec-file-list')
export class FileList extends MobxLitElement {
  
  @mobx.observable
  private _searchString: string = "";
  
  // NB: not a state or observable: data-provider update is manually triggered 
  private _dataProvider = new FileListDataProvider();

  @state()
  private _fetchError: string = "";

  @state() 
  private _selectedFiles: File[] = [];  
  private _selectedItemsClicked = new Set<string>();

  @query("#grid")
  private _grid!: Grid<File> | null;
  private _recalculateColumnWidths: boolean = false;

  constructor() {
    super();
    mobx.makeObservable(this);

    // fetch file list on repo path, snapshot or root dir changes
    mobx.reaction(
      () => appState.databasePath,
      () => this._fetchFiles(),
      { fireImmediately: true }
    );
    mobx.reaction(
      () => this._searchString,
      () => this._fetchFiles(),
      { fireImmediately: false, delay: 1500 }
    );

    // bind context for renderers which are using this
    this._actionRenderer = this._actionRenderer.bind(this);
  }

  private _playFile(file: File) {
    playAudioFile(appState.databasePath, file.filename)
      .catch(err => {
        console.warn("Audio playback error: %s", err.message || String(err))
      });
  }

  private _fetchFiles() {
    if (! appState.databasePath) {
      this._fetchError = "No database selected";
      this._selectedFiles = [];
      this._dataProvider.files = [];
      return;
    }
    appState.fetchFiles(this._searchString)
      .then((files) => {
        // assign and request data provider update
        this._selectedFiles = [];
        this._dataProvider.files = files;
        if (this._grid) {
          this._grid.clearCache();
        }
        // request auto column width update
        this._recalculateColumnWidths = true;
        // reset fetch errors - if any
        this._fetchError = "";
      })
      .catch((error) => {
        this._fetchError = error.message || String(error);
        this._selectedFiles = [];
        this._dataProvider.files = [];
      })
  }

  private _activeItemChanged(e: GridActiveItemChangedEvent<File>) {
    const item = e.detail.value;
    // don't deselect selected itesm
    if (item) {
      this._selectedFiles = [item];
    }
    // double click handling
    const doubleClickItem = this._selectedFiles.length ?
      this._selectedFiles[0] : undefined;
    if (doubleClickItem) {
      this._selectedItemsClicked.add(doubleClickItem.filename);
      setTimeout(() => {
        this._selectedItemsClicked.delete(doubleClickItem.filename);
      }, 500);
    }
  }

  private _actionRenderer(
    root: HTMLElement, 
    _column: GridColumn<File>, 
    model: GridItemModel<File>
  ) {
    render(html`
        <vaadin-button theme="small secondary icon" style="height: 1.5rem; margin: unset;padding: 0;" 
            @click=${() => this._playFile(model.item)}>
          <vaadin-icon icon="lumo:play"></vaadin-icon>
        </vaadin-button>
      `, root)
  }
 
  private _nameRenderer(
    root: HTMLElement, 
    _column: GridColumn<File>, 
    model: GridItemModel<File>
  ) {
    let name = model.item.filename;
    if (name.startsWith("./")) {
      name = name.substring(2);
    }
    render(html`${name}`, root);
  }
  
  private _classNameRenderer(
    root: HTMLElement, 
    _column: GridColumn<File>, 
    model: GridItemModel<File>
  ) {
    const classNames = model.item.classes_VS;
    if (!classNames.length) {
      render(html`-`, root);
      return;
    }
    render(html`${classNames.join(",")}`, root);
  }
  
  private _categoryNameRenderer(
    root: HTMLElement, 
    _column: GridColumn<File>, 
    model: GridItemModel<File>
  ) {
    const categoryNames = model.item.categories_VS;
    if (!categoryNames.length) {
      render(html`-`, root);
      return;
    }
    const nameFilter = (v: string) => {
      if (v.startsWith("Perc ")) {
        return v.substring("Perc ".length)
      } else if (v.startsWith("Tone ")) {
        return v.substring("Tone ".length)
      }
      return v;
    }
    render(html`${categoryNames.map(nameFilter).join(",")}`, root);
  }
  
  private _timeRenderer(
    root: HTMLElement, 
    column: GridColumn<File>, 
    model: GridItemModel<File>
  ) {
    const timestamp = (model.item as any)[column.path as string] as number;
    const date = new Date(timestamp * 1000);
    const timeString = date.getDate()+
      "/"+(date.getMonth()+1)+
      "/"+date.getFullYear()+
      " "+date.getHours()+
      ":"+date.getMinutes()+
      ":"+date.getSeconds();
    render(html`${timeString}`, root);
  }

  private _sizeRenderer(
    root: HTMLElement, 
    column: GridColumn<File>, 
    model: GridItemModel<File>
  ) {
    const bytes = (model.item as any)[column.path as string] as number;
    render(html`${prettyBytes(bytes)}`, root);
  }
 
  private _lengthRenderer(
    root: HTMLElement, 
    column: GridColumn<File>, 
    model: GridItemModel<File>
  ) {
    const time = (model.item as any)[column.path as string] as number;
    const hours = Math.floor(time / 60 / 60);
    const minutes = Math.floor(time / 60) % 60;
    const seconds = Math.floor(time - minutes * 60);
    const milliseconds = String(time).slice(-3);
    
    const pad = function(num: number | string, size: number) { 
      return ('000' + num).slice(size * -1); 
    };
    const duration = pad(minutes + hours * 60, 2) + ':' + 
      pad(seconds, 2) + '.' + pad(milliseconds, 3);

    render(html`${duration}`, root);
  }

  private _percentageRenderer(
    root: HTMLElement, 
    column: GridColumn<File>, 
    model: GridItemModel<File>
  ) {
    const value = (model.item as any)[column.path as string] as number;
    render(html`${Math.round(value * 100) + "%"}`, root);
  }
  
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
    }
    #header {
      align-items: center; 
      background: var(--lumo-shade-10pct);
      padding: 4px;
    }
    #header #title {
      flex: 0;
      margin: 0px 10px;
      padding: 4px 0px;
     }
    #header #searchString {
      padding: unset;
      margin-left: auto;
      margin-right: 4px;
      width: 50%;
    }
    #error {
      height: 75%;
    }
    #loading {
      height: 100%; 
      align-items: center;
      justify-content: center;
    }
    #grid {
      height: unset;
      flex: 1;
      margin: 0px 8px;
    }
  `;

  updated(changedProperties: PropertyValues) {
    super.updated(changedProperties);
    // apply auto column width updates after content got rendered
    if (this._recalculateColumnWidths) {
      this._recalculateColumnWidths = false;
      if (this._grid) {
        this._grid.recalculateColumnWidths();
      }
    }
  }

  render() {
    const header = html`
      <vaadin-horizontal-layout id="header">
        <strong id="title">FILES</strong>
        <vaadin-text-field 
          id="searchString"
          theme="small"
          placeholder="Search"
          clearButtonVisible
          value=${this._searchString}
          .disabled=${appState.isLoadingFiles > 0} 
          .hidden=${! appState.databasePath}
          @input=${mobx.action((event: CustomEvent) => {
            this._searchString = (event.target as HTMLInputElement).value; 
          })} 
          clear-button-visible
        >
        </vaadin-text-field>
      </vaadin-horizontal-layout>
    `;
    // error
    if (this._fetchError && appState.isLoadingFiles === 0) {
      let errorMessage = this._fetchError;
      if (appState.databasePath) {
       errorMessage = "Failed to fetch files: " + errorMessage;
      }
      return html`
        ${header}
        <afec-error-message
          id="error" 
          type=${appState.databasePath ? "error" : "info"}
          message=${errorMessage}>
        </afec-error-message>
      `;
    }
    // loading
    if (appState.isLoadingFiles > 0) {
      return html`
        ${header}
        <vaadin-horizontal-layout id="loading">
          <afec-spinner size="24px"></afec-spinner>
        </vaadin-horizontal-layout>
      `;
    }
    // grid
    return html`
      ${header}
      <vaadin-grid
        id="grid"
        theme="compact no-border small" 
        .dataProvider=${this._dataProvider.provider}
        .selectedItems=${this._selectedFiles}
        @active-item-changed=${this._activeItemChanged}
      >
        <vaadin-grid-column .flexGrow=${0} .width=${"2.65rem"} path="path" header="" frozen
          .renderer=${this._actionRenderer}></vaadin-grid-column>
          <vaadin-grid-sort-column .flexGrow=${2} .width=${"12rem"} path="name" direction="asc" frozen resizable
          .renderer=${this._nameRenderer}></vaadin-grid-sort-column>
        ${/*<vaadin-grid-sort-column .flexGrow=${0} .width=${"4rem"} path="file_type_S" header="Type">
          </vaadin-grid-sort-column>*/null}
        <vaadin-grid-sort-column .flexGrow=${0} .width=${"6rem"} path="classes_VS" header="Class"
          .renderer=${this._classNameRenderer}></vaadin-grid-sort-column>
        <vaadin-grid-sort-column .flexGrow=${0} .width=${"10rem"} path="categories_VS" header="Category"
          .renderer=${this._categoryNameRenderer}></vaadin-grid-sort-column>
        <vaadin-grid-sort-column .flexGrow=${0} .width=${"10rem"} path="modtime" header="Modified"
          .renderer=${this._timeRenderer}></vaadin-grid-sort-column>
        <vaadin-grid-sort-column .flexGrow=${0} .width=${"6rem"} path="file_size_R" header="Size"
          .renderer=${this._sizeRenderer}></vaadin-grid-sort-column>
        <vaadin-grid-sort-column .flexGrow=${0} .width=${"6rem"} path="file_length_R" header="Length"
          .renderer=${this._lengthRenderer}>
          </vaadin-grid-sort-column>
        <vaadin-grid-sort-column .flexGrow=${0} .width=${"4rem"} path="file_sample_rate_R" header="Rate">
          </vaadin-grid-sort-column>
        <vaadin-grid-sort-column .flexGrow=${0} .width=${"4rem"} path="file_channel_count_R" header="Ch">
          </vaadin-grid-sort-column>
        <vaadin-grid-sort-column .flexGrow=${0} .width=${"4rem"} path="file_bit_depth_R" header="Bits">
          </vaadin-grid-sort-column>
        <vaadin-grid-sort-column .flexGrow=${0} .width=${"6rem"} path="brightness_R" header="Brightness"
          .renderer=${this._percentageRenderer}></vaadin-grid-sort-column>
        <vaadin-grid-sort-column .flexGrow=${0} .width=${"6rem"} path="noisiness_R" header="Noisiness"
          .renderer=${this._percentageRenderer}></vaadin-grid-sort-column>
        <vaadin-grid-sort-column .flexGrow=${0} .width=${"6rem"} path="harmonicity_R" header="Harmonicity"
          .renderer=${this._percentageRenderer}></vaadin-grid-sort-column>
      </vaadin-grid>
    `;
  }
}

// -------------------------------------------------------------------------------------------------

declare global {
  interface HTMLElementTagNameMap {
    'afec-file-list': FileList
  }
}
