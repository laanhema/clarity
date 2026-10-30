import { describe, expect, it } from 'vitest'
import { nativeThemeSource, windowBackground } from './theme'

describe('nativeThemeSource', () => {
  it('passes the built-in themes through and runs Gruvbox in dark mode', () => {
    expect(nativeThemeSource('system')).toBe('system')
    expect(nativeThemeSource('light')).toBe('light')
    expect(nativeThemeSource('dark')).toBe('dark')
    expect(nativeThemeSource('gruvbox-material-dark-hard')).toBe('dark')
  })
})

describe('windowBackground', () => {
  it('matches the page background of each theme', () => {
    expect(windowBackground('light', false)).toBe('#ffffff')
    expect(windowBackground('dark', true)).toBe('#1e1f22')
    expect(windowBackground('system', true)).toBe('#1e1f22')
    expect(windowBackground('system', false)).toBe('#ffffff')
    expect(windowBackground('gruvbox-material-dark-hard', true)).toBe('#1d2021')
  })
})
