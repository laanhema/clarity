import { describe, expect, it } from 'vitest'
import { countWords, errorMessage, fileName } from './text'

describe('countWords', () => {
  it('counts words and ignores Markdown symbols', () => {
    expect(countWords('')).toBe(0)
    expect(countWords('   \n ')).toBe(0)
    expect(countWords('# Hello, world!')).toBe(2)
    expect(countWords('- one\n- two\n\n**three**')).toBe(3)
  })
})

describe('fileName', () => {
  it('takes the last path segment for either separator', () => {
    expect(fileName('/home/me/notes/today.md')).toBe('today.md')
    expect(fileName('C:\\Users\\me\\today.md')).toBe('today.md')
    expect(fileName('/home/me/notes/')).toBe('notes')
  })
})

describe('errorMessage', () => {
  it('strips the Electron IPC prefix', () => {
    const error = new Error("Error invoking remote method 'mdpad:read-file': PathAccessError: Path is outside the open folder")
    expect(errorMessage(error)).toBe('Path is outside the open folder')
  })

  it('keeps other messages as they are', () => {
    expect(errorMessage(new Error('Disk full'))).toBe('Disk full')
    expect(errorMessage('plain')).toBe('plain')
  })
})
