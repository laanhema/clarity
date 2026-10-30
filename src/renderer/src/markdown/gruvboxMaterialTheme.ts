import type { ThemeRegistration } from '@shikijs/types'

/**
 * Code colours for the Gruvbox Material Dark Hard theme (sainnhe/gruvbox-material,
 * background "hard", foreground "material", default options: only comments
 * are italic). Shiki's bundled `gruvbox-dark-hard` is the original Gruvbox
 * palette, so mdpad defines its own from the Neovim theme's syntax groups.
 */
const palette = {
  bg1: '#282828',
  fg0: '#d4be98',
  red: '#ea6962',
  orange: '#e78a4e',
  yellow: '#d8a657',
  green: '#a9b665',
  aqua: '#89b482',
  blue: '#7daea3',
  purple: '#d3869b',
  grey1: '#928374',
} as const

export const gruvboxMaterialDarkHard: ThemeRegistration = {
  name: 'gruvbox-material-dark-hard',
  type: 'dark',
  colors: {
    'editor.background': palette.bg1,
    'editor.foreground': palette.fg0,
  },
  tokenColors: [
    { settings: { foreground: palette.fg0, background: palette.bg1 } },
    {
      scope: ['comment', 'punctuation.definition.comment'],
      settings: { foreground: palette.grey1, fontStyle: 'italic' },
    },
    {
      scope: ['keyword', 'storage.type', 'storage.modifier', 'keyword.control', 'keyword.other'],
      settings: { foreground: palette.red },
    },
    { scope: ['keyword.operator', 'punctuation.accessor.optional'], settings: { foreground: palette.orange } },
    {
      // Word operators (`new`, `typeof`, `instanceof`) read as keywords.
      scope: ['keyword.operator.new', 'keyword.operator.expression', 'keyword.operator.word'],
      settings: { foreground: palette.red },
    },
    {
      scope: ['entity.name.function', 'support.function', 'meta.function-call entity.name.function'],
      settings: { foreground: palette.green },
    },
    {
      scope: ['string', 'punctuation.definition.string', 'string.template', 'string.regexp'],
      settings: { foreground: palette.aqua },
    },
    {
      scope: ['constant.numeric', 'constant.language', 'constant.character', 'constant.other'],
      settings: { foreground: palette.purple },
    },
    {
      scope: [
        'entity.name.type',
        'entity.name.class',
        'entity.name.namespace',
        'entity.other.inherited-class',
        'support.class',
        'support.type',
        'support.type.primitive',
        'support.type.builtin',
      ],
      settings: { foreground: palette.yellow },
    },
    {
      scope: [
        'variable.other.property',
        'variable.other.object.property',
        'support.variable.property',
        'meta.object-literal.key',
        'support.type.property-name',
        'entity.other.attribute-name',
      ],
      settings: { foreground: palette.blue },
    },
    { scope: ['variable.parameter', 'variable', 'variable.other'], settings: { foreground: palette.fg0 } },
    { scope: ['entity.name.tag'], settings: { foreground: palette.orange } },
    {
      scope: ['punctuation.definition.block', 'punctuation.definition.parameters', 'meta.brace', 'punctuation.section'],
      settings: { foreground: palette.fg0 },
    },
    {
      scope: [
        'punctuation.separator',
        'punctuation.terminator',
        'punctuation.accessor',
        'punctuation.delimiter',
        'keyword.operator.type.annotation',
      ],
      settings: { foreground: palette.grey1 },
    },
    { scope: ['markup.heading', 'entity.name.section'], settings: { foreground: palette.orange } },
    { scope: ['markup.bold'], settings: { fontStyle: 'bold' } },
    { scope: ['markup.italic'], settings: { fontStyle: 'italic' } },
    { scope: ['markup.inline.raw', 'markup.raw'], settings: { foreground: palette.green } },
    { scope: ['markup.underline.link'], settings: { foreground: palette.blue } },
    { scope: ['markup.inserted'], settings: { foreground: palette.green } },
    { scope: ['markup.deleted'], settings: { foreground: palette.red } },
    { scope: ['markup.changed'], settings: { foreground: palette.blue } },
  ],
}
