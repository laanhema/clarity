import { act } from '@testing-library/react'
import { vi } from 'vitest'
import {
  DEFAULT_UI_SETTINGS,
  type ClarityApi,
  type MenuCommand,
  type ThemeSetting,
  type UiSettings,
} from '../../../shared/api'
import type { Platform } from '../../../shared/shortcuts'

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

/** Installs a fake `window.clarity` whose calls tests can inspect and steer. */
export function installMockApi() {
  const menu = listenerSet<[MenuCommand]>()
  const close = listenerSet<[]>()
  const settings = listenerSet<[UiSettings]>()
  const folderPicked = listenerSet<[string]>()
  const filePicked = listenerSet<[string]>()
  const documentChanged = listenerSet<[string]>()
  const treeChanged = listenerSet<[]>()

  const api = {
    initialTheme: 'system' as ThemeSetting,
    platform: 'linux' as Platform,
    pickFolder: vi.fn<ClarityApi['pickFolder']>().mockResolvedValue(null),
    enterFolder: vi.fn<ClarityApi['enterFolder']>().mockResolvedValue(null),
    openFile: vi.fn<ClarityApi['openFile']>().mockResolvedValue(null),
    listMarkdownFiles: vi.fn<ClarityApi['listMarkdownFiles']>().mockResolvedValue([]),
    readFile: vi.fn<ClarityApi['readFile']>().mockResolvedValue(''),
    writeFile: vi.fn<ClarityApi['writeFile']>().mockResolvedValue(undefined),
    saveAs: vi.fn<ClarityApi['saveAs']>().mockResolvedValue(null),
    confirmUnsaved: vi.fn<ClarityApi['confirmUnsaved']>().mockResolvedValue('cancel'),
    confirmReload: vi.fn<ClarityApi['confirmReload']>().mockResolvedValue('keep'),
    setDocumentDirty: vi.fn<ClarityApi['setDocumentDirty']>(),
    closeWindow: vi.fn<ClarityApi['closeWindow']>(),
    watchDocument: vi.fn<ClarityApi['watchDocument']>().mockResolvedValue(undefined),
    loadImage: vi.fn<ClarityApi['loadImage']>().mockResolvedValue(null),
    getInitialFile: vi.fn<ClarityApi['getInitialFile']>().mockResolvedValue(null),
    openExternal: vi.fn<ClarityApi['openExternal']>(),
    getSettings: vi.fn<ClarityApi['getSettings']>().mockResolvedValue(DEFAULT_UI_SETTINGS),
    updateSettings: vi.fn<ClarityApi['updateSettings']>(),
    onMenuCommand: vi.fn<ClarityApi['onMenuCommand']>(menu.subscribe),
    onCloseRequested: vi.fn<ClarityApi['onCloseRequested']>(close.subscribe),
    onSettingsChanged: vi.fn<ClarityApi['onSettingsChanged']>(settings.subscribe),
    onFolderPicked: vi.fn<ClarityApi['onFolderPicked']>(folderPicked.subscribe),
    onFilePicked: vi.fn<ClarityApi['onFilePicked']>(filePicked.subscribe),
    onDocumentChanged: vi.fn<ClarityApi['onDocumentChanged']>(documentChanged.subscribe),
    onTreeChanged: vi.fn<ClarityApi['onTreeChanged']>(treeChanged.subscribe),
  } satisfies ClarityApi

  window.clarity = api

  return {
    api,
    /** Simulates a menu item or its keyboard shortcut. */
    sendMenuCommand: (command: MenuCommand) => menu.emit(command),
    /** Simulates the main process asking to close a window with unsaved changes. */
    requestClose: () => close.emit(),
    /** Simulates a settings change made from the menu. */
    changeSettings: (next: UiSettings) => settings.emit(next),
    /** Simulates picking a folder from Open Recent. */
    pickFolderFromMenu: (rootPath: string) => folderPicked.emit(rootPath),
    /** Simulates opening a file from the command line or another instance. */
    pickFileFromExternal: (filePath: string) => filePicked.emit(filePath),
    /** Simulates another program changing the watched document. */
    changeDocumentOnDisk: (path: string) => documentChanged.emit(path),
    /** Simulates files being added or removed in the open folder. */
    changeTree: () => treeChanged.emit(),
  }
}
