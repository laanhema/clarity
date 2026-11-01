/**
 * Estimates how many tokens Claude Opus 5.5 would count for a text.
 *
 * Anthropic has not published the tokenizer that Claude Opus 4.7 and later
 * use, so Clarity cannot count exactly offline. Instead it counts a few text
 * features in one pass and weighs them with coefficients fitted against real
 * Opus 5.5 counts (see TOKEN_WEIGHTS for how and how well).
 */

export interface TokenFeatures {
  /** Runs of letters (any script except CJK). */
  words: number
  /** Letters past the first WORD_HEAD of each run: long words split into more tokens. */
  wordExcess: number
  /** Lower-to-upper case changes inside a run, as in camelCase identifiers. */
  caseBreaks: number
  /** Runs that start with an ASCII capital letter. */
  capitalWords: number
  /**
   * The letters ä, ö and å. They mark Finnish text, whose words the tokenizer
   * splits into more pieces than English ones of the same length.
   */
  finnishLetters: number
  /** Han, kana and hangul characters. */
  cjk: number
  digits: number
  /** Runs of digits: each number costs a token or more of its own. */
  numbers: number
  /** ASCII punctuation and symbols, Markdown syntax included. */
  punctuation: number
  /** Runs of ASCII punctuation, such as `**`, `](` or `|---|`: a run often merges into few tokens. */
  punctuationRuns: number
  /** Runs of two or more spaces, or tabs: indentation and alignment. */
  indentRuns: number
  /** Other non-ASCII characters: emoji, arrows, dashes, box drawing. */
  symbols: number
}

export type TokenFeature = keyof TokenFeatures

/** Letters of a word that usually fit in its first token. */
export const WORD_HEAD = 3

/**
 * Tokens per feature, fitted by non-negative least squares on relative error
 * against Claude Opus 5.5 input-token counts. The counts were measured on
 * 2026-10-31 through the Claude Code CLI: the input tokens of one request
 * with the sample text, minus those of the same request with one character.
 * Repeated runs agreed within 2 tokens, and a doubled text counted double.
 *
 * Calibration texts: 54 samples (351k characters) of AGENTS.md, CLAUDE.md
 * and SKILL.md files, READMEs, design docs, a PRD, a changelog, TypeScript,
 * CSS, JSON, Finnish docs and a small CJK and emoji sample, plus four
 * synthetic probes (numbers, decimals, table separator rows, short words).
 *
 * Expected error, measured on 19 samples held out of a fit on the rest: mean
 * 3.8%, worst 8.9%. On five more texts that no fit saw (tokenEstimate.fixtures.ts)
 * it was within ±6%, except a Markdown table full of numbers at −12%. For
 * comparison, one characters-per-token ratio misses by 15% on average and by
 * up to 28%. The weights below are refitted on all samples.
 *
 * Limits: `finnishLetters` stands for Finnish vocabulary, not for the letters
 * themselves (swapping ä/ö for a/o in a Finnish sample saved only 0.3 tokens
 * per letter). Other languages, and CJK or emoji-heavy text, rest on little
 * or no data; expect larger errors there.
 */
export const TOKEN_WEIGHTS: Record<TokenFeature, number> = {
  words: 1.057,
  wordExcess: 0.29,
  caseBreaks: 1.087,
  capitalWords: 0.911,
  finnishLetters: 5.203,
  cjk: 1.386,
  digits: 0.589,
  numbers: 0.546,
  punctuation: 0.371,
  punctuationRuns: 0.731,
  indentRuns: 1.689,
  symbols: 0.761,
}

/** The typical and the worst error seen on texts outside the fit, for the tooltip. */
export const TOKEN_ESTIMATE_ERROR = { typical: 0.06, worst: 0.12 }

export function emptyFeatures(): TokenFeatures {
  return {
    words: 0,
    wordExcess: 0,
    caseBreaks: 0,
    capitalWords: 0,
    finnishLetters: 0,
    cjk: 0,
    digits: 0,
    numbers: 0,
    punctuation: 0,
    punctuationRuns: 0,
    indentRuns: 0,
    symbols: 0,
  }
}

// ä ö å Ä Ö Å
const FINNISH_LETTERS = new Set([0xe4, 0xf6, 0xe5, 0xc4, 0xd6, 0xc5])

const LETTER = /[\p{L}\p{M}]/u

function isAsciiLetter(code: number): boolean {
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122)
}

function isDigit(code: number): boolean {
  return code >= 48 && code <= 57
}

/** ASCII printable characters other than letters, digits and space. */
function isPunctuation(code: number): boolean {
  return code > 32 && code < 127 && !isDigit(code) && !isAsciiLetter(code)
}

function isUpper(code: number): boolean {
  return code >= 65 && code <= 90
}

function isCjk(code: number): boolean {
  return (
    (code >= 0x3040 && code <= 0x30ff) || // hiragana, katakana
    (code >= 0x3400 && code <= 0x4dbf) || // CJK extension A
    (code >= 0x4e00 && code <= 0x9fff) || // CJK unified ideographs
    (code >= 0xac00 && code <= 0xd7af) || // hangul syllables
    (code >= 0xf900 && code <= 0xfaff) || // CJK compatibility ideographs
    (code >= 0x20000 && code <= 0x3134f) // CJK extensions B–G
  )
}

function isOtherLetter(code: number): boolean {
  return code > 127 && !isCjk(code) && LETTER.test(String.fromCodePoint(code))
}

/**
 * Adds the features of `text` to `into`. Splitting a text at line breaks and
 * adding the parts gives the same result as scanning it whole.
 */
export function addTokenFeatures(into: TokenFeatures, text: string, wordHead = WORD_HEAD): TokenFeatures {
  const length = text.length
  let i = 0
  while (i < length) {
    const code = text.codePointAt(i) ?? 0
    const width = code > 0xffff ? 2 : 1
    if (isAsciiLetter(code) || isOtherLetter(code)) {
      into.words++
      if (isUpper(code)) into.capitalWords++
      let letters = 0
      let previousLower = false
      while (i < length) {
        const c = text.codePointAt(i) ?? 0
        if (isAsciiLetter(c)) {
          if (previousLower && isUpper(c)) into.caseBreaks++
          previousLower = !isUpper(c)
        } else if (isOtherLetter(c)) {
          if (FINNISH_LETTERS.has(c)) into.finnishLetters++
          previousLower = false
        } else {
          break
        }
        letters++
        i += c > 0xffff ? 2 : 1
      }
      into.wordExcess += Math.max(0, letters - wordHead)
      continue
    }
    if (code > 127) {
      if (isCjk(code)) into.cjk++
      else into.symbols++
    } else if (isDigit(code)) {
      into.digits++
      if (!isDigit(text.charCodeAt(i - 1))) into.numbers++
    } else if (code === 9) {
      into.indentRuns++
    } else if (code === 32) {
      if (text.charCodeAt(i + 1) === 32) {
        into.indentRuns++
        while (text.charCodeAt(i + 1) === 32) i++
      }
    } else if (code > 32) {
      into.punctuation++
      if (!isPunctuation(text.charCodeAt(i - 1))) into.punctuationRuns++
    }
    i += width
  }
  return into
}

export function tokenFeatures(text: string, wordHead = WORD_HEAD): TokenFeatures {
  return addTokenFeatures(emptyFeatures(), text, wordHead)
}

/** The weighted feature sum, rounded. */
export function tokensFromFeatures(features: TokenFeatures, weights: Record<TokenFeature, number> = TOKEN_WEIGHTS): number {
  let sum = 0
  for (const name of Object.keys(features) as TokenFeature[]) sum += features[name] * weights[name]
  return Math.round(sum)
}

export function estimateTokens(text: string): number {
  return tokensFromFeatures(tokenFeatures(text))
}

/**
 * Cuts `text` after line breaks into slices of at least `size` characters
 * (the last may be shorter), so a long text can be scanned a slice at a time.
 */
export function* lineSlices(text: string, size: number): Generator<string> {
  let start = 0
  while (start < text.length) {
    const lineEnd = text.indexOf('\n', start + size - 1)
    const end = lineEnd === -1 ? text.length : lineEnd + 1
    yield text.slice(start, end)
    start = end
  }
}

/** A short form for the status bar: 850, 3.2k, 32k, 1.2M. */
export function formatTokenCount(tokens: number): string {
  if (tokens < 1000) return String(tokens)
  if (tokens < 10_000) return `${trimZero((tokens / 1000).toFixed(1))}k`
  if (tokens < 999_500) return `${Math.round(tokens / 1000)}k`
  return `${trimZero((tokens / 1_000_000).toFixed(1))}M`
}

function trimZero(value: string): string {
  return value.endsWith('.0') ? value.slice(0, -2) : value
}
