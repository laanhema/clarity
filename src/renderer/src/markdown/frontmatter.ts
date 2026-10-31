import type { Element, ElementContent } from 'hast'
import { parse } from 'yaml'

/**
 * Builds the preview of a document's YAML frontmatter, before sanitizing:
 * a mapping becomes a key/value table, with nested mappings as nested tables
 * and lists as lists. Anything else (YAML that does not parse, or a scalar or
 * list at the top) shows as a YAML code block of the raw text. Values only
 * ever become text nodes, so markup in them is shown, not rendered.
 * Returns null for empty frontmatter.
 */
export function frontmatterTree(source: string): Element | null {
  if (source.trim() === '') return null
  let data: unknown
  try {
    data = parse(source)
  } catch {
    data = undefined
  }
  const content = isMapping(data) && Object.keys(data).length > 0 ? mappingTable(data) : codeBlock(source)
  return element('div', [content])
}

function isMapping(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function element(tagName: string, children: ElementContent[], properties: Element['properties'] = {}): Element {
  return { type: 'element', tagName, properties, children }
}

function text(value: string): ElementContent {
  return { type: 'text', value }
}

function mappingTable(mapping: Record<string, unknown>): Element {
  const rows = Object.entries(mapping).map(([key, value]) =>
    element('tr', [element('th', [text(key)]), element('td', valueContent(value))]),
  )
  return element('table', [element('tbody', rows)])
}

function valueContent(value: unknown): ElementContent[] {
  if (Array.isArray(value)) {
    if (value.length === 0) return []
    return [element('ul', value.map((item) => element('li', valueContent(item))))]
  }
  if (isMapping(value)) return Object.keys(value).length > 0 ? [mappingTable(value)] : []
  return [text(scalarText(value))]
}

/** YAML's core schema yields strings, numbers, booleans and null as scalars. */
function scalarText(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value)
  return ''
}

function codeBlock(source: string): Element {
  return element('pre', [element('code', [text(source.replace(/\n?$/, '\n'))], { className: ['language-yaml'] })])
}
