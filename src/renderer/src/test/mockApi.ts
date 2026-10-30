import { act } from '@testing-library/react'
import { vi } from 'vitest'
import {
  DEFAULT_UI_SETTINGS,
  type MdpadApi,
  type MenuCommand,
  type OpenedFolder,
  type ThemeSetting,
  type UiSettings,
} from '../../../shared/api'

function listenerSet<T extends unknown[]>() {
  const listeners = new Set<(...args: T) => void>()
  return {
    subscribe: (listener: (...args: T) => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    emit: (...args: T) => act(() => listeners.forEach((listener) => listener(...args))),
  }
}

/** Installs a fake `window.mdpad` whose calls tests can inspect and steer. */
export function installMockApi() {
  const menu = listenerSet<[MenuCommand]>()
  const close = listenerSet<[]>()
  const settings = listenerSet<[UiSettings]>()
  const folderOpened = listenerSet<[OpenedFolder]>()
  const documentChanged = listenerSet<[string]>()
  const treeChanged = listenerSet<[]>()

  const api = {
    initialTheme: 'system' as ThemeSetting,
    openFolder: vi.fn<MdpadApi['openFolder']>().mockResolvedValue(null),
    openFile: vi.fn<MdpadApi['openFile']>().mockResolvedValue(null),
    listMarkdownFiles: vi.fn<MdpadApi['listMarkdownFiles']>().mockResolvedValue([]),
    readFile: vi.fn<MdpadApi['readFile']>().mockResolvedValue(''),
    writeFile: vi.fn<MdpadApi['writeFile']>().mockResolvedValue(undefined),
    saveAs: vi.fn<MdpadApi['saveAs']>().mockResolvedValue(null),
    confirmUnsaved: vi.fn<MdpadApi['confirmUnsaved']>().mockResolvedValue('cancel'),
    confirmReload: vi.fn<MdpadApi['confirmReload']>().mockResolvedValue('keep'),
    setDocumentDirty: vi.fn<MdpadApi['setDocumentDirty']>(),
    closeWindow: vi.fn<MdpadApi['closeWindow']>(),
    watchDocument: vi.fn<MdpadApi['watchDocument']>().mockResolvedValue(undefined),
    loadImage: vi.fn<MdpadApi['loadImage']>().mockResolvedValue(null),
    openExternal: vi.fn<MdpadApi['openExternal']>(),
    getSettings: vi.fn<MdpadApi['getSettings']>().mockResolvedValue(DEFAULT_UI_SETTINGS),
    updateSettings: vi.fn<MdpadApi['updateSettings']>(),
    onMenuCommand: vi.fn<MdpadApi['onMenuCommand']>(menu.subscribe),
    onCloseRequested: vi.fn<MdpadApi['onCloseRequested']>(close.subscribe),
    onSettingsChanged: vi.fn<MdpadApi['onSettingsChanged']>(settings.subscribe),
    onFolderOpened: vi.fn<MdpadApi['onFolderOpened']>(folderOpened.subscribe),
    onDocumentChanged: vi.fn<MdpadApi['onDocumentChanged']>(documentChanged.subscribe),
    onTreeChanged: vi.fn<MdpadApi['onTreeChanged']>(treeChanged.subscribe),
  } satisfies MdpadApi

  window.mdpad = api

  return {
    api,
    /** Simulates a menu item or its keyboard shortcut. */
    sendMenuCommand: (command: MenuCommand) => menu.emit(command),
    /** Simulates the main process asking to close a window with unsaved changes. */
    requestClose: () => close.emit(),
    /** Simulates a settings change made from the menu. */
    changeSettings: (next: UiSettings) => settings.emit(next),
    /** Simulates Open Recent. */
    openFolderFromMenu: (folder: OpenedFolder) => folderOpened.emit(folder),
    /** Simulates another program changing the watched document. */
    changeDocumentOnDisk: (path: string) => documentChanged.emit(path),
    /** Simulates files being added or removed in the open folder. */
    changeTree: () => treeChanged.emit(),
  }
}
