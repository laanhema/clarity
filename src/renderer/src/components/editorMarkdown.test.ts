import { highlightTree, tags, type Tag } from '@lezer/highlight'
import { describe, expect, it } from 'vitest'
import { listMark, markdownHighlight, markdownSupport } from './editorMarkdown'

/** Each highlighted stretch of `doc` with the class names it gets. */
function highlight(doc: string): { text: string; classes: string }[] {
  const tree = markdownSupport.language.parser.parse(doc)
  const spans: { text: string; classes: string }[] = []
  highlightTree(tree, markdownHighlight, (from, to, classes) => spans.push({ text: doc.slice(from, to), classes }))
  return spans
}

function classOf(tag: Tag): string {
  const name = markdownHighlight.style([tag])
  if (!name) throw new Error('tag has no style')
  return name
}

describe('editor Markdown highlighting', () => {
  it('colours list markers, not the whole list item', () => {
    const spans = highlight('- first item\n- second item\n')
    expect(spans.filter((span) => span.classes === classOf(listMark)).map((span) => span.text)).toEqual(['-', '-'])
    expect(spans.some((span) => span.text.includes('item'))).toBe(false)
  })

  it('highlights strikethrough and tables (GitHub-flavoured Markdown)', () => {
    expect(highlight('~~gone~~\n')).toContainEqual({ text: 'gone', classes: classOf(tags.strikethrough) })

    const table = highlight('| a | b |\n| - | - |\n| 1 | 2 |\n')
    expect(table).toContainEqual(expect.objectContaining({ text: '|', classes: classOf(tags.processingInstruction) }))
    expect(table.some((span) => span.classes === classOf(tags.heading))).toBe(true)
  })

  it('gives each heading level its own style', () => {
    const levels = [tags.heading1, tags.heading2, tags.heading3, tags.heading4, tags.heading5, tags.heading6]
    const classes = new Set(levels.map(classOf))
    expect(classes.size).toBe(6)
    for (const [index, level] of levels.entries()) {
      expect(highlight(`${'#'.repeat(index + 1)} Title\n`)).toContainEqual({ text: ' Title', classes: classOf(level) })
    }
  })
})
