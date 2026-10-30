/**
 * Content-Security-Policy for the renderer.
 *
 * The production policy allows only the app's own bundled scripts and styles.
 * The dev server additionally needs inline scripts and styles (React Fast
 * Refresh preamble, Vite's injected CSS) and a websocket for hot reload.
 */
const productionDirectives: Record<string, string[]> = {
  'default-src': ["'none'"],
  'script-src': ["'self'"],
  'style-src': ["'self'"],
  'img-src': ["'self'", 'data:'],
  'font-src': ["'self'"],
  'connect-src': ["'self'"],
  'object-src': ["'none'"],
  'base-uri': ["'none'"],
  'form-action': ["'none'"],
  'frame-src': ["'none'"],
  'worker-src': ["'none'"],
}

const devAdditions: Record<string, string[]> = {
  'script-src': ["'unsafe-inline'"],
  'style-src': ["'unsafe-inline'"],
  'connect-src': ['ws://localhost:*', 'ws://127.0.0.1:*'],
}

function serialize(directives: Record<string, string[]>): string {
  return Object.entries(directives)
    .map(([name, sources]) => `${name} ${sources.join(' ')}`)
    .join('; ')
}

export function contentSecurityPolicy(mode: 'production' | 'development'): string {
  if (mode === 'production') return serialize(productionDirectives)
  const merged: Record<string, string[]> = {}
  for (const [name, sources] of Object.entries(productionDirectives)) {
    merged[name] = [...sources, ...(devAdditions[name] ?? [])]
  }
  return serialize(merged)
}
