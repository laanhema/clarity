import { describe, expect, it } from 'vitest'
import { isSafeExternalUrl } from './externalUrl'

describe('isSafeExternalUrl', () => {
  it('allows http and https links', () => {
    expect(isSafeExternalUrl('https://example.com/page')).toBe(true)
    expect(isSafeExternalUrl('http://example.com')).toBe(true)
  })

  it('rejects other schemes and junk', () => {
    expect(isSafeExternalUrl('file:///etc/passwd')).toBe(false)
    expect(isSafeExternalUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeExternalUrl('smb://host/share')).toBe(false)
    expect(isSafeExternalUrl('not a url')).toBe(false)
  })
})
