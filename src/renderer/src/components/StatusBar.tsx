import { useId } from 'react'
import type { ThemeSetting } from '../../../shared/api'
import { formatTokenCount, TOKEN_ESTIMATE_ERROR } from '../tokenEstimate'

export interface StatusBarProps {
  path: string | null
  dirty: boolean
  wordCount: number
  /** Estimated Claude Opus 5.5 tokens of the editor text. */
  tokenCount: number
  message: string | null
  theme: ThemeSetting
  onCycleTheme: () => void
}

const THEME_LABELS: Record<ThemeSetting, string> = {
  system: 'System theme',
  light: 'Light theme',
  dark: 'Dark theme',
  'gruvbox-material-dark-hard': 'Gruvbox theme',
  'tokyo-night-moon': 'Tokyo Night theme',
}

const percent = (fraction: number): string => `±${Math.round(fraction * 100)}%`

export function StatusBar({ path, dirty, wordCount, tokenCount, message, theme, onCycleTheme }: StatusBarProps) {
  const tooltipId = useId()
  // An empty text has no tokens for sure; anything else is an estimate.
  const approx = tokenCount === 0 ? '' : '≈'
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
      <span className="status-tokens" tabIndex={0} aria-describedby={tooltipId}>
        <span>{(approx && approx + ' ') + formatTokenCount(tokenCount)} tokens</span>
        <span className="status-tooltip" role="tooltip" id={tooltipId}>
          <strong>{approx + tokenCount.toLocaleString('en-US')} tokens for Claude Opus 5.5</strong>
          <span>
            Estimated offline from the words, numbers and punctuation in the editor, unsaved edits included, with
            weights fitted to real Opus 5.5 token counts. Usually within {percent(TOKEN_ESTIMATE_ERROR.typical)}, up to
            about {percent(TOKEN_ESTIMATE_ERROR.worst)} for English Markdown and code; less certain for other languages.
          </span>
          <span>Anthropic has not published the tokenizer, so only its API counts exactly.</span>
        </span>
      </span>
      <button type="button" className="status-theme" title="Switch theme (System → Light → Dark → Gruvbox → Tokyo Night)" onClick={onCycleTheme}>
        {THEME_LABELS[theme]}
      </button>
    </footer>
  )
}
