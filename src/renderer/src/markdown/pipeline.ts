import type { Element, ElementContent, Root, RootContent } from 'hast'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import { frontmatterTree } from './frontmatter'
import { grammarFor, loadHighlighter, type CodeHighlighter } from './highlighter'

/**
 * GitHub's sanitization rules (rehype-sanitize's default schema): no scripts,
 * styles, iframes, forms or event handlers; links only to http, https, mailto
 * and relative URLs; images only from http, https and relative URLs; ids
 * prefixed with `user-content-` so a document cannot clobber the app's own.
 * `<style>` content is dropped too, rather than shown as text.
 */
const schema = { ...defaultSchema, strip: [...(defaultSchema.strip ?? []), 'style'] }

/** The prefix the sanitizer puts on every id; in-page links (`#x`) point at `user-content-x`. */
export const ID_PREFIX = 'user-content-'

/** The class of the block that shows the document's YAML frontmatter. */
export const FRONTMATTER_CLASS = 'frontmatter'

const processor = unified()
  .use(remarkParse)
  // YAML frontmatter, recognised only at the very start of the document, as on GitHub.
  .use(remarkFrontmatter, ['yaml'])
  .use(remarkGfm)
  // `$inline$` and `$$display$$` math become `<code class="language-math">`, as a ```math fence does.
  .use(remarkMath)
  // Raw HTML in the Markdown is parsed into the tree here and cleaned by the next two steps.
  // Footnote ids get their prefix from the sanitizer, like every other id.
  .use(remarkRehype, {
    allowDangerousHtml: true,
    clobberPrefix: '',
    handlers: { yaml: (_state, node: { value: string }) => frontmatterTree(node.value) ?? undefined },
  })
  .use(rehypeRaw)
  .use(rehypeSanitize, schema)

/**
 * Turns Markdown into a sanitized HTML tree (hast). Untrusted input stops
 * here: everything later only adds markup that mdpad generates itself.
 */
export function markdownToSafeTree(markdown: string): Root {
  const mdast = processor.parse(markdown)
  const first = mdast.children[0]
  const hasFrontmatter = first?.type === 'yaml' && first.value.trim() !== ''
  const tree = processor.runSync(mdast)
  if (hasFrontmatter) markFrontmatter(tree)
  return tree
}

/**
 * The sanitizer drops classes it does not know, so the frontmatter block
 * (always the first element) gets its class only after sanitizing.
 */
function markFrontmatter(tree: Root): void {
  const block = tree.children.find((node) => node.type === 'element')
  if (block) block.properties = { className: [FRONTMATTER_CLASS] }
}

function textOf(node: ElementContent): string {
  if (node.type === 'text') return node.value
  if (node.type === 'element') return node.children.map(textOf).join('')
  return ''
}

interface CodeBlock {
  pre: Element
  /** The fence's language as written, lowercased; empty when it has none. */
  info: string
  code: string
}

/** Finds `<pre><code>` blocks, with the language of their `language-x` class. */
function findPreCode(tree: Root): CodeBlock[] {
  const blocks: CodeBlock[] = []
  const visit = (nodes: (RootContent | ElementContent)[]) => {
    for (const node of nodes) {
      if (node.type !== 'element') continue
      const code = node.tagName === 'pre' && node.children.length === 1 ? node.children[0] : undefined
      if (code?.type === 'element' && code.tagName === 'code') {
        const classes = Array.isArray(code.properties['className']) ? code.properties['className'] : []
        const languageClass = classes.find((name) => typeof name === 'string' && name.startsWith('language-'))
        const info = typeof languageClass === 'string' ? languageClass.slice('language-'.length).toLowerCase() : ''
        blocks.push({ pre: node, info, code: textOf(code).replace(/\n$/, '') })
        continue
      }
      visit(node.children)
    }
  }
  visit(tree.children)
  return blocks
}

/** The code blocks whose language has a grammar, with the grammar name. */
function findCodeBlocks(tree: Root): (CodeBlock & { language: string })[] {
  return findPreCode(tree).flatMap((block) => {
    const language = block.info ? grammarFor(block.info) : null
    return language ? [{ ...block, language }] : []
  })
}

/** The grammar names that `tree` needs for its code blocks. */
export function codeLanguages(tree: Root): Set<string> {
  return new Set(findCodeBlocks(tree).map((block) => block.language))
}

/**
 * Replaces code blocks with highlighted ones, in place. Runs on an already
 * sanitized tree. The highlighter builds new elements from the code's text
 * only; the `class` and `style` attributes it adds carry nothing from the
 * document.
 */
export function highlightCodeBlocks(tree: Root, highlighter: CodeHighlighter): Root {
  for (const block of findCodeBlocks(tree)) {
    const highlighted = highlighter.highlight(block.code, block.language)
    if (!highlighted) continue
    block.pre.properties = highlighted.properties
    block.pre.children = highlighted.children
  }
  return tree
}

/** The class of the placeholder that the preview renders a Mermaid diagram into. */
export const MERMAID_CLASS = 'mermaid-diagram'

/**
 * Replaces ```mermaid blocks with an empty `<div class="mermaid-diagram">`
 * that carries the diagram's source as text in `data-mermaid`, in place.
 * Runs on an already sanitized tree, which cannot contain that class, so the
 * preview only ever renders diagrams this step made.
 */
export function prepareMermaidBlocks(tree: Root): Root {
  for (const block of findPreCode(tree)) {
    if (block.info !== 'mermaid') continue
    block.pre.tagName = 'div'
    block.pre.properties = { className: [MERMAID_CLASS], dataMermaid: block.code }
    block.pre.children = []
  }
  return tree
}

/** Whether `tree` has math for KaTeX: `<code class="language-math">`, inline or in a `<pre>`. */
export function hasMath(tree: Root): boolean {
  const visit = (nodes: (RootContent | ElementContent)[]): boolean =>
    nodes.some((node) => {
      if (node.type !== 'element') return false
      const classes = node.properties['className']
      if (node.tagName === 'code' && Array.isArray(classes) && classes.includes('language-math')) return true
      return visit(node.children)
    })
  return visit(tree.children)
}

/** Block elements that carry the source lines they came from. */
const SOURCE_LINE_TAGS = new Set([
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'blockquote', 'ul', 'ol', 'li', 'table', 'tr', 'hr',
  'div', 'details', 'summary', 'dl', 'dt', 'dd', 'figure', 'img',
])

/**
 * Marks block elements with the source lines they were rendered from
 * (`data-source-line` and `data-source-line-end`, 1-based and inclusive), so
 * the preview can scroll in step with the editor. Runs on an already
 * sanitized tree, from the parser's own positions: the sanitizer drops any
 * `data-` attributes the document itself wrote. KaTeX's markup is skipped:
 * its positions are in KaTeX's own HTML, not in the document.
 */
export function annotateSourceLines(tree: Root): Root {
  const visit = (nodes: (RootContent | ElementContent)[]) => {
    for (const node of nodes) {
      if (node.type !== 'element') continue
      const classes = node.properties['className']
      if (Array.isArray(classes) && classes.some((name) => name === 'katex' || name === 'katex-display')) continue
      const position = node.position
      if (position && SOURCE_LINE_TAGS.has(node.tagName)) {
        node.properties['dataSourceLine'] = position.start.line
        node.properties['dataSourceLineEnd'] = position.end.line
      }
      visit(node.children)
    }
  }
  visit(tree.children)
  return tree
}

/**
 * The full preview pipeline: sanitize, mark Mermaid diagrams, typeset math,
 * colour code blocks and mark source lines. KaTeX and the grammars load the
 * first time a document needs them.
 */
export async function renderMarkdown(markdown: string): Promise<Root> {
  const tree = prepareMermaidBlocks(markdownToSafeTree(markdown))
  if (hasMath(tree)) (await import('./math')).typesetMath(tree)
  const languages = codeLanguages(tree)
  if (languages.size > 0) highlightCodeBlocks(tree, await loadHighlighter(languages))
  return annotateSourceLines(tree)
}
