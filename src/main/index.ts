import { app, BrowserWindow, Menu, nativeTheme } from 'electron'
import { join } from 'node:path'
import { IpcChannel } from '../shared/api'
import { registerIpcHandlers } from './ipc'
import { buildMenu } from './menu'
import { denyAllPermissions, hardenWebContents } from './security'
import { trackWindow } from './windowState'

const devServerUrl = app.isPackaged ? undefined : process.env['ELECTRON_RENDERER_URL']
let quitting = false

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 720,
    minHeight: 400,
    show: false,
    title: 'mdpad',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1e1f22' : '#ffffff',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
    },
  })
  const state = trackWindow(window)

  // Unsaved work: hand the decision to the renderer, which asks the user and
  // then calls closeWindow (see ipc.ts) if the window may really close.
  window.on('close', (event) => {
    if (!state.dirty || state.closeConfirmed) return
    event.preventDefault()
    state.quitAfterClose = quitting
    quitting = false
    window.webContents.send(IpcChannel.CloseRequested)
  })

  window.once('ready-to-show', () => window.show())

  if (devServerUrl) void window.loadURL(devServerUrl)
  else void window.loadFile(join(__dirname, '../renderer/index.html'))

  return window
}

app.enableSandbox()
nativeTheme.themeSource = 'system'

app.on('web-contents-created', (_event, contents) => hardenWebContents(contents))

app.on('before-quit', () => {
  quitting = true
})

void app.whenReady().then(() => {
  denyAllPermissions()
  registerIpcHandlers()
  Menu.setApplicationMenu(buildMenu({ isMac: process.platform === 'darwin', isDev: Boolean(devServerUrl) }))
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
