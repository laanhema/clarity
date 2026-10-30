import { realpath, stat } from 'node:fs/promises'
import path from 'node:path'
import { PathAccessError, isMarkdownPath, resolveInsideRoot } from './pathGuard'

/**
 * The set of paths the renderer may read and write.
 *
 * Access is granted only through native dialogs: the folder chosen with Open
 * Folder, and single files chosen with Open File or Save As. Every renderer
 * request is resolved against these grants; anything else is rejected.
 */
export class AccessScope {
  #folder: string | null = null
  readonly #files = new Set<string>()

  get folder(): string | null {
    return this.#folder
  }

  /** Grants access to a folder the user picked. Returns its real path. */
  async grantFolder(folderPath: string): Promise<string> {
    const real = await realpath(folderPath)
    if (!(await stat(real)).isDirectory()) throw new PathAccessError('Not a folder', folderPath)
    this.#folder = real
    return real
  }

  /** Grants access to one file the user picked. Returns its real path. */
  async grantFile(filePath: string): Promise<string> {
    const real = await realpath(filePath)
    if (!(await stat(real)).isFile()) throw new PathAccessError('Not a file', filePath)
    this.#files.add(real)
    return real
  }

  /** Resolves a path the renderer wants to read, or throws `PathAccessError`. */
  async resolveForRead(requested: unknown): Promise<string> {
    return this.#resolve(requested, false)
  }

  /** Resolves a path the renderer wants to write, or throws `PathAccessError`. */
  async resolveForWrite(requested: unknown): Promise<string> {
    return this.#resolve(requested, true)
  }

  async #resolve(requested: unknown, allowMissing: boolean): Promise<string> {
    if (typeof requested !== 'string' || requested.length === 0 || requested.includes('\0')) {
      throw new PathAccessError('Invalid path', String(requested))
    }

    const grantedFile = await this.#matchGrantedFile(requested)
    if (grantedFile) return grantedFile

    if (this.#folder) {
      const real = await resolveInsideRoot(this.#folder, requested, { allowMissing })
      if (!isMarkdownPath(real)) throw new PathAccessError('Only Markdown files can be opened', requested)
      return real
    }

    throw new PathAccessError('Path was not opened through a dialog', requested)
  }

  async #matchGrantedFile(requested: string): Promise<string | null> {
    if (this.#files.size === 0 || !path.isAbsolute(requested)) return null
    try {
      const real = await realpath(requested)
      return this.#files.has(real) ? real : null
    } catch {
      return null
    }
  }
}
