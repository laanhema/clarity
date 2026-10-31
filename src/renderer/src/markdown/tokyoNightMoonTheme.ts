import type { ThemeRegistration } from '@shikijs/types'

/**
 * Code colours for the Tokyo Night Moon theme (folke/tokyonight.nvim, style
 * "moon"), from the Neovim theme's treesitter groups. Shiki's bundled
 * `tokyo-night` is the Night variant, so mdpad defines its own.
 */
const palette = {
  bgDark: '#1e2030',
  fg: '#c8d3f5',
  fgDark: '#828bb8',
  comment: '#636da6',
  blue: '#82aaff',
  blue1: '#65bcff',
  /** blue1 at 80% over the background, for built-in types. */
  blue1Dim: '#589ed7',
  blue5: '#89ddff',
  cyan: '#86e1fc',
  green: '#c3e88d',
  green1: '#4fd6be',
  yellow: '#ffc777',
  orange: '#ff966c',
  red: '#ff757f',
  magenta: '#c099ff',
  purple: '#fca7ea',
} as const

export const tokyoNightMoon: ThemeRegistration = {
  name: 'tokyo-night-moon',
  type: 'dark',
  colors: {
    'editor.background': palette.bgDark,
    'editor.foreground': palette.fg,
  },
  tokenColors: [
    { settings: { foreground: palette.fg, background: palette.bgDark } },
    {
      scope: ['comment', 'punctuation.definition.comment'],
      settings: { foreground: palette.comment, fontStyle: 'italic' },
    },
    {
      scope: ['keyword', 'storage.type', 'storage.modifier', 'keyword.control', 'keyword.other'],
      settings: { foreground: palette.purple, fontStyle: 'italic' },
    },
    { scope: ['storage.type.function', 'keyword.function'], settings: { foreground: palette.magenta, fontStyle: 'italic' } },
    {
      scope: ['keyword.control.import', 'keyword.control.export', 'keyword.control.from', 'keyword.control.default'],
      settings: { foreground: palette.cyan, fontStyle: 'italic' },
    },
    { scope: ['keyword.operator', 'punctuation.accessor.optional'], settings: { foreground: palette.blue5, fontStyle: '' } },
    {
      // Word operators (`new`, `typeof`, `instanceof`) read as keywords.
      scope: ['keyword.operator.new', 'keyword.operator.expression', 'keyword.operator.word'],
      settings: { foreground: palette.purple, fontStyle: 'italic' },
    },
    {
      scope: ['entity.name.function', 'support.function', 'meta.function-call entity.name.function'],
      settings: { foreground: palette.blue },
    },
    {
      scope: ['string', 'punctuation.definition.string', 'string.template', 'string.regexp'],
      settings: { foreground: palette.green },
    },
    {
      scope: ['constant.numeric', 'constant.language', 'constant.character', 'constant.other'],
      settings: { foreground: palette.orange },
    },
    {
      scope: [
        'entity.name.type',
        'entity.name.class',
        'entity.name.namespace',
        'entity.other.inherited-class',
        'support.class',
        'support.type',
      ],
      settings: { foreground: palette.blue1 },
    },
    { scope: ['support.type.primitive', 'support.type.builtin'], settings: { foreground: palette.blue1Dim } },
    {
      scope: [
        'variable.other.property',
        'variable.other.object.property',
        'support.variable.property',
        'meta.object-literal.key',
        'support.type.property-name',
        'entity.other.attribute-name',
      ],
      settings: { foreground: palette.green1 },
    },
    { scope: ['variable', 'variable.other'], settings: { foreground: palette.fg } },
    { scope: ['variable.parameter'], settings: { foreground: palette.yellow } },
    { scope: ['entity.name.tag'], settings: { foreground: palette.red } },
    {
      scope: ['punctuation.definition.block', 'punctuation.definition.parameters', 'meta.brace', 'punctuation.section'],
      settings: { foreground: palette.fgDark },
    },
    {
      scope: [
        'punctuation.separator',
        'punctuation.terminator',
        'punctuation.accessor',
        'punctuation.delimiter',
        'keyword.operator.type.annotation',
      ],
      settings: { foreground: palette.blue5 },
    },
    { scope: ['markup.heading', 'entity.name.section'], settings: { foreground: palette.blue } },
    { scope: ['markup.bold'], settings: { fontStyle: 'bold' } },
    { scope: ['markup.italic'], settings: { fontStyle: 'italic' } },
    { scope: ['markup.inline.raw', 'markup.raw'], settings: { foreground: palette.green } },
    { scope: ['markup.underline.link'], settings: { foreground: palette.green1 } },
    { scope: ['markup.inserted'], settings: { foreground: palette.green } },
    { scope: ['markup.deleted'], settings: { foreground: palette.red } },
    { scope: ['markup.changed'], settings: { foreground: palette.blue } },
  ],
}
