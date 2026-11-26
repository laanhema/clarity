import type { Element, Root } from 'hast'
import { describe, expect, it } from 'vitest'
import { encodeImagePath, markdownImage } from './imageDrop'
import { markdownToSafeTree } from './markdown/pipeline'

function firstImage(tree: Root): Element | undefined {
  const stack: (Root | Element)[] = [tree]
  while (stack.length > 0) {
    const node = stack.pop()
    if (!node) break
    if (node.type === 'element' && node.tagName === 'img') return node
    for (const child of node.children) if (child.type === 'element') stack.push(child)
  }
  return undefined
}

describe('markdownImage', () => {
  it('uses the file name without its extension as the alt text', () => {
    expect(markdownImage('photo.png')).toBe('![photo](photo.png)')
    expect(markdownImage('../img/notes-photo-2.png')).toBe('![notes-photo-2](../img/notes-photo-2.png)')
    expect(markdownImage('img/.hidden')).toBe('![.hidden](img/.hidden)')
  })

  it('escapes brackets and backslashes in the alt text', () => {
    expect(markdownImage('a [draft] \\ b.png')).toBe('![a \\[draft\\] \\\\ b](a%20%5Bdraft%5D%20%5C%20b.png)')
  })

  it.each([
    'my photo (1).png',
    'img/Résumé ä 写真.png',
    '../up/a#b?c%d.png',
    'unbalanced (.svg',
  ])('encodes %s so the preview requests the same file', (relativePath) => {
    const reference = markdownImage(relativePath)
    const src = firstImage(markdownToSafeTree(reference))?.properties['src']
    expect(src).toBe(encodeImagePath(relativePath))
    // The main process strips ?query and #fragment, then decodes (src/main/images.ts localImageReference).
    expect(decodeURIComponent(String(src).replace(/[?#].*$/s, ''))).toBe(relativePath)
  })
})
