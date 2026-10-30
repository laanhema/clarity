# mdpad

A simple desktop Markdown reader and editor, built with Electron, React and TypeScript.

Open a folder, pick a Markdown file from the sidebar, edit it, and save. The window has three panes (folder sidebar, editor, preview) and a status bar showing the file path, whether it is saved, and a word count. Light and dark themes follow your system setting.

The current version has a plain text editor and an empty preview pane. A code editor, the rendered Markdown preview, syntax highlighting and GitHub-flavored Markdown come in later versions.

## Using it

| Action      | Shortcut           |
| ----------- | ------------------ |
| Open File   | Ctrl/Cmd+O         |
| Open Folder | Ctrl/Cmd+Shift+O   |
| Save        | Ctrl/Cmd+S         |
| Save As     | Ctrl/Cmd+Shift+S   |

The sidebar lists the `.md` and `.markdown` files in the open folder and its subfolders. It skips dot-folders such as `.git` and `node_modules`. A dot (●) marks unsaved changes. Before you switch files or close the window with unsaved changes, mdpad asks whether to save, discard or cancel.

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
```

If `npm run dev` says Electron failed to install, npm skipped Electron's download step. Run `node node_modules/electron/install.js` once.

## Project layout

```
src/main/       Electron main process: window, menu, file access, IPC handlers
src/preload/    The bridge that exposes window.mdpad to the renderer
src/renderer/   The React UI
src/shared/     Types and IPC channel names shared by all three
config/         Build-time settings (Content-Security-Policy)
```

## Security

mdpad will display untrusted documents, so the renderer is locked down:

- The renderer runs sandboxed, with context isolation and without Node.js. It reaches the disk only through the small typed API in `src/preload/index.ts`.
- The main process only reads and writes inside the folder or files you picked in a native dialog. It resolves real paths, so `../` tricks and symlinks that point outside the folder are rejected.
- A strict Content-Security-Policy allows only the app's own scripts and styles. The dev server relaxes it just enough for hot reload.
- The renderer cannot navigate away or open new windows. Web links (http and https only) open in your browser.
