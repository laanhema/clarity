import type { MenuItemConstructorOptions } from 'electron'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_UI_SETTINGS, IpcChannel } from '../shared/api'
import { SHORTCUTS, shortcutKeys, type Platform, type Shortcut } from '../shared/shortcuts'
import { buildMenu, type MenuOptions } from './menu'

const send = vi.fn()

vi.mock('electron', () => {
  class BrowserWindow {
    webContents = { send }
    static getFocusedWindow(): BrowserWindow {
      return new BrowserWindow()
    }
  }
  // buildMenu returns the template itself, so the tests can read it.
  return { BrowserWindow, Menu: { buildFromTemplate: (template: unknown) => template } }
})

function template(isMac: boolean): MenuItemConstructorOptions[] {
  const options: MenuOptions = {
    isMac,
    isDev: false,
    ui: DEFAULT_UI_SETTINGS,
    recentFolders: [],
    setViewMode: vi.fn(),
    setTheme: vi.fn(),
    setFont: vi.fn(),
    setFontSize: vi.fn(),
    openRecent: vi.fn(),
    clearRecent: vi.fn(),
  }
  return buildMenu(options) as unknown as MenuItemConstructorOptions[]
}

function flatten(items: MenuItemConstructorOptions[]): MenuItemConstructorOptions[] {
  return items.flatMap((item) => [item, ...(Array.isArray(item.submenu) ? flatten(item.submenu) : [])])
}

// The submenus Electron fills in itself for these roles.
const IMPLICIT_ROLES: Record<string, (isMac: boolean) => string[]> = {
  windowMenu: (isMac) => (isMac ? ['minimize', 'zoom', 'front'] : ['minimize', 'zoom', 'close']),
  appMenu: () => ['about', 'services', 'hide', 'hideOthers', 'unhide', 'quit'],
}

function rolesIn(items: MenuItemConstructorOptions[], isMac: boolean): Set<string> {
  const roles = flatten(items).flatMap((item) =>
    item.role ? [item.role, ...(IMPLICIT_ROLES[item.role]?.(isMac) ?? [])] : [],
  )
  return new Set(roles)
}

const platforms: [Platform, boolean][] = [
  ['linux', false],
  ['windows', false],
  ['mac', true],
]

describe('menu shortcuts', () => {
  it.each(platforms)('takes every accelerator from the shared shortcut list (%s)', (platform, isMac) => {
    const menuAccelerators = flatten(template(isMac))
      .map((item) => item.accelerator)
      .filter((accelerator) => accelerator !== undefined)
      .sort()
    const shared = SHORTCUTS.filter((shortcut) => shortcut.source.kind === 'menu')
      .map((shortcut) => shortcutKeys(shortcut, platform)[0])
      .sort()
    expect(menuAccelerators).toEqual(shared)
  })

  it.each(platforms)('has the role behind every role shortcut listed for %s', (platform, isMac) => {
    const roles = rolesIn(template(isMac), isMac)
    const listed: Shortcut[] = SHORTCUTS.filter((shortcut) => shortcutKeys(shortcut, platform).length > 0)
    for (const shortcut of listed) {
      if (shortcut.source.kind === 'role') expect(roles, shortcut.id).toContain(shortcut.source.role)
    }
  })

  it('opens the Keyboard Shortcuts panel from the Help menu with Ctrl+/', () => {
    const help = template(false).find((item) => item.role === 'help')
    const item = Array.isArray(help?.submenu) ? help.submenu[0] : undefined
    expect(item?.label).toBe('Keyboard Shortcuts')
    expect(item?.accelerator).toBe('CmdOrCtrl+/')
    send.mockClear()
    item?.click?.({} as never, undefined, {})
    expect(send).toHaveBeenCalledWith(IpcChannel.MenuCommand, 'show-shortcuts')
  })
})
