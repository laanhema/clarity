import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

/** A throwaway directory for file-system tests, as a real path. */
export async function makeTempDir(prefix = 'lantern-test-'): Promise<string> {
  return realpath(await mkdtemp(path.join(tmpdir(), prefix)))
}

export function removeDir(dir: string): Promise<void> {
  return rm(dir, { recursive: true, force: true })
}

/** Writes `content` to `root/relativePath`, creating parent folders. */
export async function writeAt(root: string, relativePath: string, content = ''): Promise<string> {
  const target = path.join(root, relativePath)
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, content)
  return target
}

export async function linkAt(root: string, relativePath: string, target: string): Promise<string> {
  const link = path.join(root, relativePath)
  await mkdir(path.dirname(link), { recursive: true })
  await symlink(target, link)
  return link
}
