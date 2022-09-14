import { css, html } from 'lit'
import { customElement, query, state } from 'lit/decorators.js'
import { MobxLitElement } from '@adobe/lit-mobx';
import * as mobx from 'mobx'

import { appState } from '../app-state';
import { WaveformPoint } from '../controllers/backend/waveform';

import '@vaadin/horizontal-layout';

import './file-waveview-plot';
import {FileWaveViewPlot} from './file-waveview-plot';

import './error-message';
import './spinner';

// -------------------------------------------------------------------------------------------------

// Map layout.

@customElement('afec-file-waveview')
export class FileWaveView extends MobxLitElement {

  @state()
  private _fetchError: string = "";

  @state()
  private _waveformData: WaveformPoint[] = [];

  @query("#plot")
  private _waveviewPlot!: FileWaveViewPlot | null;

  constructor() {
    super();

    // fetch new waveform on database path and selected file changes
    mobx.reaction(
      () => [appState.databasePath, appState.selectedFilePath],
      () => this._fetchWaveform(),
      { fireImmediately: true }
    );
  }

  private _fetchWaveform() {
    if (! appState.databasePath || ! appState.selectedFilePath) {
      this._fetchError = "No file selected";
      this._waveformData = [];
      return;
    }
    let neededWidth = this.clientWidth;
    if (this._waveviewPlot) {
      neededWidth = this._waveviewPlot.clientWidth;
    }
    let upscaleFactor = 1.25;
    appState.generateWaveform(neededWidth * upscaleFactor)
      .then((entries) => {
        this._waveformData = entries;
        this._fetchError = "";
      })
      .catch((error) => {
        this._fetchError = error.message || String(error);
        this._waveformData = [];
      })
  }

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      justify-content: start
    }
    #header {
      align-items: center; 
      background: var(--lumo-shade-10pct);
      padding: 4px;
      height: 37.5px;
    }
    #header #filePath {
      margin-left: 10px;
      margin-right: 12px;
      padding: 4px 0px;
      color: var(--lumo-tint);
      font-size: smaller;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    #header #filePath.disabled {
      color: var(--lumo-tint-10pct);
    } 
    #loading {
      flex: 1 1 auto;
      align-items: center;
      justify-content: center;
    }
    #error {
      flex: 1 1 auto;
    }
    #plot {
      flex: 1 1 auto;
    }
  `;

  render() {
    let selectedFilePath = appState.selectedFilePath;
    if (selectedFilePath) {
      if (selectedFilePath.startsWith("./") || selectedFilePath.startsWith(".\\")) {
        selectedFilePath = selectedFilePath.substring(2);
      }
    }
    else {
      selectedFilePath = "No file selected";
    }
    const header = html`
      <vaadin-horizontal-layout id="header">
        <div id="filePath" class="${!appState.selectedFilePath? "disabled" : ""}">
          ${selectedFilePath}
        </div>
      </vaadin-horizontal-layout>
    `;
    // error
    if (this._fetchError && appState.isGeneratingWaveform === 0) {
      let errorMessage = this._fetchError;
      if (appState.databasePath && appState.selectedFilePath) {
        errorMessage = "Failed to fetch waveform: " + errorMessage;
      }
      return html`
        ${header}
        <afec-error-message id="error"
          type=${appState.databasePath && appState.selectedFilePath ? "error" : "info"}
          message=${errorMessage}>
        </afec-error-message>
      `;
    }
    // loading
    if (appState.isGeneratingWaveform > 0 || appState.isLoadingDatabase > 0) {
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
      <afec-file-waveview-plot id="plot" .data=${this._waveformData}></afec-file-waveview-plot>
    `;
  }
}

// -------------------------------------------------------------------------------------------------

declare global {
  interface HTMLElementTagNameMap {
    'afec-file-waveview': FileWaveView
  }
}
