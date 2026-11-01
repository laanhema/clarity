import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// The two fonts View → Font offers. The weights match what styles.css uses: text, headings (600) and bold.
import '@fontsource/commit-mono/400.css'
import '@fontsource/commit-mono/400-italic.css'
import '@fontsource/commit-mono/600.css'
import '@fontsource/commit-mono/700.css'
import '@fontsource/commit-mono/700-italic.css'
import './assets/fonts/jetbrains-mono-nl/jetbrains-mono-nl.css'
import { App } from './App'
import './styles.css'

// Apply the theme before the first render, so the window does not open in another theme's colours.
document.documentElement.dataset['theme'] = window.clarity.initialTheme

const container = document.getElementById('root')
if (!container) throw new Error('Missing #root element')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
