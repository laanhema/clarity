import type { WindowBounds } from './settings'

export interface Rectangle {
  x: number
  y: number
  width: number
  height: number
}

/** How much of a saved window must still be on screen for its position to be reused. */
const MIN_VISIBLE = { width: 120, height: 80 } as const

function overlap(a: Rectangle, b: Rectangle): Rectangle {
  const x = Math.max(a.x, b.x)
  const y = Math.max(a.y, b.y)
  const width = Math.min(a.x + a.width, b.x + b.width) - x
  const height = Math.min(a.y + a.height, b.y + b.height) - y
  return { x, y, width: Math.max(0, width), height: Math.max(0, height) }
}

/**
 * Decides where to put a window whose bounds were saved in an earlier session.
 *
 * A monitor may have been unplugged since then. The saved position is kept
 * only when enough of the window lands on one of the current displays;
 * otherwise only the size is kept (shrunk to fit) and the window is centred.
 */
export function restoreBounds(
  saved: WindowBounds | null,
  workAreas: readonly Rectangle[],
): { bounds: Partial<Rectangle>; maximized: boolean } {
  if (!saved) return { bounds: {}, maximized: false }
  const visible = workAreas.some((area) => {
    const shared = overlap(saved, area)
    return shared.width >= MIN_VISIBLE.width && shared.height >= MIN_VISIBLE.height
  })
  if (visible) {
    const { x, y, width, height } = saved
    return { bounds: { x, y, width, height }, maximized: saved.maximized }
  }
  const primary = workAreas[0]
  const width = primary ? Math.min(saved.width, primary.width) : saved.width
  const height = primary ? Math.min(saved.height, primary.height) : saved.height
  return { bounds: { width, height }, maximized: saved.maximized }
}
