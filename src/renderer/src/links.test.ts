import { describe, expect, it } from 'vitest'
import { routeLink } from './links'

const doc = '/notes/guides/setup.md'
const root = '/notes'
const route = (href: string | null) => routeLink(href, doc, root)

describe('routeLink', () => {
  it('opens web links in the browser', () => {
    expect(route('https://example.com/a?b#c')).toEqual({ kind: 'external', url: 'https://example.com/a?b#c' })
    expect(route('HTTP://Example.com')).toEqual({ kind: 'external', url: 'http://example.com/' })
  })

  it('ignores other schemes', () => {
    for (const href of ['javascript:alert(1)', 'file:///etc/passwd', 'mailto:a@b.c', 'data:text/html,x', 'mdpad:x', 'ftp://x']) {
      expect(route(href)).toEqual({ kind: 'ignore' })
    }
  })

  it('scrolls to in-page anchors', () => {
    expect(route('#install')).toEqual({ kind: 'anchor', id: 'install' })
    expect(route('#caf%C3%A9')).toEqual({ kind: 'anchor', id: 'café' })
    expect(route('#')).toEqual({ kind: 'ignore' })
  })

  it('opens relative Markdown links inside the folder', () => {
    expect(route('other.md')).toEqual({ kind: 'document', path: '/notes/guides/other.md' })
    expect(route('./deep/file.markdown#part')).toEqual({ kind: 'document', path: '/notes/guides/deep/file.markdown' })
    expect(route('../readme.md')).toEqual({ kind: 'document', path: '/notes/readme.md' })
    expect(route('/top.md')).toEqual({ kind: 'document', path: '/notes/top.md' })
    expect(route('my%20notes.MD?x=1')).toEqual({ kind: 'document', path: '/notes/guides/my notes.MD' })
  })

  it('ignores links that leave the folder', () => {
    expect(route('../../etc/secret.md')).toEqual({ kind: 'ignore' })
    expect(route('../../../../../../x.md')).toEqual({ kind: 'ignore' })
    expect(routeLink('../notes-other/x.md', '/notes/a.md', '/notes')).toEqual({ kind: 'ignore' })
    expect(route('//host/share/x.md')).toEqual({ kind: 'ignore' })
    expect(route('..\\..\\x.md')).toEqual({ kind: 'ignore' })
  })

  it('ignores relative links to other file types', () => {
    expect(route('script.sh')).toEqual({ kind: 'ignore' })
    expect(route('image.png')).toEqual({ kind: 'ignore' })
    expect(route('folder/')).toEqual({ kind: 'ignore' })
  })

  it('ignores relative links without an open folder or saved document', () => {
    expect(routeLink('other.md', doc, null)).toEqual({ kind: 'ignore' })
    expect(routeLink('other.md', null, root)).toEqual({ kind: 'ignore' })
    expect(routeLink('https://example.com', null, null)).toEqual({ kind: 'external', url: 'https://example.com/' })
  })

  it('ignores empty and malformed links', () => {
    expect(route(null)).toEqual({ kind: 'ignore' })
    expect(route('')).toEqual({ kind: 'ignore' })
    expect(route('%E0%A4%A.md')).toEqual({ kind: 'ignore' })
  })

  it('handles Windows paths', () => {
    expect(routeLink('../b.md', 'C:\\notes\\sub\\a.md', 'C:\\notes')).toEqual({ kind: 'document', path: 'C:\\notes\\b.md' })
    expect(routeLink('../../b.md', 'C:\\notes\\sub\\a.md', 'C:\\notes')).toEqual({ kind: 'ignore' })
  })
})
