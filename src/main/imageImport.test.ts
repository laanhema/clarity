import { readFile, readdir, rename, rm, symlink, truncate } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AccessScope } from './accessScope'
import { importImage } from './imageImport'
import { MAX_IMAGE_BYTES } from './images'
import { PathAccessError } from './pathGuard'
import { linkAt, makeTempDir, removeDir, writeAt } from './testFs'

// Lets a test swap the dropped file between the checks and the open.
const beforeOpen = vi.hoisted(() => ({ swap: null as (() => Promise<void>) | null }))
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  return {
    ...actual,
    open: async (...args: Parameters<typeof actual.open>) => {
      const swap = beforeOpen.swap
      beforeOpen.swap = null
      if (swap) await swap()
      return actual.open(...args)
    },
  }
})

describe('importImage', () => {
  let workspace: string
  let folder: string
  let document: string
  let outside: string
  let scope: AccessScope

  beforeEach(async () => {
    workspace = await makeTempDir()
    folder = path.join(workspace, 'notes')
    document = await writeAt(folder, 'journal/notes.md', '# Notes')
    await writeAt(folder, 'img/inside.png', 'inside')
    outside = await writeAt(workspace, 'downloads/photo.png', 'photo')
    scope = new AccessScope()
    await scope.grantFolder(folder)
  })

  afterEach(async () => {
    beforeOpen.swap = null
    await removeDir(workspace)
  })

  it('references an image inside the open folder where it is, relative to the document', async () => {
    await expect(importImage(scope, document, path.join(folder, 'img', 'inside.png'))).resolves.toEqual({
      relativePath: '../img/inside.png',
      copiedAs: null,
    })
    expect(await readdir(path.dirname(document))).toEqual(['notes.md'])
  })

  it('copies an image from outside next to the document under the document name', async () => {
    await expect(importImage(scope, document, outside)).resolves.toEqual({
      relativePath: 'notes-photo.png',
      copiedAs: 'notes-photo.png',
    })
    expect(await readFile(path.join(folder, 'journal', 'notes-photo.png'), 'utf8')).toBe('photo')
  })

  it('numbers the copy on a name clash and never overwrites', async () => {
    await writeAt(folder, 'journal/notes-photo.png', 'existing')
    await expect(importImage(scope, document, outside)).resolves.toMatchObject({ copiedAs: 'notes-photo-2.png' })
    await expect(importImage(scope, document, outside)).resolves.toMatchObject({ copiedAs: 'notes-photo-3.png' })
    expect(await readFile(path.join(folder, 'journal', 'notes-photo.png'), 'utf8')).toBe('existing')
  })

  it('does not write through a link that holds the copy name', async () => {
    const target = await writeAt(workspace, 'secret.png', 'secret')
    await linkAt(folder, 'journal/notes-photo.png', target)
    await expect(importImage(scope, document, outside)).resolves.toMatchObject({ copiedAs: 'notes-photo-2.png' })
    expect(await readFile(target, 'utf8')).toBe('secret')
  })

  it('copies an image that a link inside the folder points to from outside', async () => {
    const link = await linkAt(folder, 'img/linked.png', outside)
    await expect(importImage(scope, document, link)).resolves.toMatchObject({ copiedAs: 'notes-linked.png' })
  })

  it('refuses an image over the size limit and writes nothing', async () => {
    const big = await writeAt(workspace, 'downloads/big.png')
    await truncate(big, MAX_IMAGE_BYTES + 1)
    await expect(importImage(scope, document, big)).rejects.toThrow('big.png is larger than the 15 MB image limit')
    expect(await readdir(path.dirname(document))).toEqual(['notes.md'])
  })

  it('refuses files that are not images, and folders named like images', async () => {
    const text = await writeAt(workspace, 'downloads/readme.txt', 'text')
    await expect(importImage(scope, document, text)).rejects.toThrow('readme.txt is not an image')
    const disguised = await linkAt(workspace, 'downloads/disguised.png', text)
    await expect(importImage(scope, document, disguised)).rejects.toThrow('disguised.png is not an image')
    await writeAt(workspace, 'downloads/folder.png/inner.txt')
    await expect(importImage(scope, document, path.join(workspace, 'downloads', 'folder.png'))).rejects.toThrow(
      'folder.png is not a file',
    )
  })

  it('refuses a file swapped in between the check and the read, and writes nothing', async () => {
    const secret = await writeAt(workspace, 'secret.txt', 'secret')
    beforeOpen.swap = () => rename(secret, outside)
    await expect(importImage(scope, document, outside)).rejects.toThrow('photo.png changed while it was being read')

    await writeAt(workspace, 'downloads/photo.png', 'photo')
    const other = await writeAt(workspace, 'other.txt', 'other')
    beforeOpen.swap = async () => {
      await rm(outside)
      await symlink(other, outside)
    }
    await expect(importImage(scope, document, outside)).rejects.toThrow('photo.png changed while it was being read')
    expect(await readdir(path.dirname(document))).toEqual(['notes.md'])
  })

  it('refuses relative or invalid image paths', async () => {
    for (const imagePath of ['photo.png', '', 42, null, `${outside}\0`]) {
      await expect(importImage(scope, document, imagePath)).rejects.toBeInstanceOf(PathAccessError)
    }
  })

  it('refuses when no folder is open or the document lies outside it', async () => {
    const single = await writeAt(workspace, 'elsewhere/single.md', 'single')
    await scope.grantFile(single)
    await expect(importImage(scope, single, outside)).rejects.toBeInstanceOf(PathAccessError)
    scope.dropFolder()
    await expect(importImage(scope, document, outside)).rejects.toThrow('Open a folder')
    await expect(importImage(scope, single, outside)).rejects.toBeInstanceOf(PathAccessError)
  })
})
