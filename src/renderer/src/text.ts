const wordSegmenter = new Intl.Segmenter(undefined, { granularity: 'word' })

/** Counts words the way a reader would: punctuation and Markdown symbols are not words. */
export function countWords(text: string): number {
  let count = 0
  for (const segment of wordSegmenter.segment(text)) {
    if (segment.isWordLike) count++
  }
  return count
}

/** The last segment of a path, for either separator style. */
export function fileName(filePath: string): string {
  const parts = filePath.split(/[\\/]/).filter(Boolean)
  return parts.at(-1) ?? filePath
}

/** Electron prefixes errors thrown in the main process; the user only needs the message. */
export function errorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error)
  return raw.replace(/^Error invoking remote method '[^']+': (?:\w*Error: )?/, '')
}
