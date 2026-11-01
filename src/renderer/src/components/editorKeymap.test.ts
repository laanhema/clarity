import { describe, expect, it } from 'vitest'
import { SHORTCUTS } from '../../../shared/shortcuts'
import { editorKeymap } from './editorKeymap'

/** "Mod-Shift-l" and "CmdOrCtrl+Shift+L" both become "Mod-Shift-l"; modifiers sorted. */
function normalize(parts: string[]): string {
  const key = parts.at(-1) ?? ''
  const modifiers = parts.slice(0, -1).map((part) => (part === 'CmdOrCtrl' ? 'Mod' : part))
  return [...modifiers.sort(), key.length === 1 ? key.toLowerCase() : key].join('-')
}

/** The keys CodeMirror binds on Linux, with each binding's shift variant. */
function boundKeys(): Set<string> {
  const keys = new Set<string>()
  for (const binding of editorKeymap) {
    const key = binding.linux ?? binding.key
    if (!key) continue
    keys.add(normalize(key.split('-')))
    if (binding.shift) keys.add(normalize(['Shift', ...key.split('-')]))
  }
  return keys
}

describe('editor keymap', () => {
  it('binds every editor shortcut the panel lists', () => {
    const bound = boundKeys()
    const editorShortcuts = SHORTCUTS.filter((shortcut) => shortcut.source.kind === 'editor')
    expect(editorShortcuts.length).toBeGreaterThan(0)
    for (const shortcut of editorShortcuts) {
      for (const accelerator of shortcut.keys) {
        expect(bound, `${shortcut.id}: ${accelerator}`).toContain(normalize(accelerator.split('+')))
      }
    }
  })

  it('leaves Mod-/ to the Keyboard Shortcuts menu item', () => {
    expect(boundKeys()).not.toContain('Mod-/')
  })
})
