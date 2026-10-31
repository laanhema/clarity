import type { Mermaid } from 'mermaid'
import { THEME_SETTINGS, type ThemeSetting } from '../../../shared/api'

/** Mermaid's light or dark diagram theme. */
export type DiagramTheme = 'default' | 'dark'

/** Reads the app theme from the `data-theme` value App puts on the root element; anything else counts as "system". */
export function parseThemeSetting(value: string | undefined): ThemeSetting {
  return THEME_SETTINGS.find((theme) => theme === value) ?? 'system'
}

/** The diagram theme for an app theme: light for the light theme, dark for every dark-family theme. */
export function diagramTheme(theme: ThemeSetting, systemDark: boolean): DiagramTheme {
  switch (theme) {
    case 'light':
      return 'default'
    case 'system':
      return systemDark ? 'dark' : 'default'
    case 'dark':
    case 'gruvbox-material-dark-hard':
    case 'tokyo-night-moon':
      return 'dark'
  }
}

/** A rendered diagram: the cleaned SVG element and the CSS that Mermaid put in its `<style>`. */
export interface MermaidDiagram {
  svg: SVGSVGElement
  css: string
}

let mermaidPromise: Promise<Mermaid> | null = null

/** Mermaid is large, so it loads the first time a document has a diagram. */
function loadMermaid(): Promise<Mermaid> {
  mermaidPromise ??= import('mermaid').then(
    (module) => module.default,
    (error: unknown) => {
      mermaidPromise = null
      throw error
    },
  )
  return mermaidPromise
}

/** Elements a diagram never needs that could run code, load content or animate an attribute into a link. */
const DROPPED_ELEMENTS =
  'script, iframe, frame, frameset, object, embed, applet, link, meta, base, form, input, button, textarea, select, audio, video, source, track, animate, animateMotion, animateTransform, set, discard'
const URL_ATTRIBUTES = new Set(['href', 'xlink:href', 'src', 'srcset', 'action', 'formaction', 'poster', 'background', 'ping'])

/**
 * Turns Mermaid's SVG markup into an inert element. Mermaid's strict mode
 * already sanitizes labels; this is a second line of defence: it drops
 * scripts and other active elements, event handler attributes and every URL
 * that is not a `#fragment`, and takes the `<style>` out (the CSP blocks
 * inline styles, so the caller applies it as a constructed stylesheet).
 */
export function parseMermaidSvg(markup: string): MermaidDiagram {
  // An HTML document parses the SVG the way innerHTML would, labels included,
  // and DOMParser documents never run scripts or load resources.
  const parsed = new DOMParser().parseFromString(markup, 'text/html')
  const svg = parsed.body.querySelector('svg')
  if (!svg) throw new Error('Mermaid returned no SVG')
  const css = [...svg.querySelectorAll('style')].map((style) => style.textContent).join('\n')
  for (const element of svg.querySelectorAll(`style, ${DROPPED_ELEMENTS}`)) element.remove()
  for (const element of [svg, ...svg.querySelectorAll('*')]) {
    for (const { name, value } of [...element.attributes]) {
      const lower = name.toLowerCase()
      if (lower.startsWith('on') || (URL_ATTRIBUTES.has(lower) && !value.trim().startsWith('#'))) {
        element.removeAttribute(name)
      }
    }
  }
  return { svg: document.importNode(svg, true), css }
}

/**
 * Re-applies `style` attributes through the CSSOM. The CSP (no
 * `unsafe-inline`) blocks style attributes in parsed markup, but not styles
 * set from script, which is how Mermaid sizes the diagram and its labels.
 */
export function applyInlineStyles(root: ParentNode): void {
  for (const element of root.querySelectorAll<SVGElement | HTMLElement>('[style]')) {
    const css = element.getAttribute('style') ?? ''
    element.removeAttribute('style')
    element.style.cssText = css
  }
}

/**
 * Every diagram renders with the same id: renders run one at a time, and each
 * finished SVG lives in its own shadow root, where ids cannot clash.
 */
const RENDER_ID = 'mdpad-mermaid'

/** Mermaid's CSS by theme, diagram type and `%%{init}%%` config, from the last render of that kind. */
const cssByKind = new Map<string, string>()

/**
 * One Mermaid render. Mermaid sizes boxes by measuring their labels in a
 * hidden element, styled by a `<style>` that the CSP blocks. `css` is
 * applied to the page as a constructed stylesheet meanwhile, so labels are
 * measured in the font and spacing they are drawn with. Its selectors all
 * start with the diagram's id, so it touches nothing else.
 */
async function renderOnce(mermaid: Mermaid, source: string, css: string | undefined): Promise<MermaidDiagram> {
  let sheet: CSSStyleSheet | null = null
  if (css !== undefined) {
    sheet = new CSSStyleSheet()
    sheet.replaceSync(css)
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]
  }
  try {
    const { svg } = await mermaid.render(RENDER_ID, source)
    return parseMermaidSvg(svg)
  } finally {
    if (sheet) document.adoptedStyleSheets = document.adoptedStyleSheets.filter((adopted) => adopted !== sheet)
    // Mermaid can leave its measuring element behind when a diagram fails.
    document.getElementById(`d${RENDER_ID}`)?.remove()
    document.getElementById(RENDER_ID)?.remove()
  }
}

let queue: Promise<unknown> = Promise.resolve()

/**
 * Renders a diagram with the given Mermaid theme. Renders run one at a time,
 * because Mermaid's configuration is global. Rejects with Mermaid's message
 * for a diagram it cannot parse.
 */
export function renderMermaid(source: string, theme: DiagramTheme): Promise<MermaidDiagram> {
  const run = async () => {
    const mermaid = await loadMermaid()
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme,
      // Errors show in the preview's own markup, not as Mermaid's error diagram.
      suppressErrorRendering: true,
      // A diagram's `%%{init}%%` block may not inject CSS or change the font.
      secure: ['secure', 'securityLevel', 'startOnLoad', 'maxTextSize', 'suppressErrorRendering', 'maxEdges', 'themeCSS', 'fontFamily'],
    })
    const { diagramType, config } = await mermaid.parse(source)
    const kind = JSON.stringify([theme, diagramType, config])
    const known = cssByKind.get(kind)
    const diagram = await renderOnce(mermaid, source, known)
    if (diagram.css === known) return diagram
    // The first diagram of its kind was measured without its styles; measure it again with them.
    cssByKind.set(kind, diagram.css)
    return renderOnce(mermaid, source, diagram.css)
  }
  const result = queue.then(run, run)
  queue = result.catch(() => undefined)
  return result
}
