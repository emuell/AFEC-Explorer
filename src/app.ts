import { css, html } from 'lit'
import { customElement } from 'lit/decorators.js'
import { MobxLitElement } from '@adobe/lit-mobx';

import { appState } from './app-state';

import './components/app-footer';
import './components/app-header';
import './components/file-map';
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
    #footer {
      height: auto;
    }
    #split {
      height: 100%;
      width: 100vw;
    }
    #filemap {
      height: 30%;
      min-height: 25%;
    }
    #filelist {
      height: 70%;
      min-height: 25%;
    }
    #footer {
      height: 44px;
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
          <afec-error-message 
              type=${appState.databaseError ? "error" : "info"} 
              message=${errorMessage}>
          </afec-error-message>
        </vaadin-vertical-layout>
      `;
    }
    // database browser layout
    return html`
      <vaadin-vertical-layout id="layout">
        <afec-app-header id="header" 
          .openDatabaseClick=${this._openDatabaseClick}>
        </afec-app-header>
        <vaadin-split-layout id="split" orientation="vertical" theme="small">
          <afec-file-map id="filemap"></afec-file-map>
          <afec-file-list id="filelist"></afec-file-list>
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
