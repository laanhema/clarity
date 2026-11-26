import { history, redo, undo } from '@codemirror/commands'
import { indentOnInput } from '@codemirror/language'
import { highlightSelectionMatches, openSearchPanel, search } from '@codemirror/search'
import { EditorState, StateEffect, StateField, Transaction, type Extension } from '@codemirror/state'
import { drawSelection, dropCursor, EditorView, highlightActiveLine, keymap, placeholder } from '@codemirror/view'
import { useEffect, useEffectEvent, useImperativeHandle, useRef, type Ref } from 'react'
import { editorLineAt, editorOffsetOf, type PaneChange, type SyncPane } from '../scrollSync/panes'
import { trackScrolling } from '../scrollbars'
import { editorKeymap } from './editorKeymap'
import { markdownExtensions } from './editorMarkdown'
import { rowSelection } from './editorSelection'

export interface EditorHandle {
  focus(): void
  openSearch(): void
  /**
   * Runs undo or redo on the document, unless a text field of the editor's
   * own (the search panel) has focus. Returns false when that field should
   * handle the command instead.
   */
  runHistory(command: 'undo' | 'redo'): boolean
  /** Keeps the preview scrolled in step with the editor. */
  readonly scrollSync: SyncPane
}

export interface EditorProps {
  value: string
  /** Changes whenever another document is loaded; the undo history starts over. */
  documentKey: number
  onChange: (value: string) => void
  hidden?: boolean
  /** Lays the text out in the preview's centred column, for editor-only view. */
  column?: boolean
  /**
   * Called when files are dropped on the editor, in drop order. Resolves to the
   * text to insert at the drop position, on lines of its own, or null to insert
   * nothing. Without it, a file drop inserts nothing.
   */
  onDropFiles?: (files: File[]) => Promise<string | null>
  ref?: Ref<EditorHandle>
}

const editorTheme = EditorView.theme({
  '&': { flex: '1', minHeight: '0', backgroundColor: 'var(--bg)', color: 'var(--fg)' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': {
    fontFamily: 'var(--font-app)',
    fontSize: 'var(--editor-size)',
    lineHeight: 'var(--editor-lh)',
    // Fades like the other scrollbars; see "Scrollbars" in styles.css.
    scrollbarWidth: 'thin',
    scrollbarColor: 'var(--scrollbar-thumb) transparent',
    transition: '--scrollbar-thumb var(--scrollbar-fade-out) ease-out',
  },
  '.cm-scroller:hover, .cm-scroller.scrolling': {
    '--scrollbar-thumb': 'var(--scrollbar-thumb-visible)',
    transitionDuration: 'var(--scrollbar-fade-in)',
  },
  // Keeps the fading, inherited scrollbar-color from restyling every line on each frame.
  '.cm-scroller > *': { scrollbarColor: 'transparent transparent' },
  '.cm-content': { padding: 'var(--editor-pad-y) 0', caretColor: 'var(--fg)' },
  // In editor-only view the pane sets --editor-column, and the side padding
  // grows so the text fills a centred column of that width, where the preview
  // puts its text. The lines stay full width, so clicks in the margins still
  // place the cursor. The padding is rounded to whole pixels because
  // CodeMirror reads it with parseInt to find where selections start and end.
  '.cm-line': { padding: '0 round(max(var(--editor-pad-x), (100% - var(--editor-column, 100%)) / 2), 1px)' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--fg)' },
  '&.cm-focused > .cm-scroller > .cm-rowSelectionLayer .cm-selectionBackground, .cm-selectionBackground, ::selection':
    { backgroundColor: 'var(--editor-selection)' },
  // Painted only behind the text, not the padding, so it spans the same
  // column as a selection does. Highlighted only while the editor has focus,
  // so opening a file does not highlight line 1 before the user moves into it.
  '.cm-activeLine': { backgroundColor: 'transparent', backgroundClip: 'content-box' },
  '&.cm-focused .cm-activeLine': { backgroundColor: 'var(--editor-active-line)' },
  '.cm-selectionMatch': { backgroundColor: 'var(--editor-match)' },
  '.cm-searchMatch': { backgroundColor: 'var(--editor-match)', outline: '1px solid var(--border)' },
  '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: 'var(--editor-match-selected)' },
  '.cm-placeholder': { color: 'var(--fg-muted)' },
  '.cm-panels': { backgroundColor: 'var(--bg-sidebar)', color: 'var(--fg)' },
  '.cm-panels.cm-panels-top': { borderBottom: '1px solid var(--border)' },
  '.cm-panel.cm-search': { fontFamily: 'var(--font-app)', padding: '6px 10px' },
  '.cm-panel.cm-search input, .cm-panel.cm-search button': { fontFamily: 'inherit', fontSize: '12px' },
  '.cm-textfield': {
    backgroundColor: 'var(--bg)',
    color: 'var(--fg)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
  },
  '.cm-button': {
    backgroundImage: 'none',
    backgroundColor: 'var(--bg)',
    color: 'var(--fg)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
  },
})

interface StateCallbacks {
  onDocChanged: (value: string) => void
  onPaneChange: (change: PaneChange) => void
  onDropFiles: (files: File[], position: number) => void
}

/** Starts tracking the position of a file drop whose text is still on its way. */
const trackDrop = StateEffect.define<{ id: number; position: number }>()
/** Stops tracking a file drop: its text went in, or there is none. */
const settleDrop = StateEffect.define<number>()

/**
 * The positions of file drops whose text is still on its way, by drop id. Each
 * moves with the edits made meanwhile, so typing during a slow copy does not
 * put the text in the wrong place. A new document starts with none.
 */
const pendingDrops = StateField.define<ReadonlyMap<number, number>>({
  create: () => new Map(),
  update(drops, transaction) {
    let next = drops
    if (transaction.docChanged && drops.size > 0) {
      next = new Map([...drops].map(([id, position]) => [id, transaction.changes.mapPos(position)]))
    }
    for (const effect of transaction.effects) {
      if (effect.is(trackDrop)) {
        next = new Map(next).set(effect.value.id, effect.value.position)
      } else if (effect.is(settleDrop)) {
        const remaining = new Map(next)
        remaining.delete(effect.value)
        next = remaining
      }
    }
    return next
  },
})

let nextDropId = 0

/**
 * Takes file drops away from CodeMirror, which would insert a text file's
 * contents. Dragged text has no files and stays with CodeMirror.
 */
function fileDropHandlers(onDropFiles: StateCallbacks['onDropFiles']): Extension {
  return EditorView.domEventHandlers({
    dragover(event) {
      if (!event.dataTransfer?.types.includes('Files')) return false
      event.preventDefault()
      event.dataTransfer.dropEffect = 'copy'
      return false
    },
    drop(event, view) {
      const files = event.dataTransfer?.files
      if (!files || files.length === 0) return false
      event.preventDefault()
      onDropFiles([...files], view.posAtCoords({ x: event.clientX, y: event.clientY }, false))
      return true
    },
  })
}

function createState(doc: string, { onDocChanged, onPaneChange, onDropFiles }: StateCallbacks): EditorState {
  const extensions: Extension[] = [
    history(),
    drawSelection(),
    rowSelection,
    dropCursor(),
    indentOnInput(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    search({ top: true }),
    markdownExtensions,
    EditorView.lineWrapping,
    EditorState.tabSize.of(4),
    placeholder('Start writing Markdown…'),
    EditorView.contentAttributes.of({ 'aria-label': 'Markdown source', spellcheck: 'false' }),
    keymap.of(editorKeymap),
    pendingDrops,
    fileDropHandlers(onDropFiles),
    editorTheme,
    EditorView.updateListener.of((update) => {
      if (update.docChanged) onDocChanged(update.state.doc.toString())
      // Typing, searching, undo: the user moved the editor, even without scrolling it.
      if (update.transactions.some((transaction) => transaction.annotation(Transaction.userEvent) !== undefined)) {
        onPaneChange('input')
      } else if (update.geometryChanged || update.heightChanged) {
        onPaneChange('layout')
      }
    }),
  ]
  return EditorState.create({ doc, extensions })
}

/** The Markdown source editor (CodeMirror 6): undo/redo, search and replace, line wrapping. */
export function Editor({ value, documentKey, onChange, hidden = false, column = false, onDropFiles, ref }: EditorProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  // The text this editor last reported, so the echo of its own change is not applied back.
  const reportedRef = useRef(value)
  const keyRef = useRef(documentKey)
  const initialValueRef = useRef(value)
  const paneListenersRef = useRef(new Set<(change: PaneChange) => void>())

  const reportChange = useEffectEvent((text: string) => {
    reportedRef.current = text
    onChange(text)
  })

  const notifyPane = useEffectEvent((change: PaneChange) => {
    for (const listener of paneListenersRef.current) listener(change)
  })

  // The text for dropped files comes back asynchronously; it goes in only if
  // the same document is still open, at the drop position as moved by the
  // edits made meanwhile. It gets lines of its own: a line break goes before it
  // unless the position starts a line, and after it unless the position ends one.
  const dropFiles = useEffectEvent((files: File[], position: number) => {
    const view = viewRef.current
    if (!onDropFiles || !view) return
    const id = nextDropId++
    view.dispatch({ effects: trackDrop.of({ id, position }) })
    void onDropFiles(files).then((text) => {
      const current = viewRef.current
      const from = current?.state.field(pendingDrops, false)?.get(id)
      // A document opened since the drop has no record of it.
      if (!current || from === undefined) return
      if (!text) {
        current.dispatch({ effects: settleDrop.of(id) })
        return
      }
      const line = current.state.doc.lineAt(from)
      const before = from > line.from ? '\n' : ''
      const after = from < line.to ? '\n' : ''
      current.dispatch({
        changes: { from, insert: `${before}${text}${after}` },
        selection: { anchor: from + before.length + text.length },
        effects: settleDrop.of(id),
        userEvent: 'input.drop',
        scrollIntoView: true,
      })
      current.focus()
    })
  })

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    // CodeMirror styles itself with a stylesheet it builds at runtime. In a
    // document that is a <style> element, which the app's CSP blocks; in a
    // shadow root it is a constructed stylesheet, which CSP allows. Colours
    // still come from the page's CSS variables, which inherit into the shadow root.
    const root = host.shadowRoot ?? host.attachShadow({ mode: 'open' })
    const view = new EditorView({
      root,
      parent: root,
      state: createState(initialValueRef.current, {
        onDocChanged: (text) => reportChange(text),
        onPaneChange: (change) => notifyPane(change),
        onDropFiles: (files, position) => dropFiles(files, position),
      }),
    })
    viewRef.current = view
    const stopTracking = trackScrolling(root)
    return () => {
      stopTracking()
      view.destroy()
      viewRef.current = null
    }
  }, [])

  // Apply documents loaded from outside: a new file replaces the whole state,
  // a reload of the same file is an ordinary (undoable) change.
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    if (keyRef.current !== documentKey) {
      keyRef.current = documentKey
      reportedRef.current = value
      view.setState(
        createState(value, {
          onDocChanged: (text) => reportChange(text),
          onPaneChange: (change) => notifyPane(change),
          onDropFiles: (files, position) => dropFiles(files, position),
        }),
      )
      // A new document opens at its top; the preview follows the editor there.
      view.scrollDOM.scrollTop = 0
      return
    }
    if (value === reportedRef.current) return
    reportedRef.current = value
    if (view.state.doc.toString() !== value) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } })
    }
  }, [documentKey, value])

  useImperativeHandle(
    ref,
    () => ({
      focus: () => viewRef.current?.focus(),
      openSearch: () => {
        const view = viewRef.current
        if (!view) return
        openSearchPanel(view)
      },
      runHistory: (command) => {
        const view = viewRef.current
        if (!view) return false
        const active = view.root.activeElement
        if (active && active !== view.contentDOM && view.dom.contains(active)) return false
        if (command === 'undo') undo(view)
        else redo(view)
        return true
      },
      scrollSync: {
        scroller: () => viewRef.current?.scrollDOM ?? null,
        lineAt: (offset) => (viewRef.current ? editorLineAt(viewRef.current, offset) : 0),
        offsetOf: (line) => (viewRef.current ? editorOffsetOf(viewRef.current, line) : 0),
        subscribe: (listener) => {
          const listeners = paneListenersRef.current
          listeners.add(listener)
          return () => listeners.delete(listener)
        },
      },
    }),
    [],
  )

  return (
    <section
      className={column ? 'pane editor-pane editor-column' : 'pane editor-pane'}
      aria-label="Editor"
      hidden={hidden}
      ref={hostRef}
    />
  )
}
