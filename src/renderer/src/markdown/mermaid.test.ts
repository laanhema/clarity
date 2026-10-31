import { describe, expect, it } from 'vitest'
import { THEME_SETTINGS } from '../../../shared/api'
import { applyInlineStyles, diagramTheme, parseMermaidSvg, parseThemeSetting } from './mermaid'

const SVG = `<svg id="lantern-mermaid-1" xmlns="http://www.w3.org/2000/svg" style="max-width: 200px;" onload="alert(1)">
<style>#lantern-mermaid-1{fill:#333;}</style>
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
    expect(css).toBe('#lantern-mermaid-1{fill:#333;}')
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

describe('diagramTheme', () => {
  it('is light only for the light theme, or for "system" in light mode', () => {
    const themes = (systemDark: boolean) => THEME_SETTINGS.map((theme) => [theme, diagramTheme(theme, systemDark)])
    expect(themes(false)).toEqual([
      ['system', 'default'],
      ['light', 'default'],
      ['dark', 'dark'],
      ['gruvbox-material-dark-hard', 'dark'],
      ['tokyo-night-moon', 'dark'],
    ])
    expect(themes(true).filter(([, diagram]) => diagram !== 'dark')).toEqual([['light', 'default']])
  })

  it('reads the root element\'s theme, falling back to "system"', () => {
    expect(parseThemeSetting('tokyo-night-moon')).toBe('tokyo-night-moon')
    expect(parseThemeSetting(undefined)).toBe('system')
    expect(parseThemeSetting('no-such-theme')).toBe('system')
  })
})
