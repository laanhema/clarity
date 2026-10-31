import { useEffect, useRef, type RefObject } from 'react'
import type { ViewMode } from '../../../shared/api'
import { followerScrollTop } from './lineMap'
import type { SyncPane } from './panes'

type Side = 'editor' | 'preview'

const OTHER: Record<Side, Side> = { editor: 'preview', preview: 'editor' }

/**
 * Whether a leading pane is put back on its top source line when its layout
 * changes under it. The preview loses its place when it re-renders; the
 * editor keeps its own and scrolls to the cursor, which must not be undone.
 */
const KEEPS_LINE_ON_LAYOUT: Record<Side, boolean> = { editor: false, preview: true }

/** Events by which the user starts scrolling a pane: wheel, scrollbar or touch drag, keys. */
const INPUT_EVENTS = ['wheel', 'pointerdown', 'keydown', 'touchstart'] as const

interface PaneOwner {
  readonly scrollSync: SyncPane
}

/**
 * In split view, keeps the editor and the preview scrolled to the same part
 * of the document. The pane the user last scrolled or typed in leads and the
 * other follows; scrolling the follower by code never makes it lead, so the
 * panes cannot push each other back and forth.
 */
export function useScrollSync(
  editor: RefObject<PaneOwner | null>,
  preview: RefObject<PaneOwner | null>,
  viewMode: ViewMode,
  documentKey: number,
): void {
  const leader = useRef<Side>('editor')
  const previousMode = useRef(viewMode)

  // A newly opened document starts at the top of the editor, and the preview follows.
  useEffect(() => {
    leader.current = 'editor'
  }, [documentKey])

  useEffect(() => {
    // Coming back from a single pane, the pane that was on screen leads.
    if (previousMode.current !== viewMode) {
      if (previousMode.current !== 'split') leader.current = previousMode.current
      previousMode.current = viewMode
    }
    if (viewMode !== 'split') return
    const editorPane = editor.current?.scrollSync
    const previewPane = preview.current?.scrollSync
    if (!editorPane || !previewPane) return
    const panes: Record<Side, SyncPane> = { editor: editorPane, preview: previewPane }

    let frame = 0
    // The leader's top line as of the last sync: the place to keep when its layout changes.
    let leaderLine: { side: Side; line: number } | null = null
    const sync = () => {
      frame = 0
      const side = leader.current
      const from = panes[side].scroller()
      const follower = panes[OTHER[side]]
      const to = follower.scroller()
      if (!from || !to || from.clientHeight === 0 || to.clientHeight === 0) return
      leaderLine = { side, line: panes[side].lineAt(from.scrollTop) }
      const top = followerScrollTop(from, to, (offset) => follower.offsetOf(panes[side].lineAt(offset)))
      if (Math.abs(to.scrollTop - top) >= 1) to.scrollTop = top
    }
    /** Puts the leader back on its last top line, before the browser reports its own scroll. */
    const keepLeaderLine = (side: Side) => {
      const scroller = panes[side].scroller()
      if (leaderLine?.side !== side || leader.current !== side || !scroller || scroller.clientHeight === 0) return
      const top = panes[side].offsetOf(leaderLine.line)
      if (Math.abs(scroller.scrollTop - top) >= 1) scroller.scrollTop = top
    }
    const schedule = () => {
      if (frame === 0) frame = requestAnimationFrame(sync)
    }

    const cleanups: (() => void)[] = []
    for (const side of ['editor', 'preview'] as const) {
      const pane = panes[side]
      const lead = () => {
        leader.current = side
      }
      const onScroll = () => {
        if (leader.current === side) schedule()
      }
      const scroller = pane.scroller()
      if (scroller) {
        scroller.addEventListener('scroll', onScroll, { passive: true })
        for (const type of INPUT_EVENTS) scroller.addEventListener(type, lead, { capture: true, passive: true })
        cleanups.push(() => {
          scroller.removeEventListener('scroll', onScroll)
          for (const type of INPUT_EVENTS) scroller.removeEventListener(type, lead, { capture: true })
        })
      }
      cleanups.push(
        pane.subscribe((change) => {
          if (change === 'input') lead()
          else if (KEEPS_LINE_ON_LAYOUT[side]) keepLeaderLine(side)
          schedule()
        }),
      )
    }
    schedule()
    return () => {
      cancelAnimationFrame(frame)
      for (const cleanup of cleanups) cleanup()
    }
  }, [editor, preview, viewMode])
}
