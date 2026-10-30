import { describe, expect, it } from 'vitest'
import { contentSecurityPolicy } from './csp'

describe('contentSecurityPolicy', () => {
  it('allows no inline code or remote origins in production', () => {
    const policy = contentSecurityPolicy('production')
    expect(policy).toContain("default-src 'none'")
    expect(policy).toContain("script-src 'self'")
    expect(policy).toContain("object-src 'none'")
    expect(policy).not.toContain('unsafe-inline')
    expect(policy).not.toContain('unsafe-eval')
    expect(policy).not.toMatch(/https?:/)
  })

  it('relaxes only what the dev server needs', () => {
    const policy = contentSecurityPolicy('development')
    expect(policy).toContain("script-src 'self' 'unsafe-inline'")
    expect(policy).toContain('ws://localhost:*')
    expect(policy).not.toContain('unsafe-eval')
  })
})
