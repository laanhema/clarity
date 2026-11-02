import type { BrowserWindow, WebContents } from 'electron'
import { AccessScope } from './accessScope'
import type { StopWatching } from './watchers'

/** Per-window state: what the window may access and whether it holds unsaved work. */
export interface WindowState {
  window: BrowserWindow
  scope: AccessScope
  dirty: boolean
  /** Promise resolving to the real path of a file to open once the window finishes loading. */
  initialFile: Promise<string | null> | null
  /** Set once the renderer has dealt with unsaved changes and asked to close. */
  closeConfirmed: boolean
  /** Set when the close was part of quitting the app, so the quit can resume. */
  quitAfterClose: boolean
  /** Real path of the open document, once the renderer asked to watch it. */
  documentPath: string | null
  /** Bumped on every watch request, so a slow, older request cannot win. */
  documentWatchGeneration: number
  stopDocumentWatch: StopWatching | null
  stopFolderWatch: StopWatching | null
}

const states = new WeakMap<WebContents, WindowState>()

export function trackWindow(window: BrowserWindow): WindowState {
  const state: WindowState = {
    window,
    scope: new AccessScope(),
    dirty: false,
    initialFile: null,
    closeConfirmed: false,
    quitAfterClose: false,
    documentPath: null,
    documentWatchGeneration: 0,
    stopDocumentWatch: null,
    stopFolderWatch: null,
  }
  states.set(window.webContents, state)
  window.once('closed', () => {
    state.stopDocumentWatch?.()
    state.stopFolderWatch?.()
  })
  return state
}

export function stateFor(contents: WebContents): WindowState | undefined {
  return states.get(contents)
}
