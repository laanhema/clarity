import type { Extension } from '@codemirror/state'
import { EditorView, layer, RectangleMarker } from '@codemirror/view'

/** The vertical extent of one line in the document, as CodeMirror's line blocks give it. */
export interface LineBox {
  top: number
  height: number
}

/**
 * Moves a selection edge at document height `y` onto the nearest boundary
 * between the visual rows of `line`. A wrapped line has several rows of equal
 * height, so the row count is the line's height in default line heights.
 */
export function snapToRowEdge(y: number, line: LineBox, rowHeight: number): number {
  const rows = Math.max(1, Math.round(line.height / rowHeight))
  const height = line.height / rows
  const row = Math.min(rows, Math.max(0, Math.round((y - line.top) / height)))
  return line.top + row * height
}

function snapMarker(view: EditorView, marker: RectangleMarker, toDocument: number): RectangleMarker {
  const edge = (y: number): number =>
    snapToRowEdge(y + toDocument, view.lineBlockAtHeight(y + toDocument), view.defaultLineHeight) - toDocument
  const top = edge(marker.top)
  const bottom = edge(marker.top + marker.height)
  return new RectangleMarker('cm-selectionBackground', marker.left, top, marker.width, bottom - top)
}

const LAYER_CLASS = 'cm-rowSelectionLayer'

/**
 * Draws the selection like drawSelection's layer does, but with every row as
 * tall as its line box. CodeMirror sizes a selection's first and last rows to
 * the text glyphs, which leaves a strip of the line uncovered above and below
 * them, so the selection looked shorter than the active line beside it.
 * Needs drawSelection for the cursor and the hidden native selection; its own
 * selection layer is hidden here.
 */
export const rowSelection: Extension = [
  layer({
    above: false,
    class: LAYER_CLASS,
    markers(view) {
      const scroller = view.scrollDOM.getBoundingClientRect()
      // Markers are placed relative to the scroller's content; line blocks relative to the document.
      const toDocument = scroller.top - view.scrollDOM.scrollTop - view.documentTop
      return view.state.selection.ranges
        .filter((range) => !range.empty)
        .flatMap((range) => RectangleMarker.forRange(view, 'cm-selectionBackground', range))
        .map((marker) => snapMarker(view, marker, toDocument))
    },
    update: (update) => update.docChanged || update.selectionSet || update.viewportChanged,
  }),
  EditorView.theme({ '.cm-selectionLayer': { display: 'none' } }),
]
