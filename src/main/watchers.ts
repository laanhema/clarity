import { watch } from 'chokidar'
import type { Stats } from 'node:fs'
import path from 'node:path'
import { isMarkdownPath } from './pathGuard'
import { isIgnoredDirectory } from './fileTree'

export type StopWatching = () => void

/**
 * Calls `onChange` when another program changes, replaces or deletes the file.
 * Editors that save by writing a new file and renaming it over the old one
 * count as a change, not as a delete followed by an add.
 */
export function watchDocumentFile(filePath: string, onChange: () => void): StopWatching {
  const watcher = watch(filePath, {
    ignoreInitial: true,
    atomic: true,
    awaitWriteFinish: { stabilityThreshold: 120, pollInterval: 40 },
  })
  watcher.on('change', onChange).on('add', onChange).on('unlink', onChange)
  watcher.on('error', (error) => console.error('File watcher error:', error))
  return () => void watcher.close()
}

/**
 * Calls `onChange` (batched) when Markdown files or folders are added to or
 * removed from `root`. Skips the same folders the sidebar skips.
 */
export function watchFolderTree(root: string, onChange: () => void, batchMs = 250): StopWatching {
  let timer: ReturnType<typeof setTimeout> | null = null
  const schedule = () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      onChange()
    }, batchMs)
  }
  const fileChanged = (changedPath: string) => {
    if (isMarkdownPath(changedPath)) schedule()
  }

  const watcher = watch(root, {
    ignoreInitial: true,
    followSymlinks: false,
    depth: 32,
    ignored: (candidate: string, stats?: Stats) => {
      if (candidate === root) return false
      if (stats) return stats.isFile() ? !isMarkdownPath(candidate) : isIgnoredDirectory(path.basename(candidate))
      // Called once without stats first: only rule out what cannot be a Markdown file's folder.
      return !isMarkdownPath(candidate) && isIgnoredDirectory(path.basename(candidate))
    },
  })
  watcher.on('add', fileChanged).on('unlink', fileChanged).on('addDir', schedule).on('unlinkDir', schedule)
  watcher.on('error', (error) => console.error('Folder watcher error:', error))

  return () => {
    if (timer) clearTimeout(timer)
    void watcher.close()
  }
}
