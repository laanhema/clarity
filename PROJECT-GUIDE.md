# Project guide

Lantern is a desktop Markdown reader and editor. You open a folder, pick a `.md` file from the sidebar, and edit it in CodeMirror with a live preview beside it. The preview renders GitHub-flavored Markdown, YAML frontmatter, KaTeX math, Shiki code highlighting and Mermaid diagrams. The status bar shows the path, the saved state, a word count and an offline estimate of how many Claude tokens the text costs.

The governing idea is that every document is untrusted. Lantern is built for reading Markdown that other people and tools wrote (READMEs, `SKILL.md` files, agent notes), so the renderer is sandboxed, the main process only touches files the user picked in a native dialog, and every piece of rendered HTML passes GitHub's sanitizer before anything else sees it. The app makes no network requests of its own.

## Big picture

Plain text editors show Markdown as source, and browser-based previewers either need a server or render untrusted HTML loosely. Lantern puts a fast editor and a GitHub-accurate preview in one window that works on a whole folder, offline.

The app is an Electron program with three processes:

- The main process owns the window, the menu, settings, file access and file watching. It answers typed IPC calls from the renderer and refuses any path outside the user's grants.
- The preload script exposes one small typed object, `window.lantern`, and nothing else.
- The renderer is a React app. It holds the document text, runs the Markdown pipeline and draws the sidebar, editor, preview and status bar.

The preview pipeline runs 200 ms after typing stops. remark parses the text (with GFM, frontmatter and math extensions), remark-rehype turns it into HTML syntax trees, rehype-raw admits inline HTML, and rehype-sanitize strips it to GitHub's rules. Only after that do the slower stages run, each on demand. Shiki loads a grammar the first time a document uses that language, KaTeX loads the first time a document has math, and Mermaid loads the first time it has a diagram. The final tree becomes React elements through `hast-util-to-jsx-runtime`, never `innerHTML`.

Images and links take separate paths. A relative image reference goes to the main process, which checks it against the open folder and returns a `data:` URL (15 MB cap). Remote images are never fetched, so their alt text shows instead. Web links open in the system browser, `.md` links inside the folder open in Lantern, and everything else does nothing.

File watching is the third track. chokidar watches the open document and the folder tree. When the file changes on disk, `externalChange.ts` decides between ignoring it, reloading silently, asking the user, or marking the document unsaved because the file is gone.

## Codebase map

The codebase is small (about 2,300 lines in the main process, preload and shared types) with tests next to the code they cover. Key files and directories:

- `src/main/index.ts` starts the app, creates windows and wires the security hooks, IPC handlers and menu together.
- `src/main/ipc.ts` registers every IPC handler. Each one validates its `unknown` arguments and resolves paths through the window's access scope before touching the disk.
- `src/main/accessScope.ts` holds the per-window set of granted paths: one folder plus single files picked with Open File or Save As. It is the only place access is granted.
- `src/main/pathGuard.ts` resolves real paths and rejects `../` escapes, symlinks out of the root, empty paths and NUL bytes.
- `src/main/images.ts` turns an image `src` into a local path and MIME type, and rejects anything with a scheme or a `//host`.
- `src/main/security.ts` blocks navigation, new windows, webviews and every web permission request. `externalUrl.ts` lets only http and https leave the app.
- `src/main/settings.ts` reads and writes `settings.json` in Electron's userData folder, validates every field, and migrates settings from the old `mdpad` folder once.
- `src/main/fileTree.ts` and `src/main/watchers.ts` list the folder's Markdown files (skipping `.git` and `node_modules`) and watch them.
- `src/main/menu.ts`, `theme.ts`, `windowBounds.ts` and `windowState.ts` build the application menu, apply the native theme, keep the window on a visible screen, and track per-window state such as unsaved work.
- `src/preload/index.ts` is the bridge. It forwards a fixed set of calls and never hands raw `ipcRenderer` to the page.
- `src/shared/api.ts` defines the IPC channel names and the types both sides use, so a renamed channel breaks the build instead of failing at runtime.
- `src/renderer/src/App.tsx` owns document state, the unsaved-changes prompts, the view mode and the theme.
- `src/renderer/src/components/` has the UI pieces. `Editor.tsx` wraps CodeMirror inside a shadow root, `Preview.tsx` renders the pipeline output, `MermaidDiagram.tsx` shows diagrams in a shadow root, and `Sidebar.tsx`, `Splitter.tsx` and `StatusBar.tsx` do what their names say.
- `src/renderer/src/markdown/` is the Markdown pipeline. `pipeline.ts` builds the unified processor and the sanitizer schema, `dollarMath.ts` applies Pandoc's dollar rules, `frontmatter.ts` turns YAML into a table, `highlighter.ts` loads Shiki lazily, and `mermaid.ts` configures Mermaid, scrubs its SVG and builds the diagram palette from each app theme.
- `src/renderer/src/scrollSync/` keeps the editor and the preview scrolled to the same part of the document by mapping source lines to rendered block offsets.
- `src/renderer/src/tokenEstimate.ts` estimates Claude token counts from text features with fitted weights, since the tokenizer is not public. `tokenEstimate.fixtures.ts` holds the reference texts.
- `config/csp.ts` defines the Content-Security-Policy, which the Vite plugin in `electron.vite.config.ts` writes into `index.html` at build time.
- `scripts/install-electron.mjs` downloads the Electron binary on `npm install`.

There is no state library, no router, no CSS framework and no component kit. React state in `App.tsx` and plain CSS in `styles.css` are enough for one window with four panes.

## Tech stack and design decisions

Lantern is one Electron app with no backend and no network use. Everything privileged lives in the main process, and the renderer is treated like a web page showing hostile content.

### Framework and runtime

Electron 45 gives one codebase for Linux, macOS and Windows with a real file system and native dialogs. electron-vite builds the three processes with Vite and gives hot reload in development. React 19 renders the UI, and TypeScript 6 checks everything through project references (`tsconfig.node.json` for main and preload, `tsconfig.web.json` for the renderer). Development needs Node.js 20.19+ or 22.12+.

### Runtime dependencies

The project ships with 1 runtime package:

- `chokidar` watches files and folders in the main process. Node's own `fs.watch` misses atomic saves (write a temp file, rename it over) and behaves differently on each platform, and chokidar handles both.

Everything else is in `devDependencies`, because Vite bundles the renderer code into `out/` and electron-builder packages only `out/**/*` and `package.json`. That bundle includes CodeMirror 6, the unified/remark/rehype stack, Shiki, KaTeX, Mermaid, `yaml`, and the Commit Mono and JetBrains Mono NL fonts.

### Markdown rendering

unified with remark and rehype was chosen over a single-string renderer such as marked because it works on syntax trees. That lets Lantern sanitize the tree with GitHub's own schema, then add highlighting and math afterwards from the code's and formula's text, so no style in the output ever comes from the document. Shiki gives the same TextMate grammars as VS Code. The heavy parts (Shiki grammars, KaTeX, Mermaid) are code-split and load on first use, so a plain document opens fast.

### Styling and themes

Styles are plain CSS with custom properties per theme (Light, Dark, Gruvbox Material Dark Hard, Tokyo Night Moon, or follow the system). The editor and Mermaid diagrams use constructed stylesheets inside shadow roots, which keeps the CSP free of `unsafe-inline` in production. Fonts are bundled because `font-src 'self'` allows nothing else, and the Vite config keeps them out of `data:` URLs for the same reason.

### State and settings

There is no database. Settings (view mode, theme, font, font size, pane sizes, ten recent folders, window bounds) live in one JSON file that the main process validates field by field on read. Deleting it resets the app.

### Testing

Vitest runs two projects from `vitest.config.mts`. The `main` project runs in Node and tests path guards, the access scope, settings, file tree and watchers against real temporary folders (`src/main/testFs.ts`). The `renderer` project runs in jsdom with Testing Library and a mock `window.lantern` (`src/renderer/src/test/mockApi.ts`), and tests the app, components, pipeline, scroll sync and token estimate. There are no end-to-end tests that launch Electron.

## Development and testing

### Scripts

```bash
npm install          # install packages, then download the Electron binary
npm run dev          # start the app with hot reload
npm run build        # typecheck, then build into out/
npm start            # run the production build
npm test             # Vitest, main and renderer projects
npm run test:watch   # Vitest in watch mode
npm run typecheck    # tsc --build for main, preload and renderer
npm run lint         # ESLint
npm run dist         # build, then package a Linux AppImage and .deb into release/
```

Set `ELECTRON_SKIP_BINARY_DOWNLOAD=1` to skip the Electron download. After `npm install --ignore-scripts`, run `node scripts/install-electron.mjs` once.

### Packaging

There is no Docker setup and no CI workflow. electron-builder reads the `build` field in `package.json` and writes `release/lantern-<version>-x86_64.AppImage` and `release/lantern-<version>-amd64.deb`. The `.deb` step uses a bundled fpm whose Ruby needs `libcrypt.so.1`, so on Fedora install `libxcrypt-compat` first. macOS (dmg) and Windows (nsis) targets are configured but must be built on those systems. The `homepage` field is a placeholder (`https://lantern.invalid/`) because Debian packages require one.

## Security and deployment

The threat is a malicious Markdown file: one that tries to run script, read files outside the folder, phone home through an image URL, or restyle the app to trick the user. The defenses are layered so no single bug opens the disk.

- The renderer runs sandboxed with context isolation and no Node.js. Its only route to the disk is the preload API.
- The main process accepts paths only inside the grants made through native dialogs or Open Recent, and resolves real paths so symlinks and `../` cannot escape. Opening another folder drops the old grant except for the open document.
- rehype-sanitize applies GitHub's schema, drops `<style>`, and prefixes ids with `user-content-` so a document cannot clobber the app's own elements. KaTeX runs with `trust` off.
- Mermaid runs with `securityLevel: 'strict'`. Lantern then removes scripts, event handlers, animations and non-`#` URLs from the SVG and shows it in a shadow root.
- The production CSP allows scripts, styles and fonts only from the app and images only from the app or `data:`. The dev server adds inline scripts and a localhost websocket for hot reload, nothing more.
- Navigation, new windows, webviews and all permission requests (camera, notifications and so on) are denied. Only http and https links leave the app, and they go to the system browser.

Lantern is a local desktop app with no server, so there is no public exposure or credential to manage.
