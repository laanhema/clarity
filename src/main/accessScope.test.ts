import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AccessScope } from './accessScope'
import { PathAccessError } from './pathGuard'
import { makeTempDir, removeDir, writeAt } from './testFs'

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
})
