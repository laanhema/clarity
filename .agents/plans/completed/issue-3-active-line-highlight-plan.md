# Plan: Suppress Active Line Highlight Until Editor Receives Focus

## Summary

When a Markdown document is opened in Clarity, CodeMirror initializes its selection at offset 0 (line 1). Because CodeMirror's `highlightActiveLine()` extension unconditionally attaches the `.cm-activeLine` class to the line holding the cursor, and Clarity's `editorTheme` previously styled `.cm-activeLine` with `backgroundColor: 'var(--editor-active-line)'` regardless of editor focus, the first line appeared active/selected immediately upon opening a file before any user interaction.

This plan fixes the issue by updating `editorTheme` in `src/renderer/src/components/Editor.tsx` so that `.cm-activeLine` defaults to `backgroundColor: 'transparent'`, and only applies `backgroundColor: 'var(--editor-active-line)'` when the editor container has focus (`&.cm-focused`). Explicitly setting `.cm-activeLine` to `transparent` also overrides CodeMirror's internal base theme (`#cceeff44`). When a file opens, the editor is not focused, so no line highlight is visible. As soon as the user clicks in the editor or moves into it via keyboard, `.cm-focused` is added to the editor DOM, activating the highlight. The plan is accompanied by a prototype patch covering `Editor.tsx`, a new test in `src/renderer/src/App.test.tsx`, and full validation.

All `file:line` references cited in this plan refer to lines on HEAD before the prototype patch is applied.

## User Story

As a Clarity user opening a Markdown file
I want the editor not to highlight the first line until I click or move into the editor
So that the editor does not appear to have an active selection before I have interacted with it.

## Metadata

| Field | Value |
|-------|-------|
| Type | BUG_FIX |
| Complexity | LOW |
| Systems Affected | `src/renderer/src/components/Editor.tsx`, `src/renderer/src/App.test.tsx` |
| GitHub Issue | #3 |
| PRD Phase | N/A |
| Prototype Patch | `.agents/plans/issue-3-active-line-highlight-prototype.patch` |

---

## Patterns to Follow

### Naming
```typescript
// SOURCE: src/renderer/src/components/Editor.tsx:63-67
  '&.cm-focused > .cm-scroller > .cm-rowSelectionLayer .cm-selectionBackground, .cm-selectionBackground, ::selection':
    { backgroundColor: 'var(--editor-selection)' },
  // Painted only behind the text, not the padding, so it spans the same
  // column as a selection does.
  '.cm-activeLine': { backgroundColor: 'var(--editor-active-line)', backgroundClip: 'content-box' },
```

### Error Handling
```typescript
// SOURCE: src/renderer/src/text.ts:19-22
export function errorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error)
  return raw.replace(/^Error invoking remote method '[^']+': (?:\w*Error: )?/, '')
}
```

### Tests
```typescript
// SOURCE: src/renderer/src/App.test.tsx:482-489
  // CodeMirror leaves the line padding out of a selection, so an active line
  // painted into that padding stuck out past the selection on both sides.
  it('paints the active line and the selection over the same column', async () => {
    await openFirstFileAndEdit()
    const root = editorRoot()
    const css = [...root.querySelectorAll('style')].map((style) => style.textContent).join('\n')
    expect(css).toMatch(/\.cm-activeLine \{[^}]*background-clip: content-box/)
    expect(css).toMatch(/\.cm-selectionLayer \{[^}]*display: none/)
    expect(root.querySelector('.cm-rowSelectionLayer')).not.toBeNull()
  })
```

---

## Files to Change

| File | Action | Purpose |
|------|--------|---------|
| `src/renderer/src/components/Editor.tsx` | UPDATE | Set `.cm-activeLine` default background to `transparent` and style `var(--editor-active-line)` only under `&.cm-focused`. Covered by prototype patch. |
| `src/renderer/src/App.test.tsx` | UPDATE | Add regression test verifying that line 1 is not highlighted when opening a file, and becomes highlighted when the editor receives focus. Not covered by patch. |

---

## Tasks

Execute in order. Each task is atomic and verifiable. Note: `/implement` applies `.agents/plans/issue-3-active-line-highlight-prototype.patch` before Task 1.

### Task 1: Add Automated Regression Test for Active Line Focus Behavior

- **File**: `src/renderer/src/App.test.tsx`
- **Action**: UPDATE
- **Implement**: Add a new test under `describe('selecting text in the editor', ...)` in `src/renderer/src/App.test.tsx`:
  1. Render `<App />` and open `first.md` via folder button and sidebar file button.
  2. Wait for document to load (`await waitFor(() => expect(editorText()).toBe('# First'))`).
  3. Query `editorRoot()`: verify that `.cm-editor` does not have class `.cm-focused`.
  4. Inspect the shadow root styles: assert that `.cm-activeLine` has `background-color: transparent` and that `cm-focused .cm-activeLine` has `background-color: var(--editor-active-line)`.
  5. Click the editor (`await user.click(editor())`): verify that `.cm-editor` gains class `.cm-focused`.
- **Mirror**: `src/renderer/src/App.test.tsx:482-489`
- **Validate**: `npx vitest run src/renderer/src/App.test.tsx -t "does not highlight the active line until the editor is focused"`

### Task 2: Validate Entire Test, Typecheck, and Lint Suite

- **File**: `src/renderer/src/App.test.tsx`
- **Action**: CHECK
- **Implement**: Run full project verification commands to verify clean builds, zero typecheck issues, zero lint errors, and all 27 test suites passing (303 tests).
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

# Reproduction (BUG_FIX): red on unfixed code, green after the fix
npx vitest run src/renderer/src/App.test.tsx -t "does not highlight the active line until the editor is focused"

# Scratch check on Editor.tsx rules
grep -A 2 "'\.cm-activeLine'" src/renderer/src/components/Editor.tsx
```

Outcome of scratch check on HEAD prior to patch:
```
  '.cm-activeLine': { backgroundColor: 'var(--editor-active-line)', backgroundClip: 'content-box' },
  '.cm-selectionMatch': { backgroundColor: 'var(--editor-match)' },
  '.cm-searchMatch': { backgroundColor: 'var(--editor-match)', outline: '1px solid var(--border)' },
```

Expected output for scratch check after patch:
```
  '.cm-activeLine': { backgroundColor: 'transparent', backgroundClip: 'content-box' },
  '&.cm-focused .cm-activeLine': { backgroundColor: 'var(--editor-active-line)' },
  '.cm-selectionMatch': { backgroundColor: 'var(--editor-match)' },
```

---

## End-to-End Verification

1. **Automated Verification**: Run `npm run typecheck && npm run lint && npm test` to verify that all 27 test suites pass cleanly with 303 passed tests.
2. **Interactive UI Verification**:
   - Start the development server with `npm run dev`.
   - Open any directory with Markdown files.
   - Click a document in the sidebar to open it.
   - Verify visually that the first line of the document does not show an active line highlight background.
   - Click anywhere in the editor text: verify that the line containing the text cursor is immediately highlighted.
   - Navigate lines with the Up/Down arrow keys: verify that the highlight follows the cursor.
   - Click outside the editor (e.g. on the preview pane or the sidebar): verify that the active line highlight is cleared while the editor is unfocused.

---

## Risks

| Risk | Mitigation | Scope |
|------|------------|-------|
| CodeMirror base theme default styles (`.ͼ2 .cm-activeLine { background-color: #cceeff44; }`) could show a faint highlight when unfocused if `.cm-activeLine` is not overridden. | Explicitly define `.cm-activeLine: { backgroundColor: 'transparent', backgroundClip: 'content-box' }` in `editorTheme`, which overrides CodeMirror's base theme rule. | IN-SCOPE |
| Existing test `paints the active line and the selection over the same column` expects `/\.cm-activeLine \{[^}]*background-clip: content-box/`. | Preserve `backgroundClip: 'content-box'` on `.cm-activeLine` directly so the existing test passes without alteration. | IN-SCOPE |
| Active line highlight clears when clicking in preview or sidebar. | In desktop editors and CodeMirror (which hides `.cm-cursor` when unfocused), active line indication is tied to editor focus (`.cm-focused`). Clearing it on blur prevents misleading focus indication while interacting with other panes. | IN-SCOPE |

---

## Open Questions

- **Active line visibility on blur**:
  - The issue specifies: "After opening a file, no line is highlighted until the user clicks in the editor (or otherwise moves into it)."
  - When the editor loses focus later (e.g. clicking the sidebar, status bar, or preview), should the line highlight clear, or remain?
  - Proposed default & rationale: Clear the highlight when the editor loses focus (via `&.cm-focused`). This follows standard desktop text editor behavior (Sublime Text, VS Code), matches CodeMirror's own behavior for the cursor (which hides `.cm-cursor` when unfocused), and prevents the editor from appearing focused while the user is actively working in another pane.

---

## Acceptance Criteria

- [ ] All tasks completed
- [ ] Type check passes (`npm run typecheck`)
- [ ] Linter passes (`npm run lint`)
- [ ] All unit and component tests pass (`npm test`)
- [ ] Opening a file shows no active-line highlight
- [ ] Clicking in the editor or moving the cursor shows the highlight
- [ ] Covered by regression test in `src/renderer/src/App.test.tsx`
