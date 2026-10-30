import type { ThemeSetting } from '../../../shared/api'

export interface StatusBarProps {
  path: string | null
  dirty: boolean
  wordCount: number
  message: string | null
  theme: ThemeSetting
  onCycleTheme: () => void
}

const THEME_LABELS: Record<ThemeSetting, string> = { system: 'System theme', light: 'Light theme', dark: 'Dark theme' }

export function StatusBar({ path, dirty, wordCount, message, theme, onCycleTheme }: StatusBarProps) {
  return (
    <footer className="status-bar">
      <span className="status-path" title={path ?? undefined}>
        {path ?? 'Untitled'}
      </span>
      {message && (
        <span className="status-message" role="alert">
          {message}
        </span>
      )}
      <span className="status-state" aria-live="polite">
        {dirty ? (
          <>
            <span className="unsaved-dot" aria-hidden="true">
              ●
            </span>{' '}
            Unsaved
          </>
        ) : (
          'Saved'
        )}
      </span>
      <span className="status-words">
        {wordCount} {wordCount === 1 ? 'word' : 'words'}
      </span>
      <button type="button" className="status-theme" title="Switch theme (System → Light → Dark)" onClick={onCycleTheme}>
        {THEME_LABELS[theme]}
      </button>
    </footer>
  )
}
