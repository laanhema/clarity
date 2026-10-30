import { BrowserWindow, Menu, type BaseWindow, type MenuItemConstructorOptions } from 'electron'
import { IpcChannel, type MenuCommand } from '../shared/api'

function sendCommand(command: MenuCommand) {
  return (_item: unknown, window: BaseWindow | undefined): void => {
    const target = window instanceof BrowserWindow ? window : BrowserWindow.getFocusedWindow()
    target?.webContents.send(IpcChannel.MenuCommand, command)
  }
}

export function buildMenu(options: { isMac: boolean; isDev: boolean }): Menu {
  const { isMac, isDev } = options
  const template: MenuItemConstructorOptions[] = []

  if (isMac) template.push({ role: 'appMenu' })

  template.push({
    label: 'File',
    submenu: [
      { label: 'Open File…', accelerator: 'CmdOrCtrl+O', click: sendCommand('open-file') },
      { label: 'Open Folder…', accelerator: 'CmdOrCtrl+Shift+O', click: sendCommand('open-folder') },
      { type: 'separator' },
      { label: 'Save', accelerator: 'CmdOrCtrl+S', click: sendCommand('save') },
      { label: 'Save As…', accelerator: 'CmdOrCtrl+Shift+S', click: sendCommand('save-as') },
      { type: 'separator' },
      isMac ? { role: 'close' } : { role: 'quit' },
    ],
  })

  template.push({ role: 'editMenu' })

  template.push({
    label: 'View',
    submenu: [
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
