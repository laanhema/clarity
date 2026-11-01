import { isMarkdownFileName } from '../../shared/api'

/** What clicking a link in the preview does. */
export type LinkTarget =
  /** Open in the system browser. */
  | { kind: 'external'; url: string }
  /** Scroll the preview to the element with this id (as written in the document, without the sanitizer's prefix). */
  | { kind: 'anchor'; id: string }
  /** Open this Markdown file of the open folder in Clarity. */
  | { kind: 'document'; path: string }
  | { kind: 'ignore' }

const IGNORE: LinkTarget = { kind: 'ignore' }

function separatorOf(filePath: string): '/' | '\\' {
  return filePath.includes('\\') && !filePath.includes('/') ? '\\' : '/'
}

function parentOf(filePath: string): string {
  const index = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
  return index <= 0 ? filePath.slice(0, index + 1) : filePath.slice(0, index)
}

/** Resolves a `/`-separated relative path against an absolute folder, handling `.` and `..`. */
function joinPath(folder: string, relative: string, separator: '/' | '\\'): string {
  const parts = folder.split(/[\\/]/)
  if (parts.length > 1 && parts.at(-1) === '') parts.pop()
  for (const segment of relative.split('/')) {
    if (segment === '' || segment === '.') continue
    if (segment === '..') {
      if (parts.length > 1) parts.pop()
    } else {
      parts.push(segment)
    }
  }
  const joined = parts.join(separator)
  return joined === '' ? separator : joined
}

function isInside(root: string, candidate: string, separator: '/' | '\\'): boolean {
  const prefix = root.endsWith(separator) ? root : root + separator
  return candidate.startsWith(prefix)
}

function decode(text: string): string | null {
  try {
    return decodeURIComponent(text)
  } catch {
    return null
  }
}

/**
 * Decides what a link in the preview does:
 * - `http:` and `https:` links open in the system browser;
 * - `#id` scrolls to that part of the preview;
 * - a relative link to a `.md` or `.markdown` file inside the open folder opens it in Clarity
 *   (the main process checks the path again before reading it);
 * - everything else — other schemes, other file types, files outside the folder — does nothing.
 */
export function routeLink(href: string | null, documentPath: string | null, folderPath: string | null): LinkTarget {
  if (!href) return IGNORE
  const trimmed = href.trim()

  if (trimmed.startsWith('#')) {
    const id = decode(trimmed.slice(1))
    return id ? { kind: 'anchor', id } : IGNORE
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    let url: URL
    try {
      url = new URL(trimmed)
    } catch {
      return IGNORE
    }
    return url.protocol === 'http:' || url.protocol === 'https:' ? { kind: 'external', url: url.href } : IGNORE
  }

  if (trimmed.startsWith('//') || trimmed.startsWith('\\') || !documentPath || !folderPath) return IGNORE

  const relative = decode(trimmed.replace(/[?#].*$/s, ''))
  if (!relative || relative.includes('\0') || relative.includes('\\') || !isMarkdownFileName(relative)) return IGNORE

  const separator = separatorOf(documentPath)
  const base = relative.startsWith('/') ? folderPath : parentOf(documentPath)
  const target = joinPath(base, relative, separator)
  return isInside(folderPath, target, separator) ? { kind: 'document', path: target } : IGNORE
}
