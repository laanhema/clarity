/**
 * Maps between source lines and vertical offsets in the preview, for keeping
 * the editor and the preview scrolled to the same part of the document.
 *
 * Lines here are fractional and 0-based: 0 is the top of the first source
 * line, 2.5 is halfway through the third, and the line count is the end of
 * the document.
 */

/** A point where a source line and an offset in the preview are known to line up. */
export interface Anchor {
  line: number
  /** Pixels from the top of the preview's scrollable content. */
  offset: number
}

/** A rendered block and the source lines it came from (1-based, inclusive), as measured in the preview. */
export interface BlockPosition {
  startLine: number
  endLine: number
  top: number
  bottom: number
}

/** Pixels from the top or the bottom within which a pane counts as scrolled to that end. */
const EDGE_PX = 1

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * The longest run of `points` (already sorted by line) whose offsets never
 * go down. Blocks rendered out of source order, such as footnotes collected
 * at the end, drop out instead of folding the mapping back on itself.
 */
function longestOrderedRun(points: Anchor[]): Anchor[] {
  // tails[k]: index of the smallest last offset of an ordered run of length k + 1.
  const tails: number[] = []
  const previous = new Array<number>(points.length).fill(-1)
  points.forEach((point, index) => {
    let low = 0
    let high = tails.length
    while (low < high) {
      const middle = (low + high) >> 1
      if (points[tails[middle]!]!.offset <= point.offset) low = middle + 1
      else high = middle
    }
    if (low > 0) previous[index] = tails[low - 1]!
    tails[low] = index
  })
  const run: Anchor[] = []
  for (let index = tails.at(-1) ?? -1; index >= 0; index = previous[index]!) run.push(points[index]!)
  return run.reverse()
}

/**
 * Builds the anchors for a preview: the top and bottom of every block, plus
 * the start and end of the document. Each block contributes both edges, so a
 * tall image, table or code block maps its source lines across its whole
 * height and the blocks after it stay lined up.
 */
export function buildAnchors(blocks: BlockPosition[], lineCount: number, contentHeight: number): Anchor[] {
  const lastLine = Math.max(0, lineCount)
  const height = Math.max(0, contentHeight)
  const points: Anchor[] = [{ line: 0, offset: 0 }]
  for (const block of blocks) {
    if (!Number.isFinite(block.startLine) || !Number.isFinite(block.endLine)) continue
    const start = clamp(block.startLine - 1, 0, lastLine)
    const end = clamp(Math.max(block.endLine, block.startLine), 0, lastLine)
    points.push({ line: start, offset: clamp(block.top, 0, height) })
    points.push({ line: end, offset: clamp(Math.max(block.bottom, block.top), 0, height) })
  }
  points.push({ line: lastLine, offset: height })
  points.sort((a, b) => a.line - b.line || a.offset - b.offset)
  return longestOrderedRun(points)
}

/**
 * Interpolates along `anchors` from `from` values to `to` values. Where
 * several anchors share a `from` value, the last of them wins.
 */
function interpolate(anchors: Anchor[], value: number, from: keyof Anchor, to: keyof Anchor): number {
  const first = anchors[0]
  const last = anchors.at(-1)
  if (!first || !last) return 0
  if (value <= first[from]) return first[to]
  // The first anchor past `value`.
  let low = 0
  let high = anchors.length
  while (low < high) {
    const middle = (low + high) >> 1
    if (anchors[middle]![from] <= value) low = middle + 1
    else high = middle
  }
  if (low >= anchors.length) return last[to]
  const before = anchors[low - 1]!
  const after = anchors[low]!
  const span = after[from] - before[from]
  const ratio = span > 0 ? (value - before[from]) / span : 0
  return before[to] + ratio * (after[to] - before[to])
}

/** The preview offset where `line` is shown. */
export function lineToOffset(anchors: Anchor[], line: number): number {
  return interpolate(anchors, line, 'line', 'offset')
}

/** The source line shown at `offset` in the preview. */
export function offsetToLine(anchors: Anchor[], offset: number): number {
  return interpolate(anchors, offset, 'offset', 'line')
}

export interface ScrollMetrics {
  scrollTop: number
  scrollHeight: number
  clientHeight: number
}

function maxScroll(metrics: ScrollMetrics): number {
  return Math.max(0, metrics.scrollHeight - metrics.clientHeight)
}

/**
 * How far the leader is into its last screenful: 0 above it, 1 at the very
 * end. A short document that scrolls less than a screen is all last screenful.
 */
function endProgress(leader: ScrollMetrics): number {
  const leaderMax = maxScroll(leader)
  const tail = Math.min(leader.clientHeight, leaderMax)
  const remaining = leaderMax - leader.scrollTop
  if (tail <= 0 || remaining >= tail) return 0
  return clamp(1 - remaining / tail, 0, 1)
}

/**
 * Where the following pane should scroll to. `toFollower` maps an offset in
 * the leader's content to the offset of the same source line in the
 * follower's.
 *
 * Mostly the line at the top of the leader goes to the top of the follower.
 * That line cannot reach the end of the document while the last screenful is
 * in view, so over the leader's last screenful the line that is lined up
 * slides from the top of the viewport to the bottom: the panes still show
 * the same line at the same height, and they reach the end together.
 */
export function followerScrollTop(
  leader: ScrollMetrics,
  follower: ScrollMetrics,
  toFollower: (leaderOffset: number) => number,
): number {
  const followerMax = maxScroll(follower)
  const leaderMax = maxScroll(leader)
  if (leaderMax > 0 && leader.scrollTop <= EDGE_PX) return 0
  if (leaderMax > 0 && leaderMax - leader.scrollTop <= EDGE_PX) return followerMax
  const progress = endProgress(leader)
  const focus = leader.scrollTop + progress * leader.clientHeight
  return clamp(toFollower(focus) - progress * follower.clientHeight, 0, followerMax)
}
