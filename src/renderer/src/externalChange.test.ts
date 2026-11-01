import { describe, expect, it } from 'vitest'
import { decideExternalChange } from './externalChange'

describe('decideExternalChange', () => {
  it('ignores a change that brings nothing new, such as Clarity’s own save', () => {
    expect(decideExternalChange({ content: 'a', savedContent: 'a' }, 'a')).toBe('ignore')
    expect(decideExternalChange({ content: 'a b', savedContent: 'a' }, 'a')).toBe('ignore')
  })

  it('reloads silently when there are no unsaved edits', () => {
    expect(decideExternalChange({ content: 'old', savedContent: 'old' }, 'new')).toBe('reload')
  })

  it('asks when there are unsaved edits', () => {
    expect(decideExternalChange({ content: 'mine', savedContent: 'old' }, 'theirs')).toBe('ask')
  })

  it('marks the document saved when the disk now matches the editor', () => {
    expect(decideExternalChange({ content: 'same', savedContent: 'old' }, 'same')).toBe('mark-saved')
  })

  it('reports a deleted file once', () => {
    expect(decideExternalChange({ content: 'a', savedContent: 'a' }, null)).toBe('missing')
    expect(decideExternalChange({ content: 'a', savedContent: null }, null)).toBe('ignore')
  })

  it('asks when a deleted file comes back with different content', () => {
    expect(decideExternalChange({ content: 'a', savedContent: null }, 'b')).toBe('ask')
    expect(decideExternalChange({ content: 'a', savedContent: null }, 'a')).toBe('mark-saved')
  })
})
