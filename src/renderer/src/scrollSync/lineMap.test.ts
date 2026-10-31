import { describe, expect, it } from 'vitest'
import { buildAnchors, followerScrollTop, lineToOffset, offsetToLine, type BlockPosition } from './lineMap'

const block = (startLine: number, endLine: number, top: number, bottom: number): BlockPosition => ({
  startLine,
  endLine,
  top,
  bottom,
})

describe('buildAnchors', () => {
  it('adds both edges of every block and both ends of the document', () => {
    expect(buildAnchors([block(1, 1, 20, 50), block(3, 4, 70, 120)], 6, 300)).toEqual([
      { line: 0, offset: 0 },
      { line: 0, offset: 20 },
      { line: 1, offset: 50 },
      { line: 2, offset: 70 },
      { line: 4, offset: 120 },
      { line: 6, offset: 300 },
    ])
  })

  it('drops blocks rendered out of source order, such as footnotes', () => {
    const footnote = block(2, 2, 900, 950)
    const anchors = buildAnchors([block(1, 1, 0, 40), footnote, block(4, 4, 60, 100), block(6, 6, 120, 160)], 8, 1000)
    expect(anchors.map((anchor) => anchor.offset)).not.toContain(900)
    expect(anchors.map((anchor) => anchor.offset)).toContain(160)
  })

  it('clamps blocks from a stale render to the current document', () => {
    const anchors = buildAnchors([block(1, 30, 0, 2000)], 10, 500)
    expect(anchors.at(-1)).toEqual({ line: 10, offset: 500 })
    for (const anchor of anchors) {
      expect(anchor.line).toBeLessThanOrEqual(10)
      expect(anchor.offset).toBeLessThanOrEqual(500)
    }
  })

  it('is just the two ends of the document when nothing is mapped', () => {
    expect(buildAnchors([], 10, 500)).toEqual([
      { line: 0, offset: 0 },
      { line: 10, offset: 500 },
    ])
  })
})

describe('lineToOffset and offsetToLine', () => {
  // Lines 1–2: a paragraph; lines 4–23: a code block 400px tall; line 25: a paragraph.
  const anchors = buildAnchors([block(1, 2, 0, 50), block(4, 23, 70, 470), block(25, 25, 490, 510)], 25, 530)

  it('maps a block start to its top', () => {
    expect(lineToOffset(anchors, 0)).toBe(0)
    expect(lineToOffset(anchors, 3)).toBe(70)
    expect(lineToOffset(anchors, 24)).toBe(490)
  })

  it('interpolates within a tall block', () => {
    // Line 14 starts halfway through the code block's lines 4–23.
    expect(lineToOffset(anchors, 13)).toBe(270)
    expect(offsetToLine(anchors, 270)).toBe(13)
  })

  it('interpolates across the gap between blocks', () => {
    expect(lineToOffset(anchors, 2.5)).toBe(60)
    expect(offsetToLine(anchors, 60)).toBe(2.5)
  })

  it('stays lined up after a tall block', () => {
    expect(lineToOffset(anchors, 23)).toBe(470)
    expect(offsetToLine(anchors, 490)).toBe(24)
  })

  it('round-trips', () => {
    for (const line of [0, 0.5, 1.75, 3, 7.2, 20, 23.5, 24.9]) {
      expect(offsetToLine(anchors, lineToOffset(anchors, line))).toBeCloseTo(line)
    }
  })

  it('clamps at both ends of the document', () => {
    expect(lineToOffset(anchors, -5)).toBe(0)
    expect(lineToOffset(anchors, 99)).toBe(530)
    expect(offsetToLine(anchors, -5)).toBe(0)
    expect(offsetToLine(anchors, 9999)).toBe(25)
  })

  it('falls back to proportional scrolling without blocks', () => {
    const plain = buildAnchors([], 100, 2000)
    expect(lineToOffset(plain, 25)).toBe(500)
    expect(offsetToLine(plain, 1500)).toBe(75)
  })

  it('maps a tall image on one line across its height', () => {
    const image = buildAnchors([block(1, 1, 0, 20), block(3, 3, 40, 640), block(5, 5, 660, 680)], 5, 700)
    expect(lineToOffset(image, 2.5)).toBe(340)
    expect(lineToOffset(image, 4)).toBe(660)
  })

  it('handles an empty anchor list', () => {
    expect(lineToOffset([], 3)).toBe(0)
    expect(offsetToLine([], 3)).toBe(0)
  })
})

describe('followerScrollTop', () => {
  const pane = (scrollTop: number, scrollHeight: number, clientHeight = 500) => ({ scrollTop, scrollHeight, clientHeight })
  // The follower's content is 1.6 times as tall as the leader's, evenly.
  const stretch = (offset: number) => offset * 1.6

  it('lines up the top of both panes in the middle of the document', () => {
    expect(followerScrollTop(pane(1000, 5000), pane(0, 8000), stretch)).toBe(1600)
  })

  it('brings the follower to its end when the leader reaches its end', () => {
    expect(followerScrollTop(pane(4500, 5000), pane(0, 8000), (offset) => offset + 100)).toBe(7500)
  })

  it('brings the follower to its top when the leader reaches its top', () => {
    expect(followerScrollTop(pane(0, 5000), pane(300, 8000), (offset) => offset + 40)).toBe(0)
  })

  it('lines up a line lower in the viewport over the leader’s last screenful', () => {
    // 250px of the last 500px left: the line halfway down the leader's viewport
    // (offset 4500, mapped to 7200) goes halfway down the follower's.
    expect(followerScrollTop(pane(4250, 5000), pane(0, 8000), stretch)).toBe(6950)
  })

  it('reaches the end smoothly, without a jump', () => {
    let previous = followerScrollTop(pane(3900, 5000), pane(0, 8000), stretch)
    for (let top = 3910; top <= 4500; top += 10) {
      const next = followerScrollTop(pane(top, 5000), pane(0, 8000), stretch)
      expect(next).toBeGreaterThanOrEqual(previous)
      expect(next - previous).toBeLessThan(40)
      previous = next
    }
    expect(previous).toBe(7500)
  })

  it('never scrolls the follower past its ends', () => {
    expect(followerScrollTop(pane(1000, 5000), pane(0, 2000), () => 9000)).toBe(1500)
    expect(followerScrollTop(pane(1000, 5000), pane(0, 2000), () => -50)).toBe(0)
    expect(followerScrollTop(pane(1000, 5000), pane(0, 300), stretch)).toBe(0)
  })

  it('follows the mapping when the leader cannot scroll', () => {
    expect(followerScrollTop(pane(0, 400), pane(0, 2000), () => 0)).toBe(0)
  })
})
