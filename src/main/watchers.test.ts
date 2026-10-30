import { rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeTempDir, removeDir, writeAt } from './testFs'
import { watchDocumentFile, watchFolderTree, type StopWatching } from './watchers'

// Watchers report asynchronously; give the file system a moment to settle.
const settle = () => new Promise((resolve) => setTimeout(resolve, 400))

describe('watchers', () => {
  let root: string
  let stop: StopWatching | null

  beforeEach(async () => {
    root = await makeTempDir()
    stop = null
  })

  afterEach(async () => {
    stop?.()
    await removeDir(root)
  })

  it('reports changes to the document, including atomic saves', async () => {
    const file = await writeAt(root, 'doc.md', 'one')
    const onChange = vi.fn()
    stop = watchDocumentFile(file, onChange)
    await settle()

    await writeFile(file, 'two')
    await vi.waitFor(() => expect(onChange).toHaveBeenCalled(), { timeout: 3000 })

    onChange.mockClear()
    const temporary = path.join(root, '.doc.md.tmp')
    await writeFile(temporary, 'three')
    await rename(temporary, file)
    await vi.waitFor(() => expect(onChange).toHaveBeenCalled(), { timeout: 3000 })
  })

  it('reports Markdown files added or removed in the folder, but not other files', async () => {
    await writeAt(root, 'a.md')
    await writeAt(root, 'node_modules/pkg/readme.md')
    const onChange = vi.fn()
    stop = watchFolderTree(root, onChange, 50)
    await settle()

    await writeAt(root, 'notes.txt', 'x')
    await writeAt(root, '.git/HEAD.md', 'x')
    await writeAt(root, 'node_modules/pkg/other.md', 'x')
    await settle()
    expect(onChange).not.toHaveBeenCalled()

    await writeAt(root, 'sub/new.md', 'x')
    await vi.waitFor(() => expect(onChange).toHaveBeenCalled(), { timeout: 3000 })

    onChange.mockClear()
    await rm(path.join(root, 'a.md'))
    await vi.waitFor(() => expect(onChange).toHaveBeenCalled(), { timeout: 3000 })
  })
})
