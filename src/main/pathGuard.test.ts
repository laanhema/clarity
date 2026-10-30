import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PathAccessError, isMarkdownPath, isWithin, resolveInsideRoot } from './pathGuard'
import { linkAt, makeTempDir, removeDir, writeAt } from './testFs'

describe('isWithin', () => {
  it('accepts the root and paths below it', () => {
    expect(isWithin('/notes', '/notes')).toBe(true)
    expect(isWithin('/notes', '/notes/a.md')).toBe(true)
    expect(isWithin('/notes', '/notes/deep/er/a.md')).toBe(true)
  })

  it('rejects parents, siblings and lookalike prefixes', () => {
    expect(isWithin('/notes', '/')).toBe(false)
    expect(isWithin('/notes', '/other/a.md')).toBe(false)
    expect(isWithin('/notes', '/notes-private/a.md')).toBe(false)
  })

  it('accepts names that merely start with two dots', () => {
    expect(isWithin('/notes', '/notes/..draft.md')).toBe(true)
  })
})

describe('isMarkdownPath', () => {
  it('matches .md and .markdown in any case', () => {
    expect(isMarkdownPath('/a/readme.md')).toBe(true)
    expect(isMarkdownPath('/a/README.MD')).toBe(true)
    expect(isMarkdownPath('/a/notes.markdown')).toBe(true)
    expect(isMarkdownPath('/a/notes.txt')).toBe(false)
    expect(isMarkdownPath('/a/md')).toBe(false)
  })
})

describe('resolveInsideRoot', () => {
  let workspace: string
  let root: string
  let outside: string

  beforeEach(async () => {
    workspace = await makeTempDir()
    root = path.join(workspace, 'root')
    outside = path.join(workspace, 'outside')
    await writeAt(root, 'note.md', '# note')
    await writeAt(root, 'sub/deep.md', '# deep')
    await writeAt(outside, 'secret.md', 'secret')
  })

  afterEach(() => removeDir(workspace))

  it('allows absolute and relative paths inside the folder', async () => {
    await expect(resolveInsideRoot(root, path.join(root, 'note.md'))).resolves.toBe(path.join(root, 'note.md'))
    await expect(resolveInsideRoot(root, 'sub/deep.md')).resolves.toBe(path.join(root, 'sub', 'deep.md'))
  })

  it('rejects ../ traversal', async () => {
    await expect(resolveInsideRoot(root, '../outside/secret.md')).rejects.toBeInstanceOf(PathAccessError)
    await expect(resolveInsideRoot(root, path.join(root, 'sub', '..', '..', 'outside', 'secret.md'))).rejects.toBeInstanceOf(
      PathAccessError,
    )
  })

  it('rejects absolute paths outside the folder', async () => {
    await expect(resolveInsideRoot(root, path.join(outside, 'secret.md'))).rejects.toBeInstanceOf(PathAccessError)
    await expect(resolveInsideRoot(root, '/etc/passwd')).rejects.toBeInstanceOf(PathAccessError)
  })

  it('rejects a symlinked file that points outside the folder', async () => {
    await linkAt(root, 'escape.md', path.join(outside, 'secret.md'))
    await expect(resolveInsideRoot(root, path.join(root, 'escape.md'))).rejects.toBeInstanceOf(PathAccessError)
  })

  it('rejects paths through a symlinked folder that points outside', async () => {
    await linkAt(root, 'linked', outside)
    await expect(resolveInsideRoot(root, path.join(root, 'linked', 'secret.md'))).rejects.toBeInstanceOf(PathAccessError)
  })

  it('allows a symlink that stays inside the folder and returns its real path', async () => {
    await linkAt(root, 'alias.md', path.join(root, 'sub', 'deep.md'))
    await expect(resolveInsideRoot(root, path.join(root, 'alias.md'))).resolves.toBe(path.join(root, 'sub', 'deep.md'))
  })

  it('rejects empty, non-string and NUL-containing input', async () => {
    await expect(resolveInsideRoot(root, '')).rejects.toBeInstanceOf(PathAccessError)
    await expect(resolveInsideRoot(root, 42)).rejects.toBeInstanceOf(PathAccessError)
    await expect(resolveInsideRoot(root, 'note.md\0.txt')).rejects.toBeInstanceOf(PathAccessError)
  })

  it('reports a missing file unless missing files are allowed', async () => {
    await expect(resolveInsideRoot(root, 'new.md')).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(resolveInsideRoot(root, 'new.md', { allowMissing: true })).resolves.toBe(path.join(root, 'new.md'))
  })

  it('rejects a missing file whose parent folder is a symlink to outside', async () => {
    await linkAt(root, 'linked', outside)
    await expect(resolveInsideRoot(root, path.join(root, 'linked', 'new.md'), { allowMissing: true })).rejects.toBeInstanceOf(
      PathAccessError,
    )
  })
})
