import 'katex/dist/katex.min.css'
import type { Element, ElementContent, Root, RootContent } from 'hast'
import { fromHtml } from 'hast-util-from-html'
import katex from 'katex'

/**
 * Typesets math with KaTeX. This module and KaTeX's styles and fonts load
 * the first time a document has math.
 *
 * KaTeX builds its markup from the formula's text. `trust: false` keeps
 * `\href`, `\url`, `\includegraphics` and `\html…` commands from producing
 * links, images or attributes, and `maxExpand` stops macro bombs. A formula
 * KaTeX cannot parse shows as its source in KaTeX's error colour.
 */
const OPTIONS = { trust: false, strict: 'ignore', maxExpand: 1000, throwOnError: false } as const

function textOf(node: ElementContent): string {
  if (node.type === 'text') return node.value
  if (node.type === 'element') return node.children.map(textOf).join('')
  return ''
}

function isMath(node: ElementContent): boolean {
  const classes = node.type === 'element' && node.tagName === 'code' ? node.properties['className'] : undefined
  return Array.isArray(classes) && classes.includes('language-math')
}

/**
 * KaTeX's markup as hast. It is parsed with parse5 rather than the DOM, so
 * the `style` attributes KaTeX sizes things with never meet the CSP; React
 * applies them through the CSSOM later.
 */
function typeset(tex: string, displayMode: boolean): ElementContent[] {
  let markup: string
  try {
    markup = katex.renderToString(tex, { ...OPTIONS, displayMode })
  } catch (error) {
    const title = error instanceof Error ? error.message : String(error)
    const fallback: Element = {
      type: 'element',
      tagName: 'span',
      properties: { className: ['katex-error'], title },
      children: [{ type: 'text', value: tex }],
    }
    return [fallback]
  }
  return fromHtml(markup, { fragment: true }).children.filter((node) => node.type === 'element')
}

function transform(node: Element): ElementContent[] {
  const code = node.tagName === 'pre' && node.children.length === 1 ? node.children[0] : undefined
  if (code && isMath(code)) return typeset(textOf(code).replace(/\n$/, ''), true)
  if (isMath(node)) return typeset(textOf(node), false)
  node.children = node.children.flatMap((child): ElementContent[] => (child.type === 'element' ? transform(child) : [child]))
  return [node]
}

/**
 * Replaces every `<code class="language-math">` with KaTeX markup, in place:
 * inline when it stands alone, display when it fills a `<pre>` (from `$$`
 * blocks and ```math fences). Runs on an already sanitized tree.
 */
export function typesetMath(tree: Root): Root {
  tree.children = tree.children.flatMap((node): RootContent[] => (node.type === 'element' ? transform(node) : [node]))
  return tree
}
