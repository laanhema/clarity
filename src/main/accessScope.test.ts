import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AccessScope } from './accessScope'
import { PathAccessError } from './pathGuard'
import { linkAt, makeTempDir, removeDir, writeAt } from './testFs'

describe('AccessScope', () => {
  let workspace: string
  let folder: string
  let scope: AccessScope

  beforeEach(async () => {
    workspace = await makeTempDir()
    folder = path.join(workspace, 'notes')
    await writeAt(folder, 'a.md', 'a')
    await writeAt(folder, 'script.js', 'alert(1)')
    await writeAt(workspace, 'elsewhere/single.md', 'single')
    await writeAt(workspace, 'elsewhere/other.md', 'other')
    scope = new AccessScope()
  })

  afterEach(() => removeDir(workspace))

  it('rejects everything before a dialog has granted access', async () => {
    await expect(scope.resolveForRead(path.join(folder, 'a.md'))).rejects.toBeInstanceOf(PathAccessError)
  })

  it('allows Markdown files in the granted folder only', async () => {
    await scope.grantFolder(folder)
    await expect(scope.resolveForRead(path.join(folder, 'a.md'))).resolves.toBe(path.join(folder, 'a.md'))
    await expect(scope.resolveForRead(path.join(folder, 'script.js'))).rejects.toBeInstanceOf(PathAccessError)
    await expect(scope.resolveForRead(path.join(workspace, 'elsewhere', 'single.md'))).rejects.toBeInstanceOf(
      PathAccessError,
    )
  })

  it('allows a single granted file but not its neighbours', async () => {
    const single = path.join(workspace, 'elsewhere', 'single.md')
    await scope.grantFile(single)
    await expect(scope.resolveForRead(single)).resolves.toBe(single)
    await expect(scope.resolveForWrite(single)).resolves.toBe(single)
    await expect(scope.resolveForRead(path.join(workspace, 'elsewhere', 'other.md'))).rejects.toBeInstanceOf(
      PathAccessError,
    )
  })

  it('allows writing a new Markdown file inside the folder', async () => {
    await scope.grantFolder(folder)
    await expect(scope.resolveForWrite(path.join(folder, 'new.md'))).resolves.toBe(path.join(folder, 'new.md'))
    await expect(scope.resolveForWrite(path.join(folder, 'new.sh'))).rejects.toBeInstanceOf(PathAccessError)
  })

  it('refuses to grant a file as a folder or a folder as a file', async () => {
    await expect(scope.grantFolder(path.join(folder, 'a.md'))).rejects.toBeInstanceOf(PathAccessError)
    await expect(scope.grantFile(folder)).rejects.toBeInstanceOf(PathAccessError)
  })

  it('keeps the open document writable after another folder is opened', async () => {
    const other = path.join(workspace, 'other')
    await writeAt(other, 'b.md', 'b')
    await scope.grantFolder(folder)
    const open = await scope.resolveForWrite(path.join(folder, 'a.md'))
    scope.keepFile(open)
    await scope.grantFolder(other)
    await expect(scope.resolveForWrite(open)).resolves.toBe(open)
    await expect(scope.resolveForRead(path.join(folder, 'script.js'))).rejects.toBeInstanceOf(PathAccessError)
  })

  describe('resolveImage', () => {
    let doc: string

    beforeEach(async () => {
      doc = await writeAt(folder, 'guides/doc.md', '![x](a.png)')
      await writeAt(folder, 'guides/a.png', 'png')
      await writeAt(folder, 'guides/my pic.jpg', 'jpg')
      await writeAt(folder, 'top.svg', '<svg/>')
      await writeAt(folder, 'guides/notes.txt', 'text')
      await writeAt(workspace, 'secret.png', 'secret')
    })

    it('resolves relative and folder-rooted images inside the folder', async () => {
      await scope.grantFolder(folder)
      await expect(scope.resolveImage(doc, 'a.png')).resolves.toBe(path.join(folder, 'guides', 'a.png'))
      await expect(scope.resolveImage(doc, './my%20pic.jpg?v=2#x')).resolves.toBe(path.join(folder, 'guides', 'my pic.jpg'))
      await expect(scope.resolveImage(doc, '../top.svg')).resolves.toBe(path.join(folder, 'top.svg'))
      await expect(scope.resolveImage(doc, '/top.svg')).resolves.toBe(path.join(folder, 'top.svg'))
    })

    it('rejects images outside the folder, non-images and URLs', async () => {
      await scope.grantFolder(folder)
      await linkAt(folder, 'guides/link.png', path.join(workspace, 'secret.png'))
      for (const src of [
        '../../secret.png',
        '/../secret.png',
        'link.png',
        'notes.txt',
        'missing.png',
        'https://example.com/a.png',
        'file:///etc/passwd',
        `file://${path.join(folder, 'guides', 'a.png')}`,
        'data:image/png;base64,AAAA',
        '//host/a.png',
        '%E0%A4%A.png',
        '',
        42,
      ]) {
        await expect(scope.resolveImage(doc, src), String(src)).rejects.toThrow()
      }
    })

    it('needs an open folder and a readable document', async () => {
      await expect(scope.resolveImage(doc, 'a.png')).rejects.toBeInstanceOf(PathAccessError)
      await scope.grantFolder(folder)
      await expect(scope.resolveImage(path.join(workspace, 'elsewhere', 'single.md'), '../notes/guides/a.png')).rejects.toBeInstanceOf(
        PathAccessError,
      )
    })
  })
})
