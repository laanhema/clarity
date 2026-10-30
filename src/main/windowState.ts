import type { BrowserWindow, WebContents } from 'electron'
import { AccessScope } from './accessScope'

/** Per-window state: what the window may access and whether it holds unsaved work. */
export interface WindowState {
  window: BrowserWindow
  scope: AccessScope
  dirty: boolean
  /** Set once the renderer has dealt with unsaved changes and asked to close. */
  closeConfirmed: boolean
  /** Set when the close was part of quitting the app, so the quit can resume. */
  quitAfterClose: boolean
}

const states = new WeakMap<WebContents, WindowState>()

export function trackWindow(window: BrowserWindow): WindowState {
  const state: WindowState = {
    window,
    scope: new AccessScope(),
    dirty: false,
    closeConfirmed: false,
    quitAfterClose: false,
  }
  states.set(window.webContents, state)
  return state
}

export function stateFor(contents: WebContents): WindowState | undefined {
  return states.get(contents)
}
