# Code Review: feature/issue-9-reopen-last-file-and-folder

**Scope**: branch feature/issue-9-reopen-last-file-and-folder
**Recommendation**: NEEDS CHANGES

## Summary

Reviewed branch `feature/issue-9-reopen-last-file-and-folder` against GitHub issue #9 acceptance criteria, covering session persistence in `Settings`, access scoping on startup, cold launch restoration, Close Folder commands, and renderer integration. While the core happy-path session restoration and graceful missing-path fallbacks are well implemented with comprehensive test coverage, there are two high-severity issues: cancelling a folder switch mistakenly erases session persistence and stops active folder watching, and closing a folder fails to revoke access permissions in `AccessScope`.

Acceptance criteria verification:
- When opening Clarity without file arguments, the folder open at last quit is automatically reopened in the sidebar: Met — verified via `src/main/index.ts:61`, `restoreSessionFolder` in `src/main/ipc.ts`, `api.getInitialFolder()`, and unit/integration tests in `src/renderer/src/App.test.tsx`.
- When opening Clarity without file arguments, the file open at last quit is automatically reopened in the editor and preview: Met — verified via `src/main/index.ts:62`, `restoreSessionFile` in `src/main/ipc.ts`, `api.getInitialFile()`, and `src/renderer/src/App.test.tsx`.
- Launching Clarity with an explicit file argument (via CLI or file manager) opens that file instead of restoring the previous session file: Met — verified via `src/main/index.ts:58-63`, where `initialFile` bypasses session folder and file restoration, opening only the requested document with an empty sidebar.
- If the saved file or folder no longer exists or cannot be accessed, Clarity starts gracefully with an empty workspace rather than failing: Met — verified via `try/catch` handlers in `restoreSessionFolder` and `restoreSessionFile` which gracefully prune invalid settings to `null` and return `null` without presenting error dialogs.
- Closing the folder or clearing the open file before exiting clears the saved session so they are not reopened on next start: Partially met — explicitly closing the folder or clearing the open document clears `lastFolder` and `lastFile` in settings, but cancelling a folder switch also erases the active session (H1), and closing a folder fails to drop the folder grant in `AccessScope` (H2).

## Issues Found

### Critical
None

### High Priority
- **H1** `src/main/ipc.ts:68` — Cancelling a folder switch halts the active folder's watcher and wipes saved workspace session state. **Why:** When a user cancels switching to another folder (e.g. clicking Cancel on the unsaved changes prompt), `App.tsx:223` invokes `api.enterFolder(null)` in its `finally` block to abort the pick, but `enterFolder` in `ipc.ts` stops watching the current directory (`state.stopFolderWatch?.()`) and overwrites `lastFolder` and `lastFile` with `null`, breaking directory change tracking and causing subsequent launches to start with an empty workspace. **Fix:** Separate cancelling a folder pick from closing the active folder (e.g. add a dedicated `CloseFolder` IPC channel or parameterize `enterFolder`), ensuring folder watching is maintained and settings are preserved when an in-flight switch is cancelled.
- **H2** `src/main/ipc.ts:65` — `enterFolder(null)` does not revoke folder access in `AccessScope`. **Why:** When closing an open folder, `enterFolder` calls `state.scope.dropPickedFolder()`, which only resets `#pickedFolder` while leaving `state.scope.#folder` set to the previous directory; consequently, `state.scope.folder` remains active, `ListMarkdownFiles` continues reporting the folder's files, and `resolveForRead`/`resolveForWrite` continue granting access to files within the closed directory. **Fix:** Add a `dropFolder()` method to `AccessScope` that clears `#folder` (`this.#folder = null`), and invoke it when closing a folder.

### Medium Priority
- **M1** `src/main/ipc.ts:266` — Initial render unhydrated document state prematurely clears `lastFile` in settings. **Why:** On initial mount, `<App />` initializes `doc` to `NEW_DOCUMENT` (`path: null`), immediately triggering `useEffect(() => { api.watchDocument(doc.path) }, [api, doc.path])` before `getInitialFile()` resolves; this executes `watchDocument(null)`, setting `settings.current.lastFile = null` in memory and scheduling a flush to disk, introducing a race condition where quitting or crashing before `openPath` completes permanently loses the session document. **Fix:** Guard the initial `watchDocument(null)` call in `App.tsx` until session restoration completes, or avoid clearing `lastFile` on unhydrated initial mount.
- **M2** `src/main/ipc.ts:358` — `GetInitialFolder` and `GetInitialFile` IPC handlers consume state on the first call, breaking restoration under React StrictMode in development. **Why:** React `<StrictMode>` in `src/renderer/src/main.tsx` double-mounts components in development; `GetInitialFolder` and `GetInitialFile` immediately nullify `state.initialFolder` and `state.initialFile` on the first invocation while the first mount's effect is discarded by `cancelled = true`, causing the second mount to receive `null` and leaving the workspace empty when running `npm run dev`. **Fix:** Retain `state.initialFolder` and `state.initialFile` until document reading or window navigation is confirmed rather than nullifying them on the first IPC query.

### Suggestions (Low)
- **L1** `src/renderer/src/components/Sidebar.test.tsx:23` — The new sidebar "Close" button is not tested in the Sidebar component test suite. **Why:** `Sidebar.tsx` adds an `onCloseFolder` prop and a Close button, but `Sidebar.test.tsx` was not updated to test this button's rendering or interaction (it is currently tested only in `App.test.tsx`). **Fix:** Add unit test coverage in `Sidebar.test.tsx` verifying that the Close button renders when `folder` is present and triggers `onCloseFolder` on click.
- **L2** `src/main/ipc.ts:84` — `openRecentFolder` and `openFileFromExternal` clear `state.initialFile` but omit clearing `state.initialFolder`. **Why:** If an external open action occurs while the window is still initializing, `state.initialFile` is cleared but `state.initialFolder` remains, potentially causing the initial folder to restore unexpectedly. **Fix:** Set `state.initialFolder = null` in `openRecentFolder` and `openFileFromExternal` alongside `state.initialFile = null`.

## Validation Results

| Check | Status | Notes |
|-------|--------|-------|
| Build / Type Check | PASS | `npm run typecheck` (`tsc --build --noEmit`) and `npm run build` (`electron-vite build`) on host; completed with 0 errors |
| Warnings | NONE | Zero compiler warnings; standard Vite chunk size notice for pre-existing bundled dependencies |
| Lint | PASS | `npm run lint` (`eslint .`) on host; 0 warnings, 0 errors |
| Tests | PASS | `npm test` (`vitest run`) on host; 28 test files passed (320 passed tests, 0 skipped, 0 failed) |
| UI verification | N/A | No UI verification skill in repository; verified component tests in `src/renderer/src/App.test.tsx` and static review of `.lavish/issue-9-reopen-workspace-review.html` |

## What's Good

- Clean, defensive handling of session settings parsing and invalid/relative path pruning in `src/main/settings.ts`.
- Smooth user experience with non-intrusive fallback to an empty workspace when previously open files or folders no longer exist on disk.
- Thorough automated tests added for settings persistence and renderer startup restoration in `src/main/settings.test.ts` and `src/renderer/src/App.test.tsx`.
- Convenient addition of both the `CmdOrCtrl+Alt+W` shortcut and the sidebar header Close button for closing open folders.

## Recommendation

NEEDS CHANGES. Before merging, resolve H1 (preventing cancelled folder switches from clearing session state and killing watchers) and H2 (ensuring `AccessScope` drops the folder grant upon closing). Consider addressing M1 and M2 to harden session hydration and React StrictMode development workflows.
