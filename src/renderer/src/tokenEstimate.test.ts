import { describe, expect, it } from 'vitest'
import {
  addTokenFeatures,
  emptyFeatures,
  estimateTokens,
  formatTokenCount,
  lineSlices,
  TOKEN_ESTIMATE_ERROR,
  tokenFeatures,
} from './tokenEstimate'
import { TOKEN_FIXTURES } from './tokenEstimate.fixtures'

describe('tokenFeatures', () => {
  it('counts words, case changes, numbers, punctuation and indentation', () => {
    expect(tokenFeatures('Read the openFolder docs (v12.3).\n    - done\tok')).toEqual({
      ...emptyFeatures(),
      words: 7, // Read the openFolder docs v done ok
      wordExcess: 1 + 7 + 1 + 1, // Read, openFolder, docs, done past 3 letters
      caseBreaks: 1, // openFolder
      capitalWords: 1, // Read
      digits: 3,
      numbers: 2, // 12 and 3
      punctuation: 5, // ( . ) . -
      punctuationRuns: 4, // ( . ). -
      indentRuns: 2, // four spaces, one tab
    })
  })

  it('treats Finnish letters as part of words and CJK and emoji separately', () => {
    expect(tokenFeatures('Käyttö öljy 使用 🚀 →')).toEqual({
      ...emptyFeatures(),
      words: 2,
      wordExcess: 3 + 1,
      capitalWords: 1,
      finnishLetters: 3,
      cjk: 2,
      symbols: 2,
    })
  })

  it('counts other accented letters as plain letters', () => {
    expect(tokenFeatures('café')).toEqual({ ...emptyFeatures(), words: 1, wordExcess: 1 })
  })
})

describe('estimateTokens', () => {
  it('is zero for empty or blank text', () => {
    expect(estimateTokens('')).toBe(0)
    expect(estimateTokens(' \n\n ')).toBe(0)
  })

  it('grows with the text', () => {
    const text = TOKEN_FIXTURES[0]?.text ?? ''
    expect(estimateTokens(text + text)).toBeGreaterThan(estimateTokens(text))
  })

  // Each fixture's Claude Opus 5.5 count was measured; none was used to fit the weights.
  for (const fixture of TOKEN_FIXTURES) {
    it(`stays within ±${TOKEN_ESTIMATE_ERROR.worst * 100}% of Opus 5.5 for: ${fixture.name}`, () => {
      const error = Math.abs(estimateTokens(fixture.text) - fixture.opusTokens) / fixture.opusTokens
      expect(error).toBeLessThanOrEqual(TOKEN_ESTIMATE_ERROR.worst)
    })
  }

  it(`is within ±${TOKEN_ESTIMATE_ERROR.typical * 100}% of Opus 5.5 on average over the fixtures`, () => {
    const errors = TOKEN_FIXTURES.map((f) => Math.abs(estimateTokens(f.text) - f.opusTokens) / f.opusTokens)
    const mean = errors.reduce((sum, e) => sum + e, 0) / errors.length
    expect(mean).toBeLessThanOrEqual(TOKEN_ESTIMATE_ERROR.typical)
  })
})

describe('lineSlices', () => {
  const text = TOKEN_FIXTURES.map((f) => f.text).join('\r\n  \n') + 'no final newline ä 12'

  it('cuts after line breaks and keeps every character', () => {
    for (const size of [1, 7, 64, 10_000]) {
      const slices = [...lineSlices(text, size)]
      expect(slices.join('')).toBe(text)
      for (const slice of slices.slice(0, -1)) expect(slice.endsWith('\n')).toBe(true)
    }
    expect([...lineSlices('', 64)]).toEqual([])
  })

  it('gives the same features slice by slice as for the whole text', () => {
    for (const size of [1, 7, 64]) {
      const features = emptyFeatures()
      for (const slice of lineSlices(text, size)) addTokenFeatures(features, slice)
      expect(features).toEqual(tokenFeatures(text))
    }
  })
})

describe('formatTokenCount', () => {
  it('shortens large counts', () => {
    expect(formatTokenCount(0)).toBe('0')
    expect(formatTokenCount(999)).toBe('999')
    expect(formatTokenCount(1000)).toBe('1k')
    expect(formatTokenCount(3249)).toBe('3.2k')
    expect(formatTokenCount(9960)).toBe('10k')
    expect(formatTokenCount(32_400)).toBe('32k')
    expect(formatTokenCount(999_499)).toBe('999k')
    expect(formatTokenCount(999_500)).toBe('1M')
    expect(formatTokenCount(1_250_000)).toBe('1.3M')
  })
})
