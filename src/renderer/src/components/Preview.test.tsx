import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Preview, type PreviewProps } from './Preview'

function props(markdown: string, documentKey: number, hidden = false): PreviewProps {
  return { markdown, documentKey, documentPath: null, folderPath: null, hidden, onOpenDocument: () => undefined }
}

// Showing the previous document until the new one rendered made the preview
// jump on open: scroll sync first lined up the old text with the new file.
describe('Preview when another document opens', () => {
  it('never shows the previous document while the new one renders', async () => {
    const { rerender } = render(<Preview {...props('# First', 1)} />)
    expect(await screen.findByRole('heading', { name: 'First' })).toBeInTheDocument()

    rerender(<Preview {...props('# Second', 2)} />)
    expect(screen.queryByRole('heading', { name: 'First' })).not.toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Second' })).toBeInTheDocument()
  })

  it('never shows the previous document when it is shown again after being hidden', async () => {
    const { rerender } = render(<Preview {...props('# First', 1)} />)
    expect(await screen.findByRole('heading', { name: 'First' })).toBeInTheDocument()

    // Editor-only view: another document opens while the hidden preview renders nothing.
    rerender(<Preview {...props('# Second', 2, true)} />)
    rerender(<Preview {...props('# Second', 2)} />)
    expect(screen.queryByRole('heading', { name: 'First' })).not.toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Second' })).toBeInTheDocument()
  })

  it('keeps showing the document while an edit waits to render', async () => {
    const { rerender } = render(<Preview {...props('# First', 1)} />)
    expect(await screen.findByRole('heading', { name: 'First' })).toBeInTheDocument()

    rerender(<Preview {...props('# First edited', 1)} />)
    expect(screen.getByRole('heading', { name: 'First' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'First edited' })).toBeInTheDocument()
  })
})
