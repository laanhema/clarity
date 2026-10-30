import { act } from '@testing-library/react'
import { vi } from 'vitest'
import type { MdpadApi, MenuCommand } from '../../../shared/api'

/** Installs a fake `window.mdpad` whose calls tests can inspect and steer. */
export function installMockApi() {
  const menuListeners = new Set<(command: MenuCommand) => void>()
  const closeListeners = new Set<() => void>()

  const api = {
    openFolder: vi.fn<MdpadApi['openFolder']>().mockResolvedValue(null),
    openFile: vi.fn<MdpadApi['openFile']>().mockResolvedValue(null),
    listMarkdownFiles: vi.fn<MdpadApi['listMarkdownFiles']>().mockResolvedValue([]),
    readFile: vi.fn<MdpadApi['readFile']>().mockResolvedValue(''),
    writeFile: vi.fn<MdpadApi['writeFile']>().mockResolvedValue(undefined),
    saveAs: vi.fn<MdpadApi['saveAs']>().mockResolvedValue(null),
    confirmUnsaved: vi.fn<MdpadApi['confirmUnsaved']>().mockResolvedValue('cancel'),
    setDocumentDirty: vi.fn<MdpadApi['setDocumentDirty']>(),
    closeWindow: vi.fn<MdpadApi['closeWindow']>(),
    onMenuCommand: vi.fn<MdpadApi['onMenuCommand']>((listener) => {
      menuListeners.add(listener)
      return () => menuListeners.delete(listener)
    }),
    onCloseRequested: vi.fn<MdpadApi['onCloseRequested']>((listener) => {
      closeListeners.add(listener)
      return () => closeListeners.delete(listener)
    }),
  } satisfies MdpadApi

  window.mdpad = api

  return {
    api,
    /** Simulates a menu item or its keyboard shortcut. */
    sendMenuCommand(command: MenuCommand) {
      act(() => menuListeners.forEach((listener) => listener(command)))
    },
    /** Simulates the main process asking to close a window with unsaved changes. */
    requestClose() {
      act(() => closeListeners.forEach((listener) => listener()))
    },
  }
}
