import path from 'node:path'
import { isMarkdownPath } from './pathGuard'

/**
 * Scans command-line arguments for the first Markdown file to open.
 *
 * Skips the executable/app path (argv[0]), skips options/flags (starting with `-`),
 * recognizes `--` as the end of options, and resolves any relative path against
 * the provided working directory (`cwd`).
 */
export function parseLaunchFilePath(argv: readonly string[], cwd: string): string | null {
  const args = argv.slice(1)
  let endOfOptions = false
  for (const arg of args) {
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
