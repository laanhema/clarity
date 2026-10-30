# mdpad

A simple desktop Markdown reader and editor, built with Electron, React and TypeScript.

Open a folder, pick a Markdown file from the sidebar, and edit it with a live preview next to it. The window has a folder sidebar, a code editor, a preview and a status bar showing the file path, whether it is saved, a word count and the theme.

## Features

- **Editor**: CodeMirror 6 with Markdown highlighting, undo and redo, find and replace, and line wrapping. Enter continues lists and quotes.
- **Preview**: GitHub-flavored Markdown with tables, task lists, strikethrough, autolinks and footnotes. Inline HTML is allowed but sanitized the way GitHub does it. Code blocks are coloured with [Shiki](https://shiki.style) for about 35 common languages. Each language loads the first time a document uses it. The preview updates 200 ms after you stop typing.
- **Layout**: switch between editor only, preview only, and both side by side. Drag the bars between the panes to resize them. mdpad remembers the view and the sizes.
- **Themes**: follow the system, or pick light or dark from **View → Theme** or the button in the status bar. The editor, preview and code colours all follow the choice, and mdpad remembers it.
- **Links in the preview**: web links (http and https) open in your browser. Links to other `.md` files inside the open folder open in mdpad. `#anchors` jump within the preview, including footnotes. All other links do nothing.
- **Images in the preview**: images with a relative path load if they are inside the open folder (png, jpg, gif, webp, avif, svg, bmp, ico, up to 15 MB). Remote images are not loaded; their alt text shows instead.
- **Files**: the sidebar lists the `.md` and `.markdown` files in the open folder and its subfolders. It skips dot-folders such as `.git` and `node_modules`. It updates when files are added or removed. A dot (●) marks unsaved changes. Before you switch files or close the window with unsaved changes, mdpad asks whether to save, discard or cancel.
- **Changes from other programs**: if another program changes the open file and you have no unsaved edits, mdpad reloads it. If you do have unsaved edits, it asks whether to reload or keep yours. If the file is deleted, the document is marked unsaved so you can save it again.
- **Open Recent**: **File → Open Recent** lists the last ten folders. Folders that no longer exist are dropped.
- mdpad remembers the window size and position between sessions.

## Keyboard shortcuts

On macOS use Cmd instead of Ctrl.

| Action                     | Shortcut                      |
| -------------------------- | ----------------------------- |
| New document               | Ctrl+N                        |
| Open File                  | Ctrl+O                        |
| Open Folder                | Ctrl+Shift+O                  |
| Save                       | Ctrl+S                        |
| Save As                    | Ctrl+Shift+S                  |
| Undo / Redo                | Ctrl+Z / Ctrl+Shift+Z (or Ctrl+Y in the editor) |
| Find and replace           | Ctrl+F (Esc closes the panel) |
| Next / previous match      | F3 / Shift+F3, or Ctrl+G / Ctrl+Shift+G |
| Select next occurrence     | Ctrl+D                        |
| Select all occurrences     | Ctrl+Shift+L                  |
| Go to line                 | Ctrl+Alt+G                    |
| Editor only                | Ctrl+1                        |
| Editor and preview         | Ctrl+2                        |
| Preview only               | Ctrl+3                        |
| Indent / outdent selection | Tab / Shift+Tab (Esc, then Tab, moves focus out of the editor) |
| Zoom in / out / reset      | Ctrl+= / Ctrl+- / Ctrl+0      |
| Full screen                | F11                           |
| Quit (Linux and macOS)     | Ctrl+Q                        |

The bars between the panes can also be moved with the Left and Right arrow keys once focused.

## Settings

mdpad stores its settings in `settings.json` in Electron's userData folder: `~/.config/mdpad` on Linux, `~/Library/Application Support/mdpad` on macOS and `%APPDATA%\mdpad` on Windows. The file holds the view mode, theme, pane sizes, recent folders and window position. Deleting it resets everything.

## Development

Requires Node.js 20.19+ or 22.12+ and npm.

```sh
npm install
npm run dev        # start the app with hot reload
npm run build      # typecheck, then build into out/
npm start          # run the production build
npm test           # unit and component tests (Vitest)
npm run typecheck  # TypeScript, main and renderer
npm run lint       # ESLint
npm run dist       # build, then package a Linux AppImage and .deb into release/
```

If `npm run dev` says Electron failed to install, npm skipped Electron's download step. Run `node node_modules/electron/install.js` once.

### Packaging

`npm run dist` uses [electron-builder](https://www.electron.build) to write `release/mdpad-<version>-x86_64.AppImage` and `release/mdpad-<version>-amd64.deb`. The configuration is the `build` field in `package.json`. macOS (dmg) and Windows (nsis) targets are configured but not built by this script. Run `npx electron-builder --mac` or `--win` on those systems.

electron-builder makes the `.deb` with a bundled copy of fpm. Its Ruby needs `libcrypt.so.1`. Fedora and some other distributions no longer install that library by default, and the `.deb` step then fails with `libcrypt.so.1: cannot open shared object file`. Install it once with `sudo dnf install libxcrypt-compat` (on Fedora), then run `npm run dist` again. The AppImage does not need it.

The `homepage` in `package.json` is a placeholder (`https://mdpad.invalid/`), because Debian packages must name one. Replace it when the project has a real homepage.

## Project layout

```
src/main/       Electron main process: window, menu, settings, file access and watching, IPC handlers
src/preload/    The bridge that exposes window.mdpad to the renderer
src/renderer/   The React UI; src/markdown/ holds the Markdown pipeline and the code highlighter
src/shared/     Types and IPC channel names shared by all three
config/         Build-time settings (Content-Security-Policy)
build/          Packaging resources (the app icon)
```

## Security

mdpad shows untrusted documents, so the renderer is locked down:

- The renderer runs sandboxed, with context isolation and without Node.js. It reaches the disk only through the small typed API in `src/preload/index.ts`.
- The main process only reads and writes inside the folder or files you picked in a native dialog (or from Open Recent). It resolves real paths, so `../` tricks and symlinks that point outside the folder are rejected. Opening a different folder keeps only the open document writable from the old one.
- Markdown is turned into HTML with remark and rehype, and the result is sanitized with GitHub's rules (rehype-sanitize) before anything else touches it. Scripts, event handlers, `javascript:` and other non-web URLs, iframes, forms, `<style>` and `style` attributes are removed. Code highlighting runs after sanitizing. It builds its own markup from the code's text, so its colour styles never come from the document. The preview is rendered as React elements, not with `innerHTML`.
- A strict Content-Security-Policy allows only the app's own scripts and styles, and images from the app or `data:` URLs. Images inside the open folder reach the preview as `data:` URLs from the main process. The dev server relaxes the policy just enough for hot reload. The editor runs inside a shadow root, so its runtime styles need no `unsafe-inline`.
- The renderer cannot navigate away or open new windows. Web links (http and https only) open in your browser.
