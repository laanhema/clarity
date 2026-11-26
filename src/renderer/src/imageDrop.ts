/**
 * Encodes a relative path for a Markdown link destination. Each segment is
 * percent-encoded, parentheses too, so spaces, brackets, `#`, `?` and
 * non-ASCII names survive Markdown parsing; the main process decodes the path
 * again when the preview loads the image.
 */
export function encodeImagePath(relativePath: string): string {
  return relativePath
    .split('/')
    .map((segment) => encodeURIComponent(segment).replace(/[()]/g, (char) => (char === '(' ? '%28' : '%29')))
    .join('/')
}

/** The Markdown image reference for a dropped image: its file name without the extension is the alt text. */
export function markdownImage(relativePath: string): string {
  const name = relativePath.slice(relativePath.lastIndexOf('/') + 1)
  const dot = name.lastIndexOf('.')
  const stem = dot > 0 ? name.slice(0, dot) : name
  const alt = stem.replace(/[\\[\]]/g, (char) => `\\${char}`)
  return `![${alt}](${encodeImagePath(relativePath)})`
}
