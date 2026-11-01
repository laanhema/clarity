import { toJsxRuntime, type Components } from 'hast-util-to-jsx-runtime'
import {
  createContext,
  use,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type MouseEvent,
  type Ref,
} from 'react'
import { Fragment, jsx, jsxs } from 'react/jsx-runtime'
import { routeLink } from '../links'
import { ID_PREFIX, MERMAID_CLASS } from '../markdown/pipeline'
import { useRenderedMarkdown } from '../markdown/useRenderedMarkdown'
import { lineToOffset, offsetToLine, type Anchor } from '../scrollSync/lineMap'
import { lineCountOf, measurePreviewAnchors, type SyncPane } from '../scrollSync/panes'
import { MermaidDiagram } from './MermaidDiagram'

export interface PreviewHandle {
  /** Keeps the preview scrolled in step with the editor. */
  readonly scrollSync: SyncPane
}

export interface PreviewProps {
  markdown: string
  documentKey: number
  documentPath: string | null
  folderPath: string | null
  hidden?: boolean
  onOpenDocument: (path: string) => void
  ref?: Ref<PreviewHandle>
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
    window.clarity.loadImage(documentPath, source).then(
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

/** The placeholders the pipeline makes for ```mermaid blocks become diagrams; other divs stay divs. */
function PreviewDiv({
  'data-mermaid': mermaid,
  ...rest
}: ComponentProps<'div'> & { 'data-mermaid'?: string; 'data-source-line'?: number; 'data-source-line-end'?: number }) {
  if (rest.className === MERMAID_CLASS && typeof mermaid === 'string') {
    // The diagram's source lines stay on the page for scroll syncing.
    return (
      <div data-source-line={rest['data-source-line']} data-source-line-end={rest['data-source-line-end']}>
        <MermaidDiagram source={mermaid} />
      </div>
    )
  }
  return <div {...rest} />
}

const components: Partial<Components> = { img: PreviewImage, div: PreviewDiv }

/** The rendered, sanitized Markdown preview. */
export function Preview({
  markdown,
  documentKey,
  documentPath,
  folderPath,
  hidden = false,
  onOpenDocument,
  ref,
}: PreviewProps) {
  const tree = useRenderedMarkdown(markdown, documentKey, !hidden)
  const rootRef = useRef<HTMLElement>(null)
  const articleRef = useRef<HTMLElement>(null)
  const lineCountRef = useRef(1)
  // Measured on demand and dropped whenever the layout or the document changes.
  const anchorsRef = useRef<Anchor[] | null>(null)

  useEffect(() => {
    lineCountRef.current = lineCountOf(markdown)
    anchorsRef.current = null
  }, [markdown])

  useImperativeHandle(ref, () => {
    const anchors = (scroller: HTMLElement) =>
      (anchorsRef.current ??= measurePreviewAnchors(scroller, lineCountRef.current))
    return {
      scrollSync: {
        scroller: () => rootRef.current,
        lineAt: (offset) => (rootRef.current ? offsetToLine(anchors(rootRef.current), offset) : 0),
        offsetOf: (line) => (rootRef.current ? lineToOffset(anchors(rootRef.current), line) : 0),
        subscribe: (listener) => {
          const root = rootRef.current
          const article = articleRef.current
          if (!root || !article) return () => undefined
          const changed = () => {
            anchorsRef.current = null
            listener('layout')
          }
          // Re-renders, images and diagrams that load late, pane and window resizes.
          const resizes = new ResizeObserver(changed)
          resizes.observe(root)
          resizes.observe(article)
          const mutations = new MutationObserver(changed)
          mutations.observe(article, { childList: true, subtree: true, characterData: true, attributes: true })
          return () => {
            resizes.disconnect()
            mutations.disconnect()
          }
        },
      },
    }
  }, [])

  const content = useMemo(() => (tree ? toJsxRuntime(tree, { Fragment, jsx, jsxs, components }) : null), [tree])

  function handleClick(event: MouseEvent<HTMLElement>) {
    const anchor = event.target instanceof Element ? event.target.closest('a') : null
    if (!anchor || !rootRef.current?.contains(anchor)) return
    // Links never navigate the app window; each kind is handled here or dropped.
    event.preventDefault()
    const target = routeLink(anchor.getAttribute('href'), documentPath, folderPath)
    switch (target.kind) {
      case 'external':
        return window.clarity.openExternal(target.url)
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
        <article className="markdown-body" ref={articleRef}>
          {content}
        </article>
      </DocumentPathContext>
    </section>
  )
}
