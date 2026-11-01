import { app, BrowserWindow, Menu, nativeTheme, screen } from 'electron'
import { join } from 'node:path'
import { INITIAL_THEME_SWITCH, IpcChannel, type UiSettings } from '../shared/api'
import { openRecentFolder, registerIpcHandlers } from './ipc'
import { buildMenu } from './menu'
import { denyAllPermissions, hardenWebContents } from './security'
import {
  LEGACY_USER_DATA_FOLDERS,
  migrateLegacySettings,
  pruneRecentFolders,
  SettingsStore,
  type Settings,
} from './settings'
import { nativeThemeSource, windowBackground } from './theme'
import { restoreBounds } from './windowBounds'
import { stateFor, trackWindow } from './windowState'

const devServerUrl = app.isPackaged ? undefined : process.env['ELECTRON_RENDERER_URL']
let quitting = false

function backgroundColor(ui: UiSettings): string {
  return windowBackground(ui.theme, nativeTheme.shouldUseDarkColors)
}

function createWindow(settings: SettingsStore): BrowserWindow {
  const workAreas = screen.getAllDisplays().map((display) => display.workArea)
  const { bounds, maximized } = restoreBounds(settings.current.window, workAreas)
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    ...bounds,
    minWidth: 720,
    minHeight: 400,
    show: false,
    title: 'Clarity',
    backgroundColor: backgroundColor(settings.current.ui),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      additionalArguments: [`${INITIAL_THEME_SWITCH}${settings.current.ui.theme}`],
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
    },
  })
  if (maximized) window.maximize()
  const state = trackWindow(window)

  let boundsTimer: ReturnType<typeof setTimeout> | null = null
  const saveBounds = () => {
    if (boundsTimer) clearTimeout(boundsTimer)
    boundsTimer = null
    if (window.isDestroyed() || window.isMinimized() || window.isFullScreen()) return
    settings.setWindowBounds({ ...window.getNormalBounds(), maximized: window.isMaximized() })
  }
  const saveBoundsSoon = () => {
    if (boundsTimer) clearTimeout(boundsTimer)
    boundsTimer = setTimeout(saveBounds, 400)
  }
  window.on('resize', saveBoundsSoon)
  window.on('move', saveBoundsSoon)

  // Unsaved work: hand the decision to the renderer, which asks the user and
  // then calls closeWindow (see ipc.ts) if the window may really close.
  window.on('close', (event) => {
    saveBounds()
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

function applySettings(settings: SettingsStore, previous: Settings | null): void {
  const { ui, recentFolders } = settings.current
  nativeTheme.themeSource = nativeThemeSource(ui.theme)
  Menu.setApplicationMenu(
    buildMenu({
      isMac: process.platform === 'darwin',
      isDev: Boolean(devServerUrl),
      ui,
      recentFolders,
      setViewMode: (viewMode) => settings.update((current) => ({ ...current, ui: { ...current.ui, viewMode } })),
      setTheme: (theme) => settings.update((current) => ({ ...current, ui: { ...current.ui, theme } })),
      setFont: (font) => settings.update((current) => ({ ...current, ui: { ...current.ui, font } })),
      setFontSize: (fontSize) => settings.update((current) => ({ ...current, ui: { ...current.ui, fontSize } })),
      openRecent: (window, folder) => {
        const state = stateFor(window.webContents)
        if (state) void openRecentFolder(state, folder, settings)
      },
      clearRecent: () => settings.update((current) => ({ ...current, recentFolders: [] })),
    }),
  )
  if (previous && previous.ui !== ui) broadcastUiSettings(ui)
}

function broadcastUiSettings(ui: UiSettings): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.setBackgroundColor(backgroundColor(ui))
    window.webContents.send(IpcChannel.SettingsChanged, ui)
  }
}

app.enableSandbox()

app.on('web-contents-created', (_event, contents) => hardenWebContents(contents))

app.on('before-quit', () => {
  quitting = true
})

void app.whenReady().then(async () => {
  const settingsFile = join(app.getPath('userData'), 'settings.json')
  await migrateLegacySettings(
    settingsFile,
    LEGACY_USER_DATA_FOLDERS.map((folder) => join(app.getPath('appData'), folder, 'settings.json')),
  )
  const settings = await SettingsStore.load(settingsFile)
  denyAllPermissions()
  registerIpcHandlers(settings)

  let previous = settings.current
  applySettings(settings, null)
  settings.onChange((next) => {
    applySettings(settings, previous)
    previous = next
  })

  createWindow(settings)

  const recent = settings.current.recentFolders
  const existing = await pruneRecentFolders(recent)
  if (existing.length !== recent.length) {
    settings.update((current) => ({
      ...current,
      recentFolders: current.recentFolders.filter((folder) => existing.includes(folder)),
    }))
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(settings)
  })

  // Write pending settings (window size, recent folders) before the app exits.
  let flushed = false
  app.on('will-quit', (event) => {
    if (flushed) return
    event.preventDefault()
    void settings.flush().finally(() => {
      flushed = true
      app.quit()
    })
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
