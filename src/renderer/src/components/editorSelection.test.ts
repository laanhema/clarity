import { describe, expect, it } from 'vitest'
import { snapToRowEdge } from './editorSelection'

describe('snapToRowEdge', () => {
  // A line wrapped onto three rows of 22 px, starting at 100.
  const line = { top: 100, height: 66 }

  it('moves the top of a row of text up to the top of its line box', () => {
    expect(snapToRowEdge(103, line, 22)).toBe(100)
    expect(snapToRowEdge(125, line, 22)).toBe(122)
  })

  it('moves the bottom of a row of text down to the bottom of its line box', () => {
    expect(snapToRowEdge(119, line, 22)).toBe(122)
    expect(snapToRowEdge(163, line, 22)).toBe(166)
  })

  it('stays inside the line', () => {
    expect(snapToRowEdge(90, line, 22)).toBe(100)
    expect(snapToRowEdge(180, line, 22)).toBe(166)
  })

  it('treats a line shorter than one default row as a single row', () => {
    expect(snapToRowEdge(104, { top: 100, height: 12 }, 22)).toBe(100)
    expect(snapToRowEdge(109, { top: 100, height: 12 }, 22)).toBe(112)
  })
})
