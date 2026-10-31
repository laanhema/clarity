import type { Mermaid, MermaidConfig } from 'mermaid'
import { FONT_SETTINGS, THEME_SETTINGS, type FontSetting, type ThemeSetting } from '../../../shared/api'

/** The diagram palette in use: one per app theme, with "system" resolved to light or dark. */
export type DiagramStyle = 'light' | 'dark' | 'gruvbox-material-dark-hard' | 'tokyo-night-moon'

/** Reads the app theme from the `data-theme` value App puts on the root element; anything else counts as "system". */
export function parseThemeSetting(value: string | undefined): ThemeSetting {
  return THEME_SETTINGS.find((theme) => theme === value) ?? 'system'
}

/** Reads the app font from the `data-font` value App puts on the root element; anything else counts as Commit Mono. */
export function parseFontSetting(value: string | undefined): FontSetting {
  return FONT_SETTINGS.find((font) => font === value) ?? 'commit-mono'
}

/** The diagram palette for an app theme. "System" follows the system colour scheme. */
export function diagramStyle(theme: ThemeSetting, systemDark: boolean): DiagramStyle {
  return theme === 'system' ? (systemDark ? 'dark' : 'light') : theme
}

/** The font stack of each Font setting, as `--font-app` in styles.css has it. */
export const FONT_STACKS: Record<FontSetting, string> = {
  'commit-mono': "'Commit Mono', ui-monospace, monospace",
  'jetbrains-mono-nl': "'JetBrains Mono NL', ui-monospace, monospace",
}

/** Mermaid theme variables: colours, plus `darkMode` for the colours Mermaid derives from them. */
type Palette = Record<string, string | boolean>

/**
 * Mermaid `base` theme colours for each app theme, taken from that theme's
 * block in styles.css: node fills, borders and text, lines, subgraphs,
 * notes and sequence-diagram actors.
 */
export const PALETTES: Record<DiagramStyle, Palette> = {
  light: {
    darkMode: false,
    background: '#ffffff',
    primaryColor: '#eef3fd',
    primaryBorderColor: '#2e6be6',
    primaryTextColor: '#1f2328',
    secondaryColor: '#f6f8fa',
    secondaryBorderColor: '#d8dce1',
    secondaryTextColor: '#1f2328',
    tertiaryColor: '#f5f6f8',
    tertiaryBorderColor: '#d8dce1',
    tertiaryTextColor: '#1f2328',
    lineColor: '#656d76',
    textColor: '#1f2328',
    titleColor: '#0b4fa8',
    clusterBkg: '#f6f8fa',
    clusterBorder: '#d8dce1',
    edgeLabelBackground: '#ffffff',
    noteBkgColor: '#fdf3e7',
    noteBorderColor: '#d4740b',
    noteTextColor: '#1f2328',
    actorBkg: '#eef3fd',
    actorBorder: '#2e6be6',
    actorTextColor: '#1f2328',
    actorLineColor: '#8c959f',
    signalColor: '#1f2328',
    signalTextColor: '#1f2328',
    labelBoxBkgColor: '#eef3fd',
    labelBoxBorderColor: '#2e6be6',
    labelTextColor: '#1f2328',
    loopTextColor: '#1f2328',
    activationBkgColor: '#f6f8fa',
    activationBorderColor: '#2e6be6',
  },
  dark: {
    darkMode: true,
    background: '#1e1f22',
    primaryColor: '#2a3243',
    primaryBorderColor: '#6e9eff',
    primaryTextColor: '#e3e5e8',
    secondaryColor: '#26282c',
    secondaryBorderColor: '#303236',
    secondaryTextColor: '#e3e5e8',
    tertiaryColor: '#26282c',
    tertiaryBorderColor: '#303236',
    tertiaryTextColor: '#e3e5e8',
    lineColor: '#9aa0a6',
    textColor: '#e3e5e8',
    titleColor: '#8cb4ff',
    clusterBkg: '#232427',
    clusterBorder: '#3a3d42',
    edgeLabelBackground: '#1e1f22',
    noteBkgColor: '#3a2f22',
    noteBorderColor: '#f0a64a',
    noteTextColor: '#e3e5e8',
    actorBkg: '#2a3243',
    actorBorder: '#6e9eff',
    actorTextColor: '#e3e5e8',
    actorLineColor: '#6e7681',
    signalColor: '#e3e5e8',
    signalTextColor: '#e3e5e8',
    labelBoxBkgColor: '#2a3243',
    labelBoxBorderColor: '#6e9eff',
    labelTextColor: '#e3e5e8',
    loopTextColor: '#e3e5e8',
    activationBkgColor: '#26282c',
    activationBorderColor: '#6e9eff',
  },
  'gruvbox-material-dark-hard': {
    darkMode: true,
    background: '#1d2021',
    primaryColor: '#32302f',
    primaryBorderColor: '#e78a4e',
    primaryTextColor: '#d4be98',
    secondaryColor: '#3c3836',
    secondaryBorderColor: '#a9b665',
    secondaryTextColor: '#d4be98',
    tertiaryColor: '#282828',
    tertiaryBorderColor: '#504945',
    tertiaryTextColor: '#d4be98',
    lineColor: '#a89984',
    textColor: '#d4be98',
    titleColor: '#e78a4e',
    clusterBkg: '#282828',
    clusterBorder: '#504945',
    edgeLabelBackground: '#1d2021',
    noteBkgColor: '#473c29',
    noteBorderColor: '#d8a657',
    noteTextColor: '#ddc7a1',
    actorBkg: '#32302f',
    actorBorder: '#7daea3',
    actorTextColor: '#d4be98',
    actorLineColor: '#7c6f64',
    signalColor: '#d4be98',
    signalTextColor: '#d4be98',
    labelBoxBkgColor: '#32302f',
    labelBoxBorderColor: '#7daea3',
    labelTextColor: '#d4be98',
    loopTextColor: '#d4be98',
    activationBkgColor: '#3c3836',
    activationBorderColor: '#e78a4e',
  },
  'tokyo-night-moon': {
    darkMode: true,
    background: '#222436',
    primaryColor: '#2f334d',
    primaryBorderColor: '#82aaff',
    primaryTextColor: '#c8d3f5',
    secondaryColor: '#2d3f76',
    secondaryBorderColor: '#4fd6be',
    secondaryTextColor: '#c8d3f5',
    tertiaryColor: '#1e2030',
    tertiaryBorderColor: '#3b4261',
    tertiaryTextColor: '#c8d3f5',
    lineColor: '#828bb8',
    textColor: '#c8d3f5',
    titleColor: '#82aaff',
    clusterBkg: '#1e2030',
    clusterBorder: '#3b4261',
    edgeLabelBackground: '#222436',
    noteBkgColor: '#3a3446',
    noteBorderColor: '#ff966c',
    noteTextColor: '#c8d3f5',
    actorBkg: '#2f334d',
    actorBorder: '#4fd6be',
    actorTextColor: '#c8d3f5',
    actorLineColor: '#636da6',
    signalColor: '#c8d3f5',
    signalTextColor: '#c8d3f5',
    labelBoxBkgColor: '#2f334d',
    labelBoxBorderColor: '#4fd6be',
    labelTextColor: '#c8d3f5',
    loopTextColor: '#c8d3f5',
    activationBkgColor: '#2d3f76',
    activationBorderColor: '#82aaff',
  },
}

/**
 * The `mermaid.initialize` config for a diagram palette and app font. The
 * look and layout are set explicitly so a change of Mermaid's defaults
 * cannot move them. The font goes in both places, because Mermaid measures
 * labels with one and draws them with the other.
 */
export function mermaidConfig(style: DiagramStyle, font: FontSetting): MermaidConfig {
  const fontFamily = FONT_STACKS[font]
  return {
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'base',
    look: 'classic',
    layout: 'elk',
    fontFamily,
    themeVariables: { ...PALETTES[style], fontFamily },
    // Errors show in the preview's own markup, not as Mermaid's error diagram.
    suppressErrorRendering: true,
    // A diagram's `%%{init}%%` block may not inject CSS or change the font.
    secure: ['secure', 'securityLevel', 'startOnLoad', 'maxTextSize', 'suppressErrorRendering', 'maxEdges', 'themeCSS', 'fontFamily'],
  }
}

/** Waits for the app font's regular and bold faces, since Mermaid sizes boxes by measuring labels in it. */
async function loadFont(font: FontSetting): Promise<void> {
  if (typeof document.fonts === 'undefined') return
  const stack = FONT_STACKS[font]
  await Promise.all([document.fonts.load(`16px ${stack}`), document.fonts.load(`bold 16px ${stack}`)]).catch(() => undefined)
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
const RENDER_ID = 'lantern-mermaid'

/** Mermaid's CSS by palette, font, diagram type and `%%{init}%%` config, from the last render of that kind. */
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
 * Renders a diagram in the given palette and app font. Renders run one at a
 * time, because Mermaid's configuration is global. Rejects with Mermaid's
 * message for a diagram it cannot parse.
 */
export function renderMermaid(source: string, style: DiagramStyle, font: FontSetting): Promise<MermaidDiagram> {
  const run = async () => {
    const [mermaid] = await Promise.all([loadMermaid(), loadFont(font)])
    mermaid.initialize(mermaidConfig(style, font))
    const { diagramType, config } = await mermaid.parse(source)
    const kind = JSON.stringify([style, font, diagramType, config])
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
