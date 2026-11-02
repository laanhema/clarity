# TODO Issues

Source: `TODO.md`
Created: 2026-11-02

## Skipped

None.

## [TODO-1] Reopen last opened file and folder on startup

**GitHub**: #9
**Type**: Feature
**GitHub Label**: enhancement
**Priority**: Medium
**Complexity**: Medium
**Labels**: enhancement
**Source**: `TODO.md:1` — "I wish when opening the app again it would automatically open again the file and folder I had open last time."

### Description

Automatically restore the previously active folder and open Markdown file when launching Clarity without arguments. This saves users from having to manually re-navigate to their workspace and active document on every app restart.

### Acceptance Criteria

- [ ] When opening Clarity without file arguments, the folder open at last quit is automatically reopened in the sidebar
- [ ] When opening Clarity without file arguments, the file open at last quit is automatically reopened in the editor and preview
- [ ] Launching Clarity with an explicit file argument (via CLI or file manager) opens that file instead of restoring the previous session file
- [ ] If the saved file or folder no longer exists or cannot be accessed, Clarity starts gracefully with an empty workspace rather than failing
- [ ] Closing the folder or clearing the open file before exiting clears the saved session so they are not reopened on next start

### Technical Notes

- Persist last active workspace state (`lastFolder: string | null`, `lastFile: string | null`) in `Settings` managed by `src/main/settings.ts`.
- Update session state when entering folders or opening/closing documents via IPC in `src/main/ipc.ts`.
- In `src/main/index.ts`, when `initialFile` is null, resolve and grant permissions for the last folder and file via `AccessScope` before sending to renderer.
- Handle edge cases in `src/renderer/src/App.tsx` where restored paths may have been deleted, moved, or modified externally.
- Ensure strict access scoping per `src/main/accessScope.ts` and `src/main/pathGuard.ts`.

### Dependencies

- Blocked by: none
- Blocks: none
