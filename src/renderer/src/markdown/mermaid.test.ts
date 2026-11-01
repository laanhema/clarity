import mermaid from 'mermaid'
import { describe, expect, it, vi } from 'vitest'
import { THEME_SETTINGS } from '../../../shared/api'
import {
  applyInlineStyles,
  diagramStyle,
  FONT_STACKS,
  mermaidConfig,
  PALETTES,
  parseFontSetting,
  parseMermaidSvg,
  parseThemeSetting,
  renderMermaid,
} from './mermaid'

vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    parse: vi.fn(() => Promise.resolve({ diagramType: 'flowchart-v2', config: {} })),
    render: vi.fn(() => Promise.resolve({ svg: '<svg><style>svg{fill:red}</style></svg>' })),
  },
}))

const SVG = `<svg id="clarity-mermaid-1" xmlns="http://www.w3.org/2000/svg" style="max-width: 200px;" onload="alert(1)">
<style>#clarity-mermaid-1{fill:#333;}</style>
<script>alert(2)</script>
<g class="node" onclick="alert(3)"><rect width="10" height="10" style="fill:red"/></g>
<a href="javascript:alert(4)" xlink:href="https://example.com"><text>link</text></a>
<use href="#marker"/>
<image href="https://example.com/x.png"/>
<animate attributeName="href" to="javascript:alert(5)"/>
<foreignObject><div xmlns="http://www.w3.org/1999/xhtml"><span class="nodeLabel" onmouseover="alert(6)">Label<br>two</span><img src="x" onerror="alert(7)"></div></foreignObject>
</svg>`

describe('parseMermaidSvg', () => {
  const { svg, css } = parseMermaidSvg(SVG)
  const markup = svg.outerHTML

  it('takes the stylesheet out of the SVG', () => {
    expect(css).toBe('#clarity-mermaid-1{fill:#333;}')
    expect(svg.querySelector('style')).toBeNull()
  })

  it('drops scripts, event handlers, animations and outside URLs', () => {
    expect(markup).not.toMatch(/<script|<animate|\bon\w+=|javascript:|example\.com|alert/)
    expect(svg.querySelector('use')?.getAttribute('href')).toBe('#marker')
  })

  it('keeps the drawing and its labels', () => {
    expect(svg.querySelector('g.node rect')).not.toBeNull()
    expect(svg.querySelector('foreignObject span.nodeLabel')?.textContent).toBe('Labeltwo')
    expect(svg.ownerDocument).toBe(document)
  })

  it('rejects markup without an SVG', () => {
    expect(() => parseMermaidSvg('<p>no</p>')).toThrow('no SVG')
  })
})

describe('applyInlineStyles', () => {
  it('moves style attributes to the CSSOM', () => {
    const { svg } = parseMermaidSvg(SVG)
    const container = document.createElement('div')
    container.append(svg)
    applyInlineStyles(container)
    expect(svg.getAttribute('style')).toBe('max-width: 200px;')
    expect(svg.style.maxWidth).toBe('200px')
    expect(svg.querySelector('rect')?.style.fill).toBe('red')
  })
})

describe('diagramStyle', () => {
  it('gives each app theme its own palette, and "system" the light or dark one', () => {
    const styles = (systemDark: boolean) => THEME_SETTINGS.map((theme) => [theme, diagramStyle(theme, systemDark)])
    expect(styles(false)).toEqual([
      ['system', 'light'],
      ['light', 'light'],
      ['dark', 'dark'],
      ['gruvbox-material-dark-hard', 'gruvbox-material-dark-hard'],
      ['tokyo-night-moon', 'tokyo-night-moon'],
    ])
    expect(diagramStyle('system', true)).toBe('dark')
  })

  it('reads the root element\'s theme, falling back to "system"', () => {
    expect(parseThemeSetting('tokyo-night-moon')).toBe('tokyo-night-moon')
    expect(parseThemeSetting(undefined)).toBe('system')
    expect(parseThemeSetting('no-such-theme')).toBe('system')
  })

  it("reads the root element's font, falling back to Commit Mono", () => {
    expect(parseFontSetting('jetbrains-mono-nl')).toBe('jetbrains-mono-nl')
    expect(parseFontSetting(undefined)).toBe('commit-mono')
    expect(parseFontSetting('no-such-font')).toBe('commit-mono')
  })
})

describe('mermaidConfig', () => {
  it("maps each app theme to its palette, in that theme's page colour and accent", () => {
    const palette = (theme: (typeof THEME_SETTINGS)[number]) => {
      const variables = mermaidConfig(diagramStyle(theme, false), 'commit-mono').themeVariables as Record<string, unknown>
      return [variables['background'], variables['primaryBorderColor'], variables['darkMode']]
    }
    expect(palette('light')).toEqual(['#ffffff', '#2e6be6', false])
    expect(palette('dark')).toEqual(['#0d1117', '#4493f8', true])
    expect(palette('gruvbox-material-dark-hard')).toEqual(['#1d2021', '#e78a4e', true])
    expect(palette('tokyo-night-moon')).toEqual(['#222436', '#82aaff', true])
  })

  it('uses the base theme, classic look, ELK layout and app font, with no corner CSS', () => {
    const config = mermaidConfig('gruvbox-material-dark-hard', 'jetbrains-mono-nl')
    expect(config).toMatchObject({
      theme: 'base',
      look: 'classic',
      layout: 'elk',
      fontFamily: FONT_STACKS['jetbrains-mono-nl'],
      themeVariables: {
        ...PALETTES['gruvbox-material-dark-hard'],
        fontFamily: FONT_STACKS['jetbrains-mono-nl'],
      },
      securityLevel: 'strict',
    })
    expect(config).not.toHaveProperty('themeCSS')
    expect(config.secure).toEqual(expect.arrayContaining(['themeCSS', 'fontFamily', 'securityLevel']))
  })
})

describe('renderMermaid', () => {
  it('initializes Mermaid with the palette and font it is given', async () => {
    // jsdom has no constructed stylesheets.
    vi.stubGlobal(
      'CSSStyleSheet',
      class {
        replaceSync = vi.fn()
      },
    )
    Object.defineProperty(document, 'adoptedStyleSheets', {
      value: [],
      writable: true,
      configurable: true,
    })
    const { css } = await renderMermaid('graph TD; A-->B', 'tokyo-night-moon', 'commit-mono')
    expect(css).toBe('svg{fill:red}')
    expect(mermaid.initialize).toHaveBeenLastCalledWith(mermaidConfig('tokyo-night-moon', 'commit-mono'))
    vi.unstubAllGlobals()
  })
})
