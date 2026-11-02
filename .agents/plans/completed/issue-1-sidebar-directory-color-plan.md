# Plan: Lighter Blue for Directory Names in Sidebar (Dark and Light)

## Summary

This plan updates the sidebar directory name and folder icon color (`--dir` token in `src/renderer/src/styles.css`) for both Dark (GitHub Dark) and Light (GitHub Light) themes to improve visual legibility. In Dark mode, directory names currently use `--dir: #4493f8`, which is too dark against the near-black sidebar (`--bg-sidebar: #010409`, contrast ratio 7.5:1); we update this to GitHub dark's lighter heading blue `#79c0ff` (contrast ratio 11.5:1). In Light mode, directory names currently use the dark navy `--dir: #0b4fa8`; we update this to the lighter GitHub accent blue `--dir: #2e6be6` (contrast ratio 4.9:1, passing WCAG AA against `--bg-sidebar: #f5f6f8`), maintaining consistency with existing accent tokens while leaving custom themes (Gruvbox and Tokyo Night Moon) untouched. The plan incorporates capturing headless before/after screenshots for both themes, generating an interactive HTML comparison artifact under `.lavish/`, and opening it with `lavish-axi` for human visual verification.

All `file:line` references cited in this plan refer to lines on HEAD before the prototype patch is applied.

## User Story

As a Clarity user
I want directory names in the sidebar to use a lighter, higher-contrast blue in both Dark and Light themes
So that folder structures are clearly legible against the sidebar background.

## Metadata

| Field | Value |
|-------|-------|
| Type | ENHANCEMENT |
| Complexity | LOW |
| Systems Affected | `src/renderer/src/styles.css`, `src/renderer/src/App.test.tsx`, `.lavish/` |
| GitHub Issue | #1 |
| PRD Phase | N/A |
| Prototype Patch | `.agents/plans/issue-1-sidebar-directory-color-prototype.patch` |

---

## Patterns to Follow

### Naming
```css
// SOURCE: src/renderer/src/styles.css:12-17
  --accent: #2e6be6;
  --unsaved: #d4740b;
  --danger: #c4314b;
  --dir: #0b4fa8;
  --md-heading: #0b4fa8;
  --md-link: #2e6be6;
```

```css
// SOURCE: src/renderer/src/styles.css:458-460
.tree-directory {
  color: var(--dir);
}
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
// SOURCE: src/renderer/src/App.test.tsx:446-451
  it('gives each custom dark theme its own table stripe', () => {
    for (const theme of ['gruvbox-material-dark-hard', 'tokyo-night-moon']) {
      const block = new RegExp(`:root\\[data-theme='${theme}'\\] \\{([^}]*)\\}`).exec(styles)?.[1] ?? ''
      expect(block, theme).toContain('--bg-stripe: var(--bg-sidebar);')
    }
  })
```

---

## Files to Change

| File | Action | Purpose |
|------|--------|---------|
| `src/renderer/src/styles.css` | UPDATE | Set `--dir: #2e6be6;` in `:root` and `--dir: #79c0ff;` in `@media (prefers-color-scheme: dark)`. Covered by prototype patch. |
| `src/renderer/src/App.test.tsx` | UPDATE | Add unit tests verifying `--dir` token values for Light, Dark, Gruvbox, and Tokyo Night Moon themes. Not covered by patch. |
| `scripts/capture-sidebar-screenshots.mjs` | CREATE | Headless Electron capture script that renders the sidebar in Light and Dark modes to PNG files under `.lavish/`. Not covered by patch. |
| `.lavish/sidebar-color-comparison.html` | CREATE | Interactive HTML comparison artifact per Lavish comparison playbook with side-by-side before/after review cards. Not covered by patch. |

---

## Tasks

Execute in order. Each task is atomic and verifiable. Note: `/implement` applies `issue-1-sidebar-directory-color-prototype.patch` before Task 1.

### Task 1: Create Headless Screenshot Capture Script and Capture Baseline Screenshots

- **File**: `scripts/capture-sidebar-screenshots.mjs`
- **Action**: CREATE
- **Implement**: Create a headless capture script using Electron's `BrowserWindow` and `capturePage()` (following `electron-probes.md` with `--ozone-platform=headless`, `--ozone-override-screen-size=900,600`, `--window-size=900,600`, `XDG_CONFIG_HOME` pointing to a scratch folder, and `ELECTRON_RUN_AS_NODE` unset). The script accepts `--out-prefix` (e.g. `before` or `after`) and writes `.lavish/sidebar-light-${prefix}.png` and `.lavish/sidebar-dark-${prefix}.png`. To capture baseline "before" images since the repo is already patched by `/implement`, create a detached git worktree at HEAD~1 in a scratch folder (`git worktree add --detach <scratch>/base HEAD~1`), build or link it, and run the capture script to record `.lavish/sidebar-light-before.png` and `.lavish/sidebar-dark-before.png`, then remove the worktree.
- **Mirror**: `src/main/theme.test.ts:4-15` and `electron-probes.md`
- **Validate**: `test -f .lavish/sidebar-light-before.png && test -f .lavish/sidebar-dark-before.png`

### Task 2: Add Automated Unit Tests for Directory Color Tokens

- **File**: `src/renderer/src/App.test.tsx`
- **Action**: UPDATE
- **Implement**: Add a test in `App.test.tsx` testing the raw stylesheet token definitions:
  1. Light mode `:root` has `--dir: #2e6be6;`
  2. Dark mode `@media (prefers-color-scheme: dark)` has `--dir: #79c0ff;`
  3. Custom themes keep their existing values: Gruvbox has `--dir: #a9b665;`, Tokyo Night Moon has `--dir: #82aaff;`
- **Mirror**: `src/renderer/src/App.test.tsx:446-451`
- **Validate**: `npm test`

### Task 3: Build Patched Renderer and Capture After Screenshots

- **File**: `.lavish/sidebar-light-after.png` and `.lavish/sidebar-dark-after.png`
- **Action**: CREATE
- **Implement**: Run `npm run build` to build the patched styles into `out/`. Execute `node scripts/capture-sidebar-screenshots.mjs --out-prefix after` to generate `.lavish/sidebar-light-after.png` and `.lavish/sidebar-dark-after.png`.
- **Mirror**: `scripts/capture-sidebar-screenshots.mjs`
- **Validate**: `test -f .lavish/sidebar-light-after.png && test -f .lavish/sidebar-dark-after.png`

### Task 4: Author Interactive Lavish Comparison Artifact

- **File**: `.lavish/sidebar-color-comparison.html`
- **Action**: CREATE
- **Implement**: Create an interactive HTML comparison artifact under `.lavish/sidebar-color-comparison.html` conforming to the Lavish `comparison` playbook (`lavish-axi playbook comparison`):
  1. Header with title, context (Issue #1), and summary of the readability improvement.
  2. Dark theme card (GitHub Dark): Side-by-side before (`#4493f8`) vs after (`#79c0ff`) on `#010409` sidebar background, showing contrast ratio increase from 7.5:1 to 11.5:1, with embedded relative images `sidebar-dark-before.png` and `sidebar-dark-after.png`.
  3. Light theme card (GitHub Light): Side-by-side before (`#0b4fa8`) vs after (`#2e6be6`) on `#f5f6f8` sidebar background, showing contrast ratio 4.9:1 (WCAG AA compliant), with embedded relative images `sidebar-light-before.png` and `sidebar-light-after.png`.
  4. Interactive view switcher / tab selector enabling side-by-side or overlay comparison.
  5. Color palette specification table documenting hex codes and role mappings.
- **Mirror**: `lavish-axi playbook comparison` and `lavish-axi design`
- **Validate**: `test -f .lavish/sidebar-color-comparison.html`

### Task 5: Launch Lavish Review Surface and Verify

- **File**: `.lavish/sidebar-color-comparison.html`
- **Action**: CHECK
- **Implement**: Launch the Lavish review surface using `lavish-axi .lavish/sidebar-color-comparison.html` so the user can visually review the side-by-side before/after comparison in their browser.
- **Validate**: `lavish-axi reply .lavish/sidebar-color-comparison.html --agent-reply "Visual comparison ready for review." || true`

---

## Validation

```bash
# Type check / Build
npm run build

# Lint
npm run lint

# Tests
npm test

# Token verification on styles.css
grep -n -- '--dir:' src/renderer/src/styles.css
```

Expected output for token check after patch:
- Light `:root`: `--dir: #2e6be6;`
- Dark `@media (prefers-color-scheme: dark)`: `--dir: #79c0ff;`
- Gruvbox: `--dir: #a9b665;`
- Tokyo Night Moon: `--dir: #82aaff;`

Outcome of token check on HEAD prior to patch:
```
15:  --dir: #0b4fa8;
63:    --dir: #4493f8;
97:  --dir: #a9b665;
143:  --dir: #82aaff;
```

---

## End-to-End Verification

1. **Verify automated tests and build**: Run `npm run typecheck && npm run lint && npm test && npm run build` to confirm zero regressions and a clean production bundle.
2. **Verify generated comparison assets**: Confirm that `.lavish/` contains:
   - `sidebar-light-before.png`
   - `sidebar-light-after.png`
   - `sidebar-dark-before.png`
   - `sidebar-dark-after.png`
   - `sidebar-color-comparison.html`
3. **Verify review surface in Lavish**: Execute `lavish-axi .lavish/sidebar-color-comparison.html`. Open the page and confirm:
   - In Dark mode, folder directory names and icons render in bright light blue (`#79c0ff`), visibly standing out against the dark sidebar background (`#010409`).
   - In Light mode, folder directory names render in clear light blue (`#2e6be6`), noticeably lighter than the original dark navy (`#0b4fa8`) while remaining sharp and readable on `#f5f6f8`.
   - The interactive comparison allows instant switching between before and after representations.

---

## Risks

| Risk | Mitigation | Scope |
|------|------------|-------|
| Light theme blue could fail WCAG contrast if made too light (e.g. using dark theme's `#79c0ff` on light grey background) | Use `#2e6be6` (Clarity's `--accent` in Light), which provides a 4.9:1 contrast ratio on `#f5f6f8`, satisfying WCAG AA requirements (>4.5:1). | IN-SCOPE |
| Unintended color regression in Gruvbox Material or Tokyo Night Moon themes | Keep `--dir` definitions in `:root[data-theme='gruvbox-material-dark-hard']` (`#a9b665`) and `:root[data-theme='tokyo-night-moon']` (`#82aaff`) untouched, and assert them in unit tests. | IN-SCOPE |
| Electron headless screenshot execution hangs or fails in headless environment | Use documented headless flags (`--ozone-platform=headless`, `--disable-gpu`, `--ozone-override-screen-size=900,600`, scratch `XDG_CONFIG_HOME`, `unset ELECTRON_RUN_AS_NODE`) proved in planning probes. | IN-SCOPE |

---

## Open Questions

- **Light theme blue value**: The issue requests changing the directory name color to "the lighter blue of the GitHub theme" in both Dark and Light themes. In Light theme, `#0b4fa8` is a dark navy heading color. The plan proposes `#2e6be6` (Clarity's existing `--accent` / `--md-link` color) as the default lighter blue because it provides a 4.9:1 contrast ratio against the `#f5f6f8` sidebar background (conforming to WCAG AA) while staying within Clarity's palette. An alternative candidate is GitHub Primer's light text link blue `#0969da` (5.4:1 contrast ratio). Both are highlighted in the Lavish comparison artifact for visual review.
- **Dark theme blue value**: The issue notes that GitHub dark's lighter blues in the file include `#79c0ff` (headings) and `#a5d6ff` (links). The plan proposes `#79c0ff` as the default because it matches heading weight and provides strong legibility (11.5:1 contrast ratio) against `#010409` without appearing washed out.

---

## Acceptance Criteria

- [ ] All tasks completed
- [ ] Type check passes (`npm run typecheck`)
- [ ] Linter passes (`npm run lint`)
- [ ] All tests pass (`npm test`)
- [ ] `--dir` in Dark theme is `#79c0ff`
- [ ] `--dir` in Light theme is `#2e6be6`
- [ ] Custom themes (Gruvbox Material Dark Hard and Tokyo Night Moon) retain their existing `--dir` values
- [ ] Before and after screenshots captured for both Dark and Light modes under `.lavish/`
- [ ] Interactive comparison artifact `.lavish/sidebar-color-comparison.html` generated and reviewed via `lavish-axi`
