import { describe, expect, it } from 'vitest'
import { nativeThemeSource, windowBackground } from './theme'

describe('nativeThemeSource', () => {
  it('passes the built-in themes through and runs the custom themes in dark mode', () => {
    expect(nativeThemeSource('system')).toBe('system')
    expect(nativeThemeSource('light')).toBe('light')
    expect(nativeThemeSource('dark')).toBe('dark')
    expect(nativeThemeSource('gruvbox-material-dark-hard')).toBe('dark')
    expect(nativeThemeSource('tokyo-night-moon')).toBe('dark')
  })
})

describe('windowBackground', () => {
  it('matches the page background of each theme', () => {
    expect(windowBackground('light', false)).toBe('#ffffff')
    expect(windowBackground('dark', true)).toBe('#1e1f22')
    expect(windowBackground('system', true)).toBe('#1e1f22')
    expect(windowBackground('system', false)).toBe('#ffffff')
    expect(windowBackground('gruvbox-material-dark-hard', true)).toBe('#1d2021')
    expect(windowBackground('tokyo-night-moon', false)).toBe('#222436')
  })
})
