import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SCROLLING_CLASS, trackScrolling } from './scrollbars'

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
