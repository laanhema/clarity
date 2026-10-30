import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter/wght.css'
import '@fontsource-variable/inter/wght-italic.css'
import '@fontsource-variable/jetbrains-mono/wght.css'
import '@fontsource-variable/jetbrains-mono/wght-italic.css'
import { App } from './App'
import './styles.css'

// Apply the theme before the first render, so the window does not open in another theme's colours.
document.documentElement.dataset['theme'] = window.mdpad.initialTheme

const container = document.getElementById('root')
if (!container) throw new Error('Missing #root element')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
