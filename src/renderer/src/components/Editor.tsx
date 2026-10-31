import { defaultKeymap, history, historyKeymap, indentWithTab, redo, undo } from '@codemirror/commands'
import { indentOnInput } from '@codemirror/language'
import { highlightSelectionMatches, openSearchPanel, search, searchKeymap } from '@codemirror/search'
import { EditorState, Transaction, type Extension } from '@codemirror/state'
import { drawSelection, dropCursor, EditorView, highlightActiveLine, keymap, placeholder } from '@codemirror/view'
import { useEffect, useEffectEvent, useImperativeHandle, useRef, type Ref } from 'react'
import { editorLineAt, editorOffsetOf, type PaneChange, type SyncPane } from '../scrollSync/panes'
import { markdownExtensions } from './editorMarkdown'

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
  ref?: Ref<EditorHandle>
}

const editorTheme = EditorView.theme({
  '&': { flex: '1', minHeight: '0', backgroundColor: 'var(--bg)', color: 'var(--fg)' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'var(--font-app)', fontSize: 'var(--editor-size)', lineHeight: 'var(--editor-lh)' },
  '.cm-content': { padding: 'var(--editor-pad-y) 0', caretColor: 'var(--fg)' },
  '.cm-line': { padding: '0 var(--editor-pad-x)' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--fg)' },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, ::selection':
    { backgroundColor: 'var(--editor-selection)' },
  '.cm-activeLine': { backgroundColor: 'var(--editor-active-line)' },
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
}

function createState(doc: string, { onDocChanged, onPaneChange }: StateCallbacks): EditorState {
  const extensions: Extension[] = [
    history(),
    drawSelection(),
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
    keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
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
export function Editor({ value, documentKey, onChange, hidden = false, ref }: EditorProps) {
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
      }),
    })
    viewRef.current = view
    return () => {
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
        createState(value, { onDocChanged: (text) => reportChange(text), onPaneChange: (change) => notifyPane(change) }),
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

  return <section className="pane editor-pane" aria-label="Editor" hidden={hidden} ref={hostRef} />
}
