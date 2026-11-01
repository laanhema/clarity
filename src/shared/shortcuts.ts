/**
 * Every keyboard shortcut Clarity has, in one list. The menu takes its
 * accelerators from here (`menuAccelerator`) and the Keyboard Shortcuts panel
 * shows this list, so the two cannot drift apart.
 *
 * Keys use Electron's accelerator syntax ("CmdOrCtrl+Shift+O"). An entry may
 * list several key combinations; the first one of a menu entry is the menu's
 * accelerator. `mac` and `windows` replace `keys` on that platform, and an
 * empty list hides the entry there.
 */

export type Platform = 'mac' | 'windows' | 'linux'

/** Maps Node's `process.platform` to the three platforms Clarity labels keys for. */
export function platformOf(nodePlatform: string): Platform {
  if (nodePlatform === 'darwin') return 'mac'
  if (nodePlatform === 'win32') return 'windows'
  return 'linux'
}

export type ShortcutGroup = 'File' | 'Edit' | 'Editor' | 'View' | 'Window' | 'Help'
export const SHORTCUT_GROUPS = [
  'File',
  'Edit',
  'Editor',
  'View',
  'Window',
  'Help',
] as const satisfies readonly ShortcutGroup[]

/**
 * Where a shortcut is bound:
 * - `menu`: a menu item in src/main/menu.ts whose accelerator comes from this list;
 * - `role`: an Electron menu role, which brings its own accelerator. The keys
 *   here are Electron's defaults for that role (checked against Electron 45);
 * - `editor`: the CodeMirror keymap in Editor.tsx;
 * - `pane`: the app's own key handling (the pane dividers).
 */
export type ShortcutSource =
  | { readonly kind: 'menu' }
  | { readonly kind: 'role'; readonly role: string }
  | { readonly kind: 'editor' }
  | { readonly kind: 'pane' }

export interface Shortcut {
  readonly id: string
  readonly group: ShortcutGroup
  readonly label: string
  readonly keys: readonly string[]
  readonly mac?: readonly string[]
  readonly windows?: readonly string[]
  readonly source: ShortcutSource
  /** A short extra hint shown under the label. */
  readonly note?: string
}

const MENU = { kind: 'menu' } as const
const EDITOR = { kind: 'editor' } as const

export const SHORTCUTS = [
  { id: 'new-file', group: 'File', label: 'New document', keys: ['CmdOrCtrl+N'], source: MENU },
  { id: 'open-file', group: 'File', label: 'Open file', keys: ['CmdOrCtrl+O'], source: MENU },
  { id: 'open-folder', group: 'File', label: 'Open folder', keys: ['CmdOrCtrl+Shift+O'], source: MENU },
  { id: 'save', group: 'File', label: 'Save', keys: ['CmdOrCtrl+S'], source: MENU },
  { id: 'save-as', group: 'File', label: 'Save as', keys: ['CmdOrCtrl+Shift+S'], source: MENU },
  // Electron's quit role has no accelerator on Windows.
  {
    id: 'quit',
    group: 'File',
    label: 'Quit',
    keys: ['CmdOrCtrl+Q'],
    windows: [],
    source: { kind: 'role', role: 'quit' },
  },

  { id: 'undo', group: 'Edit', label: 'Undo', keys: ['CmdOrCtrl+Z'], source: MENU },
  { id: 'redo', group: 'Edit', label: 'Redo', keys: ['CmdOrCtrl+Shift+Z'], source: MENU },
  { id: 'cut', group: 'Edit', label: 'Cut', keys: ['CmdOrCtrl+X'], source: { kind: 'role', role: 'cut' } },
  { id: 'copy', group: 'Edit', label: 'Copy', keys: ['CmdOrCtrl+C'], source: { kind: 'role', role: 'copy' } },
  { id: 'paste', group: 'Edit', label: 'Paste', keys: ['CmdOrCtrl+V'], source: { kind: 'role', role: 'paste' } },
  {
    id: 'select-all',
    group: 'Edit',
    label: 'Select all',
    keys: ['CmdOrCtrl+A'],
    source: { kind: 'role', role: 'selectAll' },
  },
  {
    id: 'find',
    group: 'Edit',
    label: 'Find and replace',
    keys: ['CmdOrCtrl+F'],
    note: 'Esc closes the search panel',
    source: MENU,
  },

  // CodeMirror's history keymap adds Ctrl+Y outside macOS.
  { id: 'redo-editor', group: 'Editor', label: 'Redo', keys: ['CmdOrCtrl+Y'], mac: [], source: EDITOR },
  { id: 'find-next', group: 'Editor', label: 'Next match', keys: ['F3', 'CmdOrCtrl+G'], source: EDITOR },
  {
    id: 'find-previous',
    group: 'Editor',
    label: 'Previous match',
    keys: ['Shift+F3', 'CmdOrCtrl+Shift+G'],
    source: EDITOR,
  },
  { id: 'select-next', group: 'Editor', label: 'Select next occurrence', keys: ['CmdOrCtrl+D'], source: EDITOR },
  {
    id: 'select-all-matches',
    group: 'Editor',
    label: 'Select all occurrences',
    keys: ['CmdOrCtrl+Shift+L'],
    source: EDITOR,
  },
  { id: 'go-to-line', group: 'Editor', label: 'Go to line', keys: ['CmdOrCtrl+Alt+G'], source: EDITOR },
  {
    id: 'indent',
    group: 'Editor',
    label: 'Indent selection',
    keys: ['Tab'],
    note: 'Press Esc first to move focus out of the editor with Tab',
    source: EDITOR,
  },
  { id: 'outdent', group: 'Editor', label: 'Outdent selection', keys: ['Shift+Tab'], source: EDITOR },

  { id: 'view-editor', group: 'View', label: 'Editor only', keys: ['CmdOrCtrl+1'], source: MENU },
  { id: 'view-split', group: 'View', label: 'Editor and preview', keys: ['CmdOrCtrl+2'], source: MENU },
  { id: 'view-preview', group: 'View', label: 'Preview only', keys: ['CmdOrCtrl+3'], source: MENU },
  {
    id: 'resize-panes',
    group: 'View',
    label: 'Move a focused pane divider',
    keys: ['Left', 'Right'],
    source: { kind: 'pane' },
  },
  { id: 'zoom-in', group: 'View', label: 'Zoom in', keys: ['CmdOrCtrl+Plus'], source: { kind: 'role', role: 'zoomIn' } },
  { id: 'zoom-out', group: 'View', label: 'Zoom out', keys: ['CmdOrCtrl+-'], source: { kind: 'role', role: 'zoomOut' } },
  {
    id: 'zoom-reset',
    group: 'View',
    label: 'Reset zoom level',
    keys: ['CmdOrCtrl+0'],
    source: { kind: 'role', role: 'resetZoom' },
  },
  {
    id: 'full-screen',
    group: 'View',
    label: 'Full screen',
    keys: ['F11'],
    mac: ['Control+Command+F'],
    source: { kind: 'role', role: 'togglefullscreen' },
  },

  {
    id: 'minimize',
    group: 'Window',
    label: 'Minimize',
    keys: ['CmdOrCtrl+M'],
    source: { kind: 'role', role: 'minimize' },
  },
  {
    id: 'close-window',
    group: 'Window',
    label: 'Close window',
    keys: ['CmdOrCtrl+W'],
    source: { kind: 'role', role: 'close' },
  },

  { id: 'show-shortcuts', group: 'Help', label: 'Keyboard shortcuts', keys: ['CmdOrCtrl+/'], source: MENU },
] as const satisfies readonly Shortcut[]

export type ShortcutId = (typeof SHORTCUTS)[number]['id']
export type MenuShortcutId = Extract<(typeof SHORTCUTS)[number], { source: { kind: 'menu' } }>['id']

/** The key combinations of a shortcut on one platform; empty when it has none there. */
export function shortcutKeys(shortcut: Shortcut, platform: Platform): readonly string[] {
  if (platform === 'mac' && shortcut.mac) return shortcut.mac
  if (platform === 'windows' && shortcut.windows) return shortcut.windows
  return shortcut.keys
}

/** The accelerator of a menu item, taken from the shortcut list. */
export function menuAccelerator(id: MenuShortcutId): string {
  const shortcut: Shortcut | undefined = SHORTCUTS.find((entry) => entry.id === id)
  const accelerator = shortcut?.keys[0]
  if (accelerator === undefined) throw new Error(`No shortcut for menu item ${id}`)
  return accelerator
}

/** One key of a combination, as the panel draws it and as a screen reader reads it. */
export interface KeyCap {
  readonly label: string
  readonly spoken: string
}

const MAC_MODIFIER_ORDER = ['Control', 'Option', 'Shift', 'Command']

function keyCap(token: string, platform: Platform): KeyCap {
  const mac = platform === 'mac'
  switch (token) {
    case 'CmdOrCtrl':
    case 'CommandOrControl':
      return mac ? { label: '⌘', spoken: 'Command' } : { label: 'Ctrl', spoken: 'Control' }
    case 'Cmd':
    case 'Command':
      return { label: '⌘', spoken: 'Command' }
    case 'Ctrl':
    case 'Control':
      return mac ? { label: '⌃', spoken: 'Control' } : { label: 'Ctrl', spoken: 'Control' }
    case 'Alt':
    case 'Option':
      return mac ? { label: '⌥', spoken: 'Option' } : { label: 'Alt', spoken: 'Alt' }
    case 'Shift':
      return mac ? { label: '⇧', spoken: 'Shift' } : { label: 'Shift', spoken: 'Shift' }
    case 'Plus':
      return { label: '+', spoken: 'Plus' }
    case '-':
      return { label: '-', spoken: 'Minus' }
    case '/':
      return { label: '/', spoken: 'Slash' }
    case 'Escape':
    case 'Esc':
      return { label: 'Esc', spoken: 'Escape' }
    case 'Left':
      return { label: '←', spoken: 'Left arrow' }
    case 'Right':
      return { label: '→', spoken: 'Right arrow' }
    case 'Tab':
      return mac ? { label: '⇥', spoken: 'Tab' } : { label: 'Tab', spoken: 'Tab' }
    default:
      return { label: token, spoken: token }
  }
}

/**
 * Splits an accelerator into the keys to draw. On macOS the modifiers come in
 * Apple's order (⌃⌥⇧⌘), as its menus show them.
 */
export function keyCaps(accelerator: string, platform: Platform): KeyCap[] {
  // "CmdOrCtrl+-" splits cleanly; only a literal "+" key would not, and accelerators spell that "Plus".
  const caps = accelerator.split('+').map((token) => keyCap(token, platform))
  if (platform !== 'mac') return caps
  const rank = (cap: KeyCap): number => {
    const index = MAC_MODIFIER_ORDER.indexOf(cap.spoken)
    return index === -1 ? MAC_MODIFIER_ORDER.length : index
  }
  return caps.toSorted((a, b) => rank(a) - rank(b))
}
