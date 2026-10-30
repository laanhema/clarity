import { realpath } from 'node:fs/promises'
import path from 'node:path'
import { MARKDOWN_EXTENSIONS } from '../shared/api'

export class PathAccessError extends Error {
  constructor(
    message: string,
    readonly requestedPath: string,
  ) {
    super(message)
    this.name = 'PathAccessError'
  }
}

/** True when `candidate` is `root` itself or lies below it. Both must be absolute. */
export function isWithin(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate)
  if (relative === '') return true
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)
}

export function isMarkdownPath(filePath: string): boolean {
  const extension = path.extname(filePath).toLowerCase()
  return (MARKDOWN_EXTENSIONS as readonly string[]).includes(extension)
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && 'code' in error && (error.code === 'ENOENT' || error.code === 'ENOTDIR')
}

function assertUsablePath(requested: unknown): asserts requested is string {
  if (typeof requested !== 'string' || requested.length === 0 || requested.includes('\0')) {
    throw new PathAccessError('Invalid path', String(requested))
  }
}

export interface ResolveOptions {
  /** Accept a path that does not exist yet, as long as its parent folder is inside the root. */
  allowMissing?: boolean
}

/**
 * Resolves `requested` (absolute, or relative to `root`) to a real path inside `root`.
 *
 * `root` must already be a real path. The check runs twice: once on the lexical
 * path, which rejects `../` traversal and absolute paths elsewhere, and once on
 * the real path, which rejects symlinks that point outside the root.
 */
export async function resolveInsideRoot(
  root: string,
  requested: unknown,
  options: ResolveOptions = {},
): Promise<string> {
  assertUsablePath(requested)
  const candidate = path.resolve(root, requested)
  if (!isWithin(root, candidate)) {
    throw new PathAccessError('Path is outside the open folder', requested)
  }

  let real: string
  try {
    real = await realpath(candidate)
  } catch (error) {
    if (!options.allowMissing || !isMissing(error)) throw error
    const parent = await realpath(path.dirname(candidate))
    real = path.join(parent, path.basename(candidate))
  }

  if (!isWithin(root, real)) {
    throw new PathAccessError('Path resolves outside the open folder', requested)
  }
  return real
}
