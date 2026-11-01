import { defaultKeymap, historyKeymap, indentWithTab } from '@codemirror/commands'
import { searchKeymap } from '@codemirror/search'
import type { KeyBinding } from '@codemirror/view'

/**
 * The editor's key bindings. The Keyboard Shortcuts panel lists the ones a
 * user would look for (src/shared/shortcuts.ts); a test checks those exist here.
 * CodeMirror binds Mod-/ to toggle a comment; Clarity uses it for the panel.
 */
export const editorKeymap: readonly KeyBinding[] = [
  ...defaultKeymap.filter((binding) => binding.key !== 'Mod-/'),
  ...historyKeymap,
  ...searchKeymap,
  indentWithTab,
]
