import { useEffect, useEffectEvent, useRef, useState } from 'react'
import {
  DEFAULT_UI_SETTINGS,
  EDITOR_FRACTION_RANGE,
  SIDEBAR_WIDTH_RANGE,
  type MenuCommand,
  type OpenedFolder,
  type ThemeSetting,
  type UiSettings,
} from '../../shared/api'
import { Editor, type EditorHandle } from './components/Editor'
import { Preview, type PreviewHandle } from './components/Preview'
import { Sidebar } from './components/Sidebar'
import { Splitter } from './components/Splitter'
import { StatusBar } from './components/StatusBar'
import { decideExternalChange } from './externalChange'
import { useScrollSync } from './scrollSync/useScrollSync'
import { countWords, errorMessage, fileName } from './text'
import { useTokenEstimate } from './useTokenEstimate'

interface DocumentState {
  /** Null for a new document that has never been saved. */
  path: string | null
  content: string
  /**
   * The content as it is on disk; the document is dirty when `content`
   * differs. Null when the file was deleted or moved away by another program.
   */
  savedContent: string | null
  /** Identifies one loaded document; the editor starts a fresh undo history when it changes. */
  key: number
}

let nextDocumentKey = 1

function loadedDocument(path: string | null, content: string): DocumentState {
  return { path, content, savedContent: content, key: nextDocumentKey++ }
}

const NEW_DOCUMENT: DocumentState = { path: null, content: '', savedContent: '', key: 0 }

function isDirty(document: DocumentState): boolean {
  return document.content !== document.savedContent
}

function documentName(document: DocumentState): string {
  return document.path ? fileName(document.path) : 'Untitled'
}

const SPLITTER_WIDTH = 5
const NEXT_THEME: Record<ThemeSetting, ThemeSetting> = {
  system: 'light',
  light: 'dark',
  dark: 'gruvbox-material-dark-hard',
  'gruvbox-material-dark-hard': 'tokyo-night-moon',
  'tokyo-night-moon': 'system',
}

export function App() {
  const api = window.lantern
  const [folder, setFolder] = useState<OpenedFolder | null>(null)
  const [doc, setDoc] = useState<DocumentState>(NEW_DOCUMENT)
  const [message, setMessage] = useState<string | null>(null)
  const [settings, setSettings] = useState<UiSettings>(() => ({ ...DEFAULT_UI_SETTINGS, theme: api.initialTheme }))
  // Native dialogs are modal, but async work around them is not: run one flow at a time.
  const busy = useRef(false)
  const latestDoc = useRef(doc)
  const editor = useRef<EditorHandle>(null)
  const preview = useRef<PreviewHandle>(null)
  const workspace = useRef<HTMLDivElement>(null)
  const externalCheck = useRef({ running: false, again: false })

  const dirty = isDirty(doc)
  const name = documentName(doc)
  const tokenCount = useTokenEstimate(doc.content)

  useEffect(() => {
    latestDoc.current = doc
  }, [doc])

  useEffect(() => {
    api.setDocumentDirty(dirty)
  }, [api, dirty])

  useEffect(() => {
    document.title = `${dirty ? '● ' : ''}${name} — Lantern`
  }, [dirty, name])

  useEffect(() => {
    let cancelled = false
    api.getSettings().then(
      (loaded) => {
        if (!cancelled) setSettings(loaded)
      },
      () => undefined,
    )
    const unsubscribe = api.onSettingsChanged(setSettings)
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [api])

  // styles.css picks the theme's colours and layout from this attribute.
  useEffect(() => {
    document.documentElement.dataset['theme'] = settings.theme
  }, [settings.theme])

  // styles.css takes the app font from data-font, and scales the editor and preview text from --content-size.
  useEffect(() => {
    document.documentElement.dataset['font'] = settings.font
  }, [settings.font])

  useEffect(() => {
    document.documentElement.style.setProperty('--content-size', `${settings.fontSize}px`)
  }, [settings.fontSize])

  useEffect(() => {
    api.watchDocument(doc.path).catch((error: unknown) => setMessage(errorMessage(error)))
  }, [api, doc.path])

  function updateSettings(patch: Partial<UiSettings>): void {
    setSettings((current) => ({ ...current, ...patch }))
    api.updateSettings(patch)
  }

  async function exclusive(task: () => Promise<void>): Promise<void> {
    if (busy.current) return
    busy.current = true
    setMessage(null)
    try {
      await task()
    } catch (error) {
      setMessage(errorMessage(error))
    } finally {
      busy.current = false
    }
  }

  async function refreshTree(): Promise<void> {
    if (!folder) return
    const tree = await api.listMarkdownFiles()
    setFolder((current) => current && { ...current, tree })
  }

  async function saveAs(snapshot: DocumentState): Promise<boolean> {
    const savedPath = await api.saveAs(snapshot.content, snapshot.path)
    if (!savedPath) return false
    setDoc((current) => ({ ...current, path: savedPath, savedContent: snapshot.content }))
    await refreshTree()
    return true
  }

  async function save(snapshot: DocumentState): Promise<boolean> {
    if (!snapshot.path) return saveAs(snapshot)
    await api.writeFile(snapshot.path, snapshot.content)
    // Typing may have continued while the write ran; only what was written counts as saved.
    setDoc((current) => (current.path === snapshot.path ? { ...current, savedContent: snapshot.content } : current))
    return true
  }

  /** Resolves to true when it is fine to replace or close the current document. */
  async function settleUnsavedChanges(snapshot: DocumentState): Promise<boolean> {
    if (!isDirty(snapshot)) return true
    const choice = await api.confirmUnsaved(documentName(snapshot))
    if (choice === 'cancel') return false
    if (choice === 'discard') return true
    return save(snapshot)
  }

  function openPath(path: string): Promise<void> {
    return exclusive(async () => {
      if (path === doc.path) return
      if (!(await settleUnsavedChanges(doc))) return
      const content = await api.readFile(path)
      setDoc(loadedDocument(path, content))
    })
  }

  function openFileDialog(): Promise<void> {
    return exclusive(async () => {
      const opened = await api.openFile()
      if (!opened) return
      if (!(await settleUnsavedChanges(doc))) return
      setDoc(loadedDocument(opened.path, opened.content))
    })
  }

  /**
   * Opens a folder that the main process picked. Another folder closes the
   * open document, after settling its unsaved changes; the same folder again
   * only refreshes the sidebar.
   */
  async function enterFolder(rootPath: string): Promise<void> {
    const switching = rootPath !== folder?.rootPath
    let settled = false
    try {
      settled = !switching || (await settleUnsavedChanges(doc))
    } finally {
      // Cancelled or failed: keep the old folder and let the main process forget the pick.
      if (!settled) await api.enterFolder(null)
    }
    if (!settled) return
    const opened = await api.enterFolder(rootPath)
    if (!opened) return
    setFolder(opened)
    if (switching) setDoc(loadedDocument(null, ''))
  }

  function openFolderDialog(): Promise<void> {
    return exclusive(async () => {
      const rootPath = await api.pickFolder()
      if (rootPath) await enterFolder(rootPath)
    })
  }

  function newDocument(): Promise<void> {
    return exclusive(async () => {
      if (!(await settleUnsavedChanges(doc))) return
      setDoc(loadedDocument(null, ''))
      editor.current?.focus()
    })
  }

  function runHistory(command: 'undo' | 'redo'): void {
    const active = document.activeElement
    const inOtherField = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement
    if (!inOtherField && editor.current?.runHistory(command)) return
    // A plain text field (such as the editor's search box) keeps its own history.
    document.execCommand(command)
  }

  function find(): void {
    if (settings.viewMode === 'preview') updateSettings({ viewMode: 'split' })
    // Let the editor become visible before its search panel takes focus.
    setTimeout(() => editor.current?.openSearch(), 0)
  }

  /** Brings the document in line with a file that another program changed. */
  async function reconcileWithDisk(path: string): Promise<void> {
    if (latestDoc.current.path !== path) return
    let disk: string | null
    try {
      disk = await api.readFile(path)
    } catch {
      disk = null
    }
    const current = latestDoc.current
    if (current.path !== path) return
    const name = documentName(current)

    switch (decideExternalChange(current, disk)) {
      case 'ignore':
        return
      case 'missing':
        setDoc((latest) => (latest.path === path ? { ...latest, savedContent: null } : latest))
        setMessage(`${name} was deleted or moved by another program. Save to write it again.`)
        return
      case 'mark-saved':
      case 'reload':
        // Re-check against the newest state: typing may have started in the meantime.
        setDoc((latest) => {
          if (latest.path !== path || disk === null) return latest
          if (latest.content === disk) return { ...latest, savedContent: disk }
          if (isDirty(latest)) return latest
          return { ...latest, content: disk, savedContent: disk }
        })
        return
      case 'ask': {
        const choice = await api.confirmReload(name)
        setDoc((latest) => {
          if (latest.path !== path || disk === null) return latest
          return choice === 'reload'
            ? { ...latest, content: disk, savedContent: disk }
            : // Keep the user's text; it stays unsaved against the new disk content.
              { ...latest, savedContent: disk }
        })
        return
      }
    }
  }

  /** Runs one disk check at a time; a change that arrives during a check triggers one more. */
  async function checkExternalChange(path: string): Promise<void> {
    const state = externalCheck.current
    if (state.running) {
      state.again = true
      return
    }
    state.running = true
    try {
      do {
        state.again = false
        await reconcileWithDisk(path)
      } while (state.again)
    } catch (error) {
      setMessage(errorMessage(error))
    } finally {
      state.running = false
    }
  }

  const onMenuCommand = useEffectEvent((command: MenuCommand) => {
    switch (command) {
      case 'new-file':
        return void newDocument()
      case 'open-file':
        return void openFileDialog()
      case 'open-folder':
        return void openFolderDialog()
      case 'save':
        return void exclusive(async () => void (await save(doc)))
      case 'save-as':
        return void exclusive(async () => void (await saveAs(doc)))
      case 'undo':
      case 'redo':
        return runHistory(command)
      case 'find':
        return find()
    }
  })

  const onCloseRequested = useEffectEvent(() => {
    void exclusive(async () => {
      if (await settleUnsavedChanges(doc)) api.closeWindow()
    })
  })

  const onFolderPicked = useEffectEvent((rootPath: string) => void exclusive(() => enterFolder(rootPath)))
  const onDocumentChanged = useEffectEvent((path: string) => void checkExternalChange(path))
  const onTreeChanged = useEffectEvent(() => void refreshTree().catch(() => undefined))

  useEffect(() => api.onMenuCommand((command) => onMenuCommand(command)), [api])
  useEffect(() => api.onCloseRequested(() => onCloseRequested()), [api])
  useEffect(() => api.onFolderPicked((rootPath) => onFolderPicked(rootPath)), [api])
  useEffect(() => api.onDocumentChanged((path) => onDocumentChanged(path)), [api])
  useEffect(() => api.onTreeChanged(() => onTreeChanged()), [api])

  const { viewMode, sidebarWidth, editorFraction } = settings
  useScrollSync(editor, preview, viewMode, doc.key)
  const showEditor = viewMode !== 'preview'
  const showPreview = viewMode !== 'editor'
  const columns =
    viewMode === 'split'
      ? `${sidebarWidth}px ${SPLITTER_WIDTH}px minmax(0, ${editorFraction}fr) ${SPLITTER_WIDTH}px minmax(0, ${1 - editorFraction}fr)`
      : `${sidebarWidth}px ${SPLITTER_WIDTH}px minmax(0, 1fr)`

  function panesWidth(): number {
    const element = workspace.current
    if (!element) return 1
    // Some themes pad the workspace; only the grid's content box holds the panes.
    const style = getComputedStyle(element)
    const padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
    return Math.max(1, element.clientWidth - (padding || 0) - sidebarWidth - 2 * SPLITTER_WIDTH)
  }

  return (
    <div className="app">
      <div className="workspace" ref={workspace} style={{ gridTemplateColumns: columns }}>
        <Sidebar
          folder={folder}
          activePath={doc.path}
          dirty={dirty}
          onSelectFile={(path) => void openPath(path)}
          onOpenFolder={() => void openFolderDialog()}
        />
        <Splitter
          label="Resize sidebar"
          value={sidebarWidth}
          min={SIDEBAR_WIDTH_RANGE.min}
          max={SIDEBAR_WIDTH_RANGE.max}
          step={16}
          valueForDrag={(start, deltaX) => start + deltaX}
          onChange={(value) => setSettings((current) => ({ ...current, sidebarWidth: value }))}
          onCommit={(value) => updateSettings({ sidebarWidth: value })}
        />
        <Editor
          ref={editor}
          value={doc.content}
          documentKey={doc.key}
          hidden={!showEditor}
          onChange={(content) => setDoc((current) => ({ ...current, content }))}
        />
        {viewMode === 'split' && (
          <Splitter
            label="Resize editor and preview"
            value={editorFraction}
            min={EDITOR_FRACTION_RANGE.min}
            max={EDITOR_FRACTION_RANGE.max}
            step={0.05}
            valueForDrag={(start, deltaX) => start + deltaX / panesWidth()}
            onChange={(value) => setSettings((current) => ({ ...current, editorFraction: value }))}
            onCommit={(value) => updateSettings({ editorFraction: value })}
          />
        )}
        <Preview
          ref={preview}
          markdown={doc.content}
          documentKey={doc.key}
          documentPath={doc.path}
          folderPath={folder?.rootPath ?? null}
          hidden={!showPreview}
          onOpenDocument={(path) => void openPath(path)}
        />
      </div>
      <StatusBar
        path={doc.path}
        dirty={dirty}
        wordCount={countWords(doc.content)}
        tokenCount={tokenCount}
        message={message}
        theme={settings.theme}
        onCycleTheme={() => updateSettings({ theme: NEXT_THEME[settings.theme] })}
      />
    </div>
  )
}
