import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import {
  applyInlineStyles,
  diagramTheme,
  parseThemeSetting,
  renderMermaid,
  type DiagramTheme,
  type MermaidDiagram as Diagram,
} from '../markdown/mermaid'

const DARK_QUERY = '(prefers-color-scheme: dark)'

function systemPrefersDark(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(DARK_QUERY).matches
}

/** Calls `onChange` when the app theme (the root's `data-theme`) or the system colour scheme changes. */
function subscribeToTheme(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  const query = typeof window.matchMedia === 'function' ? window.matchMedia(DARK_QUERY) : null
  query?.addEventListener('change', onChange)
  return () => {
    observer.disconnect()
    query?.removeEventListener('change', onChange)
  }
}

/** The Mermaid theme that matches the app theme, updated when either changes. */
function useDiagramTheme(): DiagramTheme {
  return useSyncExternalStore(
    subscribeToTheme,
    () => diagramTheme(parseThemeSetting(document.documentElement.dataset['theme']), systemPrefersDark()),
    () => 'default',
  )
}

/** Layout for the diagram inside its shadow root; Mermaid's own CSS follows it. */
const BASE_CSS = ':host { display: block; } svg { display: block; height: auto; margin: 0 auto; }'

function messageOf(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message.trim() || 'The diagram could not be rendered.'
}

type Result = { diagram: Diagram; error?: undefined } | { diagram?: undefined; error: string }

/**
 * A Mermaid diagram in the preview. The source shows until the first render
 * finishes; after that an edit keeps the old diagram up until the new one is
 * ready. A diagram that fails shows Mermaid's message in its place.
 *
 * The diagram follows the app theme and renders again when it changes.
 * The SVG lives in a shadow root, so Mermaid's stylesheet (applied as a
 * constructed stylesheet, which the CSP allows) touches only this diagram.
 */
export function MermaidDiagram({ source }: { source: string }) {
  const theme = useDiagramTheme()
  const [result, setResult] = useState<Result | null>(null)
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    renderMermaid(source, theme).then(
      (diagram) => {
        if (!cancelled) setResult({ diagram })
      },
      (error: unknown) => {
        if (!cancelled) setResult({ error: messageOf(error) })
      },
    )
    return () => {
      cancelled = true
    }
  }, [source, theme])

  const diagram = result?.diagram
  useLayoutEffect(() => {
    const host = hostRef.current
    if (!host || !diagram) return
    const shadow = host.shadowRoot ?? host.attachShadow({ mode: 'open' })
    const sheets = [BASE_CSS, diagram.css].map((css) => {
      const sheet = new CSSStyleSheet()
      sheet.replaceSync(css)
      return sheet
    })
    shadow.adoptedStyleSheets = sheets
    shadow.replaceChildren(diagram.svg.cloneNode(true))
    applyInlineStyles(shadow)
  }, [diagram])

  if (!result) {
    return (
      <pre className="mermaid-pending" aria-busy="true">
        <code>{source}</code>
      </pre>
    )
  }
  if (result.error !== undefined) {
    return (
      <div className="mermaid-error">
        <strong>Mermaid diagram error</strong>
        <pre>{result.error}</pre>
      </div>
    )
  }
  return <div className="mermaid-diagram" role="img" aria-label="Mermaid diagram" ref={hostRef} />
}
