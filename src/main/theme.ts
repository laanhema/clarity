import type { ThemeSetting } from '../shared/api'

/** The page background of each theme that always runs in dark mode. */
const DARK_THEME_BACKGROUNDS: Partial<Record<ThemeSetting, string>> = {
  'gruvbox-material-dark-hard': '#1d2021',
  'tokyo-night-moon': '#222436',
}

/** The light or dark mode a theme asks of native widgets and of `prefers-color-scheme`. */
export function nativeThemeSource(theme: ThemeSetting): 'system' | 'light' | 'dark' {
  if (theme === 'system' || theme === 'light' || theme === 'dark') return theme
  return 'dark'
}

/**
 * The colour a window paints before the page has loaded. It matches the
 * theme's page background, so opening a window does not flash.
 */
export function windowBackground(theme: ThemeSetting, darkColors: boolean): string {
  return DARK_THEME_BACKGROUNDS[theme] ?? (darkColors ? '#1e1f22' : '#ffffff')
}
