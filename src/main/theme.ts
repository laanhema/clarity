import type { ThemeSetting } from '../shared/api'

/** The page background of each theme that always runs in dark mode. */
const DARK_THEME_BACKGROUNDS: Partial<Record<ThemeSetting, string>> = {
  'gruvbox-material-dark-hard': '#1d2021',
  'tokyo-night-moon': '#222436',
}

/**
 * The page background, in light and in dark mode, of each custom theme that
 * follows the system: bg-main of Modus Operandi and Vivendi, plain and tinted.
 */
const SYSTEM_THEME_BACKGROUNDS: Partial<Record<ThemeSetting, { light: string; dark: string }>> = {
  modus: { light: '#ffffff', dark: '#000000' },
  'modus-tinted': { light: '#fbf7f0', dark: '#0d0e1c' },
}

/** The light or dark mode a theme asks of native widgets and of `prefers-color-scheme`. */
export function nativeThemeSource(theme: ThemeSetting): 'system' | 'light' | 'dark' {
  if (theme === 'system' || theme === 'light' || theme === 'dark') return theme
  return SYSTEM_THEME_BACKGROUNDS[theme] ? 'system' : 'dark'
}

/**
 * The colour a window paints before the page has loaded. It matches the
 * theme's page background, so opening a window does not flash.
 */
export function windowBackground(theme: ThemeSetting, darkColors: boolean): string {
  const followsSystem = SYSTEM_THEME_BACKGROUNDS[theme]
  if (followsSystem) return darkColors ? followsSystem.dark : followsSystem.light
  return DARK_THEME_BACKGROUNDS[theme] ?? (darkColors ? '#0d1117' : '#ffffff')
}
