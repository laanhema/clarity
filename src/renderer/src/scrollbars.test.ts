import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SCROLLING_CLASS, trackScrolling } from './scrollbars'
import styles from './styles.css?raw'

describe('trackScrolling', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    document.body.replaceChildren()
  })

  function scroller(parent: Node = document.body): HTMLElement {
    const element = document.createElement('div')
    parent.appendChild(element)
    return element
  }

  it('marks a scrolling element until it has been idle for the delay', () => {
    const stop = trackScrolling(document, 1000)
    const element = scroller()
    expect(element.classList.contains(SCROLLING_CLASS)).toBe(false)

    element.dispatchEvent(new Event('scroll'))
    expect(element.classList.contains(SCROLLING_CLASS)).toBe(true)

    vi.advanceTimersByTime(600)
    element.dispatchEvent(new Event('scroll'))
    vi.advanceTimersByTime(600)
    // The second scroll restarted the delay.
    expect(element.classList.contains(SCROLLING_CLASS)).toBe(true)

    vi.advanceTimersByTime(400)
    expect(element.classList.contains(SCROLLING_CLASS)).toBe(false)
    stop()
  })

  it('tracks each element on its own', () => {
    const stop = trackScrolling(document, 1000)
    const first = scroller()
    const second = scroller()
    first.dispatchEvent(new Event('scroll'))
    vi.advanceTimersByTime(500)
    second.dispatchEvent(new Event('scroll'))
    vi.advanceTimersByTime(500)
    expect(first.classList.contains(SCROLLING_CLASS)).toBe(false)
    expect(second.classList.contains(SCROLLING_CLASS)).toBe(true)
    stop()
  })

  it('sees scrolls inside a shadow root it is given', () => {
    const host = scroller()
    const shadow = host.attachShadow({ mode: 'open' })
    const stop = trackScrolling(shadow, 1000)
    const inner = scroller(shadow)
    inner.dispatchEvent(new Event('scroll'))
    expect(inner.classList.contains(SCROLLING_CLASS)).toBe(true)
    stop()
  })

  it('clears the class and stops listening when stopped', () => {
    const stop = trackScrolling(document, 1000)
    const element = scroller()
    element.dispatchEvent(new Event('scroll'))
    stop()
    expect(element.classList.contains(SCROLLING_CLASS)).toBe(false)
    element.dispatchEvent(new Event('scroll'))
    expect(element.classList.contains(SCROLLING_CLASS)).toBe(false)
  })
})

describe('scrollbar styles', () => {
  let stylesheet: HTMLStyleElement

  beforeEach(() => {
    stylesheet = document.createElement('style')
    stylesheet.textContent = styles
    document.head.append(stylesheet)
    document.body.innerHTML = `
      <nav class="sidebar"><ul class="tree"><li><button class="tree-row">guides</button>
        <ul class="tree"><li><button class="tree-row">setup.md</button></li></ul></li></ul></nav>
      <section class="pane preview-pane"><article class="markdown-body">
        <pre><code><span>code</span></code></pre>
        <table><tbody><tr><td>cell</td></tr></tbody></table>
        <p><span class="katex-display"><span class="katex">x</span></span></p>
        <div class="mermaid-diagram"><div>diagram</div></div>
      </article></section>`
  })

  afterEach(() => {
    stylesheet.remove()
    document.body.replaceChildren()
  })

  const get = (selector: string) => {
    const element = document.querySelector<HTMLElement>(selector)
    if (!element) throw new Error(`Missing ${selector}`)
    return element
  }
  const scrollbarColor = (element: Element) => getComputedStyle(element).getPropertyValue('scrollbar-color')

  // The fade changes the scroller's scrollbar-color on every frame. If its
  // contents inherited it, each frame would restyle all of them.
  it.each([
    ['.sidebar > .tree', '.sidebar > .tree > li', '.tree .tree .tree-row'],
    ['.preview-pane', '.markdown-body', '.markdown-body td'],
    ['.markdown-body pre', '.markdown-body pre > code', '.markdown-body pre span'],
    ['.markdown-body table', '.markdown-body tbody', '.markdown-body td'],
    ['.markdown-body .katex-display', '.markdown-body .katex', '.markdown-body .katex'],
    ['.markdown-body .mermaid-diagram', '.mermaid-diagram > div', '.mermaid-diagram > div'],
  ])('keeps the scrollbar fade of %s from reaching its contents', (scrollerSelector, childSelector, deepSelector) => {
    const scroller = get(scrollerSelector)
    const contents = [get(childSelector), get(deepSelector)]
    const before = contents.map(scrollbarColor)
    const scrollerBefore = scrollbarColor(scroller)

    scroller.style.setProperty('scrollbar-color', 'red blue')

    expect(scrollbarColor(scroller)).not.toBe(scrollerBefore)
    expect(contents.map(scrollbarColor)).toEqual(before)
  })

  it('gives the folder tree an opaque background, so Chromium scrolls it off the main thread', () => {
    // The sidebar's own colour, opaque in every theme.
    expect(getComputedStyle(get('.sidebar > .tree')).backgroundColor).toBe('var(--bg)')
  })
})
