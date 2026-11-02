import { render, screen, within } from '@testing-library/react'
import { Profiler } from 'react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { OpenedFolder } from '../../../shared/api'
import { SCROLLING_CLASS, trackScrolling } from '../scrollbars'
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
  const handlers = { onSelectFile: vi.fn(), onOpenFolder: vi.fn(), onCloseFolder: vi.fn() }
  render(<Sidebar folder={folder} activePath={null} dirty={false} {...handlers} {...props} />)
  return handlers
}

describe('Sidebar', () => {
  it('invites opening a folder when none is open', async () => {
    const { onOpenFolder } = renderSidebar({ folder: null })
    expect(screen.getByText('No folder open')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Open Folder' }))
    expect(onOpenFolder).toHaveBeenCalledOnce()
  })

  it('renders a Close button when a folder is open and triggers onCloseFolder', async () => {
    const { onCloseFolder } = renderSidebar()
    const closeButton = screen.getByRole('button', { name: 'Close' })
    expect(closeButton).toBeInTheDocument()
    await userEvent.click(closeButton)
    expect(onCloseFolder).toHaveBeenCalledOnce()
  })

  it('does not render a Close button when no folder is open', () => {
    renderSidebar({ folder: null })
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument()
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

  it('draws the folder chevron as an SVG, not a text glyph', async () => {
    renderSidebar()
    const guides = screen.getByRole('button', { name: 'guides' })
    const chevron = guides.querySelector('.tree-chevron')
    expect(chevron?.querySelector('svg')).toBeInTheDocument()
    expect(chevron).toHaveTextContent(/^$/)

    await userEvent.click(guides)
    expect(guides.querySelector('.tree-chevron svg')).toBeInTheDocument()
    expect(guides).not.toHaveTextContent(/[▾▸]/)
  })

  it('puts the folder name in its own span so long names truncate', () => {
    renderSidebar()
    const name = within(screen.getByRole('button', { name: 'guides' })).getByText('guides')
    expect(name.tagName).toBe('SPAN')
    expect(name).toHaveClass('tree-directory-name')
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

  it('only toggles a class on the tree while it scrolls, without rendering again', () => {
    const stop = trackScrolling(document, 1000)
    const onRender = vi.fn()
    render(
      <Profiler id="sidebar" onRender={onRender}>
        <Sidebar folder={folder} activePath={null} dirty={false} onSelectFile={vi.fn()} onOpenFolder={vi.fn()} />
      </Profiler>,
    )
    const tree = screen.getByRole('navigation', { name: 'Files' }).querySelector(':scope > .tree')
    if (!tree) throw new Error('Missing tree')
    const renders = onRender.mock.calls.length
    const changes = new MutationObserver(() => undefined)
    changes.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true })

    for (let i = 0; i < 20; i++) tree.dispatchEvent(new Event('scroll'))

    const records = changes.takeRecords()
    changes.disconnect()
    expect(records.map((record) => [record.target, record.type, record.attributeName])).toEqual([[tree, 'attributes', 'class']])
    expect(tree).toHaveClass(SCROLLING_CLASS)
    expect(onRender).toHaveBeenCalledTimes(renders)
    stop()
  })
})
