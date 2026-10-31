import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderMermaid } from '../markdown/mermaid'
import { MermaidDiagram } from './MermaidDiagram'

vi.mock('../markdown/mermaid', async (importActual) => ({
  ...(await importActual<typeof import('../markdown/mermaid')>()),
  renderMermaid: vi.fn(),
}))

const renderMermaidMock = vi.mocked(renderMermaid)

describe('MermaidDiagram', () => {
  beforeEach(() => {
    renderMermaidMock.mockReset()
  })

  it('shows the source until the diagram is ready', () => {
    renderMermaidMock.mockReturnValue(new Promise(() => undefined))
    render(<MermaidDiagram source="graph TD; A-->B" />)
    expect(screen.getByText('graph TD; A-->B')).toBeInTheDocument()
    expect(renderMermaidMock).toHaveBeenCalledWith('graph TD; A-->B', 'light', 'commit-mono')
  })

  it("renders again in the new theme's palette when the app theme changes", async () => {
    renderMermaidMock.mockReturnValue(new Promise(() => undefined))
    render(<MermaidDiagram source="graph TD; A-->B" />)
    act(() => {
      document.documentElement.dataset['theme'] = 'tokyo-night-moon'
    })
    await waitFor(() => expect(renderMermaidMock).toHaveBeenLastCalledWith('graph TD; A-->B', 'tokyo-night-moon', 'commit-mono'))
    delete document.documentElement.dataset['theme']
  })

  it('renders again in the new font when the Font setting changes', async () => {
    renderMermaidMock.mockReturnValue(new Promise(() => undefined))
    render(<MermaidDiagram source="graph TD; A-->B" />)
    act(() => {
      document.documentElement.dataset['font'] = 'jetbrains-mono-nl'
    })
    await waitFor(() => expect(renderMermaidMock).toHaveBeenLastCalledWith('graph TD; A-->B', 'light', 'jetbrains-mono-nl'))
    delete document.documentElement.dataset['font']
  })

  it('shows the error in place of a diagram that fails', async () => {
    renderMermaidMock.mockRejectedValue(new Error('Parse error on line 2'))
    render(<MermaidDiagram source="graph TD; A-->" />)
    expect(await screen.findByText('Mermaid diagram error')).toBeInTheDocument()
    expect(screen.getByText('Parse error on line 2')).toBeInTheDocument()
  })

  it('puts the SVG in a shadow root', async () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('style', 'max-width: 120px;')
    renderMermaidMock.mockResolvedValue({ svg, css: 'svg { fill: red; }' })
    const constructed = vi.fn()
    vi.stubGlobal(
      'CSSStyleSheet',
      class {
        replaceSync = constructed
      },
    )
    render(<MermaidDiagram source="graph TD; A-->B" />)
    const host = await screen.findByRole('img', { name: 'Mermaid diagram' })
    const shown = host.shadowRoot?.querySelector('svg')
    expect(shown?.style.maxWidth).toBe('120px')
    expect(constructed).toHaveBeenCalledWith('svg { fill: red; }')
    vi.unstubAllGlobals()
  })
})
