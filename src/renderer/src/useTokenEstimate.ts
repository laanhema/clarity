import { useEffect, useState } from 'react'
import { addTokenFeatures, emptyFeatures, estimateTokens, lineSlices, tokensFromFeatures } from './tokenEstimate'

/** How long typing must pause before the estimate updates. */
export const TOKEN_ESTIMATE_DELAY_MS = 300
/** About 1 ms of scanning; the renderer gets a turn between slices. */
const SLICE_SIZE = 64 * 1024

/**
 * The estimated Claude Opus 5.5 token count of `text`. A new estimate runs
 * once typing pauses, a slice at a time, and starts over when the text
 * changes again; until it finishes, the previous count stays.
 */
export function useTokenEstimate(text: string): number {
  const [tokens, setTokens] = useState(() => estimateTokens(text))

  useEffect(() => {
    let timer = setTimeout(() => {
      const features = emptyFeatures()
      const slices = lineSlices(text, SLICE_SIZE)
      const step = (): void => {
        const next = slices.next()
        if (next.done) {
          setTokens(tokensFromFeatures(features))
          return
        }
        addTokenFeatures(features, next.value)
        timer = setTimeout(step, 0)
      }
      step()
    }, TOKEN_ESTIMATE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [text])

  return tokens
}
