import { toJsxRuntime, type Components } from 'hast-util-to-jsx-runtime'
import { createContext, use, useEffect, useMemo, useRef, useState, type ComponentProps, type MouseEvent } from 'react'
import { Fragment, jsx, jsxs } from 'react/jsx-runtime'
import { routeLink } from '../links'
import { ID_PREFIX } from '../markdown/pipeline'
import { useRenderedMarkdown } from '../markdown/useRenderedMarkdown'

export interface PreviewProps {
  markdown: string
  documentKey: number
  documentPath: string | null
  folderPath: string | null
  hidden?: boolean
  onOpenDocument: (path: string) => void
}

const REMOTE_IMAGE = /^(?:https?:)?\/\//i

/** The path of the document being previewed; relative image paths resolve against it. */
const DocumentPathContext = createContext<string | null>(null)

/**
 * Images: relative ones load through the main process, which only serves
 * files inside the open folder. Remote images are not loaded at all (the
 * CSP would block them anyway); their alt text shows instead.
 */
function PreviewImage({ src, alt, ...rest }: ComponentProps<'img'>) {
  const documentPath = use(DocumentPathContext)
  const [loaded, setLoaded] = useState<{ request: string; url: string | null } | null>(null)
  const source = typeof src === 'string' ? src : ''
  const isRemote = REMOTE_IMAGE.test(source)
  const request = documentPath && source && !isRemote ? `${documentPath}\n${source}` : null

  useEffect(() => {
    if (!request || !documentPath) return
    let cancelled = false
    window.mdpad.loadImage(documentPath, source).then(
      (url) => {
        if (!cancelled) setLoaded({ request, url })
      },
      () => {
        if (!cancelled) setLoaded({ request, url: null })
      },
    )
    return () => {
      cancelled = true
    }
  }, [request, documentPath, source])

  const label = alt || source || 'image'
  if (isRemote) {
    return (
      <span className="preview-image-placeholder" title={`Remote images are not loaded: ${source}`}>
        {label}
      </span>
    )
  }
  if (!request || (loaded?.request === request && loaded.url === null)) {
    return (
      <span className="preview-image-placeholder" title={`Image not found in the open folder: ${source}`}>
        {label}
      </span>
    )
  }
  if (loaded?.request !== request || !loaded.url) return <span className="preview-image-loading">{label}</span>
  return <img {...rest} src={loaded.url} alt={alt} />
}

const components: Partial<Components> = { img: PreviewImage }

/** The rendered, sanitized Markdown preview. */
export function Preview({ markdown, documentKey, documentPath, folderPath, hidden = false, onOpenDocument }: PreviewProps) {
  const tree = useRenderedMarkdown(markdown, documentKey, !hidden)
  const rootRef = useRef<HTMLElement>(null)

  const content = useMemo(() => (tree ? toJsxRuntime(tree, { Fragment, jsx, jsxs, components }) : null), [tree])

  function handleClick(event: MouseEvent<HTMLElement>) {
    const anchor = event.target instanceof Element ? event.target.closest('a') : null
    if (!anchor || !rootRef.current?.contains(anchor)) return
    // Links never navigate the app window; each kind is handled here or dropped.
    event.preventDefault()
    const target = routeLink(anchor.getAttribute('href'), documentPath, folderPath)
    switch (target.kind) {
      case 'external':
        return window.mdpad.openExternal(target.url)
      case 'document':
        return onOpenDocument(target.path)
      case 'anchor': {
        const element =
          document.getElementById(ID_PREFIX + target.id) ?? document.getElementById(target.id)
        if (element && rootRef.current.contains(element)) element.scrollIntoView({ block: 'start' })
        return
      }
      case 'ignore':
        return
    }
  }

  return (
    <section
      className="pane preview-pane"
      aria-label="Preview"
      hidden={hidden}
      ref={rootRef}
      onClick={handleClick}
      onAuxClick={(event) => {
        if (event.target instanceof Element && event.target.closest('a')) event.preventDefault()
      }}
    >
      <DocumentPathContext value={documentPath}>
        <article className="markdown-body">{content}</article>
      </DocumentPathContext>
    </section>
  )
}
