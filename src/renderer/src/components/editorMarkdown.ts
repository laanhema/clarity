import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { yamlFrontmatter } from '@codemirror/lang-yaml'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import type { Extension } from '@codemirror/state'
import { styleTags, Tag, tags } from '@lezer/highlight'

/**
 * List markers (`-`, `*`, `1.`) get a tag of their own, so they can be
 * coloured apart from the other Markdown punctuation and from the item text.
 */
export const listMark = Tag.define()

/**
 * The editor's Markdown language: GitHub-flavoured, so tables, strikethrough
 * and task lists are parsed and highlighted like the preview renders them.
 */
export const markdownSupport = markdown({
  base: markdownLanguage,
  extensions: [{ props: [styleTags({ ListMark: listMark })] }],
})

/**
 * The editor's language: Markdown, with a YAML frontmatter block at the very
 * start of the document (between `---` lines) highlighted as YAML.
 */
export const editorLanguage = yamlFrontmatter({ content: markdownSupport })

/**
 * Markdown colours come from CSS variables, so they follow the theme. A theme
 * may set the optional ones (per-level heading colours, list markers and
 * their weight, URLs, quotes); the others fall back to the shared Markdown colours.
 */
export const markdownHighlight = HighlightStyle.define([
  { tag: tags.heading, color: 'var(--md-heading)', fontWeight: '600' },
  { tag: tags.heading1, color: 'var(--h1, var(--md-heading))', fontWeight: '600' },
  { tag: tags.heading2, color: 'var(--h2, var(--md-heading))', fontWeight: '600' },
  { tag: tags.heading3, color: 'var(--h3, var(--md-heading))', fontWeight: '600' },
  { tag: tags.heading4, color: 'var(--h4, var(--md-heading))', fontWeight: '600' },
  { tag: tags.heading5, color: 'var(--h5, var(--md-heading))', fontWeight: '600' },
  { tag: tags.heading6, color: 'var(--h6, var(--md-heading))', fontWeight: '600' },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: tags.link, color: 'var(--md-link)' },
  {
    tag: tags.url,
    color: 'var(--md-url, var(--md-link))',
    textDecoration: 'var(--md-url-decoration, none)',
  },
  { tag: tags.monospace, color: 'var(--md-code)' },
  { tag: tags.quote, color: 'var(--md-quote, var(--fg-muted))', fontStyle: 'italic' },
  { tag: [tags.processingInstruction, tags.meta, tags.contentSeparator], color: 'var(--md-mark)' },
  { tag: listMark, color: 'var(--md-list, var(--md-mark))', fontWeight: 'var(--md-list-weight, normal)' },
  // YAML frontmatter: keys like headings, quoted strings like code, punctuation like Markdown marks.
  { tag: tags.definition(tags.propertyName), color: 'var(--md-heading)' },
  { tag: [tags.string, tags.special(tags.string)], color: 'var(--md-code)' },
  { tag: tags.lineComment, color: 'var(--fg-muted)', fontStyle: 'italic' },
  { tag: [tags.separator, tags.punctuation, tags.squareBracket, tags.brace], color: 'var(--md-mark)' },
  { tag: [tags.typeName, tags.labelName, tags.keyword], color: 'var(--md-link)' },
])

export const markdownExtensions: Extension[] = [editorLanguage, syntaxHighlighting(markdownHighlight)]
