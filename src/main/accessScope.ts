import { realpath, stat } from 'node:fs/promises'
import path from 'node:path'
import { imageMimeType, localImageReference } from './images'
import { PathAccessError, isMarkdownPath, resolveInsideRoot } from './pathGuard'

/**
 * The set of paths the renderer may read and write.
 *
 * Access is granted only through native dialogs and the menu: the folder
 * chosen with Open Folder or Open Recent, and single files chosen with Open
 * File or Save As. Opening another folder drops the old folder's grant. Every renderer
 * request is resolved against these grants; anything else is rejected.
 */
export class AccessScope {
  #folder: string | null = null
  #pickedFolder: string | null = null
  readonly #files = new Set<string>()

  get folder(): string | null {
    return this.#folder
  }

  /**
   * Remembers a folder the user picked, without granting it yet: the renderer
   * first settles the open document, then grants it with `grantPickedFolder`.
   * Returns its real path.
   */
  async pickFolder(folderPath: string): Promise<string> {
    const real = await realpath(folderPath)
    if (!(await stat(real)).isDirectory()) throw new PathAccessError('Not a folder', folderPath)
    this.#pickedFolder = real
    return real
  }

  /**
   * Makes the picked folder, or the open folder again, the granted folder, and
   * forgets the pick. Any other path throws `PathAccessError`.
   */
  async grantPickedFolder(requested: unknown): Promise<string> {
    const picked = this.#pickedFolder
    this.#pickedFolder = null
    if (typeof requested !== 'string' || (requested !== picked && requested !== this.#folder)) {
      throw new PathAccessError('Folder was not picked', String(requested))
    }
    return this.grantFolder(requested)
  }

  /** Forgets a picked folder, such as when the user cancels the switch. */
  dropPickedFolder(): void {
    this.#pickedFolder = null
  }

  /** Grants access to a folder. Returns its real path. */
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

  /**
   * Resolves an image that `documentPath` links as `src`. The image must lie
   * inside the open folder and have an image extension; anything else throws
   * `PathAccessError`.
   */
  async resolveImage(documentPath: unknown, src: unknown): Promise<string> {
    const folder = this.#folder
    if (!folder) throw new PathAccessError('Images load only from an open folder', String(src))
    const document = await this.resolveForRead(documentPath)
    const { fromRoot, relativePath } = localImageReference(src)
    const candidate = fromRoot ? path.join(folder, relativePath) : path.resolve(path.dirname(document), relativePath)
    const real = await resolveInsideRoot(folder, candidate)
    if (!imageMimeType(real)) throw new PathAccessError('Not an image', String(src))
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
