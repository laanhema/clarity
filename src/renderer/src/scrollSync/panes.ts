import type { EditorView } from '@codemirror/view'
import { buildAnchors, type Anchor, type BlockPosition } from './lineMap'

export type PaneChange = 'layout' | 'input'

/** A pane that shows the document and scrolls in step with the other one. */
export interface SyncPane {
  /** The element that scrolls, or null while the pane is not mounted. */
  scroller(): HTMLElement | null
  /** The source line (fractional, 0-based) at `offset` pixels into the scroller's content. */
  lineAt(offset: number): number
  /** Where `line` is in the scroller's content; as a `scrollTop`, it puts `line` at the top. */
  offsetOf(line: number): number
  /**
   * Calls `listener` with 'layout' when what the pane shows moves without
   * the user scrolling it (re-rendered, resized, line heights measured), and
   * with 'input' when the user acted on the pane in a way the DOM has no
   * input event for, such as a search that moved the editor's selection.
   */
  subscribe(listener: (change: PaneChange) => void): () => void
}

/** Where the editor's document starts within its scroller's content. */
function documentOffset(view: EditorView): number {
  return view.documentTop - view.scrollDOM.getBoundingClientRect().top + view.scrollDOM.scrollTop
}

/** The source line at `offset` pixels into the editor's scroller content. */
export function editorLineAt(view: EditorView, offset: number): number {
  const height = offset - documentOffset(view)
  if (height <= 0) return 0
  const block = view.lineBlockAtHeight(height)
  const line = view.state.doc.lineAt(block.from).number - 1
  return line + (block.height > 0 ? Math.min(1, (height - block.top) / block.height) : 0)
}

/** Where `line` is in the editor's scroller content. */
export function editorOffsetOf(view: EditorView, line: number): number {
  const doc = view.state.doc
  if (line >= doc.lines) return view.scrollDOM.scrollHeight
  const index = Math.max(0, Math.floor(line))
  const block = view.lineBlockAt(doc.line(index + 1).from)
  return documentOffset(view) + block.top + (Math.max(0, line) - index) * block.height
}

/**
 * Measures the preview's blocks marked with `data-source-line` and turns
 * them into anchors, with offsets in the scroller's content.
 */
export function measurePreviewAnchors(scroller: HTMLElement, lineCount: number): Anchor[] {
  const origin = scroller.getBoundingClientRect().top + scroller.clientTop - scroller.scrollTop
  const blocks: BlockPosition[] = []
  for (const element of scroller.querySelectorAll<HTMLElement>('[data-source-line]')) {
    // Not rendered, such as the inside of a closed <details>.
    if (element.getClientRects().length === 0) continue
    const rect = element.getBoundingClientRect()
    blocks.push({
      startLine: Number(element.dataset['sourceLine']),
      endLine: Number(element.dataset['sourceLineEnd']),
      top: rect.top - origin,
      bottom: rect.bottom - origin,
    })
  }
  return buildAnchors(blocks, lineCount, scroller.scrollHeight)
}

/** The number of lines in `text`, counted the way the editor counts them. */
export function lineCountOf(text: string): number {
  let count = 1
  for (let index = text.indexOf('\n'); index !== -1; index = text.indexOf('\n', index + 1)) count++
  return count
}
