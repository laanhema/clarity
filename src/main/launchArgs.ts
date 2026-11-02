import path from 'node:path'
import { isMarkdownPath } from './pathGuard'

/**
 * Scans command-line arguments for the first Markdown file to open.
 *
 * Skips options/flags (starting with `-`), recognizes `--` as the end of options,
 * and resolves any relative path against the provided working directory (`cwd`).
 */
export function parseLaunchFilePath(argv: readonly string[], cwd: string): string | null {
  let endOfOptions = false
  for (const arg of argv) {
    if (!endOfOptions && arg === '--') {
      endOfOptions = true
      continue
    }
    if (!endOfOptions && arg.startsWith('-')) continue
    if (isMarkdownPath(arg)) {
      return path.resolve(cwd, arg)
    }
  }
  return null
}
