import { css, html } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { MobxLitElement } from '@adobe/lit-mobx';
import * as mobx from 'mobx'

import { appState } from '../app-state';
import { PlotEntry } from '../controllers/backend/plot';

import '@vaadin/integer-field';
import '@vaadin/number-field';
import '@vaadin/horizontal-layout';

import './file-map-plot';
import './error-message';
import './spinner';

// -------------------------------------------------------------------------------------------------

// Map layout.

@customElement('afec-file-map')
export class FileMap extends MobxLitElement {

  @state()
  private _fetchError: string = "";

  @state() 
  private _plotEntries: PlotEntry[] = [];  

  constructor() {
    super();

    // fetch new map on database path changes
    mobx.reaction(
      () => appState.databasePath,
      () => this._fetchMap(),
      { fireImmediately: true }
    );

    // update map on map parameter changes
    mobx.reaction(
      () => [appState.mapEpochs, appState.mapPerplexity, appState.mapTheta],
      () => this._fetchMap(),
      { fireImmediately: false, delay: 1000 }
    );
  }

  private _fetchMap() {
    if (! appState.databasePath) {
      this._fetchError = "No database selected";
      this._plotEntries = [];
      return;
    }
    appState.generateMap()
      .then((entries) => {
        this._plotEntries = entries;
        this._fetchError = "";
      })
      .catch((error) => {
        this._fetchError = error.message || String(error);
        this._plotEntries = [];
      })
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
    #header .control {
      margin-right: 12px;
      padding: unset;
      width: 6rem;
    }
    #header .label {
      margin-right: 4px;
      color: var(--lumo-tertiary-text-color);
      font-size: var(--lumo-font-size-s);
    }
    #loading {
      height: 100%; 
      align-items: center;
      justify-content: center;
    }
    #error {
      height: 75%; 
    }
    #plot {
      flex: 1 1 auto;
    }
  `;

  render() {
    const header = html`
      <vaadin-horizontal-layout id="header">
        <strong id="title">MAP</strong>
        <span class="label">Perplexity</span>
        <vaadin-integer-field
          theme="small" 
          class="control"
          has-controls
          .min=${5}
          .max=${50}
          .step=${5}
          .value=${String(appState.mapPerplexity)} 
          .disabled=${appState.isGeneratingMap > 0} 
          @change=${(event: CustomEvent) => {
            appState.mapPerplexity = Number((event.target as HTMLInputElement).value); 
          }}>
        </vaadin-integer-field>
        <span class="label">Theta</span>
        <vaadin-number-field
          theme="small" 
          class="control"
          has-controls
          .min=${0.01}
          .max=${1}
          .step=${0.1}
          .value=${String(appState.mapTheta)} 
          .disabled=${appState.isGeneratingMap > 0} 
          @change=${(event: CustomEvent) => {
            appState.mapTheta = Number((event.target as HTMLInputElement).value); 
          }}>
        </vaadin-number-field>
        <span class="label">Epochs</span>
        <vaadin-integer-field
          theme="small" 
          class="control"
          has-controls
          .min=${0}
          .max=${10000}
          .step=${100}
          .value=${String(appState.mapEpochs)} 
          .disabled=${appState.isGeneratingMap > 0} 
          @change=${(event: CustomEvent) => {
            appState.mapEpochs = Number((event.target as HTMLInputElement).value); 
          }}>
        </vaadin-integer-field>
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
        <afec-error-message id="error"
          type=${appState.databasePath ? "error" : "info"}
          message=${errorMessage}>
        </afec-error-message>
      `;
    }
    // loading
    if (appState.isGeneratingMap > 0 || appState.isLoadingDatabase > 0) {
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
      <afec-file-map-plot id="plot" .data=${this._plotEntries}></afec-file-map-plot>
    `;
  }
}

// -------------------------------------------------------------------------------------------------

declare global {
  interface HTMLElementTagNameMap {
    'afec-file-map': FileMap
  }
}
