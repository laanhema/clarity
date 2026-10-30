import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import type { OpenedFolder } from '../../shared/api'
import { App } from './App'
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

const editor = () => screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Markdown source' })

/** Opens the test folder and loads first.md, then edits it so it has unsaved changes. */
async function openFirstFileAndEdit() {
  const user = userEvent.setup()
  render(<App />)
  await user.click(screen.getByRole('button', { name: 'Open Folder…' }))
  await user.click(await screen.findByRole('button', { name: 'first.md' }))
  await waitFor(() => expect(editor()).toHaveValue('# First'))
  await user.type(editor(), ' edited')
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

  it('switches files without asking when there are no changes', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Open Folder…' }))
    await user.click(await screen.findByRole('button', { name: 'first.md' }))
    await waitFor(() => expect(editor()).toHaveValue('# First'))
    await user.click(screen.getByRole('button', { name: 'second.md' }))
    await waitFor(() => expect(editor()).toHaveValue('# Second'))
    expect(mock.api.confirmUnsaved).not.toHaveBeenCalled()
  })

  it('stays on the current file when the user cancels', async () => {
    const user = await openFirstFileAndEdit()
    mock.api.confirmUnsaved.mockResolvedValue('cancel')
    await user.click(screen.getByRole('button', { name: 'second.md' }))

    await waitFor(() => expect(mock.api.confirmUnsaved).toHaveBeenCalledWith('first.md'))
    expect(editor()).toHaveValue('# First edited')
    expect(mock.api.readFile).not.toHaveBeenCalledWith('/notes/second.md')
    expect(mock.api.writeFile).not.toHaveBeenCalled()
  })

  it('drops the changes and switches when the user discards', async () => {
    const user = await openFirstFileAndEdit()
    mock.api.confirmUnsaved.mockResolvedValue('discard')
    await user.click(screen.getByRole('button', { name: /second\.md/ }))

    await waitFor(() => expect(editor()).toHaveValue('# Second'))
    expect(mock.api.writeFile).not.toHaveBeenCalled()
    expect(screen.getByText('Saved')).toBeInTheDocument()
  })

  it('saves first and then switches when the user saves', async () => {
    const user = await openFirstFileAndEdit()
    mock.api.confirmUnsaved.mockResolvedValue('save')
    await user.click(screen.getByRole('button', { name: /second\.md/ }))

    await waitFor(() => expect(editor()).toHaveValue('# Second'))
    expect(mock.api.writeFile).toHaveBeenCalledWith('/notes/first.md', '# First edited')
  })

  it('does not switch when saving fails, and shows the error', async () => {
    const user = await openFirstFileAndEdit()
    mock.api.confirmUnsaved.mockResolvedValue('save')
    mock.api.writeFile.mockRejectedValue(new Error("Error invoking remote method 'mdpad:write-file': Error: Disk full"))
    await user.click(screen.getByRole('button', { name: /second\.md/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Disk full')
    expect(editor()).toHaveValue('# First edited')
  })

  it('asks before replacing the document with Open File', async () => {
    const user = await openFirstFileAndEdit()
    mock.api.openFile.mockResolvedValue({ path: '/elsewhere/other.md', content: 'Other' })
    mock.api.confirmUnsaved.mockResolvedValue('cancel')
    mock.sendMenuCommand('open-file')

    await waitFor(() => expect(mock.api.confirmUnsaved).toHaveBeenCalled())
    expect(editor()).toHaveValue('# First edited')

    mock.api.confirmUnsaved.mockResolvedValue('discard')
    mock.sendMenuCommand('open-file')
    await waitFor(() => expect(editor()).toHaveValue('Other'))
    expect(screen.getByText('/elsewhere/other.md')).toBeInTheDocument()
    await user.type(editor(), '!')
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
    const user = userEvent.setup()
    render(<App />)
    await user.type(editor(), 'Fresh words')
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
    const user = userEvent.setup()
    render(<App />)
    await user.type(editor(), 'Draft')
    mock.api.confirmUnsaved.mockResolvedValue('save')
    mock.api.saveAs.mockResolvedValue(null)
    mock.requestClose()

    await waitFor(() => expect(mock.api.saveAs).toHaveBeenCalled())
    expect(mock.api.closeWindow).not.toHaveBeenCalled()
    expect(mock.api.confirmUnsaved).toHaveBeenCalledWith('Untitled')
  })
})
