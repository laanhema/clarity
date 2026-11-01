/** The class a scroller carries while it scrolls; styles.css and the editor theme show its scrollbar. */
export const SCROLLING_CLASS = 'scrolling'

/** How long a scrollbar stays visible after the last scroll, in milliseconds. */
export const SCROLLBAR_IDLE_MS = 1000

/**
 * Marks each element that scrolls inside `root` with SCROLLING_CLASS until it
 * has been still for `idleMs`, so its scrollbar can fade in and out. Scroll
 * events do not bubble or leave a shadow root, so this listens in the capture
 * phase, once for the document and once for each shadow root. Returns a
 * function that stops listening and clears the class.
 */
export function trackScrolling(root: Document | ShadowRoot, idleMs = SCROLLBAR_IDLE_MS): () => void {
  const timers = new Map<Element, ReturnType<typeof setTimeout>>()

  const onScroll = (event: Event) => {
    const target = event.target instanceof Document ? event.target.scrollingElement : event.target
    if (!(target instanceof Element)) return
    const pending = timers.get(target)
    if (pending !== undefined) clearTimeout(pending)
    // Scroll events come every frame; touch the DOM only when a burst starts.
    else target.classList.add(SCROLLING_CLASS)
    timers.set(
      target,
      setTimeout(() => {
        timers.delete(target)
        target.classList.remove(SCROLLING_CLASS)
      }, idleMs),
    )
  }

  root.addEventListener('scroll', onScroll, { capture: true, passive: true })
  return () => {
    root.removeEventListener('scroll', onScroll, { capture: true })
    for (const [element, timer] of timers) {
      clearTimeout(timer)
      element.classList.remove(SCROLLING_CLASS)
    }
    timers.clear()
  }
}
