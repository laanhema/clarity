import type { Dirent } from 'node:fs'
import { readdir, realpath, stat } from 'node:fs/promises'
import path from 'node:path'
import type { FileTreeNode } from '../shared/api'
import { isMarkdownPath, isWithin } from './pathGuard'

const IGNORED_DIRECTORIES = new Set(['.git', 'node_modules'])
const MAX_DEPTH = 32

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

function compareNodes(a: FileTreeNode, b: FileTreeNode): number {
  if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1
  return collator.compare(a.name, b.name)
}

/** `.git` and `node_modules` are never listed or watched; other dot-folders are treated like any folder. */
export function isIgnoredDirectory(name: string): boolean {
  return IGNORED_DIRECTORIES.has(name)
}

/**
 * A symlink is listed only when it points at a Markdown file inside the root.
 * Symlinked folders are skipped, which also rules out symlink loops.
 */
async function isListableSymlink(root: string, linkPath: string): Promise<boolean> {
  try {
    const target = await realpath(linkPath)
    if (!isWithin(root, target) || !isMarkdownPath(target)) return false
    return (await stat(target)).isFile()
  } catch {
    return false
  }
}

async function listDirectory(root: string, directory: string, depth: number): Promise<FileTreeNode[]> {
  if (depth > MAX_DEPTH) return []

  let entries: Dirent[]
  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch {
    // An unreadable subfolder should not hide the rest of the tree.
    return []
  }

  const nodes: FileTreeNode[] = []
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      if (isIgnoredDirectory(entry.name)) continue
      const children = await listDirectory(root, entryPath, depth + 1)
      if (children.length > 0) nodes.push({ kind: 'directory', name: entry.name, path: entryPath, children })
    } else if (entry.isFile()) {
      if (isMarkdownPath(entry.name)) nodes.push({ kind: 'file', name: entry.name, path: entryPath })
    } else if (entry.isSymbolicLink()) {
      if (isMarkdownPath(entry.name) && (await isListableSymlink(root, entryPath))) {
        nodes.push({ kind: 'file', name: entry.name, path: entryPath })
      }
    }
  }
  return nodes.sort(compareNodes)
}

/**
 * Lists the Markdown files below `root` as a tree. Folders without Markdown
 * files, dot-folders and `node_modules` are left out. `root` must be a real path.
 */
export function listMarkdownTree(root: string): Promise<FileTreeNode[]> {
  return listDirectory(root, root, 0)
}
