import { css, html } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { MobxLitElement } from '@adobe/lit-mobx';
import * as mobx from 'mobx';

import { appState } from '../app-state';

import eye from '../assets/images/eye.png'

import '@vaadin/horizontal-layout';

// -------------------------------------------------------------------------------------------------
 
// Status bar alike footer in the restic browser app

@customElement('afec-app-footer')
export class AppFooter extends MobxLitElement {

  @state()
  private _statusMessage: string = "";

  constructor() {
    super();

    let messageTimeoutId: number | undefined = undefined;
    mobx.autorun(() => {
      let newMessage = "";
      if (appState.isLoadingDatabase > 0) {
        newMessage = "Opening database...";
      } else if (appState.isLoadingFiles > 0) {
        newMessage = "Fetching files...";
      } else if (appState.isGeneratingMap > 0) {
        newMessage = "Generating t-SNE Map...";
      }
      if (newMessage !== "") {
        if (messageTimeoutId !== undefined) {
          clearTimeout(messageTimeoutId);
          messageTimeoutId = undefined;
        }
        this._statusMessage = newMessage;
      } 
      else {
        messageTimeoutId = setTimeout(() => {
          this._statusMessage = "";
          messageTimeoutId = undefined;
        }, 1000);
      }
    });
  }

  static styles = css`
    #footer {
      background: var(--lumo-shade-10pct);
      height: 100%;
      padding: 0 4px;
      align-items: center;
    }
    #footer #status {
      flex: 1; 
      margin-left: 8px;
      font-size: smaller;
      font-weight: 500;
    }
    #footer #eye {
      margin-right: 8px;
      width: auto; 
      height: var(--lumo-font-size-xxl);
    }
    #footer #logo {
      margin-left: 8px;
      margin-right: 4px;
      margin-bottom: 2px;
      font-weight: bolder;
      font-size: smaller;
      width: auto; 
      height: var(--lumo-font-size-xl);
    }
  `;

  render() {
    return html`
      <vaadin-horizontal-layout id="footer">
        <div id="status">
          ${this._statusMessage}
        </div>
        <div id="logo">AFEC</div>
        <img src=${eye} id="eye" />
      </vaadin-horizontal-layout>
    `;
  }
}

// -------------------------------------------------------------------------------------------------

declare global {
  interface HTMLElementTagNameMap {
    'afec-app-footer': AppFooter
  }
}


