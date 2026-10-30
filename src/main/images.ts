import path from 'node:path'
import { PathAccessError } from './pathGuard'

const IMAGE_TYPES: Readonly<Record<string, string>> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  // An SVG shown through <img> cannot run scripts, so it is as safe as a bitmap.
  '.svg': 'image/svg+xml',
}

export const MAX_IMAGE_BYTES = 15 * 1024 * 1024

/** The MIME type for an image file, or null when the extension is not an image type mdpad shows. */
export function imageMimeType(filePath: string): string | null {
  return IMAGE_TYPES[path.extname(filePath).toLowerCase()] ?? null
}

/**
 * Turns an image `src` from a document into a file path relative to the
 * document's folder, or, when it starts with `/`, relative to the open folder.
 *
 * Only local relative references are accepted: anything with a scheme
 * (`https:`, `file:`, `data:`…) or a protocol-relative `//host` is rejected.
 * Query strings and fragments are dropped and percent-escapes decoded.
 */
export function localImageReference(src: unknown): { fromRoot: boolean; relativePath: string } {
  if (typeof src !== 'string' || src.length === 0 || src.length > 4096) {
    throw new PathAccessError('Invalid image path', String(src))
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(src) || src.startsWith('//') || src.startsWith('\\\\')) {
    throw new PathAccessError('Only images inside the open folder can be shown', src)
  }
  const withoutSuffix = src.replace(/[?#].*$/s, '')
  let decoded: string
  try {
    decoded = decodeURIComponent(withoutSuffix)
  } catch {
    throw new PathAccessError('Invalid image path', src)
  }
  if (decoded.length === 0 || decoded.includes('\0')) throw new PathAccessError('Invalid image path', src)
  const fromRoot = decoded.startsWith('/')
  return { fromRoot, relativePath: fromRoot ? decoded.replace(/^\/+/, '') : decoded }
}
