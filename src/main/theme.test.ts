import { describe, expect, it } from 'vitest'
import { nativeThemeSource, windowBackground } from './theme'

describe('nativeThemeSource', () => {
  it('passes the built-in themes through, follows the system for Modus, and runs the other custom themes in dark mode', () => {
    expect(nativeThemeSource('system')).toBe('system')
    expect(nativeThemeSource('light')).toBe('light')
    expect(nativeThemeSource('dark')).toBe('dark')
    expect(nativeThemeSource('gruvbox-material-dark-hard')).toBe('dark')
    expect(nativeThemeSource('tokyo-night-moon')).toBe('dark')
    expect(nativeThemeSource('modus')).toBe('system')
    expect(nativeThemeSource('modus-tinted')).toBe('system')
  })
})

describe('windowBackground', () => {
  it('matches the page background of each theme', () => {
    expect(windowBackground('light', false)).toBe('#ffffff')
    expect(windowBackground('dark', true)).toBe('#0d1117')
    expect(windowBackground('system', true)).toBe('#0d1117')
    expect(windowBackground('system', false)).toBe('#ffffff')
    expect(windowBackground('gruvbox-material-dark-hard', true)).toBe('#1d2021')
    expect(windowBackground('tokyo-night-moon', false)).toBe('#222436')
  })

  it('uses the light or dark Modus background as the system is light or dark', () => {
    expect(windowBackground('modus', false)).toBe('#ffffff')
    expect(windowBackground('modus', true)).toBe('#000000')
    expect(windowBackground('modus-tinted', false)).toBe('#fbf7f0')
    expect(windowBackground('modus-tinted', true)).toBe('#0d0e1c')
  })
})
