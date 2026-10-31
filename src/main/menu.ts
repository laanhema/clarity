import { BrowserWindow, Menu, type BaseWindow, type MenuItemConstructorOptions } from 'electron'
import {
  DEFAULT_UI_SETTINGS,
  IpcChannel,
  type FontSetting,
  type MenuCommand,
  type ThemeSetting,
  type UiSettings,
  type ViewMode,
} from '../shared/api'

export interface MenuOptions {
  isMac: boolean
  isDev: boolean
  ui: UiSettings
  recentFolders: readonly string[]
  setViewMode(mode: ViewMode): void
  setTheme(theme: ThemeSetting): void
  setFont(font: FontSetting): void
  setFontSize(fontSize: number): void
  openRecent(window: BrowserWindow, folder: string): void
  clearRecent(): void
}

function targetWindow(window: BaseWindow | undefined): BrowserWindow | null {
  return window instanceof BrowserWindow ? window : BrowserWindow.getFocusedWindow()
}

function sendCommand(command: MenuCommand) {
  return (_item: unknown, window: BaseWindow | undefined): void => {
    targetWindow(window)?.webContents.send(IpcChannel.MenuCommand, command)
  }
}

const VIEW_ITEMS: { mode: ViewMode; label: string; accelerator: string }[] = [
  { mode: 'editor', label: 'Editor Only', accelerator: 'CmdOrCtrl+1' },
  { mode: 'split', label: 'Editor and Preview', accelerator: 'CmdOrCtrl+2' },
  { mode: 'preview', label: 'Preview Only', accelerator: 'CmdOrCtrl+3' },
]

const THEME_ITEMS: { theme: ThemeSetting; label: string }[] = [
  { theme: 'system', label: 'Follow System' },
  { theme: 'light', label: 'Light' },
  { theme: 'dark', label: 'Dark' },
  { theme: 'gruvbox-material-dark-hard', label: 'Gruvbox Material Dark Hard' },
  { theme: 'tokyo-night-moon', label: 'Tokyo Night Moon' },
]

const FONT_ITEMS: { font: FontSetting; label: string }[] = [
  { font: 'jetbrains-mono-nl', label: 'JetBrains Mono NL' },
  { font: 'commit-mono', label: 'Commit Mono' },
]

/** Editor text sizes offered in the menu; the preview scales with them. 14 is the default. */
const FONT_SIZES = [10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 28] as const

function recentSubmenu(options: MenuOptions): MenuItemConstructorOptions[] {
  if (options.recentFolders.length === 0) return [{ label: 'No Recent Folders', enabled: false }]
  return [
    ...options.recentFolders.map(
      (folder): MenuItemConstructorOptions => ({
        // A single & marks a mnemonic in menu labels on Windows and Linux.
        label: folder.replaceAll('&', '&&'),
        click: (_item, window) => {
          const target = targetWindow(window)
          if (target) options.openRecent(target, folder)
        },
      }),
    ),
    { type: 'separator' },
    { label: 'Clear Recent', click: () => options.clearRecent() },
  ]
}

export function buildMenu(options: MenuOptions): Menu {
  const { isMac, isDev, ui } = options
  const template: MenuItemConstructorOptions[] = []

  if (isMac) template.push({ role: 'appMenu' })

  template.push({
    label: 'File',
    submenu: [
      { label: 'New', accelerator: 'CmdOrCtrl+N', click: sendCommand('new-file') },
      { label: 'Open File…', accelerator: 'CmdOrCtrl+O', click: sendCommand('open-file') },
      { label: 'Open Folder…', accelerator: 'CmdOrCtrl+Shift+O', click: sendCommand('open-folder') },
      { label: 'Open Recent', submenu: recentSubmenu(options) },
      { type: 'separator' },
      { label: 'Save', accelerator: 'CmdOrCtrl+S', click: sendCommand('save') },
      { label: 'Save As…', accelerator: 'CmdOrCtrl+Shift+S', click: sendCommand('save-as') },
      { type: 'separator' },
      isMac ? { role: 'close' } : { role: 'quit' },
    ],
  })

  template.push({
    label: 'Edit',
    submenu: [
      // Undo and redo go to the renderer, which applies them to the editor's own history.
      { label: 'Undo', accelerator: 'CmdOrCtrl+Z', click: sendCommand('undo') },
      { label: 'Redo', accelerator: 'CmdOrCtrl+Shift+Z', click: sendCommand('redo') },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'selectAll' },
      { type: 'separator' },
      { label: 'Find and Replace…', accelerator: 'CmdOrCtrl+F', click: sendCommand('find') },
    ],
  })

  template.push({
    label: 'View',
    submenu: [
      ...VIEW_ITEMS.map(
        ({ mode, label, accelerator }): MenuItemConstructorOptions => ({
          label,
          accelerator,
          type: 'radio',
          checked: ui.viewMode === mode,
          click: () => options.setViewMode(mode),
        }),
      ),
      { type: 'separator' },
      {
        label: 'Theme',
        submenu: THEME_ITEMS.map(
          ({ theme, label }): MenuItemConstructorOptions => ({
            label,
            type: 'radio',
            checked: ui.theme === theme,
            click: () => options.setTheme(theme),
          }),
        ),
      },
      {
        label: 'Font',
        submenu: FONT_ITEMS.map(
          ({ font, label }): MenuItemConstructorOptions => ({
            label: font === DEFAULT_UI_SETTINGS.font ? `${label} (Default)` : label,
            type: 'radio',
            checked: ui.font === font,
            click: () => options.setFont(font),
          }),
        ),
      },
      {
        label: 'Font Size',
        submenu: FONT_SIZES.map(
          (fontSize): MenuItemConstructorOptions => ({
            label: fontSize === DEFAULT_UI_SETTINGS.fontSize ? `${fontSize} px (Default)` : `${fontSize} px`,
            type: 'radio',
            checked: ui.fontSize === fontSize,
            click: () => options.setFontSize(fontSize),
          }),
        ),
      },
      { type: 'separator' },
      ...(isDev
        ? ([{ role: 'reload' }, { role: 'toggleDevTools' }, { type: 'separator' }] satisfies MenuItemConstructorOptions[])
        : []),
      { role: 'resetZoom' },
      { role: 'zoomIn' },
      { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'togglefullscreen' },
    ],
  })

  template.push({ role: 'windowMenu' })

  return Menu.buildFromTemplate(template)
}
