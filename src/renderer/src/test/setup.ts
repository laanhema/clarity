import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// jsdom has no layout. CodeMirror measures text ranges, so give it empty rectangles.
function emptyRects(): DOMRectList {
  const list: DOMRect[] = []
  return Object.assign(list, { item: (index: number) => list[index] ?? null })
}
Range.prototype.getClientRects = emptyRects
Range.prototype.getBoundingClientRect = () => new DOMRect()
// Inside a shadow root CodeMirror reads the selection through execCommand, which jsdom lacks.
if (!('execCommand' in Document.prototype)) {
  Object.defineProperty(Document.prototype, 'execCommand', { value: () => false })
}
if (!('scrollIntoView' in Element.prototype)) {
  Object.defineProperty(Element.prototype, 'scrollIntoView', { value: () => undefined })
}

afterEach(() => {
  cleanup()
})
