# Plan: Open a file Clarity is launched with (Open with, command line)

## Summary

When Clarity is launched with a Markdown file path on the command line, through a file manager's "Open with", or via desktop launcher drag-and-drop, it currently ignores the argument and opens an empty "Untitled" window. In addition, launching a second instance spawns a duplicate app process instead of focusing the existing window.

This plan implements command-line and external launch file opening with single-instance enforcement and full security isolation. On startup, `app.requestSingleInstanceLock()` ensures only one primary instance of Clarity runs. If a second instance is launched, it immediately forwards its arguments and working directory to the primary instance via Electron's `second-instance` event and terminates. Candidate file paths are extracted using a dedicated parser (`src/main/launchArgs.ts`) that skips flags, respects the `--` options delimiter, and filters for Markdown extensions (`.md`, `.markdown`). The file path is granted through `AccessScope.grantFile()`, ensuring that only that specific file becomes readable, preserving existing security boundaries.

For window lifecycle, an initial launch file is requested by `<App />` on mount via `api.getInitialFile()`, avoiding race conditions between window creation and React hydration. Runtime file launches (from `second-instance` or macOS `open-file`) push `IpcChannel.FilePicked` to the window, where the renderer's `openPath()` handles unsaved change prompts (`Save`, `Don't Save`, `Cancel`) before switching documents. The Linux desktop entry in `package.json` is updated with `MimeType=text/markdown;text/x-markdown;`, `README.md` documents the feature, and an interactive review surface is generated under `.lavish/` and verified with `lavish-axi`. The core code and unit tests are supplied via `.agents/plans/issue-4-open-file-on-launch-prototype.patch`.

All `file:line` references cited in this plan refer to lines on HEAD before the prototype patch is applied.

## User Story

As a desktop user opening a Markdown document from a terminal or file manager
I want Clarity to open the specified Markdown file and bring its existing window to focus
So that I can immediately view and edit my document without creating duplicate application windows or losing unsaved work.

## Metadata

| Field | Value |
|-------|-------|
| Type | ENHANCEMENT |
| Complexity | MEDIUM |
| Systems Affected | `src/main/index.ts`, `src/main/ipc.ts`, `src/main/windowState.ts`, `src/main/launchArgs.ts`, `src/shared/api.ts`, `src/preload/index.ts`, `src/renderer/src/App.tsx`, `src/renderer/src/test/mockApi.ts`, `src/renderer/src/App.test.tsx`, `package.json`, `README.md`, `.lavish/` |
| GitHub Issue | #4 |
| PRD Phase | N/A |
| Prototype Patch | `.agents/plans/issue-4-open-file-on-launch-prototype.patch` |

---

## Patterns to Follow

### Naming
```typescript
// SOURCE: src/shared/api.ts:154-159
  /** Subscribes to folders picked from the Open Recent menu; the listener answers with `enterFolder`. */
  onFolderPicked(listener: (rootPath: string) => void): () => void
  /** Subscribes to changes of the watched document made by other programs. */
  onDocumentChanged(listener: (path: string) => void): () => void
  /** Subscribes to Markdown files being added to or removed from the open folder. */
  onTreeChanged(listener: () => void): () => void
```

### Error Handling
```typescript
// SOURCE: src/main/ipc.ts:84-90
    await dialog.showMessageBox(state.window, {
      type: 'error',
      message: `"${path.basename(folder)}" can no longer be opened.`,
      detail: `${folder}\n\nIt was removed from Open Recent.`,
    })
    return
```

### Tests
```typescript
// SOURCE: src/main/pathGuard.test.ts:24-30
describe('isMarkdownPath', () => {
  it('matches .md and .markdown in any case', () => {
    expect(isMarkdownPath('a.md')).toBe(true)
    expect(isMarkdownPath('a.MD')).toBe(true)
    expect(isMarkdownPath('a.markdown')).toBe(true)
    expect(isMarkdownPath('a.txt')).toBe(false)
  })
})
```

```typescript
// SOURCE: src/renderer/src/App.test.tsx:114-123
  it('stays on the current file when the user cancels', async () => {
    const user = await openFirstFileAndEdit()
    mock.api.confirmUnsaved.mockResolvedValue('cancel')
    await user.click(screen.getByRole('button', { name: 'second.md' }))

    await waitFor(() => expect(mock.api.confirmUnsaved).toHaveBeenCalledWith('first.md'))
    expect(editorText()).toBe('# First edited')
    expect(mock.api.readFile).not.toHaveBeenCalledWith('/notes/second.md')
    expect(mock.api.writeFile).not.toHaveBeenCalled()
  })
```

---

## Files to Change

| File | Action | Purpose |
|------|--------|---------|
| `src/main/launchArgs.ts` | CREATE | Pure argument parsing helper to extract the first valid Markdown file from CLI `argv` with working directory resolution. Covered by prototype patch. |
| `src/main/launchArgs.test.ts` | CREATE | Unit tests covering option skipping, `--` delimiter, relative/absolute path resolution, and non-markdown filtering. Covered by prototype patch. |
| `src/shared/api.ts` | UPDATE | Add `getInitialFile()` and `onFilePicked()` to `ClarityApi`; declare `IpcChannel.GetInitialFile` and `IpcChannel.FilePicked`. Covered by prototype patch. |
| `src/preload/index.ts` | UPDATE | Bridge `getInitialFile` and `onFilePicked` via `ipcRenderer`. Covered by prototype patch. |
| `src/main/windowState.ts` | UPDATE | Add `initialFile: Promise<string \| null> \| null` to `WindowState` interface and `trackWindow`. Covered by prototype patch. |
| `src/main/ipc.ts` | UPDATE | Implement `openFileFromExternal(state, targetPath)` helper and register `IpcChannel.GetInitialFile` handler. Covered by prototype patch. |
| `src/main/index.ts` | UPDATE | Enforce single-instance lock via `app.requestSingleInstanceLock()`, wire `second-instance` and `open-file` listeners, resolve startup file and pass to `createWindow()`. Covered by prototype patch. |
| `src/renderer/src/App.tsx` | UPDATE | Fetch initial file on mount via `api.getInitialFile()`, and subscribe to `api.onFilePicked()` to open incoming files through `openPath()`. Covered by prototype patch. |
| `src/renderer/src/test/mockApi.ts` | UPDATE | Mock `getInitialFile` and `onFilePicked`, add `pickFileFromExternal()` testing simulation helper. Covered by prototype patch. |
| `src/renderer/src/App.test.tsx` | UPDATE | Add tests for initial file launch, runtime external file open, and unsaved changes dirty prompt handling. Covered by prototype patch. |
| `package.json` | UPDATE | Declare `MimeType=text/markdown;text/x-markdown;` in `build.linux.desktop.entry`. Covered by prototype patch. |
| `README.md` | UPDATE | Document command-line file launching, "Open with" support, single instance semantics, and security guarantees. Covered by prototype patch. |
| `.lavish/issue-4-open-file-review.html` | CREATE | Interactive visual review artifact illustrating flow, state machine, simulated CLI launcher, and security boundary review. Not covered by patch. |

---

## Tasks

Execute in order. Each task is atomic and verifiable. Note: `/implement` applies `.agents/plans/issue-4-open-file-on-launch-prototype.patch` before Task 1.

### Task 1: Verify Unit and Component Test Suite for Launch Args and App Integration

- **File**: `src/main/launchArgs.test.ts`, `src/renderer/src/App.test.tsx`
- **Action**: CHECK
- **Implement**: Run Vitest on `src/main/launchArgs.test.ts` and `src/renderer/src/App.test.tsx` to verify that all 8 argument-parsing unit tests and all 60 App tests (including the 3 new tests for startup launch, second-instance open, and dirty prompt preservation) pass.
- **Mirror**: `package.json:18`
- **Validate**: `npx vitest run src/main/launchArgs.test.ts src/renderer/src/App.test.tsx`

### Task 2: Create Interactive Lavish Review Artifact

- **File**: `.lavish/issue-4-open-file-review.html`
- **Action**: CREATE
- **Implement**: Create an interactive HTML review artifact under `.lavish/issue-4-open-file-review.html` using the Lavish design system (Tailwind v4 CDN + DaisyUI v5 CDN) combining the `plan`, `diagram`, `comparison`, and `explanation` playbooks:
  1. **Header & Context**: Title, badges (Issue #4, Single Instance, Security Sandboxed), and overview summary.
  2. **Architecture & State Machine Diagram**: Inline SVG diagram illustrating:
     - Startup path: `process.argv` -> `parseLaunchFilePath` -> `AccessScope.grantFile` -> `createWindow` -> `api.getInitialFile` -> `openPath`
     - Runtime path: `second-instance` / `open-file` -> `window.restore()` + `focus()` -> `openFileFromExternal` -> `IpcChannel.FilePicked` -> `settleUnsavedChanges` -> `openPath`
     - Security sandbox: `AccessScope` isolation ensuring only the target file is granted into `#files`.
  3. **Interactive Simulation Panel**:
     - Mode 1: *Cold Start with File* (simulates launching `clarity notes.md` with empty initial state).
     - Mode 2: *Second Instance (Clean Document)* (simulates sending `another.md` to a running instance).
     - Mode 3: *Second Instance (Dirty Document)* (simulates sending `another.md` while current file has unsaved edits; allows clicking "Save", "Don't Save", or "Cancel" to inspect state outcome).
     - Mode 4: *Invalid / Non-Markdown Argument* (simulates passing `--flag` or `image.png` or non-existent file).
  4. **Code Structure & Security Inspection**: Side-by-side view detailing main process, IPC contract, preload bridge, and renderer changes.
  5. **Verification Checklist**: Table of acceptance criteria and test coverage metrics.
- **Mirror**: `.lavish/issue-3-active-line-review.html`
- **Validate**: `test -f .lavish/issue-4-open-file-review.html`

### Task 3: Launch Lavish Review Surface and Verify

- **File**: `.lavish/issue-4-open-file-review.html`
- **Action**: CHECK
- **Implement**: Launch the Lavish review surface using `lavish-axi .lavish/issue-4-open-file-review.html` so the user can visually review the architecture, flow diagrams, and interactive simulator in their browser, and notify Lavish with `lavish-axi reply`.
- **Mirror**: `lavish-axi .lavish/issue-3-active-line-review.html`
- **Validate**: `lavish-axi reply .lavish/issue-4-open-file-review.html --agent-reply "Interactive review artifact for Issue #4 is ready for visual review." || true`

### Task 4: Full Suite Validation and Clean Build Check

- **File**: `package.json`
- **Action**: CHECK
- **Implement**: Execute the full project validation pipeline (`npm run typecheck && npm run lint && npm test`) to confirm zero type errors, zero lint warnings, and all 28 test suites passing (314 tests).
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

# Unit tests specific to launch argument parsing
npx vitest run src/main/launchArgs.test.ts

# Component tests for external launch handling
npx vitest run src/renderer/src/App.test.tsx -t "opens an initial file passed on launch"
npx vitest run src/renderer/src/App.test.tsx -t "opens a file passed from an external launch while running"
npx vitest run src/renderer/src/App.test.tsx -t "asks to save unsaved changes when an external launch arrives while dirty"

# Scratch check on index.ts single instance lock
grep -n "requestSingleInstanceLock" src/main/index.ts || echo "Not present on HEAD"

# Scratch check on launchArgs parser existence
grep -n "parseLaunchFilePath" src/main/launchArgs.ts 2>/dev/null || echo "launchArgs.ts does not exist on HEAD"
```

Outcome of scratch checks on HEAD prior to patch:
```
Not present on HEAD
launchArgs.ts does not exist on HEAD
```

Expected output for scratch checks after patch:
```
130:const gotSingleInstanceLock = app.requestSingleInstanceLock()
10:export function parseLaunchFilePath(argv: readonly string[], cwd: string): string | null {
```

---

## End-to-End Verification

1. **Automated Verification**: Run `npm run typecheck && npm run lint && npm test` to verify that all 28 test suites pass cleanly with 314 passed tests.
2. **Interactive CLI Launch Verification**:
   - Create a temporary Markdown file: `echo "# Launch Test" > /tmp/test-launch.md`.
   - Start the app with the file: `npx electron . /tmp/test-launch.md`.
   - Verify that Clarity opens directly to `/tmp/test-launch.md`, displaying `# Launch Test` in the editor and preview.
   - Clean up: `rm -f /tmp/test-launch.md`.
3. **Interactive Second-Instance Verification**:
   - While Clarity is running with `/tmp/test-launch.md`, edit the text to make it dirty (dot appears in title and status bar).
   - In a second terminal, execute `npx electron . /tmp/test-second.md`.
   - Verify that the second command exits immediately.
   - Verify that the existing Clarity window is brought to focus and displays the unsaved changes dialog: "Do you want to save the changes you made to test-launch.md?".
   - Click "Cancel": verify that Clarity remains on `/tmp/test-launch.md` with unsaved changes preserved.
   - Re-run `npx electron . /tmp/test-second.md` and click "Don't Save": verify that Clarity loads `/tmp/test-second.md`.
4. **Lavish Review Verification**:
   - Run `lavish-axi .lavish/issue-4-open-file-review.html`.
   - Verify in browser that all interactive state transitions and diagrams render with correct visual hierarchy and zero layout overflow.

---

## Risks

| Risk | Mitigation | Scope |
|------|------------|-------|
| Race condition during app launch where the renderer mounts after or before IPC events are dispatched | The initial file is stored on `WindowState.initialFile` as a Promise resolved during window setup, which the renderer pulls via `api.getInitialFile()` on mount. Subsequent launches use `IpcChannel.FilePicked` push. | In-scope |
| Malicious or non-markdown file paths passed through the command line (e.g. traversal or executable scripts) | `parseLaunchFilePath` checks `isMarkdownPath()`, and `AccessScope.grantFile()` resolves real paths on disk, ensuring only valid, existing Markdown files are granted into `#files`. | In-scope |
| Unsaved work lost when a second instance is launched with a different file | Handled via renderer's `openPath()` invoking `settleUnsavedChanges(doc)`, prompting the user to Save, Don't Save, or Cancel before switching documents. | In-scope |
| Second instance launched with no arguments stealing focus without action | When no Markdown argument is present in `second-instance`, the window is focused/restored without triggering document change or dialogs. | In-scope |
| Second instance window focus fails if the window was minimized or obscured | In `second-instance` handler, check `if (window.isMinimized()) window.restore()` prior to calling `window.focus()`. | In-scope |

---

## Open Questions

- **Sidebar folder visibility on external open**: Should opening a file from the command line or "Open with" also show its parent folder in the sidebar?
  - *Proposed default*: No. This matches the existing behavior of **File → Open File…**, which opens only the target document into the editor and preview without changing or requiring an open folder in the sidebar.
- **Multiple Markdown file arguments**: If multiple Markdown files are supplied on the command line (e.g. `clarity doc1.md doc2.md`), which file should Clarity open?
  - *Proposed default*: Clarity's single-window document model supports one active file at a time. The first valid Markdown file found in `argv` is opened; subsequent arguments are ignored.

---

## Acceptance Criteria

- [ ] All tasks completed
- [ ] Single-instance lock acquired; second instances hand off arguments and exit
- [ ] Command line argument parsing extracts Markdown files, respects `--`, and skips flags
- [ ] Startup file loaded cleanly without window-creation race conditions
- [ ] Second instance restores and focuses existing window, prompting if document has unsaved edits
- [ ] Security scoping strictly limits disk access to the granted file via `AccessScope.grantFile`
- [ ] `package.json` declares `MimeType=text/markdown;text/x-markdown;` in the Linux desktop entry
- [ ] `README.md` documents command-line usage, Open with, and single-instance behavior
- [ ] Type check, lint, and all test suites pass (`npm run typecheck && npm run lint && npm test`)
- [ ] Interactive review artifact created under `.lavish/` and launched via `lavish-axi`
