import { css, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { MobxLitElement } from '@adobe/lit-mobx';

import { appState } from '../app-state';

import '@vaadin/horizontal-layout';
import '@vaadin/button';

// -------------------------------------------------------------------------------------------------
 
// Allow opening new repositories and shows active repository in a header alike view

@customElement('afec-app-header')
export class AppHeader extends MobxLitElement {

  @property()
  openDatabaseClick?: () => void = undefined;

  static styles = css`
    #header {
      align-items: center;
    }
    #header #databaseButton {
      margin-left: 8px;
    }
    #header #databasePath {
      margin-left: 8px;
      margin-right: 12px;
      color: var(--lumo-tint-50pct);
      font-size: smaller;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    #header #repoPath.disabled {
      color: var(--lumo-tint-10pct);
    } 
  `;

  render() {
    let databaseName = appState.databasePath;
    if (! databaseName) {
      databaseName = "No database selected";
    }
    
    return html`
      <vaadin-horizontal-layout id="header">
        <vaadin-button 
          id="databaseButton" 
          theme="primary" 
          @click=${() => {
            if (this.openDatabaseClick) { 
              this.openDatabaseClick(); 
             } 
            } 
          }>
          Open Database 
        </vaadin-button>
        <div id="databasePath" class="${!appState.databasePath? "disabled" : ""}">
          ${databaseName}
        </div>
      </vaadin-horizontal-layout>
    `;
  }
}

// -------------------------------------------------------------------------------------------------

declare global {
  interface HTMLElementTagNameMap {
    'afec-app-header': AppHeader
  }
}


