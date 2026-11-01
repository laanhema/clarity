export interface DocumentSnapshot {
  content: string
  /** The content as Clarity last saw it on disk; null when the file is gone. */
  savedContent: string | null
}

/**
 * What to do when the watched file changed on disk.
 * - `ignore`: the disk holds what Clarity already knows, for example after Clarity's own save.
 * - `mark-saved`: the disk now holds exactly what the editor holds.
 * - `reload`: no unsaved edits, so take the new content silently.
 * - `ask`: there are unsaved edits; the user picks between reloading and keeping theirs.
 * - `missing`: the file was deleted or moved away.
 */
export type ExternalChangeAction = 'ignore' | 'mark-saved' | 'reload' | 'ask' | 'missing'

/** `diskContent` is null when the file could not be read. */
export function decideExternalChange(document: DocumentSnapshot, diskContent: string | null): ExternalChangeAction {
  if (diskContent === null) return document.savedContent === null ? 'ignore' : 'missing'
  if (diskContent === document.savedContent) return 'ignore'
  if (diskContent === document.content) return 'mark-saved'
  if (document.content === document.savedContent) return 'reload'
  return 'ask'
}
