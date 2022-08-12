import { css, html } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { MobxLitElement } from '@adobe/lit-mobx';
import * as mobx from 'mobx';

import { appState } from '../app-state';

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
      } 
      else if (appState.isLoadingFiles > 0) {
        newMessage = "Fetching files...";
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
      font-size: smaller;
    }
  `;

  render() {
    return html`
      <vaadin-horizontal-layout id="footer">
        ${this._statusMessage}
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


