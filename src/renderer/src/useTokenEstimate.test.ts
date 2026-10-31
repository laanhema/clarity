import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { estimateTokens } from './tokenEstimate'
import { TOKEN_ESTIMATE_DELAY_MS, useTokenEstimate } from './useTokenEstimate'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useTokenEstimate', () => {
  it('estimates the first text at once', () => {
    const { result } = renderHook(() => useTokenEstimate('# Hello, world'))
    expect(result.current).toBe(estimateTokens('# Hello, world'))
  })

  it('updates only once typing has paused', () => {
    const { result, rerender } = renderHook(({ text }) => useTokenEstimate(text), { initialProps: { text: '' } })
    rerender({ text: 'Some words' })
    act(() => {
      vi.advanceTimersByTime(TOKEN_ESTIMATE_DELAY_MS - 50)
    })
    rerender({ text: 'Some words typed in' })
    act(() => {
      vi.advanceTimersByTime(TOKEN_ESTIMATE_DELAY_MS - 50)
    })
    expect(result.current).toBe(0)
    act(() => {
      vi.runAllTimers()
    })
    expect(result.current).toBe(estimateTokens('Some words typed in'))
  })

  it('scans a long text in slices to the same result', () => {
    const { result, rerender } = renderHook(({ text }) => useTokenEstimate(text), { initialProps: { text: '' } })
    const long = '- item with `code` and 42 numbers, plus Käyttö\n'.repeat(5000)
    rerender({ text: long })
    act(() => {
      vi.advanceTimersByTime(TOKEN_ESTIMATE_DELAY_MS)
    })
    // The first slice has run; the rest wait for later turns.
    expect(result.current).toBe(0)
    act(() => {
      vi.runAllTimers()
    })
    expect(result.current).toBe(estimateTokens(long))
  })
})
