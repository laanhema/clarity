import { useEffect, useEffectEvent, useRef, useState } from 'react'
import type { MenuCommand, OpenedFolder } from '../../shared/api'
import { Editor } from './components/Editor'
import { Preview } from './components/Preview'
import { Sidebar } from './components/Sidebar'
import { StatusBar } from './components/StatusBar'
import { countWords, errorMessage, fileName } from './text'

interface DocumentState {
  /** Null for a new document that has never been saved. */
  path: string | null
  content: string
  /** The content as it is on disk; the document is dirty when `content` differs. */
  savedContent: string
}

const NEW_DOCUMENT: DocumentState = { path: null, content: '', savedContent: '' }

function isDirty(document: DocumentState): boolean {
  return document.content !== document.savedContent
}

function documentName(document: DocumentState): string {
  return document.path ? fileName(document.path) : 'Untitled'
}

export function App() {
  const api = window.mdpad
  const [folder, setFolder] = useState<OpenedFolder | null>(null)
  const [doc, setDoc] = useState<DocumentState>(NEW_DOCUMENT)
  const [message, setMessage] = useState<string | null>(null)
  // Native dialogs are modal, but async work around them is not: run one flow at a time.
  const busy = useRef(false)

  const dirty = isDirty(doc)
  const name = documentName(doc)

  useEffect(() => {
    api.setDocumentDirty(dirty)
  }, [api, dirty])

  useEffect(() => {
    document.title = `${dirty ? '● ' : ''}${name} — mdpad`
  }, [dirty, name])

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
      setDoc({ path, content, savedContent: content })
    })
  }

  function openFileDialog(): Promise<void> {
    return exclusive(async () => {
      const opened = await api.openFile()
      if (!opened) return
      if (!(await settleUnsavedChanges(doc))) return
      setDoc({ path: opened.path, content: opened.content, savedContent: opened.content })
    })
  }

  function openFolderDialog(): Promise<void> {
    return exclusive(async () => {
      const opened = await api.openFolder()
      if (opened) setFolder(opened)
    })
  }

  const onMenuCommand = useEffectEvent((command: MenuCommand) => {
    switch (command) {
      case 'open-file':
        return void openFileDialog()
      case 'open-folder':
        return void openFolderDialog()
      case 'save':
        return void exclusive(async () => void (await save(doc)))
      case 'save-as':
        return void exclusive(async () => void (await saveAs(doc)))
    }
  })

  const onCloseRequested = useEffectEvent(() => {
    void exclusive(async () => {
      if (await settleUnsavedChanges(doc)) api.closeWindow()
    })
  })

  useEffect(() => api.onMenuCommand((command) => onMenuCommand(command)), [api])
  useEffect(() => api.onCloseRequested(() => onCloseRequested()), [api])

  return (
    <div className="app">
      <Sidebar
        folder={folder}
        activePath={doc.path}
        dirty={dirty}
        onSelectFile={(path) => void openPath(path)}
        onOpenFolder={() => void openFolderDialog()}
      />
      <Editor value={doc.content} onChange={(content) => setDoc((current) => ({ ...current, content }))} />
      <Preview />
      <StatusBar path={doc.path} dirty={dirty} wordCount={countWords(doc.content)} message={message} />
    </div>
  )
}
