import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { contentSecurityPolicy } from './config/csp'

const CSP_PLACEHOLDER = '%MDPAD_CSP%'

/** Fills the CSP meta tag in index.html with the policy for the current command. */
function cspPlugin(): Plugin {
  let mode: 'production' | 'development' = 'production'
  return {
    name: 'mdpad-csp',
    configResolved(config) {
      mode = config.command === 'serve' ? 'development' : 'production'
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        if (!html.includes(CSP_PLACEHOLDER)) {
          throw new Error(`index.html is missing the ${CSP_PLACEHOLDER} placeholder`)
        }
        return html.replace(CSP_PLACEHOLDER, contentSecurityPolicy(mode))
      },
    },
  }
}

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    plugins: [react(), cspPlugin()],
    build: {
      // electron-vite leaves the renderer unminified by default.
      minify: true,
      // The CSP allows fonts only from the app itself (font-src 'self'), not as data: URLs.
      assetsInlineLimit: (file) => (/\.(woff2?|ttf|otf)$/.test(file) ? false : undefined),
    },
  },
})
