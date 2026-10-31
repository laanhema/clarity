import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatusBar, type StatusBarProps } from './StatusBar'

const props: StatusBarProps = {
  path: '/notes/AGENTS.md',
  dirty: false,
  wordCount: 1200,
  tokenCount: 3249,
  message: null,
  theme: 'system',
  onCycleTheme: () => undefined,
}

describe('StatusBar token estimate', () => {
  it('shows a short approximate count with the exact estimate and method in its tooltip', () => {
    render(<StatusBar {...props} />)
    const count = screen.getByText('≈3.2k tokens')
    const tooltip = screen.getByRole('tooltip')
    expect(count.parentElement).toHaveAccessibleDescription(expect.stringContaining('≈3,249 tokens for Claude Opus 5.5'))
    expect(tooltip).toHaveTextContent('Estimated offline')
    expect(tooltip).toHaveTextContent('Usually within ±6%, up to about ±12%')
  })

  it('shows an empty text as exactly zero', () => {
    render(<StatusBar {...props} tokenCount={0} />)
    expect(screen.getByText('0 tokens')).toBeInTheDocument()
  })
})
