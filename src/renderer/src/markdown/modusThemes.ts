import type { ThemeRegistration } from '@shikijs/types'

/**
 * Code colours for the Modus themes (Protesilaos Stavrou, modus-themes.el
 * 5.3.0): Modus Operandi and Modus Vivendi, plain and tinted. Shiki ships no
 * Modus theme, so Clarity defines its own. Each value is the upstream
 * palette's semantic mapping resolved to its colour; the comment names the
 * named colour it resolves to. Upstream turns italic and bold code off by
 * default (modus-themes-italic-constructs, modus-themes-bold-constructs), so
 * these do too.
 */
interface ModusPalette {
  /** bg-dim: code blocks (bg-prose-block-contents). */
  bgDim: string
  /** fg-main: text, and numbers, operators and punctuation. */
  fgMain: string
  comment: string
  docstring: string
  keyword: string
  builtin: string
  constant: string
  fnname: string
  fnnameCall: string
  type: string
  string: string
  property: string
  variable: string
  preprocessor: string
  rxConstruct: string
  rxBackslash: string
  err: string
  fgLink: string
  fgProseCode: string
  fgAdded: string
  fgRemoved: string
  fgChanged: string
}

const operandi: ModusPalette = {
  bgDim: '#f2f2f2',
  fgMain: '#000000',
  comment: '#595959', // fg-dim
  docstring: '#2a5045', // green-faint
  keyword: '#531ab6', // magenta-cooler
  builtin: '#8f0075', // magenta-warmer
  constant: '#0000b0', // blue-cooler
  fnname: '#721045', // magenta
  fnnameCall: '#7b435c', // pink
  type: '#005f5f', // cyan-cooler
  string: '#3548cf', // blue-warmer
  property: '#005e8b', // cyan
  variable: '#005e8b', // cyan
  preprocessor: '#a0132f', // red-cooler
  rxConstruct: '#00663f', // green-cooler
  rxBackslash: '#721045', // magenta
  err: '#a60000', // red
  fgLink: '#3548cf', // blue-warmer
  fgProseCode: '#005f5f', // cyan-cooler
  fgAdded: '#005000',
  fgRemoved: '#8f1313',
  fgChanged: '#553d00',
}

const vivendi: ModusPalette = {
  bgDim: '#1e1e1e',
  fgMain: '#ffffff',
  comment: '#989898', // fg-dim
  docstring: '#9ac8e0', // cyan-faint
  keyword: '#b6a0ff', // magenta-cooler
  builtin: '#f78fe7', // magenta-warmer
  constant: '#00bcff', // blue-cooler
  fnname: '#feacd0', // magenta
  fnnameCall: '#d09dc0', // pink
  type: '#6ae4b9', // cyan-cooler
  string: '#79a8ff', // blue-warmer
  property: '#00d3d0', // cyan
  variable: '#00d3d0', // cyan
  preprocessor: '#ff7f86', // red-cooler
  rxConstruct: '#00c06f', // green-cooler
  rxBackslash: '#feacd0', // magenta
  err: '#ff5f59', // red
  fgLink: '#79a8ff', // blue-warmer
  fgProseCode: '#6ae4b9', // cyan-cooler
  fgAdded: '#a0e0a0',
  fgRemoved: '#ffbfbf',
  fgChanged: '#efef80',
}

const operandiTinted: ModusPalette = {
  bgDim: '#efe9dd',
  fgMain: '#000000',
  comment: '#7f0000', // red-faint
  docstring: '#304463', // cyan-faint
  keyword: '#0031a9', // blue
  builtin: '#721045', // magenta
  constant: '#531ab6', // magenta-cooler
  fnname: '#602938', // yellow-cooler
  fnnameCall: '#7b435c', // pink
  type: '#306010', // green-warmer
  string: '#00598b', // cyan
  property: '#00603f', // green-cooler
  variable: '#00603f', // green-cooler
  preprocessor: '#894000', // yellow-warmer
  rxConstruct: '#531ab6', // magenta-cooler
  rxBackslash: '#8f0075', // magenta-warmer
  err: '#a60000', // red
  fgLink: '#3546c2', // blue-warmer
  fgProseCode: '#00603f', // green-cooler
  fgAdded: '#005000',
  fgRemoved: '#8f1313',
  fgChanged: '#553d00',
}

const vivendiTinted: ModusPalette = {
  bgDim: '#1d2235',
  fgMain: '#ffffff',
  comment: '#ef8386', // red-faint
  docstring: '#9ac8e0', // cyan-faint
  keyword: '#79a8ff', // blue-warmer
  builtin: '#feacd0', // magenta
  constant: '#b6a0ff', // magenta-cooler
  fnname: '#f78fe7', // magenta-warmer
  fnnameCall: '#d09dc0', // pink
  type: '#11c777', // green-cooler
  string: '#2fafff', // blue
  property: '#4ae2f0', // cyan-warmer
  variable: '#4ae2f0', // cyan-warmer
  preprocessor: '#ff7f86', // red-cooler
  rxConstruct: '#b6a0ff', // magenta-cooler
  rxBackslash: '#f78fe7', // magenta-warmer
  err: '#ff5f59', // red
  fgLink: '#79a8ff', // blue-warmer
  fgProseCode: '#6ae4b9', // cyan-cooler
  fgAdded: '#a0e0a0',
  fgRemoved: '#ffbfbf',
  fgChanged: '#efef80',
}

/** The TextMate scopes of each Emacs font-lock face, as modus-themes.el colours them. */
function modusTheme(name: string, type: 'light' | 'dark', p: ModusPalette): ThemeRegistration {
  return {
    name,
    type,
    colors: {
      'editor.background': p.bgDim,
      'editor.foreground': p.fgMain,
    },
    tokenColors: [
      { settings: { foreground: p.fgMain, background: p.bgDim } },
      { scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: p.comment } },
      { scope: ['comment.block.documentation', 'string.quoted.docstring'], settings: { foreground: p.docstring } },
      {
        scope: [
          'keyword',
          'storage.type',
          'storage.modifier',
          'keyword.operator.new',
          'keyword.operator.expression',
          'keyword.operator.word',
        ],
        settings: { foreground: p.keyword },
      },
      // Numbers, operators, punctuation and brackets are fg-main upstream.
      {
        scope: ['keyword.operator', 'punctuation', 'meta.brace', 'constant.numeric', 'keyword.operator.type.annotation'],
        settings: { foreground: p.fgMain },
      },
      { scope: ['entity.name.function'], settings: { foreground: p.fnname } },
      {
        scope: ['meta.function-call entity.name.function', 'meta.function-call support.function'],
        settings: { foreground: p.fnnameCall },
      },
      { scope: ['support.function', 'variable.language', 'support.constant'], settings: { foreground: p.builtin } },
      { scope: ['constant.language', 'constant.other', 'variable.other.constant'], settings: { foreground: p.constant } },
      {
        scope: [
          'entity.name.type',
          'entity.name.class',
          'entity.name.namespace',
          'entity.other.inherited-class',
          'support.class',
          'support.type',
        ],
        settings: { foreground: p.type },
      },
      { scope: ['string', 'punctuation.definition.string', 'string.template'], settings: { foreground: p.string } },
      { scope: ['constant.character.escape'], settings: { foreground: p.rxBackslash } },
      {
        scope: [
          'string.regexp punctuation.definition.group',
          'string.regexp keyword.operator',
          'string.regexp constant.other.character-class',
        ],
        settings: { foreground: p.rxConstruct },
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
        settings: { foreground: p.property },
      },
      // Emacs colours a variable where it is defined, not where it is used.
      { scope: ['variable', 'variable.other'], settings: { foreground: p.fgMain } },
      {
        scope: [
          'variable.parameter',
          'meta.definition.variable variable.other',
          'meta.definition.variable variable.other.constant',
          'meta.definition.variable entity.name',
        ],
        settings: { foreground: p.variable },
      },
      { scope: ['entity.name.tag'], settings: { foreground: p.fnname } },
      { scope: ['meta.preprocessor', 'keyword.control.directive'], settings: { foreground: p.preprocessor } },
      { scope: ['invalid'], settings: { foreground: p.err } },
      { scope: ['markup.heading', 'entity.name.section'], settings: { foreground: p.fgMain, fontStyle: 'bold' } },
      { scope: ['markup.bold'], settings: { fontStyle: 'bold' } },
      { scope: ['markup.italic'], settings: { fontStyle: 'italic' } },
      { scope: ['markup.inline.raw', 'markup.raw'], settings: { foreground: p.fgProseCode } },
      { scope: ['markup.underline.link'], settings: { foreground: p.fgLink } },
      { scope: ['markup.quote'], settings: { foreground: p.docstring } },
      { scope: ['markup.inserted'], settings: { foreground: p.fgAdded } },
      { scope: ['markup.deleted'], settings: { foreground: p.fgRemoved } },
      { scope: ['markup.changed'], settings: { foreground: p.fgChanged } },
    ],
  }
}

export const modusOperandi = modusTheme('modus-operandi', 'light', operandi)
export const modusVivendi = modusTheme('modus-vivendi', 'dark', vivendi)
export const modusOperandiTinted = modusTheme('modus-operandi-tinted', 'light', operandiTinted)
export const modusVivendiTinted = modusTheme('modus-vivendi-tinted', 'dark', vivendiTinted)
