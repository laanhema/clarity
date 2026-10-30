import { describe, expect, it } from 'vitest'
import { restoreBounds } from './windowBounds'

const laptop = { x: 0, y: 0, width: 1920, height: 1080 }
const external = { x: 1920, y: 0, width: 2560, height: 1440 }

describe('restoreBounds', () => {
  it('uses the defaults the first time', () => {
    expect(restoreBounds(null, [laptop])).toEqual({ bounds: {}, maximized: false })
  })

  it('restores a window that is still on a display', () => {
    const saved = { x: 2200, y: 100, width: 1200, height: 900, maximized: true }
    expect(restoreBounds(saved, [laptop, external])).toEqual({
      bounds: { x: 2200, y: 100, width: 1200, height: 900 },
      maximized: true,
    })
  })

  it('keeps only the size when its display is gone', () => {
    const saved = { x: 2200, y: 100, width: 2400, height: 1300, maximized: false }
    expect(restoreBounds(saved, [laptop])).toEqual({ bounds: { width: 1920, height: 1080 }, maximized: false })
  })

  it('does not restore a window that would barely peek onto the screen', () => {
    const saved = { x: 1850, y: 1040, width: 800, height: 600, maximized: false }
    expect(restoreBounds(saved, [laptop]).bounds).toEqual({ width: 800, height: 600 })
  })
})
