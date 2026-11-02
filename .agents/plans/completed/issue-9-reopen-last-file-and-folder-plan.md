# Plan: Reopen last opened file and folder on startup

## Summary

When Clarity is launched without arguments, it currently initializes with an empty workspace ("No folder open") and an "Untitled" document, requiring users to manually re-navigate to their project directory and active Markdown document every time they start the application.

This plan implements automatic workspace session restoration with strict security containment. The last active workspace state (`lastFolder: string | null`, `lastFile: string | null`) is persisted in `Settings` via `src/main/settings.ts`. As users enter folders, switch documents, create new files, or close workspaces, the main process tracks the active folder in `enterFolder` and the active file in `watchDocument` via IPC. On application launch without arguments, `src/main/index.ts` resolves and grants permissions for the last folder and file through `AccessScope` before sending them to the renderer via `api.getInitialFolder()` and `api.getInitialFile()`. If a saved path no longer exists or cannot be accessed, Clarity starts gracefully with an empty workspace rather than failing. In addition, explicit launch arguments bypass previous session file restoration, and closing a folder or creating a new document clears the saved session. The complete implementation and test suite are captured in `.agents/plans/issue-9-reopen-last-file-and-folder-prototype.patch`.

All `file:line` references cited in this plan refer to lines on HEAD before the prototype patch is applied.

## User Story

As a Clarity user reopening the editor
I want Clarity to automatically reopen the folder and Markdown file I was working on when I last quit
So that I can immediately resume my editing workflow without manually re-navigating to my workspace and document.

## Metadata

| Field | Value |
|-------|-------|
| Type | ENHANCEMENT |
| Complexity | MEDIUM |
| Systems Affected | `src/main/settings.ts`, `src/main/settings.test.ts`, `src/main/ipc.ts`, `src/main/index.ts`, `src/main/windowState.ts`, `src/main/menu.ts`, `src/shared/api.ts`, `src/shared/shortcuts.ts`, `src/preload/index.ts`, `src/renderer/src/App.tsx`, `src/renderer/src/components/Sidebar.tsx`, `src/renderer/src/styles.css`, `src/renderer/src/test/mockApi.ts`, `src/renderer/src/App.test.tsx`, `README.md`, `.lavish/` |
| GitHub Issue | #9 |
| PRD Phase | N/A |
| Prototype Patch | `.agents/plans/issue-9-reopen-last-file-and-folder-prototype.patch` |

---

## Patterns to Follow

### Naming
```typescript
// SOURCE: src/shared/api.ts:117-120
  /**
   * Opens the folder that `pickFolder` or Open Recent picked last, or the open
   * folder again, and drops the old folder's access. Null forgets the pick and resolves to null.
   */
  enterFolder(rootPath: string | null): Promise<OpenedFolder | null>
```

### Error Handling
```typescript
// SOURCE: src/main/ipc.ts:86-92
    await dialog.showMessageBox(state.window, {
      type: 'error',
      message: `"${path.basename(folder)}" can no longer be opened.`,
      detail: `${folder}\n\nIt was removed from Open Recent.`,
    })
    return
```

### Tests
```typescript
// SOURCE: src/main/settings.test.ts:47-51
  it('falls back to defaults for missing, broken or foreign files', () => {
    for (const raw of ['', 'not json', '[]', 'null', '42']) {
      expect(parseSettings(raw)).toEqual({ ui: DEFAULT_UI_SETTINGS, recentFolders: [], window: null })
    }
  })
```

```typescript
// SOURCE: src/renderer/src/App.test.tsx:88-93
  it('opens an initial file passed on launch', async () => {
    mock.api.getInitialFile.mockResolvedValue('/notes/first.md')
    render(<App />)
    await waitFor(() => expect(editorText()).toBe('# First'))
    expect(screen.getByText('/notes/first.md')).toBeInTheDocument()
  })
```

---

## Files to Change

| File | Action | Purpose |
|------|--------|---------|
| `src/main/settings.ts` | UPDATE | Add `lastFolder: string \| null` and `lastFile: string \| null` to `Settings`, initialize in `defaultSettings()`, parse and validate in `parseSettings()`. Covered by prototype patch. |
| `src/main/settings.test.ts` | UPDATE | Test default initialization, valid path persistence, and invalid path pruning for `lastFolder` and `lastFile`. Covered by prototype patch. |
| `src/shared/api.ts` | UPDATE | Add `getInitialFolder(): Promise<OpenedFolder \| null>` to `ClarityApi`; add `'close-folder'` to `MenuCommand` and `MENU_COMMANDS`; declare `IpcChannel.GetInitialFolder`. Covered by prototype patch. |
| `src/shared/shortcuts.ts` | UPDATE | Register `'close-folder'` shortcut (`CmdOrCtrl+Alt+W`) in `File` group. Covered by prototype patch. |
| `src/main/menu.ts` | UPDATE | Add "Close Folder" item to File menu with accelerator from `menuAccelerator('close-folder')`. Covered by prototype patch. |
| `src/main/windowState.ts` | UPDATE | Add `initialFolder: Promise<OpenedFolder \| null> \| null` to `WindowState` and `trackWindow`. Covered by prototype patch. |
| `src/main/ipc.ts` | UPDATE | Implement `restoreSessionFolder` and `restoreSessionFile` helpers; update `enterFolder` and `watchDocument` to persist/clear session in `Settings`; register `GetInitialFolder` and update `GetInitialFile` handlers. Covered by prototype patch. |
| `src/main/index.ts` | UPDATE | On startup without file argument, invoke `restoreSessionFolder` and `restoreSessionFile` into window state. Covered by prototype patch. |
| `src/preload/index.ts` | UPDATE | Expose `getInitialFolder` over `IpcChannel.GetInitialFolder` to renderer. Covered by prototype patch. |
| `src/renderer/src/test/mockApi.ts` | UPDATE | Mock `getInitialFolder` with `mockResolvedValue(null)`. Covered by prototype patch. |
| `src/renderer/src/App.tsx` | UPDATE | On mount, sequentially restore initial folder and initial file via `api.getInitialFolder()` and `api.getInitialFile()`; handle `close-folder` menu command; pass `onCloseFolder` to `Sidebar`. Covered by prototype patch. |
| `src/renderer/src/components/Sidebar.tsx` | UPDATE | Add `onCloseFolder` prop to `SidebarProps`; render Close button in sidebar header when a folder is open. Covered by prototype patch. |
| `src/renderer/src/styles.css` | UPDATE | Share `.sidebar-open` styling with `.sidebar-close`. Covered by prototype patch. |
| `src/renderer/src/App.test.tsx` | UPDATE | Add test cases for startup session restoration, graceful missing path startup, sidebar close button, and close-folder menu command. Covered by prototype patch. |
| `README.md` | UPDATE | Document session reopening behavior on launch without arguments and the Close Folder action. Not covered by patch. |
| `.lavish/issue-9-reopen-workspace-review.html` | CREATE | Interactive visual review artifact detailing session lifecycle, permission resolution, state transitions, and acceptance verification. Not covered by patch. |

---

## Tasks

Execute in order. Each task is atomic and verifiable. Note: `/implement` applies `.agents/plans/issue-9-reopen-last-file-and-folder-prototype.patch` before Task 1.

### Task 1: Verify Unit and Component Test Suites Across Main and Renderer

- **File**: `src/main/settings.test.ts`, `src/main/menu.test.ts`, `src/renderer/src/components/Sidebar.test.tsx`, `src/renderer/src/components/ShortcutsPanel.test.tsx`, `src/renderer/src/App.test.tsx`
- **Action**: CHECK
- **Implement**: Run Vitest on `src/main/settings.test.ts`, `src/main/menu.test.ts`, `src/renderer/src/components/Sidebar.test.tsx`, `src/renderer/src/components/ShortcutsPanel.test.tsx`, and `src/renderer/src/App.test.tsx` to verify that all 22 settings tests, all 7 menu tests, all 11 sidebar tests, all 8 shortcuts panel tests, and all 64 App tests pass cleanly.
- **Mirror**: `package.json:18`
- **Validate**: `npx vitest run src/main/settings.test.ts src/main/menu.test.ts src/renderer/src/components/Sidebar.test.tsx src/renderer/src/components/ShortcutsPanel.test.tsx src/renderer/src/App.test.tsx`

### Task 2: Update Documentation in README.md

- **File**: `README.md`
- **Action**: UPDATE
- **Implement**: In `README.md`, update the **Files** section and the **Keyboard shortcuts** table:
  1. Describe that launching Clarity without arguments automatically reopens the folder and Markdown file open at last quit, while launching with an explicit file argument opens that specific file instead.
  2. Note that if the saved folder or file no longer exists or is inaccessible, Clarity starts gracefully with an empty workspace.
  3. Document the "Close Folder" command (`Ctrl+Alt+W` / `Cmd+Alt+W` on macOS) and the sidebar "Close" button.
- **Mirror**: `README.md:17-20`
- **Validate**: `git diff README.md`

### Task 3: Create Interactive Lavish Review Artifact

- **File**: `.lavish/issue-9-reopen-workspace-review.html`
- **Action**: CREATE
- **Implement**: Create an interactive HTML review artifact under `.lavish/issue-9-reopen-workspace-review.html` using the Lavish design system (Tailwind v4 CDN + DaisyUI v5 CDN) combining the `plan`, `diagram`, `comparison`, and `explanation` playbooks:
  1. **Header & Badges**: Title "Issue #9: Reopen Last File and Folder on Startup", badges (Session Persistence, Strict Security Containment, Graceful Fallback).
  2. **Architecture & Flow Diagram**: Inline SVG diagram illustrating:
     - Normal launch without arguments: `Settings.lastFolder` & `Settings.lastFile` -> `AccessScope.grantFolder` & `AccessScope.grantFile` -> `api.getInitialFolder` & `api.getInitialFile` -> active workspace.
     - CLI launch with file argument: `startupFile` -> `grantLaunchFile` -> bypasses `lastFile` and `lastFolder` -> opens target file.
     - Missing or deleted path: `stat`/`realpath` failure -> catch and clear `Settings` entry -> starts empty without dialog.
     - Clearing session: `Close Folder` / `New Document` -> `enterFolder(null)` / `watchDocument(null)` -> sets `lastFolder: null` / `lastFile: null`.
  3. **Interactive Simulator**:
     - Mode 1: *Cold Start (Restored Workspace)* — simulates opening Clarity with previously saved folder `/projects/clarity` and active file `notes.md`.
     - Mode 2: *Cold Start (Missing File / Folder)* — simulates deleted workspace path gracefully starting with empty state.
     - Mode 3: *CLI File Launch* — simulates launching `clarity specific.md` bypassing saved session.
     - Mode 4: *Session Clearing* — simulates closing folder or creating new document before quit.
  4. **Security Boundary Review**: Deep dive into `AccessScope` realpath resolution preventing directory traversal or unauthorized file access.
  5. **Verification Checklist**: Table of all 5 acceptance criteria mapped to passing automated test assertions.
- **Mirror**: `.lavish/issue-4-open-file-review.html`
- **Validate**: `test -f .lavish/issue-9-reopen-workspace-review.html`

### Task 4: Launch Lavish Review Surface and Verify

- **File**: `.lavish/issue-9-reopen-workspace-review.html`
- **Action**: CHECK
- **Implement**: Launch the Lavish review surface using `lavish-axi .lavish/issue-9-reopen-workspace-review.html` so the user can visually review the architecture, state machine, and interactive simulator, and notify Lavish with `lavish-axi reply`.
- **Mirror**: `lavish-axi .lavish/issue-4-open-file-review.html`
- **Validate**: `lavish-axi reply .lavish/issue-9-reopen-workspace-review.html --agent-reply "Interactive review artifact for Issue #9 is ready for visual review." || true`

### Task 5: Full Suite Validation and Clean Build Check

- **File**: `package.json`
- **Action**: CHECK
- **Implement**: Run the full project validation pipeline (`npm run typecheck && npm run lint && npm test`) to confirm zero type errors, zero lint warnings, and 28 passing test files (320 tests).
- **Mirror**: `package.json:16-18`
- **Validate**: `npm run typecheck && npm run lint && npm test`

---

## Validation

```bash
# Type check
npm run typecheck

# Lint
npm run lint

# Tests
npm test
```

## End-to-End Verification

To verify the workspace restoration end-to-end:
1. Launch Clarity headlessly or via test harness with a clean temporary userData settings directory containing:
   ```json
   {
     "ui": { "viewMode": "split", "theme": "dark", "sidebarWidth": 240, "editorFraction": 0.5, "font": "commit-mono", "fontSize": 14 },
     "recentFolders": ["<tempDir>/notes"],
     "window": null,
     "lastFolder": "<tempDir>/notes",
     "lastFile": "<tempDir>/notes/welcome.md"
   }
   ```
2. Confirm via `api.getInitialFolder()` and `api.getInitialFile()` that `<tempDir>/notes` is mounted in the sidebar and `<tempDir>/notes/welcome.md` is loaded into the editor and preview without errors.
3. Remove `<tempDir>/notes/welcome.md` from disk, relaunch Clarity with the same settings, and verify that Clarity starts with `<tempDir>/notes` in the sidebar and a clean "Untitled" document in the editor without raising an error dialog.
4. Launch Clarity with an explicit CLI file argument (`clarity <tempDir>/other.md`), and verify that `<tempDir>/other.md` opens in the editor while `<tempDir>/notes` is not reopened.
5. In the running application, trigger `File -> Close Folder` (or click `Close` in the sidebar) and exit Clarity; inspect `settings.json` and verify `lastFolder` and `lastFile` are saved as `null`.

## Risks

| Risk | Mitigation |
|------|------------|
| Restored `lastFolder` or `lastFile` path has been deleted, moved, or permissions revoked since last session. | **In-scope**. The main process wraps permission grants in `restoreSessionFolder` and `restoreSessionFile` in `try...catch`. On error, `settings.update` clears the invalid path and returns `null`, enabling `<App />` to start gracefully with an empty workspace without error modals. |
| Concurrency / ordering race between `getInitialFolder()` and `getInitialFile()` resolving on mount. | **In-scope**. Promise chain in `App.tsx` awaits `api.getInitialFolder()` and applies `setFolder()` first, before resolving `api.getInitialFile()` and calling `openPath()`. Setting `folder` directly avoids calling `enterFolder()` which would reset `doc`. |
| Creating a new file (Ctrl+N) or closing a folder fails to clear `lastFile` in settings before quit. | **In-scope**. `api.watchDocument(doc.path)` executes on every change to `doc.path`. When `doc.path` is `null`, `watchDocument(null)` immediately updates `lastFile: null` in settings. Similarly, `enterFolder(null)` sets both `lastFolder: null` and `lastFile: null`. |
| Closing a folder with unsaved edits might discard changes. | **In-scope**. `closeFolder()` runs through `exclusive()` and prompts the user via `settleUnsavedChanges(doc)` (Save, Discard, Cancel) before clearing the folder. |

## Open Questions

- **CLI File Launch Sidebar State**: Should launching Clarity with an explicit file argument (`clarity file.md`) keep the sidebar empty or restore the previous session folder?
  - *Proposed Default*: Keep the sidebar empty (`initialFolder: null`). Acceptance criteria 1 and 2 specify restoring folder and file "When opening Clarity without file arguments", while criterion 3 states launching with explicit file arguments opens that file. Opening with an empty sidebar ensures isolated focus on the targeted document without distraction from previous unrelated project trees.
- **Close Folder Accelerator**: Shortcut assignment for the new "Close Folder" command.
  - *Proposed Default*: Assign `CmdOrCtrl+Alt+W` in `src/shared/shortcuts.ts` and `src/main/menu.ts`. This provides a standard accelerator that does not collide with `CmdOrCtrl+W` (close window) or `CmdOrCtrl+Shift+W`.

## Acceptance Criteria

- [ ] When opening Clarity without file arguments, the folder open at last quit is automatically reopened in the sidebar
- [ ] When opening Clarity without file arguments, the file open at last quit is automatically reopened in the editor and preview
- [ ] Launching Clarity with an explicit file argument (via CLI or file manager) opens that file instead of restoring the previous session file
- [ ] If the saved file or folder no longer exists or cannot be accessed, Clarity starts gracefully with an empty workspace rather than failing
- [ ] Closing the folder or clearing the open file before exiting clears the saved session so they are not reopened on next start
- [ ] All tasks completed
- [ ] Type check passes (`npm run typecheck`)
- [ ] Lint passes (`npm run lint`)
- [ ] Tests pass (`npm test`)
- [ ] Follows existing patterns
