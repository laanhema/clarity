import type { ThemeSetting } from '../shared/api'

/** The light or dark mode a theme asks of native widgets and of `prefers-color-scheme`. */
export function nativeThemeSource(theme: ThemeSetting): 'system' | 'light' | 'dark' {
  return theme === 'gruvbox-material-dark-hard' ? 'dark' : theme
}

/**
 * The colour a window paints before the page has loaded. It matches the
 * theme's page background, so opening a window does not flash.
 */
export function windowBackground(theme: ThemeSetting, darkColors: boolean): string {
  if (theme === 'gruvbox-material-dark-hard') return '#1d2021'
  return darkColors ? '#1e1f22' : '#ffffff'
}
