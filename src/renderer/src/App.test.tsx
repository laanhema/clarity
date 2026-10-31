import { EditorView } from '@codemirror/view'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_UI_SETTINGS, type OpenedFolder } from '../../shared/api'
import { App } from './App'
import styles from './styles.css?raw'
import { installMockApi } from './test/mockApi'

const folder: OpenedFolder = {
  rootPath: '/notes',
  tree: [
    { kind: 'file', name: 'first.md', path: '/notes/first.md' },
    { kind: 'file', name: 'second.md', path: '/notes/second.md' },
  ],
}

const files: Record<string, string> = {
  '/notes/first.md': '# First',
  '/notes/second.md': '# Second',
}

let mock: ReturnType<typeof installMockApi>

beforeEach(() => {
  mock = installMockApi()
  mock.api.openFolder.mockResolvedValue(folder)
  mock.api.listMarkdownFiles.mockResolvedValue(folder.tree)
  mock.api.readFile.mockImplementation((path) => Promise.resolve(files[path] ?? ''))
})

/** CodeMirror lives in the editor pane's shadow root, out of reach of `screen` queries. */
function editorRoot(): ShadowRoot {
  const root = document.querySelector('section[aria-label="Editor"]')?.shadowRoot
  if (!root) throw new Error('No editor')
  return root
}

const editor = () => within(editorRoot() as unknown as HTMLElement).getByRole('textbox', { name: 'Markdown source' })

function editorView(): EditorView {
  const view = EditorView.findFromDOM(editor())
  if (!view) throw new Error('No editor')
  return view
}

const editorText = () => editorView().state.doc.toString()

/** Types at the end of the document, as the user would. */
function typeInEditor(text: string): void {
  act(() => {
    const view = editorView()
    view.dispatch({ changes: { from: view.state.doc.length, insert: text }, userEvent: 'input.type' })
  })
}

/** Opens the test folder and loads first.md, then edits it so it has unsaved changes. */
async function openFirstFileAndEdit() {
  const user = userEvent.setup()
  render(<App />)
  await user.click(screen.getByRole('button', { name: 'Open Folder…' }))
  await user.click(await screen.findByRole('button', { name: 'first.md' }))
  await waitFor(() => expect(editorText()).toBe('# First'))
  typeInEditor(' edited')
  return user
}

describe('App layout', () => {
  it('shows sidebar, editor, preview and status bar', () => {
    installMockApi()
    render(<App />)
    expect(screen.getByRole('navigation', { name: 'Files' })).toBeInTheDocument()
    expect(editor()).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Preview' })).toBeInTheDocument()
    expect(screen.getByText('Untitled')).toBeInTheDocument()
    expect(screen.getByText('0 words')).toBeInTheDocument()
    expect(screen.getByText('0 tokens')).toBeInTheDocument()
  })
})

describe('unsaved changes', () => {
  it('marks the document dirty in the sidebar, status bar and main process', async () => {
    await openFirstFileAndEdit()
    expect(screen.getByText('Unsaved')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Unsaved changes' })).toBeInTheDocument()
    expect(mock.api.setDocumentDirty).toHaveBeenLastCalledWith(true)
    expect(screen.getByText('2 words')).toBeInTheDocument()
  })

  it('estimates the tokens of the unsaved text once typing pauses', async () => {
    await openFirstFileAndEdit()
    await waitFor(() => expect(screen.getByText(/^≈\d+ tokens$/)).toBeInTheDocument())
  })

  it('switches files without asking when there are no changes', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Open Folder…' }))
    await user.click(await screen.findByRole('button', { name: 'first.md' }))
    await waitFor(() => expect(editorText()).toBe('# First'))
    await user.click(screen.getByRole('button', { name: 'second.md' }))
    await waitFor(() => expect(editorText()).toBe('# Second'))
    expect(mock.api.confirmUnsaved).not.toHaveBeenCalled()
  })

  it('stays on the current file when the user cancels', async () => {
    const user = await openFirstFileAndEdit()
    mock.api.confirmUnsaved.mockResolvedValue('cancel')
    await user.click(screen.getByRole('button', { name: 'second.md' }))

    await waitFor(() => expect(mock.api.confirmUnsaved).toHaveBeenCalledWith('first.md'))
    expect(editorText()).toBe('# First edited')
    expect(mock.api.readFile).not.toHaveBeenCalledWith('/notes/second.md')
    expect(mock.api.writeFile).not.toHaveBeenCalled()
  })

  it('drops the changes and switches when the user discards', async () => {
    const user = await openFirstFileAndEdit()
    mock.api.confirmUnsaved.mockResolvedValue('discard')
    await user.click(screen.getByRole('button', { name: /second\.md/ }))

    await waitFor(() => expect(editorText()).toBe('# Second'))
    expect(mock.api.writeFile).not.toHaveBeenCalled()
    expect(screen.getByText('Saved')).toBeInTheDocument()
  })

  it('saves first and then switches when the user saves', async () => {
    const user = await openFirstFileAndEdit()
    mock.api.confirmUnsaved.mockResolvedValue('save')
    await user.click(screen.getByRole('button', { name: /second\.md/ }))

    await waitFor(() => expect(editorText()).toBe('# Second'))
    expect(mock.api.writeFile).toHaveBeenCalledWith('/notes/first.md', '# First edited')
  })

  it('does not switch when saving fails, and shows the error', async () => {
    const user = await openFirstFileAndEdit()
    mock.api.confirmUnsaved.mockResolvedValue('save')
    mock.api.writeFile.mockRejectedValue(new Error("Error invoking remote method 'lantern:write-file': Error: Disk full"))
    await user.click(screen.getByRole('button', { name: /second\.md/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Disk full')
    expect(editorText()).toBe('# First edited')
  })

  it('asks before replacing the document with Open File', async () => {
    await openFirstFileAndEdit()
    mock.api.openFile.mockResolvedValue({ path: '/elsewhere/other.md', content: 'Other' })
    mock.api.confirmUnsaved.mockResolvedValue('cancel')
    mock.sendMenuCommand('open-file')

    await waitFor(() => expect(mock.api.confirmUnsaved).toHaveBeenCalled())
    expect(editorText()).toBe('# First edited')

    mock.api.confirmUnsaved.mockResolvedValue('discard')
    mock.sendMenuCommand('open-file')
    await waitFor(() => expect(editorText()).toBe('Other'))
    expect(screen.getByText('/elsewhere/other.md')).toBeInTheDocument()
    typeInEditor('!')
    expect(screen.getByText('Unsaved')).toBeInTheDocument()
  })
})

describe('saving', () => {
  it('saves with the Save command and clears the unsaved marker', async () => {
    await openFirstFileAndEdit()
    mock.sendMenuCommand('save')

    await waitFor(() => expect(screen.getByText('Saved')).toBeInTheDocument())
    expect(mock.api.writeFile).toHaveBeenCalledWith('/notes/first.md', '# First edited')
    expect(screen.queryByRole('img', { name: 'Unsaved changes' })).not.toBeInTheDocument()
    expect(mock.api.setDocumentDirty).toHaveBeenLastCalledWith(false)
  })

  it('uses Save As for a new document and adopts the chosen path', async () => {
    render(<App />)
    typeInEditor('Fresh words')
    mock.api.saveAs.mockResolvedValue('/notes/fresh.md')
    mock.sendMenuCommand('save')

    await waitFor(() => expect(screen.getByText('/notes/fresh.md')).toBeInTheDocument())
    expect(mock.api.saveAs).toHaveBeenCalledWith('Fresh words', null)
    expect(mock.api.writeFile).not.toHaveBeenCalled()
    expect(screen.getByText('Saved')).toBeInTheDocument()
  })

  it('keeps the document unsaved when Save As is cancelled', async () => {
    await openFirstFileAndEdit()
    mock.api.saveAs.mockResolvedValue(null)
    mock.sendMenuCommand('save-as')

    await waitFor(() => expect(mock.api.saveAs).toHaveBeenCalledWith('# First edited', '/notes/first.md'))
    expect(screen.getByText('Unsaved')).toBeInTheDocument()
    expect(screen.getByText('/notes/first.md')).toBeInTheDocument()
  })

  it('refreshes the sidebar after Save As', async () => {
    await openFirstFileAndEdit()
    mock.api.saveAs.mockResolvedValue('/notes/copy.md')
    mock.api.listMarkdownFiles.mockResolvedValue([
      ...folder.tree,
      { kind: 'file', name: 'copy.md', path: '/notes/copy.md' },
    ])
    mock.sendMenuCommand('save-as')

    expect(await screen.findByRole('button', { name: 'copy.md' })).toHaveAttribute('aria-current', 'page')
  })
})

describe('closing the window', () => {
  it('keeps the window open when the user cancels', async () => {
    await openFirstFileAndEdit()
    mock.api.confirmUnsaved.mockResolvedValue('cancel')
    mock.requestClose()

    await waitFor(() => expect(mock.api.confirmUnsaved).toHaveBeenCalled())
    expect(mock.api.closeWindow).not.toHaveBeenCalled()
  })

  it('closes without saving when the user discards', async () => {
    await openFirstFileAndEdit()
    mock.api.confirmUnsaved.mockResolvedValue('discard')
    mock.requestClose()

    await waitFor(() => expect(mock.api.closeWindow).toHaveBeenCalledOnce())
    expect(mock.api.writeFile).not.toHaveBeenCalled()
  })

  it('saves and then closes when the user saves', async () => {
    await openFirstFileAndEdit()
    mock.api.confirmUnsaved.mockResolvedValue('save')
    mock.requestClose()

    await waitFor(() => expect(mock.api.closeWindow).toHaveBeenCalledOnce())
    expect(mock.api.writeFile).toHaveBeenCalledWith('/notes/first.md', '# First edited')
  })

  it('stays open when saving a new document is cancelled in Save As', async () => {
    render(<App />)
    typeInEditor('Draft')
    mock.api.confirmUnsaved.mockResolvedValue('save')
    mock.api.saveAs.mockResolvedValue(null)
    mock.requestClose()

    await waitFor(() => expect(mock.api.saveAs).toHaveBeenCalled())
    expect(mock.api.closeWindow).not.toHaveBeenCalled()
    expect(mock.api.confirmUnsaved).toHaveBeenCalledWith('Untitled')
  })
})

describe('preview', () => {
  const preview = () => screen.getByRole('region', { name: 'Preview' })

  it('renders the Markdown shortly after typing stops', async () => {
    render(<App />)
    typeInEditor('# Title\n\n- [x] done\n\n| a |\n| - |\n| 1 |')
    expect(await within(preview()).findByRole('heading', { name: 'Title' })).toBeInTheDocument()
    expect(within(preview()).getByRole('checkbox')).toBeChecked()
    expect(within(preview()).getByRole('table')).toBeInTheDocument()
  })

  it('never renders scripts or event handlers', async () => {
    render(<App />)
    typeInEditor('ok <img src="x.png" onerror="window.hacked = 1"> <script>window.hacked = 2</script>')
    await within(preview()).findByText(/ok/)
    expect(preview().innerHTML).not.toMatch(/script|onerror/)
  })

  it('opens web links in the browser and ignores unsafe ones', async () => {
    const user = userEvent.setup()
    render(<App />)
    typeInEditor('[web](https://example.com/page) [bad](javascript:alert(1)) [mail](mailto:a@example.com)')
    await user.click(await within(preview()).findByText('web'))
    expect(mock.api.openExternal).toHaveBeenCalledWith('https://example.com/page')
    await user.click(within(preview()).getByText('bad'))
    await user.click(within(preview()).getByText('mail'))
    expect(mock.api.openExternal).toHaveBeenCalledOnce()
  })

  it('opens linked Markdown files of the folder in the editor', async () => {
    files['/notes/first.md'] = 'See [the second](second.md) and [outside](../x.md).'
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Open Folder…' }))
    await user.click(await screen.findByRole('button', { name: 'first.md' }))
    await user.click(await within(preview()).findByText('outside'))
    expect(mock.api.readFile).not.toHaveBeenCalledWith('/x.md')
    await user.click(within(preview()).getByText('the second'))
    await waitFor(() => expect(editorText()).toBe('# Second'))
    files['/notes/first.md'] = '# First'
  })

  it('loads relative images through the main process and leaves remote ones out', async () => {
    files['/notes/first.md'] = '![local](img/a.png) ![remote](https://example.com/b.png)'
    mock.api.loadImage.mockResolvedValue('data:image/png;base64,AAAA')
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Open Folder…' }))
    await user.click(await screen.findByRole('button', { name: 'first.md' }))
    expect(await within(preview()).findByRole('img', { name: 'local' })).toHaveAttribute(
      'src',
      'data:image/png;base64,AAAA',
    )
    expect(mock.api.loadImage).toHaveBeenCalledWith('/notes/first.md', 'img/a.png')
    expect(mock.api.loadImage).toHaveBeenCalledOnce()
    expect(within(preview()).getByText('remote')).toHaveClass('preview-image-placeholder')
    files['/notes/first.md'] = '# First'
  })
})

describe('view modes and settings', () => {
  // Hidden elements have no accessible name, so find the panes by their label attribute.
  const pane = (label: string) => {
    const element = document.querySelector(`section[aria-label="${label}"]`)
    if (!element) throw new Error(`No ${label} pane`)
    return element
  }

  it('shows only the panes of the chosen view mode', async () => {
    mock.api.getSettings.mockResolvedValue({ ...DEFAULT_UI_SETTINGS, viewMode: 'preview' })
    render(<App />)
    await waitFor(() => expect(pane('Editor')).not.toBeVisible())
    expect(screen.getByRole('region', { name: 'Preview' })).toBeVisible()

    mock.changeSettings({ ...DEFAULT_UI_SETTINGS, viewMode: 'editor' })
    expect(screen.getByRole('region', { name: 'Editor' })).toBeVisible()
    expect(pane('Preview')).not.toBeVisible()
    expect(screen.queryByRole('separator', { name: 'Resize editor and preview' })).not.toBeInTheDocument()
  })

  it('cycles the theme from the status bar', async () => {
    const user = userEvent.setup()
    mock.api.getSettings.mockResolvedValue({ ...DEFAULT_UI_SETTINGS, theme: 'system' })
    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'System theme' }))
    expect(mock.api.updateSettings).toHaveBeenCalledWith({ theme: 'light' })
    expect(screen.getByRole('button', { name: 'Light theme' })).toBeInTheDocument()
  })

  it('cycles through the custom themes and marks the page with the active theme', async () => {
    const user = userEvent.setup()
    mock.api.getSettings.mockResolvedValue({ ...DEFAULT_UI_SETTINGS, theme: 'dark' })
    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Dark theme' }))
    expect(mock.api.updateSettings).toHaveBeenCalledWith({ theme: 'gruvbox-material-dark-hard' })
    expect(document.documentElement).toHaveAttribute('data-theme', 'gruvbox-material-dark-hard')

    await user.click(screen.getByRole('button', { name: 'Gruvbox theme' }))
    expect(mock.api.updateSettings).toHaveBeenCalledWith({ theme: 'tokyo-night-moon' })
    expect(document.documentElement).toHaveAttribute('data-theme', 'tokyo-night-moon')

    await user.click(screen.getByRole('button', { name: 'Tokyo Night theme' }))
    expect(mock.api.updateSettings).toHaveBeenCalledWith({ theme: 'system' })
    expect(document.documentElement).toHaveAttribute('data-theme', 'system')
  })

  it('starts in the theme the window opened with', () => {
    mock.api.initialTheme = 'gruvbox-material-dark-hard'
    mock.api.getSettings.mockReturnValue(new Promise(() => undefined))
    render(<App />)
    expect(screen.getByRole('button', { name: 'Gruvbox theme' })).toBeInTheDocument()
    expect(document.documentElement).toHaveAttribute('data-theme', 'gruvbox-material-dark-hard')
  })

  it('remembers a resized sidebar', async () => {
    const user = userEvent.setup()
    render(<App />)
    const splitter = screen.getByRole('separator', { name: 'Resize sidebar' })
    splitter.focus()
    await user.keyboard('{ArrowRight}')
    expect(mock.api.updateSettings).toHaveBeenCalledWith({ sidebarWidth: 256 })
    expect(splitter).toHaveAttribute('aria-valuenow', '256')
  })

  it('switches to split view to find text from preview-only view', async () => {
    mock.api.getSettings.mockResolvedValue({ ...DEFAULT_UI_SETTINGS, viewMode: 'preview' })
    render(<App />)
    await waitFor(() => expect(pane('Editor')).not.toBeVisible())
    mock.sendMenuCommand('find')
    expect(mock.api.updateSettings).toHaveBeenCalledWith({ viewMode: 'split' })
    expect(await within(editorRoot() as unknown as HTMLElement).findByRole('textbox', { name: 'Find' })).toBeInTheDocument()
  })
})

describe('undo and redo from the Edit menu', () => {
  it('apply to the editor history', async () => {
    await openFirstFileAndEdit()
    mock.sendMenuCommand('undo')
    expect(editorText()).toBe('# First')
    mock.sendMenuCommand('redo')
    expect(editorText()).toBe('# First edited')
  })

  it('do not undo past the opened file', async () => {
    await openFirstFileAndEdit()
    mock.sendMenuCommand('undo')
    mock.sendMenuCommand('undo')
    expect(editorText()).toBe('# First')
  })
})

describe('new documents', () => {
  it('starts an empty document after settling unsaved changes', async () => {
    await openFirstFileAndEdit()
    mock.api.confirmUnsaved.mockResolvedValue('discard')
    mock.sendMenuCommand('new-file')
    await waitFor(() => expect(editorText()).toBe(''))
    expect(screen.getByText('Untitled')).toBeInTheDocument()
    expect(mock.api.watchDocument).toHaveBeenLastCalledWith(null)
  })
})

describe('changes made by other programs', () => {
  async function openFirstFile() {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Open Folder…' }))
    await user.click(await screen.findByRole('button', { name: 'first.md' }))
    await waitFor(() => expect(editorText()).toBe('# First'))
    expect(mock.api.watchDocument).toHaveBeenLastCalledWith('/notes/first.md')
  }

  it('reloads silently when there are no unsaved edits', async () => {
    await openFirstFile()
    mock.api.readFile.mockResolvedValue('# Changed elsewhere')
    mock.changeDocumentOnDisk('/notes/first.md')
    await waitFor(() => expect(editorText()).toBe('# Changed elsewhere'))
    expect(mock.api.confirmReload).not.toHaveBeenCalled()
    expect(screen.getByText('Saved')).toBeInTheDocument()
  })

  it('ignores the echo of its own save', async () => {
    await openFirstFileAndEdit()
    mock.sendMenuCommand('save')
    await waitFor(() => expect(screen.getByText('Saved')).toBeInTheDocument())
    mock.api.readFile.mockResolvedValue('# First edited')
    mock.changeDocumentOnDisk('/notes/first.md')
    await waitFor(() => expect(mock.api.readFile).toHaveBeenLastCalledWith('/notes/first.md'))
    expect(mock.api.confirmReload).not.toHaveBeenCalled()
    expect(editorText()).toBe('# First edited')
  })

  it('asks when there are unsaved edits, and keeps them if the user says so', async () => {
    await openFirstFileAndEdit()
    mock.api.readFile.mockResolvedValue('# Theirs')
    mock.api.confirmReload.mockResolvedValue('keep')
    mock.changeDocumentOnDisk('/notes/first.md')
    await waitFor(() => expect(mock.api.confirmReload).toHaveBeenCalledWith('first.md'))
    expect(editorText()).toBe('# First edited')
    expect(screen.getByText('Unsaved')).toBeInTheDocument()
  })

  it('reloads over unsaved edits when the user chooses Reload', async () => {
    await openFirstFileAndEdit()
    mock.api.readFile.mockResolvedValue('# Theirs')
    mock.api.confirmReload.mockResolvedValue('reload')
    mock.changeDocumentOnDisk('/notes/first.md')
    await waitFor(() => expect(editorText()).toBe('# Theirs'))
    expect(screen.getByText('Saved')).toBeInTheDocument()
  })

  it('marks a deleted file as unsaved', async () => {
    await openFirstFile()
    mock.api.readFile.mockRejectedValue(new Error('ENOENT'))
    mock.changeDocumentOnDisk('/notes/first.md')
    expect(await screen.findByRole('alert')).toHaveTextContent('first.md was deleted or moved')
    expect(screen.getByText('Unsaved')).toBeInTheDocument()
  })

  it('refreshes the sidebar when files are added or removed', async () => {
    await openFirstFile()
    mock.api.listMarkdownFiles.mockResolvedValue([
      ...folder.tree,
      { kind: 'file', name: 'third.md', path: '/notes/third.md' },
    ])
    mock.changeTree()
    expect(await screen.findByRole('button', { name: 'third.md' })).toBeInTheDocument()
  })

  it('shows a folder opened from Open Recent', () => {
    render(<App />)
    mock.openFolderFromMenu({ rootPath: '/recent', tree: [{ kind: 'file', name: 'r.md', path: '/recent/r.md' }] })
    expect(screen.getByText('recent')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'r.md' })).toBeInTheDocument()
  })
})

describe('font and font size', () => {
  // jsdom cascades custom properties but neither substitutes var() nor inherits them into
  // shadow roots, where the editor lives, so the test does both itself.
  function customProperty(element: Element, name: string): string {
    const value = getComputedStyle(element).getPropertyValue(name).trim()
    const root = element.getRootNode()
    return value || !(root instanceof ShadowRoot) ? value : customProperty(root.host, name)
  }

  function resolve(element: Element, value: string): string {
    const resolved = value.replace(/var\((--[\w-]+)\)/g, (_match, name: string) => customProperty(element, name))
    return resolved === value ? value : resolve(element, resolved)
  }

  const editorScroller = () => {
    const scroller = editorRoot().querySelector('.cm-scroller')
    if (!scroller) throw new Error('No editor scroller')
    return scroller
  }

  const previewBody = () => {
    const body = document.querySelector('.markdown-body')
    if (!body) throw new Error('No preview')
    return body
  }

  const previewCode = () => {
    const code = document.querySelector('.markdown-body pre > code')
    if (!code) throw new Error('No code block')
    return code
  }

  const fontOf = (element: Element) => resolve(element, getComputedStyle(element).fontFamily)
  const sizeOf = (element: Element) => resolve(element, getComputedStyle(element).fontSize)

  let stylesheet: HTMLStyleElement

  beforeEach(async () => {
    stylesheet = document.createElement('style')
    stylesheet.textContent = styles
    document.head.append(stylesheet)
    files['/notes/code.md'] = '# Code\n\n```\nplain\n```\n'
    mock.api.openFile.mockResolvedValue({ path: '/notes/code.md', content: files['/notes/code.md'] })
    render(<App />)
    mock.sendMenuCommand('open-file')
    await waitFor(() => expect(previewCode()).toBeInTheDocument(), { timeout: 2000 })
  })

  afterEach(() => {
    stylesheet.remove()
    delete files['/notes/code.md']
    delete document.documentElement.dataset['font']
    document.documentElement.style.removeProperty('--content-size')
  })

  // Everything Lantern draws: the sidebar, the editor, the preview and its code, and the status bar.
  const appParts = () => [
    document.querySelector('.sidebar-open'),
    editorScroller(),
    previewBody(),
    previewCode(),
    document.querySelector('.markdown-body h1'),
    document.querySelector('.status-bar'),
  ]

  function expectWholeAppIn(family: string) {
    for (const part of appParts()) {
      if (!part) throw new Error('Missing part of the app')
      expect(fontOf(part).split(',')[0]?.replaceAll('"', "'")).toBe(`'${family}'`)
    }
  }

  it('uses Commit Mono for the whole app at 14px by default', () => {
    expect(document.documentElement).toHaveAttribute('data-font', 'commit-mono')
    expectWholeAppIn('Commit Mono')
    expect(sizeOf(editorScroller())).toBe('14px')
    expect(sizeOf(previewBody())).toBe('calc(14px * 15 / 14)')
    expect(sizeOf(previewCode())).toBe('calc(14px * 13 / 14)')
  })

  it('applies a changed font and size to the whole app at once', () => {
    mock.changeSettings({ ...DEFAULT_UI_SETTINGS, font: 'jetbrains-mono-nl', fontSize: 20 })
    expect(document.documentElement).toHaveAttribute('data-font', 'jetbrains-mono-nl')
    expectWholeAppIn('JetBrains Mono NL')
    expect(sizeOf(editorScroller())).toBe('20px')
    expect(sizeOf(previewBody())).toBe('calc(20px * 15 / 14)')
    expect(sizeOf(previewCode())).toBe('calc(20px * 13 / 14)')

    mock.changeSettings({ ...DEFAULT_UI_SETTINGS, font: 'commit-mono' })
    expectWholeAppIn('Commit Mono')
    expect(sizeOf(editorScroller())).toBe('14px')
  })

  it('wraps long lines in preview code blocks, keeping their spaces', () => {
    const style = getComputedStyle(previewCode())
    expect(style.whiteSpace).toBe('pre-wrap')
    expect(style.overflowWrap).toBe('anywhere')
  })

  it('keeps the same font in every theme', () => {
    for (const theme of ['light', 'dark', 'gruvbox-material-dark-hard', 'tokyo-night-moon'] as const) {
      mock.changeSettings({ ...DEFAULT_UI_SETTINGS, theme, font: 'jetbrains-mono-nl' })
      expectWholeAppIn('JetBrains Mono NL')
    }
  })
})
