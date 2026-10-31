import { act } from '@testing-library/react'
import { vi } from 'vitest'
import {
  DEFAULT_UI_SETTINGS,
  type LanternApi,
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

/** Installs a fake `window.lantern` whose calls tests can inspect and steer. */
export function installMockApi() {
  const menu = listenerSet<[MenuCommand]>()
  const close = listenerSet<[]>()
  const settings = listenerSet<[UiSettings]>()
  const folderOpened = listenerSet<[OpenedFolder]>()
  const documentChanged = listenerSet<[string]>()
  const treeChanged = listenerSet<[]>()

  const api = {
    initialTheme: 'system' as ThemeSetting,
    openFolder: vi.fn<LanternApi['openFolder']>().mockResolvedValue(null),
    openFile: vi.fn<LanternApi['openFile']>().mockResolvedValue(null),
    listMarkdownFiles: vi.fn<LanternApi['listMarkdownFiles']>().mockResolvedValue([]),
    readFile: vi.fn<LanternApi['readFile']>().mockResolvedValue(''),
    writeFile: vi.fn<LanternApi['writeFile']>().mockResolvedValue(undefined),
    saveAs: vi.fn<LanternApi['saveAs']>().mockResolvedValue(null),
    confirmUnsaved: vi.fn<LanternApi['confirmUnsaved']>().mockResolvedValue('cancel'),
    confirmReload: vi.fn<LanternApi['confirmReload']>().mockResolvedValue('keep'),
    setDocumentDirty: vi.fn<LanternApi['setDocumentDirty']>(),
    closeWindow: vi.fn<LanternApi['closeWindow']>(),
    watchDocument: vi.fn<LanternApi['watchDocument']>().mockResolvedValue(undefined),
    loadImage: vi.fn<LanternApi['loadImage']>().mockResolvedValue(null),
    openExternal: vi.fn<LanternApi['openExternal']>(),
    getSettings: vi.fn<LanternApi['getSettings']>().mockResolvedValue(DEFAULT_UI_SETTINGS),
    updateSettings: vi.fn<LanternApi['updateSettings']>(),
    onMenuCommand: vi.fn<LanternApi['onMenuCommand']>(menu.subscribe),
    onCloseRequested: vi.fn<LanternApi['onCloseRequested']>(close.subscribe),
    onSettingsChanged: vi.fn<LanternApi['onSettingsChanged']>(settings.subscribe),
    onFolderOpened: vi.fn<LanternApi['onFolderOpened']>(folderOpened.subscribe),
    onDocumentChanged: vi.fn<LanternApi['onDocumentChanged']>(documentChanged.subscribe),
    onTreeChanged: vi.fn<LanternApi['onTreeChanged']>(treeChanged.subscribe),
  } satisfies LanternApi

  window.lantern = api

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
