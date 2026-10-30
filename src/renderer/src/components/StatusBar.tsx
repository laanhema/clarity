export interface StatusBarProps {
  path: string | null
  dirty: boolean
  wordCount: number
  message: string | null
}

export function StatusBar({ path, dirty, wordCount, message }: StatusBarProps) {
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
    </footer>
  )
}
