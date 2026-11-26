import { constants, type Stats } from 'node:fs'
import { open, realpath, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { DroppedImage } from '../shared/api'
import type { AccessScope } from './accessScope'
import { MAX_IMAGE_BYTES, copyNameFor, imageMimeType, relativeReference } from './images'
import { PathAccessError, isWithin } from './pathGuard'

/** How many numbered names a copy tries before giving up. */
const MAX_COPY_ATTEMPTS = 1000

const SIZE_LIMIT = `${MAX_IMAGE_BYTES / (1024 * 1024)} MB`

function isAlreadyThere(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'EEXIST'
}

/**
 * Reads a dropped image from outside the open folder. The path comes from the
 * user's drop, not from a grant, so only the regular image file that `checked`
 * describes is read: the open does not follow a link at the last path
 * component, and the open handle must be the same file (device and inode) and
 * still within the size limit, so a file swapped in after the check is refused.
 */
async function readDroppedImage(imagePath: string, name: string, checked: Stats): Promise<Buffer> {
  // O_NONBLOCK keeps a FIFO renamed to `.png` from blocking the open.
  const handle = await open(imagePath, constants.O_RDONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW).catch(
    (error: unknown) => {
      if (error instanceof Error && 'code' in error && error.code === 'ELOOP') {
        throw new PathAccessError(`${name} changed while it was being read`, imagePath)
      }
      throw error
    },
  )
  try {
    const info = await handle.stat()
    if (info.dev !== checked.dev || info.ino !== checked.ino) {
      throw new PathAccessError(`${name} changed while it was being read`, imagePath)
    }
    if (!info.isFile()) throw new PathAccessError(`${name} is not a file`, imagePath)
    if (info.size > MAX_IMAGE_BYTES) throw new PathAccessError(`${name} is larger than the ${SIZE_LIMIT} image limit`, imagePath)
    return await handle.readFile()
  } finally {
    await handle.close()
  }
}

/**
 * Prepares an image file dropped on the editor for the open document. An image
 * whose real path lies inside the open folder is referenced where it is; any
 * other is copied next to the document as `<document name>-<image name>`, with
 * `-2`, `-3`… added until the name is free. A copy never replaces a file.
 */
export async function importImage(scope: AccessScope, documentPath: unknown, imagePath: unknown): Promise<DroppedImage> {
  const { folder, document } = await scope.resolveDropDocument(documentPath)
  if (typeof imagePath !== 'string' || !path.isAbsolute(imagePath) || imagePath.includes('\0')) {
    throw new PathAccessError('Invalid image path', String(imagePath))
  }
  const name = path.basename(imagePath)
  const real = await realpath(imagePath)
  if (!imageMimeType(name) || !imageMimeType(real)) throw new PathAccessError(`${name} is not an image`, imagePath)
  const info = await stat(real)
  if (!info.isFile()) throw new PathAccessError(`${name} is not a file`, imagePath)
  if (info.size > MAX_IMAGE_BYTES) throw new PathAccessError(`${name} is larger than the ${SIZE_LIMIT} image limit`, imagePath)

  const documentFolder = path.dirname(document)
  if (isWithin(folder, real)) return { relativePath: relativeReference(documentFolder, real), copiedAs: null }

  const data = await readDroppedImage(real, name, info)
  for (let attempt = 1; attempt <= MAX_COPY_ATTEMPTS; attempt++) {
    const target = await scope.resolveImageCopy(documentFolder, copyNameFor(document, name, attempt))
    try {
      // 'wx' creates the file exclusively: it fails on any existing file or link.
      await writeFile(target, data, { flag: 'wx' })
    } catch (error) {
      if (isAlreadyThere(error)) continue
      throw error
    }
    return { relativePath: relativeReference(documentFolder, target), copiedAs: path.basename(target) }
  }
  throw new PathAccessError(`No free name for a copy of ${name}`, imagePath)
}
