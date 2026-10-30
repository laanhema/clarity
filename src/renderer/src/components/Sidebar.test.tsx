import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { OpenedFolder } from '../../../shared/api'
import { Sidebar, type SidebarProps } from './Sidebar'

const folder: OpenedFolder = {
  rootPath: '/notes',
  tree: [
    {
      kind: 'directory',
      name: 'guides',
      path: '/notes/guides',
      children: [{ kind: 'file', name: 'setup.md', path: '/notes/guides/setup.md' }],
    },
    { kind: 'file', name: 'readme.md', path: '/notes/readme.md' },
    { kind: 'file', name: 'todo.md', path: '/notes/todo.md' },
  ],
}

function renderSidebar(props: Partial<SidebarProps> = {}) {
  const handlers = { onSelectFile: vi.fn(), onOpenFolder: vi.fn() }
  render(<Sidebar folder={folder} activePath={null} dirty={false} {...handlers} {...props} />)
  return handlers
}

describe('Sidebar', () => {
  it('invites opening a folder when none is open', async () => {
    const { onOpenFolder } = renderSidebar({ folder: null })
    expect(screen.getByText('No folder open')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Open Folder…' }))
    expect(onOpenFolder).toHaveBeenCalledOnce()
  })

  it('shows the folder name and its Markdown files', () => {
    renderSidebar()
    expect(screen.getByText('notes')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'readme.md' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'setup.md' })).toBeInTheDocument()
  })

  it('says so when the folder has no Markdown files', () => {
    renderSidebar({ folder: { rootPath: '/empty', tree: [] } })
    expect(screen.getByText('No Markdown files in this folder.')).toBeInTheDocument()
  })

  it('collapses and expands subfolders', async () => {
    renderSidebar()
    const guides = screen.getByRole('button', { name: /guides/ })
    expect(guides).toHaveAttribute('aria-expanded', 'true')

    await userEvent.click(guides)
    expect(guides).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('button', { name: 'setup.md' })).not.toBeInTheDocument()

    await userEvent.click(guides)
    expect(screen.getByRole('button', { name: 'setup.md' })).toBeInTheDocument()
  })

  it('reports the clicked file', async () => {
    const { onSelectFile } = renderSidebar()
    await userEvent.click(screen.getByRole('button', { name: 'setup.md' }))
    expect(onSelectFile).toHaveBeenCalledWith('/notes/guides/setup.md')
  })

  it('highlights the active file', () => {
    renderSidebar({ activePath: '/notes/todo.md' })
    expect(screen.getByRole('button', { name: 'todo.md' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'readme.md' })).not.toHaveAttribute('aria-current')
  })

  it('marks only the active file with an unsaved dot when dirty', () => {
    renderSidebar({ activePath: '/notes/todo.md', dirty: true })
    const active = screen.getByRole('button', { name: /todo\.md/ })
    expect(within(active).getByRole('img', { name: 'Unsaved changes' })).toBeInTheDocument()
    expect(screen.getAllByRole('img', { name: 'Unsaved changes' })).toHaveLength(1)
  })

  it('shows no unsaved dot when the document is clean', () => {
    renderSidebar({ activePath: '/notes/todo.md', dirty: false })
    expect(screen.queryByRole('img', { name: 'Unsaved changes' })).not.toBeInTheDocument()
  })
})
