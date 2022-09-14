import { css, html } from 'lit'
import { customElement } from 'lit/decorators.js'
import { MobxLitElement } from '@adobe/lit-mobx';

import { appState } from './app-state';

import './components/app-footer';
import './components/app-header';
import './components/file-map';
import './components/file-waveview';
import './components/file-list';
import './components/error-message';

import { open } from '@tauri-apps/api/dialog';

import '@vaadin/vertical-layout';
import '@vaadin/split-layout';

// -------------------------------------------------------------------------------------------------
 
// Main app layout.

@customElement('afec-app')
export class App extends MobxLitElement {
  
  private _openDatabaseClick() {
    (async () => {
      // Open a selection dialog for image files
      const selectedFile = await open({
        multiple: false,
        filters: [{
          name: 'AFEC Database',
          extensions: ['afec.db', 'db']
        }]
      });
      if (selectedFile) {
        const file = Array.isArray(selectedFile) ? 
          (selectedFile as Array<string>)[0] : selectedFile as string;
        await appState.openDatabase(file);
      }
    })()
    .catch(_err => {
      // TODO: notification
    })
  }

  static styles = css`
    #layout {
       align-items: stretch; 
       width: 100vw; 
       height: 100%;
    }
    #error {
      height: 100%;
    }
    #footer {
      height: auto;
    }
    #main-split {
      height: 100%;
      width: 100vw;
    }
    #map {
      height: 30%;
      min-height: 25%;
    }
    #lower-split {
      height: 70%;
      width: 100vw;
    }
    #waveview {
      height: 25%;
      min-height: 25%;
    }
    #file-list {
      height: 75%;
      min-height: 25%;
    }
    #footer {
      height: 38px;
    }
  `;

  render() {
    // database error
    if (appState.databaseError || ! appState.databasePath) {
      const errorMessage = appState.databaseError ? 
        `Failed to open database: ${appState.databaseError}` : 
        "No database selected";
      return html`
        <vaadin-vertical-layout id="layout">
          <afec-app-header id="header" 
            .openDatabaseClick=${this._openDatabaseClick}>
          </afec-app-header>
          <afec-error-message id="error"
              type=${appState.databaseError ? "error" : "info"} 
              message=${errorMessage}>
          </afec-error-message>
          <afec-app-footer id="footer"></afec-app-footer>
        </vaadin-vertical-layout>
      `;
    }
    // database browser layout
    return html`
      <vaadin-vertical-layout id="layout">
        <afec-app-header id="header" 
          .openDatabaseClick=${this._openDatabaseClick}>
        </afec-app-header>
        <vaadin-split-layout id="main-split" orientation="vertical" theme="small">
          <afec-file-map id="map"></afec-file-map>
          <vaadin-split-layout id="lower-split" orientation="vertical" theme="small">
            <afec-file-waveview id="waveview"></afec-file-waveview>
            <afec-file-list id="file-list"></afec-file-list>
          </vaadin-split-layout> 
        </vaadin-split-layout> 
        <afec-app-footer id="footer"></afec-app-footer>
      </vaadin-vertical-layout>
    `;
  }
}

// -------------------------------------------------------------------------------------------------

declare global {
  interface HTMLElementTagNameMap {
    'afec-app': App
  }
}
