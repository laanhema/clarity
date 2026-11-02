import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseLaunchFilePath } from './launchArgs'

describe('parseLaunchFilePath', () => {
  const cwd = '/workspace/project'

  it('returns null when no arguments are given', () => {
    expect(parseLaunchFilePath([], cwd)).toBeNull()
    expect(parseLaunchFilePath(['clarity'], cwd)).toBeNull()
  })

  it('skips command line flags and options', () => {
    expect(parseLaunchFilePath(['clarity', '--no-sandbox', '--inspect=9229'], cwd)).toBeNull()
    expect(parseLaunchFilePath(['clarity', '-v', '-d'], cwd)).toBeNull()
  })

  it('ignores flags that end with .md or .markdown', () => {
    expect(parseLaunchFilePath(['clarity', '--flag.md'], cwd)).toBeNull()
    expect(parseLaunchFilePath(['clarity', '-custom.markdown'], cwd)).toBeNull()
  })

  it('ignores files without a markdown extension', () => {
    expect(parseLaunchFilePath(['clarity', 'README', 'image.png', 'script.js'], cwd)).toBeNull()
  })

  it('resolves relative markdown paths against cwd', () => {
    expect(parseLaunchFilePath(['clarity', 'notes.md'], cwd)).toBe(path.join(cwd, 'notes.md'))
    expect(parseLaunchFilePath(['clarity', './sub/doc.markdown'], cwd)).toBe(path.join(cwd, 'sub', 'doc.markdown'))
  })

  it('returns absolute markdown paths directly', () => {
    const absolute = '/home/user/documents/notes.md'
    expect(parseLaunchFilePath(['clarity', absolute], cwd)).toBe(absolute)
  })

  it('picks the first markdown file when multiple arguments exist', () => {
    expect(parseLaunchFilePath(['clarity', '--flag', 'first.md', 'second.md'], cwd)).toBe(path.join(cwd, 'first.md'))
  })

  it('supports positional arguments after -- delimiter', () => {
    expect(parseLaunchFilePath(['clarity', '--', '-weird-name.md'], cwd)).toBe(path.join(cwd, '-weird-name.md'))
  })

  it('ignores executable path in argv[0] even if it ends with .md or .markdown', () => {
    expect(parseLaunchFilePath(['clarity.md', 'notes.md'], cwd)).toBe(path.join(cwd, 'notes.md'))
    expect(parseLaunchFilePath(['/usr/local/bin/clarity.markdown'], cwd)).toBeNull()
  })
})
