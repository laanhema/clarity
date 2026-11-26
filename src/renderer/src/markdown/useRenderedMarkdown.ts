import type { Root } from 'hast'
import { useEffect, useState } from 'react'
import { renderMarkdown } from './pipeline'

export const PREVIEW_DELAY_MS = 200

interface Rendered {
  key: number
  markdown: string
  tree: Root
}

/**
 * Renders `markdown` to a sanitized, highlighted tree, waiting until typing
 * has paused for `PREVIEW_DELAY_MS`. A new `documentKey` (another file was
 * opened) renders right away, and until it has, the result is null rather
 * than the previous document's tree. While `active` is false nothing is rendered.
 */
export function useRenderedMarkdown(markdown: string, documentKey: number, active: boolean): Root | null {
  const [rendered, setRendered] = useState<Rendered | null>(null)
  const isNewDocument = rendered?.key !== documentKey
  const upToDate = !isNewDocument && rendered.markdown === markdown

  useEffect(() => {
    if (!active || upToDate) return
    let cancelled = false
    const timer = setTimeout(
      () => {
        renderMarkdown(markdown).then(
          (tree) => {
            if (!cancelled) setRendered({ key: documentKey, markdown, tree })
          },
          (error: unknown) => console.error('Preview failed to render:', error),
        )
      },
      isNewDocument ? 0 : PREVIEW_DELAY_MS,
    )
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [markdown, documentKey, active, isNewDocument, upToDate])

  // Never another document's tree: scroll sync would line it up with the new
  // document in the editor, and the preview would jump when the new one came.
  return isNewDocument ? null : rendered.tree
}
