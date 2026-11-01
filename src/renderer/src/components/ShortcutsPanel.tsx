import { Fragment, useEffect, useId, useRef } from 'react'
import {
  keyCaps,
  SHORTCUT_GROUPS,
  SHORTCUTS,
  shortcutKeys,
  type Platform,
  type Shortcut,
} from '../../../shared/shortcuts'

export interface ShortcutsPanelProps {
  platform: Platform
  onClose: () => void
}

/** The focused element, looking inside shadow roots (the editor lives in one). */
function deepActiveElement(): Element | null {
  let active = document.activeElement
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement
  return active
}

function Combination({ accelerator, platform }: { accelerator: string; platform: Platform }) {
  const caps = keyCaps(accelerator, platform)
  return (
    <>
      <span className="sr-only">{caps.map((cap) => cap.spoken).join(' ')}</span>
      <kbd className="shortcut-keys" aria-hidden="true">
        {caps.map((cap, index) => (
          <Fragment key={index}>
            {index > 0 && platform !== 'mac' && <span className="shortcut-plus">+</span>}
            <kbd className="keycap">{cap.label}</kbd>
          </Fragment>
        ))}
      </kbd>
    </>
  )
}

function Row({ shortcut, keys, platform }: { shortcut: Shortcut; keys: readonly string[]; platform: Platform }) {
  return (
    <div className="shortcut-row">
      <dt>
        {shortcut.label}
        {shortcut.note && <span className="shortcut-note">{shortcut.note}</span>}
      </dt>
      <dd>
        {keys.map((accelerator, index) => (
          <Fragment key={accelerator}>
            {index > 0 && <span className="shortcut-or">or</span>}
            <Combination accelerator={accelerator} platform={platform} />
          </Fragment>
        ))}
      </dd>
    </div>
  )
}

/**
 * The Keyboard Shortcuts panel (Help → Keyboard Shortcuts). A modal dialog that
 * lists every shortcut from the shared list; Esc, the close button or a click
 * outside closes it, and focus goes back to where it was.
 */
export function ShortcutsPanel({ platform, onClose }: ShortcutsPanelProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const previous = deepActiveElement()
    // A modal dialog keeps focus inside and makes the rest of the window inert.
    dialog.showModal()
    return () => {
      dialog.close()
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus()
    }
  }, [])

  const groups = SHORTCUT_GROUPS.map((group) => ({
    group,
    rows: SHORTCUTS.filter((shortcut) => shortcut.group === group)
      .map((shortcut) => ({ shortcut, keys: shortcutKeys(shortcut, platform) }))
      .filter(({ keys }) => keys.length > 0),
  })).filter(({ rows }) => rows.length > 0)

  return (
    <dialog
      ref={dialogRef}
      className="shortcuts"
      aria-labelledby={titleId}
      onCancel={(event) => {
        // Esc: let React unmount the panel rather than the browser closing it.
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        // The content fills the dialog, so a click on the dialog itself landed on the backdrop.
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="shortcuts-content">
        <header className="shortcuts-header">
          <h2 id={titleId}>Keyboard shortcuts</h2>
          <button type="button" className="shortcuts-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="shortcuts-body">
          {groups.map(({ group, rows }) => (
            <section key={group} className="shortcut-group" aria-labelledby={`${titleId}-${group}`}>
              <h3 id={`${titleId}-${group}`}>{group}</h3>
              <dl>
                {rows.map(({ shortcut, keys }) => (
                  <Row key={shortcut.id} shortcut={shortcut} keys={keys} platform={platform} />
                ))}
              </dl>
            </section>
          ))}
        </div>
      </div>
    </dialog>
  )
}
