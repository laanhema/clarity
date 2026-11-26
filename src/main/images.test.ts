import { describe, expect, it } from 'vitest'
import { copyNameFor, localImageReference, relativeReference } from './images'

describe('copyNameFor', () => {
  it('puts the document name in front of the image name', () => {
    expect(copyNameFor('/notes/notes.md', 'photo.png', 1)).toBe('notes-photo.png')
    expect(copyNameFor('/notes/Trip Report.markdown', 'IMG 0001.JPG', 1)).toBe('Trip Report-IMG 0001.JPG')
  })

  it('numbers later attempts before the extension', () => {
    expect(copyNameFor('/notes/notes.md', 'photo.png', 2)).toBe('notes-photo-2.png')
    expect(copyNameFor('/notes/notes.md', 'photo.png', 3)).toBe('notes-photo-3.png')
    expect(copyNameFor('/notes/notes.md', 'archive.tar.svg', 2)).toBe('notes-archive.tar-2.svg')
  })
})

describe('relativeReference', () => {
  it('is relative to the document folder, with forward slashes', () => {
    expect(relativeReference('/notes', '/notes/photo.png')).toBe('photo.png')
    expect(relativeReference('/notes', '/notes/img/deep/photo.png')).toBe('img/deep/photo.png')
    expect(relativeReference('/notes/journal/2026', '/notes/img/photo.png')).toBe('../../img/photo.png')
  })
})

describe('localImageReference', () => {
  it('decodes the encoded paths that a dropped image inserts', () => {
    expect(localImageReference('my%20photo%20%281%29.png').relativePath).toBe('my photo (1).png')
    expect(localImageReference('../img/%C3%A4%23%3F.png').relativePath).toBe('../img/ä#?.png')
  })
})
