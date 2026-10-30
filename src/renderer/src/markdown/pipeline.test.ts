import { toHtml } from 'hast-util-to-html'
import { describe, expect, it } from 'vitest'
import { grammarFor } from './highlighter'
import { codeLanguages, highlightCodeBlocks, markdownToSafeTree, renderMarkdown } from './pipeline'

const html = (markdown: string) => toHtml(markdownToSafeTree(markdown))

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

  it('colours code blocks with light and dark theme variables', async () => {
    const out = toHtml(await renderMarkdown('```ts\nconst answer: number = 42\n```'))
    expect(out).toContain('class="shiki shiki-themes github-light github-dark"')
    expect(out).toMatch(/style="[^"]*--shiki-light:#[0-9a-f]+;--shiki-dark:#[0-9a-f]+/i)
    expect(out).toContain('answer')
  })

  it('leaves blocks without a known language alone', async () => {
    const out = toHtml(await renderMarkdown('```\nplain <b>text</b>\n```'))
    expect(out).toBe('<pre><code>plain &#x3C;b>text&#x3C;/b>\n</code></pre>')
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
