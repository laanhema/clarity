import type { Element, ElementContent, Root, RootContent } from 'hast'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
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
  language: string
  code: string
}

/** Finds `<pre><code class="language-x">` blocks whose language has a grammar. */
function findCodeBlocks(tree: Root): CodeBlock[] {
  const blocks: CodeBlock[] = []
  const visit = (nodes: (RootContent | ElementContent)[]) => {
    for (const node of nodes) {
      if (node.type !== 'element') continue
      const code = node.tagName === 'pre' && node.children.length === 1 ? node.children[0] : undefined
      if (code?.type === 'element' && code.tagName === 'code') {
        const classes = Array.isArray(code.properties['className']) ? code.properties['className'] : []
        const languageClass = classes.find((name) => typeof name === 'string' && name.startsWith('language-'))
        const language = typeof languageClass === 'string' ? grammarFor(languageClass.slice('language-'.length)) : null
        if (language) blocks.push({ pre: node, language, code: textOf(code).replace(/\n$/, '') })
        continue
      }
      visit(node.children)
    }
  }
  visit(tree.children)
  return blocks
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

/** The full preview pipeline: sanitize, then colour code blocks once their grammars have loaded. */
export async function renderMarkdown(markdown: string): Promise<Root> {
  const tree = markdownToSafeTree(markdown)
  const languages = codeLanguages(tree)
  if (languages.size === 0) return tree
  return highlightCodeBlocks(tree, await loadHighlighter(languages))
}
