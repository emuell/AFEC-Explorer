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

// Selected file's waveform plot layout 

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
    let upscaleFactor = 2;
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
    // error
    if (this._fetchError && appState.isGeneratingWaveform === 0) {
      let errorMessage = this._fetchError;
      if (appState.databasePath && appState.selectedFilePath) {
        errorMessage = "Failed to fetch waveform: " + errorMessage;
      }
      return html`
        <afec-error-message id="error"
          type=${appState.databasePath && appState.selectedFilePath ? "error" : "info"}
          message=${errorMessage}>
        </afec-error-message>
      `;
    }
    // loading
    if (appState.isGeneratingWaveform > 0 || appState.isLoadingDatabase > 0) {
      return html`
        <vaadin-horizontal-layout id="loading">
          <afec-spinner size="24px"></afec-spinner>
        </vaadin-horizontal-layout>
      `;
    }
    // map
    return html`
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
