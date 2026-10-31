import type { Code, Construct, Effects, State, TokenizeContext } from 'micromark-util-types'
import type { Processor } from 'unified'
// The token types of micromark-extension-math (mathText, mathTextSequence, mathTextData).
import type {} from 'micromark-extension-math'

/**
 * Single-dollar inline math (`$x$`) with Pandoc's `tex_math_dollars` rule,
 * so dollars in ordinary prose stay text:
 *
 * - the opening `$` must have a non-space character right after it,
 * - the formula ends at the next `$`, which must have a non-space character
 *   right before it and no digit right after it; otherwise there is no
 *   formula (so `$5 and $10` and `$HOME and $PATH` are text),
 * - a backslash escapes the next character, so `\$` does not end it.
 *
 * On top of that, code spans win over math, as CommonMark has code spans win
 * over every other inline construct: a formula cannot contain a code span, so
 * a `$` inside `` `$VAR` `` never closes one that opened earlier.
 *
 * It emits the same tokens as micromark-extension-math, so remark-math's
 * mdast handling turns it into `inlineMath`. `$$x$$` is left to remark-math.
 */

const DOLLAR = 36
const BACKSLASH = 92
const GRAVE = 96
const SPACE = 32

/** micromark codes: line endings are -5 to -3, tab and virtual space -2 and -1. */
const isLineEnding = (code: Code) => code !== null && code < -2
const isWhitespace = (code: Code) => code !== null && (code < 0 || code === SPACE)
const isDigit = (code: Code) => code !== null && code >= 48 && code <= 57

function tokenizeDollarMath(this: TokenizeContext, effects: Effects, ok: State, nok: State): State {
  /** The character before the current one inside the formula. */
  let previous: Code = DOLLAR

  const consume = (code: Code) => {
    effects.consume(code)
    previous = code
  }

  const start: State = (code) => {
    effects.enter('mathText')
    effects.enter('mathTextSequence')
    effects.consume(code)
    effects.exit('mathTextSequence')
    return afterOpen
  }

  const afterOpen: State = (code) => {
    if (code === null || code === DOLLAR || isWhitespace(code)) return nok(code)
    effects.enter('mathTextData')
    return inside(code)
  }

  const inside: State = (code) => {
    if (code === null) return nok(code)
    if (isLineEnding(code)) {
      effects.exit('mathTextData')
      effects.enter('lineEnding')
      consume(code)
      effects.exit('lineEnding')
      return afterLineEnding
    }
    // The first `$` ends the formula; one with a space before it ends the attempt.
    if (code === DOLLAR) return isWhitespace(previous) ? nok(code) : close(code)
    if (code === GRAVE) return effects.check(codeSpan, nok, backticks)(code)
    consume(code)
    return code === BACKSLASH ? afterBackslash : inside
  }

  const afterLineEnding: State = (code) => {
    if (code === null) return nok(code)
    effects.enter('mathTextData')
    return inside(code)
  }

  /** A backslash escapes the next character, so `\$` does not close the formula. */
  const afterBackslash: State = (code) => {
    if (code === null || isLineEnding(code)) return inside(code)
    consume(code)
    return inside
  }

  /** A backtick run that opens no code span is plain formula text. */
  const backticks: State = (code) => {
    if (code !== GRAVE) return inside(code)
    consume(code)
    return backticks
  }

  const close: State = (code) => {
    effects.exit('mathTextData')
    effects.enter('mathTextSequence')
    effects.consume(code)
    effects.exit('mathTextSequence')
    return afterClose
  }

  const afterClose: State = (code) => {
    if (isDigit(code)) return nok(code)
    effects.exit('mathText')
    return ok(code)
  }

  return start
}

/** Lookahead: this backtick run opens a code span, as a run of the same length follows. */
function tokenizeCodeSpan(effects: Effects, ok: State, nok: State): State {
  let size = 0
  let closing = 0

  const open: State = (code) => {
    if (code === GRAVE) {
      effects.consume(code)
      size++
      return open
    }
    effects.exit('codeTextSequence')
    return between(code)
  }

  const between: State = (code) => {
    if (code === null) return nok(code)
    if (code === GRAVE) {
      closing = 0
      effects.enter('codeTextSequence')
      return close(code)
    }
    if (isLineEnding(code)) {
      effects.enter('lineEnding')
      effects.consume(code)
      effects.exit('lineEnding')
      return between
    }
    effects.enter('codeTextData')
    return data(code)
  }

  const data: State = (code) => {
    if (code === null || code === GRAVE || isLineEnding(code)) {
      effects.exit('codeTextData')
      return between(code)
    }
    effects.consume(code)
    return data
  }

  const close: State = (code) => {
    if (code === GRAVE) {
      effects.consume(code)
      closing++
      return close
    }
    effects.exit('codeTextSequence')
    return closing === size ? ok(code) : between(code)
  }

  return (code) => {
    effects.enter('codeTextSequence')
    return open(code)
  }
}

const codeSpan: Construct = { tokenize: tokenizeCodeSpan, partial: true }

const dollarMath: Construct = {
  name: 'dollarMath',
  tokenize: tokenizeDollarMath,
  // A `$` right after another `$` cannot open, unless that one was escaped.
  previous(this: TokenizeContext, code: Code) {
    return code !== DOLLAR || this.events[this.events.length - 1]?.[1].type === 'characterEscape'
  },
}

/**
 * Adds single-dollar math to the parser. Use with
 * `remarkMath({ singleDollarTextMath: false })`, which keeps `$$` math.
 */
export function remarkDollarMath(this: Processor): void {
  const data = this.data()
  ;(data.micromarkExtensions ??= []).push({ text: { [DOLLAR]: dollarMath } })
}
