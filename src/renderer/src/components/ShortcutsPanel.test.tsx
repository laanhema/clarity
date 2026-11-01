import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { keyCaps, SHORTCUTS, shortcutKeys } from '../../../shared/shortcuts'
import { ShortcutsPanel } from './ShortcutsPanel'

describe('ShortcutsPanel', () => {
  it('lists every shared shortcut, grouped', () => {
    render(<ShortcutsPanel platform="linux" onClose={vi.fn()} />)
    const dialog = screen.getByRole('dialog', { name: 'Keyboard shortcuts' })
    for (const group of ['File', 'Edit', 'Editor', 'View', 'Window', 'Help']) {
      expect(within(dialog).getByRole('heading', { name: group })).toBeInTheDocument()
    }
    for (const shortcut of SHORTCUTS) {
      if (shortcutKeys(shortcut, 'linux').length === 0) continue
      const group = within(dialog).getByRole('region', { name: shortcut.group })
      expect(within(group).getAllByText(shortcut.label).length).toBeGreaterThan(0)
    }
    expect(dialog.querySelectorAll('.shortcut-row')).toHaveLength(
      SHORTCUTS.filter((shortcut) => shortcutKeys(shortcut, 'linux').length > 0).length,
    )
  })

  it('draws keys as caps with words for screen readers', () => {
    render(<ShortcutsPanel platform="linux" onClose={vi.fn()} />)
    const row = screen.getByText('Open folder').closest('.shortcut-row')
    expect(row).not.toBeNull()
    const caps = [...(row?.querySelectorAll('kbd.keycap') ?? [])].map((cap) => cap.textContent)
    expect(caps).toEqual(['Ctrl', 'Shift', 'O'])
    expect(within(row as HTMLElement).getByText('Control Shift O')).toHaveClass('sr-only')
  })

  it('uses macOS symbols and hides shortcuts that do not exist there', () => {
    render(<ShortcutsPanel platform="mac" onClose={vi.fn()} />)
    const row = screen.getByText('Open folder').closest('.shortcut-row')
    const caps = [...(row?.querySelectorAll('kbd.keycap') ?? [])].map((cap) => cap.textContent)
    expect(caps).toEqual(['⇧', '⌘', 'O'])
    // Ctrl+Y redoes in the editor only outside macOS.
    const editorGroup = screen.getByRole('region', { name: 'Editor' })
    expect(within(editorGroup).queryByText('Redo')).not.toBeInTheDocument()
  })

  it('hides Quit on Windows, where Electron gives it no shortcut', () => {
    render(<ShortcutsPanel platform="windows" onClose={vi.fn()} />)
    expect(screen.queryByText('Quit')).not.toBeInTheDocument()
  })

  it('closes with the close button, Esc, or a click outside', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<ShortcutsPanel platform="linux" onClose={onClose} />)
    const dialog = screen.getByRole('dialog')

    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)

    dialog.dispatchEvent(new Event('cancel', { cancelable: true }))
    expect(onClose).toHaveBeenCalledTimes(2)

    await user.click(dialog)
    expect(onClose).toHaveBeenCalledTimes(3)

    // A click inside the panel keeps it open.
    await user.click(screen.getByRole('heading', { name: 'Keyboard shortcuts' }))
    expect(onClose).toHaveBeenCalledTimes(3)
  })
})

describe('keyCaps', () => {
  it('orders macOS modifiers as its menus do', () => {
    expect(keyCaps('Control+Command+F', 'mac').map((cap) => cap.label)).toEqual(['⌃', '⌘', 'F'])
    expect(keyCaps('CmdOrCtrl+Alt+G', 'mac').map((cap) => cap.label)).toEqual(['⌥', '⌘', 'G'])
  })

  it('spells out keys that are symbols', () => {
    expect(keyCaps('CmdOrCtrl+Plus', 'linux').map((cap) => cap.spoken)).toEqual(['Control', 'Plus'])
    expect(keyCaps('CmdOrCtrl+-', 'linux').map((cap) => cap.label)).toEqual(['Ctrl', '-'])
  })
})
