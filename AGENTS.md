# Lantern

## Project Overview

Lantern is a desktop Markdown reader and editor (Electron + React + TypeScript): folder sidebar, CodeMirror editor, live preview, status bar. It renders untrusted documents, so security boundaries matter more than in a typical app. User-facing behaviour is documented in `README.md`; keep it in sync when behaviour changes. The app was renamed from mdpad; `src/main/settings.ts` migrates the old settings folder on purpose.

## Commands

```sh
npm install          # also downloads the Electron binary (scripts/install-electron.mjs postinstall)
npm run dev          # electron-vite dev server with hot reload
npm run build        # typecheck, then electron-vite build into out/
npm start            # run the production build
npm test             # vitest run (projects: main = node, renderer = jsdom)
npm run typecheck    # tsc --build --noEmit over tsconfig.node.json + tsconfig.web.json
npm run lint         # eslint . (type-checked rules)
npm run dist         # build, then electron-builder Linux AppImage + .deb into release/
```

Requires Node.js 20.19+ or 22.12+. `ELECTRON_SKIP_BINARY_DOWNLOAD=1` skips the Electron download; after `npm install --ignore-scripts`, run `node scripts/install-electron.mjs` once or `npm run dev` fails. The `.deb` step needs `libcrypt.so.1` (Fedora: `libxcrypt-compat`).

## Validation

There is no CI or pre-commit hook. Before committing run:

```sh
npm run typecheck && npm run lint && npm test
```

## Architecture

```
src/main/            Electron main process
  index.ts           app entry, window creation
  ipc.ts             every ipcMain.handle; validates `unknown` args, checks sender frame, size limits
  pathGuard.ts       resolveInsideRoot / isWithin: realpath-based containment checks
  accessScope.ts     which folder/files the window may read or write
  security.ts        navigation/window-open lockdown, openExternally (http/https only)
  settings.ts        settings.json in userData, sanitizeUiPatch, mdpad migration
  watchers.ts        chokidar watchers for folder tree and open document
  testFs.ts          temp-dir helpers for file-system tests
src/preload/index.ts contextBridge exposing `window.lantern` (type LanternApi)
src/shared/api.ts    LanternApi contract, IpcChannel names, shared types and constants
src/renderer/src/    React UI (App.tsx, components/)
  markdown/          remark/rehype pipeline, sanitizing, Shiki, KaTeX, Mermaid, themes
  scrollSync/        editor/preview scroll sync via source line map
  test/              setup.ts and mockApi.ts (fake window.lantern for component tests)
config/csp.ts        Content-Security-Policy, injected into index.html at build time
```

Data flow: renderer -> `window.lantern` (preload) -> IPC channel from `IpcChannel` -> handler in `src/main/ipc.ts` -> path checked by `AccessScope`/`pathGuard` -> disk. A new IPC call touches all of `shared/api.ts`, `preload/index.ts`, `main/ipc.ts` and `renderer/src/test/mockApi.ts`.

## Code Patterns

- The renderer is sandboxed with context isolation and no Node.js; it never touches the disk except through `LanternApi`. Never loosen `webPreferences`, the CSP, or add `innerHTML`.
- IPC handlers take `unknown` arguments and validate them (`requireString`, `sanitizeUiPatch`); every path goes through the access scope before any fs call.
- Markdown HTML is sanitized with rehype-sanitize (GitHub rules) before anything else; Shiki and KaTeX run after sanitizing and build their own markup. KaTeX `trust` stays off; Mermaid stays `securityLevel: 'strict'`, and its SVG is scrubbed and shown in a shadow root.
- No inline styles: the CSP has no `unsafe-inline` in production. The editor and Mermaid use shadow roots / constructed stylesheets; fonts must not be inlined as data: URLs (see `electron.vite.config.ts`).
- `index.html` must keep the `%LANTERN_CSP%` placeholder; the build throws without it.
- String-union types in `shared/api.ts` pair with a `const` array checked by `satisfies` (e.g. `VIEW_MODES`); update both.
- TypeScript is strict with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` and `verbatimModuleSyntax` (use `import type`).

## Testing

- Tests sit next to the code as `*.test.ts(x)`. `src/main/**` and `config/**` run in node; `src/renderer/**` runs in jsdom with `src/renderer/src/test/setup.ts`.
- Component tests use Testing Library with the fake API from `test/mockApi.ts`; main-process fs tests use real temp dirs from `src/main/testFs.ts`.
- Vitest normally stubs CSS; `styles.css` is the exception (font tests import it with `?raw`).
