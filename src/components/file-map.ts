import { css, html } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { MobxLitElement } from '@adobe/lit-mobx';
import * as mobx from 'mobx'

import { appState } from '../app-state';

// import { MapResult } from '../models/map-result';

import './error-message';
import './spinner';

// -------------------------------------------------------------------------------------------------
 
// File list / table.

@customElement('afec-file-map')
export class FileMap extends MobxLitElement {
  
  @state()
  private _fetchError: string = "";

  // @state() 
  // private _mapEntries: MapResult[] = [];  

  // @query("#canvas")
  // private _canvas!: HTMLCanvasElement | null;

  constructor() {
    super();

    // fetch new map on database path changes, snapshot or root dir changes
    mobx.reaction(
      () => appState.databasePath,
      () => this._fetchMap(),
      { fireImmediately: true }
    );
  }
  
  private _fetchMap() {
    /*if (! appState.databasePath) {
      this._fetchError = "No database selected";
      this._mapEntries = [];
      return;
    }
    appState.fetchMap()
      .then((entries) => {
        // assign and rebuild graph
        this._mapEntries = [];
        if (this._canvas) {
          this._canvas.clearCache();
        }
        // reset fetch errors - if any
        this._fetchError = "";
      })
      .catch((error) => {
        this._fetchError = error.message || String(error);
        this._mapEntries = [];
      })*/
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
      flex: 1;
      margin: 0px 10px;
      padding: 4px 0px;
     }
    #loading {
      height: 100%; 
      align-items: center;
      justify-content: center;
    }
    #canvas {
      height: inherit;
      flex: 1;
      margin: 0px 8px;
    }
  `;
  
  render() {
    const header = html`
      <vaadin-horizontal-layout id="header">
        <strong id="title">Map</strong>
      </vaadin-horizontal-layout>
    `;
    // error
    if (this._fetchError && appState.isGeneratingMap === 0) {
      let errorMessage = this._fetchError;
      if (appState.databasePath) {
       errorMessage = "Failed to calculate t-SNE map: " + errorMessage;
      }
      return html`
        ${header}
        <afec-error-message 
          type=${appState.databasePath ? "error" : "info"}
          message=${errorMessage}>
        </afec-error-message>
      `;
    }
    // loading
    if (appState.isGeneratingMap > 0 || appState.isLoadingFiles > 0) {
      return html`
        ${header}
        <vaadin-horizontal-layout id="loading">
          <afec-spinner size="24px"></afec-spinner>
        </vaadin-horizontal-layout>
      `;
    }
    // map
    return html`
      ${header}
      <div id="canvas" style="display: flex">
        <p style="width: 100%; align-self: center; text-align: center;">
          Here will be a t-SNE map
        </p>
      </div>
    `;
  }
}

// -------------------------------------------------------------------------------------------------

declare global {
  interface HTMLElementTagNameMap {
    'afec-file-map': FileMap
  }
}
