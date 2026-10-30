import { defaultKeymap, history, historyKeymap, indentWithTab, redo, undo } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { HighlightStyle, indentOnInput, syntaxHighlighting } from '@codemirror/language'
import { highlightSelectionMatches, openSearchPanel, search, searchKeymap } from '@codemirror/search'
import { EditorState, type Extension } from '@codemirror/state'
import { drawSelection, dropCursor, EditorView, highlightActiveLine, keymap, placeholder } from '@codemirror/view'
import { tags } from '@lezer/highlight'
import { useEffect, useEffectEvent, useImperativeHandle, useRef, type Ref } from 'react'

export interface EditorHandle {
  focus(): void
  openSearch(): void
  /**
   * Runs undo or redo on the document, unless a text field of the editor's
   * own (the search panel) has focus. Returns false when that field should
   * handle the command instead.
   */
  runHistory(command: 'undo' | 'redo'): boolean
}

export interface EditorProps {
  value: string
  /** Changes whenever another document is loaded; the undo history starts over. */
  documentKey: number
  onChange: (value: string) => void
  hidden?: boolean
  ref?: Ref<EditorHandle>
}

/** Markdown colours come from CSS variables, so they follow the light and dark themes. */
const markdownHighlight = HighlightStyle.define([
  { tag: tags.heading, color: 'var(--md-heading)', fontWeight: '600' },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: [tags.link, tags.url], color: 'var(--md-link)' },
  { tag: tags.monospace, color: 'var(--md-code)' },
  { tag: tags.quote, color: 'var(--fg-muted)', fontStyle: 'italic' },
  { tag: [tags.processingInstruction, tags.meta, tags.contentSeparator], color: 'var(--md-mark)' },
  { tag: tags.list, color: 'var(--md-mark)' },
])

const editorTheme = EditorView.theme({
  '&': { flex: '1', minHeight: '0', backgroundColor: 'var(--bg)', color: 'var(--fg)' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', fontSize: '14px', lineHeight: '1.6' },
  '.cm-content': { padding: '16px 0', caretColor: 'var(--fg)' },
  '.cm-line': { padding: '0 20px' },
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
  '.cm-panel.cm-search': { fontFamily: 'var(--font-ui)', padding: '6px 10px' },
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

function createState(doc: string, onDocChanged: (value: string) => void): EditorState {
  const extensions: Extension[] = [
    history(),
    drawSelection(),
    dropCursor(),
    indentOnInput(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    search({ top: true }),
    markdown(),
    syntaxHighlighting(markdownHighlight),
    EditorView.lineWrapping,
    EditorState.tabSize.of(4),
    placeholder('Start writing Markdown…'),
    EditorView.contentAttributes.of({ 'aria-label': 'Markdown source', spellcheck: 'false' }),
    keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
    editorTheme,
    EditorView.updateListener.of((update) => {
      if (update.docChanged) onDocChanged(update.state.doc.toString())
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

  const reportChange = useEffectEvent((text: string) => {
    reportedRef.current = text
    onChange(text)
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
      state: createState(initialValueRef.current, (text) => reportChange(text)),
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
      view.setState(createState(value, (text) => reportChange(text)))
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
    }),
    [],
  )

  return <section className="pane editor-pane" aria-label="Editor" hidden={hidden} ref={hostRef} />
}
