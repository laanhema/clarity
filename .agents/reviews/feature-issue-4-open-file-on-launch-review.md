# Code Review: feature/issue-4-open-file-on-launch

**Scope**: branch feature/issue-4-open-file-on-launch
**Recommendation**: APPROVE WITH NITS

## Summary

Reviewed branch `feature/issue-4-open-file-on-launch` against GitHub issue #4 acceptance criteria, covering CLI argument parsing, single-instance enforcement, IPC contracts, access scoping, and renderer document loading. The implementation cleanly addresses all requirements with good security isolation and test coverage, though minor edge cases exist around macOS window lifecycle and React StrictMode development hydration.

Acceptance criteria verification:
- On startup, open a Markdown file path passed on the command line, exactly as if it had been picked through **Open File…**: Met — verified via `src/main/launchArgs.ts`, `src/main/index.ts:190`, `api.getInitialFile()`, and unit/integration tests in `src/main/launchArgs.test.ts` and `src/renderer/src/App.test.tsx`.
- Keep a single instance: when Clarity is already running, hand the file to the existing window instead of starting a second copy. If that window has unsaved changes, show the usual save / discard / cancel prompt first: Met — verified via `app.requestSingleInstanceLock()`, `second-instance` IPC dispatch in `src/main/index.ts:137`, and dirty-prompt settling in `src/renderer/src/App.tsx:189` and `App.test.tsx`.
- Security stays as today: the path goes through `AccessScope` / `pathGuard` like any other open, and only that file becomes accessible: Met — verified via `AccessScope.grantFile()`, ensuring the file is verified on disk and added to `#files` without granting the containing folder.
- Document it in the README: Met — documented in `README.md` under the "Files" and security sections.
- Linux desktop entry declares `MimeType`: Met — declared in `package.json` under `build.linux.desktop.entry`.

## Issues Found

### Critical
None

### High Priority
None

### Medium Priority
- **M1** `src/main/index.ts:156` — macOS `open-file` event ignores file launch requests when no application window is currently open. **Why:** When a user closes the window on macOS, the application process remains alive; subsequent external file opens through Finder or "Open with" trigger `open-file`, but `BrowserWindow.getAllWindows()[0]` is undefined and the event drops the path without creating a window. **Fix:** Keep a reference to `settings` or an external file handler so `createWindow(settings, filePath)` is called when `open-file` receives a path and no window exists.
- **M2** `src/main/ipc.ts:281` — `GetInitialFile` IPC handler deletes `state.initialFile` on the first invocation, breaking initial file loading under React StrictMode in development. **Why:** React `<StrictMode>` in development (`npm run dev`) mounts and unmounts `<App />` immediately; the initial IPC call consumes and nullifies `state.initialFile` while the first mount's callback is discarded by `cancelled = true`, causing the subsequent mount to receive `null`. **Fix:** Retain `state.initialFile` until document reading or window navigation is confirmed, or avoid dropping the initial file in `App.tsx` on StrictMode remount.

### Suggestions (Low)
- **L1** `src/main/launchArgs.ts:18` — `parseLaunchFilePath` checks `isMarkdownPath` on every argument without skipping executable or app paths. **Why:** If the application directory or executable path itself ends with `.md` or `.markdown` (e.g. running from a cloned repo named `clarity.md`), the argument parser treats it as the candidate document, failing `grantFile` with a "Not a file" error dialog instead of opening the user's argument. **Fix:** Exclude `argv[0]` (or verify the path is a file) before selecting the candidate path.
- **L2** `src/main/index.ts:53` — File error dialog logic in `createWindow` duplicates `openFileFromExternal` in `src/main/ipc.ts`. **Why:** Both call `state.scope.grantFile()` and show an identical `showMessageBox` error dialog on failure with identical text and button options. **Fix:** Extract the `grantFile` attempt and error dialog presentation into a shared helper in `src/main/ipc.ts`.

## Validation Results

| Check | Status | Notes |
|-------|--------|-------|
| Build / Type Check | PASS | `npm run typecheck` (`tsc --build --noEmit`) and `npm run build` (`electron-vite build`) on host |
| Warnings | NONE | Zero compiler warnings; standard Vite chunk size notice for pre-existing bundled dependencies |
| Lint | PASS | `npm run lint` (`eslint .`) on host; 0 warnings, 0 errors |
| Tests | PASS | `npm test` (`vitest run`) on host; 28 test files passed (314 passed tests, 0 skipped, 0 failed) |
| UI verification | N/A | No UI verification skill in repository; verified component tests in `src/renderer/src/App.test.tsx` and static review of `.lavish/issue-4-open-file-review.html` |

## What's Good

- Comprehensive automated test coverage added for launch arguments (`src/main/launchArgs.test.ts`) and renderer lifecycle/unsaved prompts (`src/renderer/src/App.test.tsx`).
- Robust security boundaries: strict verification that incoming launch files must pass `isMarkdownPath()` and canonical realpath resolution via `AccessScope.grantFile()`, preventing directory exposure or path traversal.
- Thoughtful handling of the single-instance handoff, ensuring minimized windows are restored and focused before file delegation.
- Detailed interactive review artifact authored under `.lavish/` providing diagrams and simulated state transitions.

## Recommendation

APPROVE WITH NITS. Address the macOS `open-file` windowless edge case (M1) and React StrictMode dev-mode initial file drop (M2) in a follow-up or before final release.
