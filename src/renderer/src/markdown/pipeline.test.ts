import type { ElementContent, Root, RootContent } from 'hast'
import { toHtml } from 'hast-util-to-html'
import { describe, expect, it } from 'vitest'
import { grammarFor } from './highlighter'
import {
  annotateSourceLines,
  codeLanguages,
  hasMath,
  highlightCodeBlocks,
  markdownToSafeTree,
  MERMAID_CLASS,
  prepareMermaidBlocks,
  renderMarkdown,
} from './pipeline'

const html = (markdown: string) => toHtml(markdownToSafeTree(markdown))

/** Every element in `tree` as `tag` plus one `tag attribute=value` entry per attribute. */
function elementsOf(tree: Root): string[] {
  const out: string[] = []
  const visit = (nodes: (RootContent | ElementContent)[]) => {
    for (const node of nodes) {
      if (node.type !== 'element') continue
      out.push(node.tagName)
      for (const [name, value] of Object.entries(node.properties)) out.push(`${node.tagName} ${name}=${String(value)}`)
      visit(node.children)
    }
  }
  visit(tree.children)
  return out
}

describe('sanitizing', () => {
  it('drops script tags and their content', () => {
    const out = html('Hello\n\n<script>alert(1)</script>\n\n<p>after<script>alert(2)</script></p>')
    expect(out).not.toContain('<script')
    expect(out).not.toContain('alert')
    expect(out).toContain('after')
  })

  it('drops event handler attributes', () => {
    const out = html('<img src="x.png" onerror="alert(1)" alt="x">\n\n<a href="#" onclick="alert(2)">link</a>')
    expect(out).not.toMatch(/onerror|onclick|alert/)
    expect(out).toContain('<img src="x.png" alt="x">')
  })

  it('drops javascript: and other unsafe URLs', () => {
    const out = html(
      '[a](javascript:alert(1)) [b](JaVaScRiPt:alert(2)) <a href="javascript:alert(3)">c</a> [d](data:text/html,x) [e](vbscript:x)',
    )
    expect(out).not.toMatch(/javascript|vbscript|data:/i)
    expect(out).toContain('>a</a>')
  })

  it('drops iframes, objects, embeds, forms and base tags', () => {
    const out = html(
      '<iframe src="https://example.com"></iframe><object data="x"></object><embed src="x"><form action="/x"><input name="q"></form><base href="https://evil.example/">',
    )
    expect(out).not.toMatch(/<(iframe|object|embed|form|base)/)
    // The only input that survives is a disabled checkbox, as task lists use.
    expect(out).toContain('<input name="user-content-q" disabled type="checkbox">')
  })

  it('drops style elements and style attributes', () => {
    const out = html('<style>body{display:none}</style>\n\n<p style="position:fixed;inset:0">covered</p>')
    expect(out).not.toMatch(/<style|style=|display:none|position/)
    expect(out).toContain('<p>covered</p>')
  })

  it('drops class attributes a highlighter or the app might trust', () => {
    const out = html('<pre class="shiki"><code class="language-js" style="--shiki-light:red">x</code></pre>')
    expect(out).not.toContain('shiki')
    expect(out).toContain('<code class="language-js">x</code>')
  })

  it('prefixes ids so a document cannot clobber the app', () => {
    expect(html('<p id="root">x</p>')).toContain('id="user-content-root"')
  })

  it('keeps harmless inline HTML', () => {
    expect(html('<details><summary>More</summary>Hidden</details>')).toContain('<details><summary>More</summary>')
    expect(html('line<br>break <kbd>Ctrl</kbd>')).toContain('<kbd>Ctrl</kbd>')
  })

  it('keeps web, mail and relative links', () => {
    const out = html('[w](https://example.com) [m](mailto:a@example.com) [r](other.md#part) [h](#top)')
    expect(out).toContain('href="https://example.com"')
    expect(out).toContain('href="mailto:a@example.com"')
    expect(out).toContain('href="other.md#part"')
    expect(out).toContain('href="#top"')
  })
})

describe('GitHub-flavored Markdown', () => {
  it('renders tables with alignment', () => {
    const out = html('| a | b |\n| :- | -: |\n| 1 | 2 |')
    expect(out).toContain('<table>')
    expect(out).toContain('<th align="left">a</th>')
    expect(out).toContain('<td align="right">2</td>')
  })

  it('renders task lists with disabled checkboxes', () => {
    const out = html('- [x] done\n- [ ] todo')
    expect(out).toContain('class="contains-task-list"')
    expect(out).toContain('class="task-list-item"')
    expect(out).toContain('<input type="checkbox" checked disabled>')
    expect(out).toContain('<input type="checkbox" disabled>')
  })

  it('renders strikethrough, autolinks and footnotes', () => {
    const out = html('~~gone~~ www.example.com https://example.org\n\nNote[^1].\n\n[^1]: The note.')
    expect(out).toContain('<del>gone</del>')
    expect(out).toContain('href="http://www.example.com"')
    expect(out).toContain('href="https://example.org"')
    expect(out).toContain('href="#fn-1"')
    expect(out).toContain('id="user-content-fn-1"')
    expect(out).toContain('id="user-content-fnref-1"')
    expect(out).toContain('The note.')
  })
})

describe('code highlighting', () => {
  it('maps fence languages and aliases to grammars', () => {
    expect(grammarFor('ts')).toBe('typescript')
    expect(grammarFor('Python')).toBe('python')
    expect(grammarFor('sh')).toBe('bash')
    expect(grammarFor('no-such-language')).toBeNull()
    expect(grammarFor('constructor')).toBeNull()
  })

  it('lists the grammars a document needs', () => {
    const tree = markdownToSafeTree('```js\na\n```\n\n```py\nb\n```\n\n```\nplain\n```\n\n```nope\nx\n```')
    expect([...codeLanguages(tree)].sort()).toEqual(['javascript', 'python'])
  })

  it('colours code blocks with the variables of every theme', async () => {
    const out = toHtml(await renderMarkdown('```ts\nconst answer: number = 42\n```'))
    expect(out).toContain('class="shiki shiki-themes github-light github-dark gruvbox-material-dark-hard tokyo-night-moon"')
    expect(out).toMatch(
      /style="[^"]*--shiki-light:#[0-9a-f]+;--shiki-dark:#[0-9a-f]+;--shiki-gruvbox:#[0-9a-f]+;--shiki-tokyo:#[0-9a-f]+/i,
    )
    expect(out).toContain('answer')
  })

  it('colours code with the Gruvbox Material palette, not the original Gruvbox', async () => {
    const out = toHtml(await renderMarkdown('```ts\n// note\nconst answer: number = 42\n```'))
    const gruvbox = (token: string) => new RegExp(`--shiki-gruvbox:(#[0-9a-f]+)[^>]*> ?${token}<`, 'i').exec(out)?.[1]
    expect(gruvbox('const')?.toLowerCase()).toBe('#ea6962')
    expect(gruvbox('number')?.toLowerCase()).toBe('#d8a657')
    expect(gruvbox('42')?.toLowerCase()).toBe('#d3869b')
    expect(gruvbox(':')?.toLowerCase()).toBe('#928374')
    expect(out).toMatch(/--shiki-gruvbox-bg:#282828/i)
    expect(out).toMatch(/--shiki-gruvbox:#928374;[^"]*--shiki-gruvbox-font-style:italic[^>]*>\/\/ note</i)
  })

  it('colours code with the Tokyo Night Moon palette, not Tokyo Night', async () => {
    const out = toHtml(
      await renderMarkdown('```ts\n// note\nimport { x } from "y"\nfunction add(a: number): Point {\n  return a + 42\n}\n```'),
    )
    const tokyo = (token: string) => new RegExp(`--shiki-tokyo:(#[0-9a-f]+)[^>]*>\\s*${token}<`, 'i').exec(out)?.[1]
    expect(tokyo('import')?.toLowerCase()).toBe('#86e1fc')
    expect(tokyo('function')?.toLowerCase()).toBe('#c099ff')
    expect(tokyo('return')?.toLowerCase()).toBe('#fca7ea')
    expect(tokyo('add')?.toLowerCase()).toBe('#82aaff')
    expect(tokyo('"y"')?.toLowerCase()).toBe('#c3e88d')
    expect(tokyo('a')?.toLowerCase()).toBe('#ffc777')
    expect(tokyo('number')?.toLowerCase()).toBe('#589ed7')
    expect(tokyo('Point')?.toLowerCase()).toBe('#65bcff')
    expect(tokyo('42')?.toLowerCase()).toBe('#ff966c')
    expect(tokyo('\\+')?.toLowerCase()).toBe('#89ddff')
    expect(out).toMatch(/--shiki-tokyo-bg:#1e2030/i)
    expect(out).toMatch(/--shiki-tokyo:#636da6;[^"]*--shiki-tokyo-font-style:italic[^>]*>\/\/ note</i)
  })

  it('leaves blocks without a known language alone', async () => {
    const out = toHtml(await renderMarkdown('```\nplain <b>text</b>\n```'))
    expect(out).toBe(
      '<pre data-source-line="1" data-source-line-end="3"><code>plain &#x3C;b>text&#x3C;/b>\n</code></pre>',
    )
  })

  it('highlights from text only, so markup in code stays text', async () => {
    const out = toHtml(await renderMarkdown('```html\n<img src=x onerror=alert(1)>\n```'))
    expect(out).not.toContain('<img')
    expect(out).toContain('&#x3C;')
  })

  it('runs after sanitizing: styles come only from the highlighter', () => {
    const tree = markdownToSafeTree('<pre><code class="language-js" style="color:red">x</code></pre>')
    highlightCodeBlocks(tree, { highlight: () => null })
    expect(toHtml(tree)).not.toContain('style=')
  })
})

describe('YAML frontmatter', () => {
  it('shows frontmatter as a key/value table, not a rule and a heading', () => {
    const out = html('---\nname: ship-landing\ndescription: A long description of the skill.\n---\n\n# Title\n')
    expect(out).toMatch(/^<div class="frontmatter"><table><tbody>/)
    expect(out).toContain('<tr><th>name</th><td>ship-landing</td></tr>')
    expect(out).toContain('<tr><th>description</th><td>A long description of the skill.</td></tr>')
    expect(out).not.toContain('<hr>')
    expect(out).not.toContain('<h2')
    expect(out).toContain('<h1>Title</h1>')
  })

  it('shows nested mappings as tables and lists as lists', () => {
    const out = html('---\nmetadata:\n  author: someone\n  version: 2\ntags:\n  - one\n  - two\nflag: true\nempty:\n---\n')
    expect(out).toContain('<th>metadata</th><td><table><tbody><tr><th>author</th><td>someone</td></tr>')
    expect(out).toContain('<tr><th>version</th><td>2</td></tr>')
    expect(out).toContain('<th>tags</th><td><ul><li>one</li><li>two</li></ul></td>')
    expect(out).toContain('<tr><th>flag</th><td>true</td></tr>')
    expect(out).toContain('<tr><th>empty</th><td></td></tr>')
    expect(out).not.toContain('{')
  })

  it('shows YAML that does not parse as a YAML code block', async () => {
    const source = '---\nname: [unclosed\nkey: : bad\n---\n\nBody\n'
    const out = html(source)
    expect(out).toContain('<div class="frontmatter"><pre><code class="language-yaml">name: [unclosed\nkey: : bad\n</code></pre></div>')
    expect(out).not.toContain('<table')
    expect(out).toContain('<p>Body</p>')

    const highlighted = toHtml(await renderMarkdown(source))
    expect(highlighted).toMatch(/^<div class="frontmatter"><pre class="shiki /)
  })

  it('shows a top-level list or scalar as a code block', () => {
    expect(html('---\n- a\n- b\n---\n')).toContain('<code class="language-yaml">- a\n- b\n</code>')
    expect(html('---\njust text\n---\n')).toContain('<code class="language-yaml">just text\n</code>')
  })

  it('shows HTML in values as text', () => {
    const out = html(
      '---\ntitle: "<script>alert(1)</script><img src=x onerror=alert(2)>"\nlist:\n  - <b>bold</b>\n---\n',
    )
    expect(out).not.toMatch(/<script|<img|<b>/)
    expect(out).toContain('&#x3C;script>alert(1)&#x3C;/script>&#x3C;img src=x onerror=alert(2)>')
    expect(out).toContain('<li>&#x3C;b>bold&#x3C;/b></li>')
  })

  it('shows HTML in malformed frontmatter as text', () => {
    const out = html('---\n<script>alert(1)</script>: : [\n---\n')
    expect(out).not.toContain('<script')
    expect(out).toContain('&#x3C;script>')
  })

  it('only recognises frontmatter at the very start', () => {
    const out = html('Intro\n\n---\nname: x\n---\n\nAfter\n')
    expect(out).not.toContain('frontmatter')
    expect(out).toContain('<hr>')
    expect(out).toContain('<h2>name: x</h2>')
  })

  it('keeps a later --- a horizontal rule', () => {
    const out = html('---\nname: x\n---\n\nAbove\n\n---\n\nBelow\n')
    expect(out).toContain('<th>name</th>')
    expect(out.match(/<hr>/g)).toHaveLength(1)
    expect(out).toContain('<p>Above</p>\n<hr>\n<p>Below</p>')
  })

  it('renders nothing for empty frontmatter', () => {
    expect(html('---\n---\n\n# Title\n')).toBe('<h1>Title</h1>')
  })

  it('keeps ids, links and footnotes in the body working', () => {
    const out = html('---\nname: x\n---\n\n<h2 id="part">Part</h2>\n\n[to part](#part) Note[^1]\n\n[^1]: The note.')
    expect(out).toContain('id="user-content-part"')
    expect(out).toContain('href="#part"')
    expect(out).toContain('id="user-content-fn-1"')
  })
})

describe('math', () => {
  it('typesets inline math with KaTeX', async () => {
    const out = toHtml(await renderMarkdown('Euler: $e^{i\\pi} + 1 = 0$ done'))
    expect(out).toMatch(/<p data-source-line="1" data-source-line-end="1">Euler: <span class="katex">/)
    expect(out).toContain('<annotation encoding="application/x-tex">e^{i\\pi} + 1 = 0</annotation>')
    expect(out).not.toContain('katex-display')
    expect(out).toContain('done</p>')
  })

  it('typesets display math, from $$ blocks and ```math fences', async () => {
    for (const markdown of ['$$\n\\int_0^1 x\\,dx\n$$', '```math\n\\int_0^1 x\\,dx\n```']) {
      const out = toHtml(await renderMarkdown(markdown))
      expect(out).toMatch(/^<span class="katex-display"><span class="katex">/)
      expect(out).not.toContain('<pre')
    }
  })

  it('shows a formula KaTeX cannot parse as an error, not as markup', async () => {
    const out = toHtml(await renderMarkdown('$\\frac{1}{$'))
    expect(out).toContain('katex-error')
  })

  it('keeps text without math as it was', async () => {
    const tree = markdownToSafeTree('Just text and `code`.')
    expect(hasMath(tree)).toBe(false)
    expect(toHtml(await renderMarkdown('Just text and `code`.'))).toBe(
      '<p data-source-line="1" data-source-line-end="1">Just text and <code>code</code>.</p>',
    )
  })

  it('neutralizes scripts, handlers and links inside math', async () => {
    const tree = await renderMarkdown(
      [
        '$<script>alert(1)</script>$',
        '$<img src=x onerror=alert(2)>$',
        '$\\href{javascript:alert(3)}{x}$ $\\url{https://example.com}$',
        '$\\htmlClass{shiki}{x}\\htmlStyle{position:fixed}{y}\\htmlId{root}{z}$',
        '$$\n\\includegraphics{https://example.com/x.png}\n$$',
      ].join('\n\n'),
    )
    const elements = elementsOf(tree)
    expect(elements).toContain('span className=katex')
    const unsafe = /^(script|img|a|image)\b| (on\w+|href|src|id)=|javascript:|position:fixed|shiki/i
    expect(elements.filter((entry) => unsafe.test(entry))).toEqual([])
  })
})

describe('Mermaid', () => {
  const diagram = 'graph TD\n  A[Start] --> B{Ok?}'

  it('turns a mermaid fence into a diagram placeholder, not a code block', async () => {
    const out = toHtml(await renderMarkdown(`\`\`\`mermaid\n${diagram}\n\`\`\``))
    expect(out).toBe(
      `<div class="${MERMAID_CLASS}" data-mermaid="graph TD\n  A[Start] --> B{Ok?}" data-source-line="1" data-source-line-end="4"></div>`,
    )
    expect(out).not.toMatch(/<pre|shiki/)
  })

  it('leaves other code blocks alone', () => {
    const tree = prepareMermaidBlocks(markdownToSafeTree('```js\nx\n```\n\n```\ngraph TD\n```'))
    expect(toHtml(tree)).not.toContain(MERMAID_CLASS)
  })

  it('keeps a script or handler in the diagram source as text', async () => {
    const source = 'graph TD\n  A["<img src=x onerror=alert(1)>"] --> B["<script>alert(2)</script>"]'
    const tree = await renderMarkdown(`\`\`\`mermaid\n${source}\n\`\`\``)
    // One empty element; the source is only an attribute's text, which React escapes.
    expect(elementsOf(tree)).toEqual([
      'div',
      `div className=${MERMAID_CLASS}`,
      `div dataMermaid=${source}`,
      'div dataSourceLine=1',
      'div dataSourceLineEnd=4',
    ])
  })

  it('cannot be faked with raw HTML', async () => {
    const out = toHtml(await renderMarkdown(`<div class="${MERMAID_CLASS}" data-mermaid="graph TD">x</div>`))
    expect(out).not.toMatch(/mermaid/)
  })
})

describe('frontmatter, math and Mermaid together', () => {
  it('renders each in one document', async () => {
    const out = toHtml(
      await renderMarkdown('---\nprice: $5 and $10\n---\n\nArea $\\pi r^2$.\n\n```mermaid\ngraph TD\n  A --> B\n```'),
    )
    expect(out).toMatch(/^<div class="frontmatter">/)
    expect(out).toContain('$5 and $10')
    expect(out.match(/class="katex"/g)).toHaveLength(1)
    expect(out).toContain(
      `<div class="${MERMAID_CLASS}" data-mermaid="graph TD\n  A --> B" data-source-line="7" data-source-line-end="10"></div>`,
    )
  })
})

describe('source lines', () => {
  const annotated = (markdown: string) => toHtml(annotateSourceLines(markdownToSafeTree(markdown)))

  it('marks blocks with the lines they came from', () => {
    const out = annotated('# Title\n\nfirst\nsecond\n\n- a\n- b\n')
    expect(out).toContain('<h1 data-source-line="1" data-source-line-end="1">')
    expect(out).toContain('<p data-source-line="3" data-source-line-end="4">')
    expect(out).toContain('<ul data-source-line="6" data-source-line-end="7">')
    expect(out).toContain('<li data-source-line="7" data-source-line-end="7">')
  })

  it('marks table rows, so a long table stays lined up', () => {
    const out = annotated('| a |\n|---|\n| 1 |\n| 2 |\n')
    expect(out).toContain('<table data-source-line="1" data-source-line-end="4">')
    expect(out).toContain('<tr data-source-line="4" data-source-line-end="4">')
  })

  it('leaves inline elements alone', () => {
    expect(annotated('some **bold** text')).toContain('<strong>bold</strong>')
  })

  it('does not trust line attributes written in the document', () => {
    const out = annotated('\n\n<span data-source-line="99">x</span>')
    expect(out).not.toContain('99')
  })

  it('marks Mermaid diagrams, and skips KaTeX markup, whose positions are not in the document', async () => {
    const out = toHtml(await renderMarkdown('text\n\n$$\nx^2\n$$\n\n```mermaid\ngraph TD\n```\n'))
    expect(out).toContain(`<div class="${MERMAID_CLASS}" data-mermaid="graph TD" data-source-line="7" data-source-line-end="9">`)
    expect(out).toMatch(/<span class="katex-display"><span class="katex">/)
    expect(out.match(/data-source-line=/g)).toHaveLength(2)
  })

  it('leaves the frontmatter block to interpolation, as it has no position', async () => {
    const out = toHtml(await renderMarkdown('---\ntitle: x\n---\n\nBody\n'))
    expect(out).toMatch(/^<div class="frontmatter"><table><tbody><tr>/)
    expect(out).toContain('<p data-source-line="5" data-source-line-end="5">Body</p>')
  })

  it('keeps the lines of highlighted code blocks', async () => {
    const out = toHtml(await renderMarkdown('text\n\n```ts\nconst a = 1\nconst b = 2\n```\n'))
    expect(out).toMatch(/<pre class="shiki[^>]*data-source-line="3" data-source-line-end="6"/)
  })
})
