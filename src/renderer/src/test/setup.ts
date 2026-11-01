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
// Nor does it have ResizeObserver; without layout nothing would ever be resized.
if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

// Nor modal dialogs: open and close them without the top layer.
if (!('showModal' in HTMLDialogElement.prototype)) {
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: {
      value(this: HTMLDialogElement) {
        this.setAttribute('open', '')
      },
    },
    close: {
      value(this: HTMLDialogElement) {
        if (!this.hasAttribute('open')) return
        this.removeAttribute('open')
        this.dispatchEvent(new Event('close'))
      },
    },
  })
}

afterEach(() => {
  cleanup()
})
