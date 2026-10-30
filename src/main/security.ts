import { session, shell, type WebContents } from 'electron'
import { isSafeExternalUrl } from './externalUrl'

function openExternally(url: string): void {
  if (isSafeExternalUrl(url)) void shell.openExternal(url)
}

/**
 * The renderer shows untrusted documents, so it may never navigate away from
 * the app, open windows, or embed webviews. Web links go to the system browser.
 */
export function hardenWebContents(contents: WebContents): void {
  contents.on('will-navigate', (event, url) => {
    event.preventDefault()
    openExternally(url)
  })
  contents.setWindowOpenHandler(({ url }) => {
    openExternally(url)
    return { action: 'deny' }
  })
  contents.on('will-attach-webview', (event) => {
    event.preventDefault()
  })
}

/** mdpad needs no camera, microphone, notifications or other web permissions. */
export function denyAllPermissions(): void {
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => {
    callback(false)
  })
  session.defaultSession.setPermissionCheckHandler(() => false)
}
