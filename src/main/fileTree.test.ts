import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { FileTreeNode } from '../shared/api'
import { listMarkdownTree } from './fileTree'
import { linkAt, makeTempDir, removeDir, writeAt } from './testFs'

/** The tree as relative names, which keeps the expectations readable. */
function shape(nodes: FileTreeNode[]): unknown[] {
  return nodes.map((node) => (node.kind === 'directory' ? { [node.name]: shape(node.children) } : node.name))
}

describe('listMarkdownTree', () => {
  let workspace: string
  let root: string

  beforeEach(async () => {
    workspace = await makeTempDir()
    root = path.join(workspace, 'root')
    await writeAt(root, 'b.md')
    await writeAt(root, 'a.markdown')
    await writeAt(root, 'notes.txt')
    await writeAt(root, 'guides/setup.md')
    await writeAt(root, 'guides/deep/more.md')
    await writeAt(root, 'images/logo.png')
  })

  afterEach(() => removeDir(workspace))

  it('lists Markdown files with folders first, sorted by name', async () => {
    expect(shape(await listMarkdownTree(root))).toEqual([{ guides: [{ deep: ['more.md'] }, 'setup.md'] }, 'a.markdown', 'b.md'])
  })

  it('returns absolute paths', async () => {
    const tree = await listMarkdownTree(root)
    const file = tree.find((node) => node.name === 'b.md')
    expect(file?.path).toBe(path.join(root, 'b.md'))
  })

  it('ignores dot-folders and node_modules', async () => {
    await writeAt(root, '.git/HEAD.md')
    await writeAt(root, '.obsidian/workspace.md')
    await writeAt(root, 'node_modules/pkg/README.md')
    expect(shape(await listMarkdownTree(root))).toEqual([{ guides: [{ deep: ['more.md'] }, 'setup.md'] }, 'a.markdown', 'b.md'])
  })

  it('sorts numbers naturally', async () => {
    const dir = path.join(workspace, 'numbers')
    await writeAt(dir, 'ch10.md')
    await writeAt(dir, 'ch2.md')
    await writeAt(dir, 'ch1.md')
    expect(shape(await listMarkdownTree(dir))).toEqual(['ch1.md', 'ch2.md', 'ch10.md'])
  })

  it('lists symlinked files inside the folder but not ones pointing outside', async () => {
    await writeAt(workspace, 'outside/secret.md')
    await linkAt(root, 'inside-link.md', path.join(root, 'b.md'))
    await linkAt(root, 'outside-link.md', path.join(workspace, 'outside', 'secret.md'))
    const names = shape(await listMarkdownTree(root))
    expect(names).toContain('inside-link.md')
    expect(names).not.toContain('outside-link.md')
  })

  it('skips symlinked folders, which also prevents loops', async () => {
    await linkAt(root, 'guides/loop', root)
    expect(shape(await listMarkdownTree(root))).toEqual([{ guides: [{ deep: ['more.md'] }, 'setup.md'] }, 'a.markdown', 'b.md'])
  })

  it('returns an empty list for a folder without Markdown files', async () => {
    const empty = path.join(workspace, 'empty')
    await writeAt(empty, 'notes.txt')
    expect(await listMarkdownTree(empty)).toEqual([])
  })
})
