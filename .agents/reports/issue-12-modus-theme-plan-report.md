# Implementation Report

**Plan**: `.agents/plans/completed/issue-12-modus-theme-plan.md`
**Branch**: `kingpin/kp-add-new-theme`
**Status**: COMPLETE

## Summary

Added two theme entries, **Modus** (`modus`) and **Modus Tinted** (`modus-tinted`), built from the Emacs modus-themes 5.3.0 palettes. Both follow the system light/dark preference and switch live: Modus uses Operandi (light) and Vivendi (dark), and Modus Tinted uses Operandi Tinted and Vivendi Tinted. The production code came from the plan's prototype patch, which applied cleanly to HEAD: theme ids in `ThemeSetting`/`THEME_SETTINGS`, View → Theme items, `nativeThemeSource` → `'system'` with per-mode window backgrounds, the status-bar cycle (Tokyo Night → Modus → Modus Tinted → System), four Shiki themes in `modusThemes.ts`, four Mermaid palettes resolved by `diagramStyle()`, and the light and dark CSS variable blocks. This run added the tests and the docs, and ran the full gate and the headless end-to-end check.

The open questions were settled with the plan's proposed defaults: inline code uses a `bg-dim` chip, the selected sidebar row uses `bg-hl-line` and hover uses `bg-inactive`, and the labels are "Modus" / "Modus Tinted" in the menu and "Modus theme" / "Modus Tinted theme" in the status bar.

## Tasks Completed

| # | Task | File | Status |
|---|------|------|--------|
| 0 | Apply prototype patch (`git apply --check`, then `git apply`) | 9 source files | PASS |
| 1 | Confirm the patch builds; see exactly the 4 expected test failures (`4 failed \| 319 passed (323)`) | whole tree | PASS |
| 2 | Main-process tests: native source, window background, `sanitizeUiPatch`, View → Theme menu | `src/main/theme.test.ts`, `src/main/settings.test.ts`, `src/main/menu.test.ts` | PASS |
| 3 | Mermaid tests: `diagramStyle`, palette table, live switch on a system colour-scheme change | `src/renderer/src/markdown/mermaid.test.ts`, `src/renderer/src/components/MermaidDiagram.test.tsx` | PASS |
| 4 | Shiki tests: class list, variable order, Modus token colours, no italic comments | `src/renderer/src/markdown/pipeline.test.ts` | PASS |
| 5 | App/stylesheet tests: cycle, stripe, Dark-variable coverage, active-line count 8, font loop | `src/renderer/src/App.test.tsx` | PASS |
| 6 | Docs | `README.md`, `PROJECT-GUIDE.md` | PASS |
| 7 | Full gate and end-to-end check | whole tree | PASS |

## Validation Results

| Check | Result | Command / environment |
|-------|--------|-----------------------|
| Type check | PASS | `npm run typecheck`: host |
| Lint | PASS | `npm run lint`: host (run after typecheck, before tests, never in parallel) |
| Tests | PASS (328 passed, 28 files) | `npm test`: host |
| E2E step 1: build | PASS | `npm run build`: host |
| E2E step 3: active-line probe | PASS | `node scratch/activeline.mjs`: prints `exact` for operandi, vivendi, operandi-tinted, vivendi-tinted; the four X values match `styles.css` |
| E2E step 4: headless live-switch probe | PASS | `node scratch/e2e-modus.mjs "$PWD" scratch/e2e`: `ok` for modus light/dark and modus-tinted light/dark, exit 0. The same probe against a HEAD build (scratch `git archive HEAD` export) prints FAIL in all four modes and exits 1 |
| E2E step 5: screenshots | PASS | Read `modus-light.png`, `modus-dark.png`, `modus-tinted-light.png`, `modus-tinted-dark.png`: white/black and cream/navy pages, bg-dim workspace and status bar, purple or blue `const`, Mermaid nodes with accent borders, status bar reads "Modus theme" / "Modus Tinted theme" |
| E2E step 6: manual desktop check | PENDING | Owner-only (opens a window): `npm start`, View → Theme → Modus, switch OS light/dark, repeat with Modus Tinted, restart and check the choice is kept |

Scratch scripts and screenshots: `/home/lauri/.kingpin/tasks/kp-add-new-theme/scratch/` (`after-modus-light.png`, `after-modus-dark.png`, `after-modus-tinted-light.png`, `after-modus-tinted-dark.png`, `before-dark.png` from HEAD's Dark theme with the same document in split view).

## Files Changed

| File | Action | Lines |
|------|--------|-------|
| `src/shared/api.ts` | UPDATE (patch) | +10/-1 |
| `src/main/menu.ts` | UPDATE (patch) | +2/-0 |
| `src/main/theme.ts` | UPDATE (patch) | +12/-1 |
| `src/renderer/src/App.tsx` | UPDATE (patch) | +3/-1 |
| `src/renderer/src/components/StatusBar.tsx` | UPDATE (patch) | +3/-1 |
| `src/renderer/src/markdown/modusThemes.ts` | CREATE (patch) | +237 |
| `src/renderer/src/markdown/highlighter.ts` | UPDATE (patch) | +11/-1 |
| `src/renderer/src/markdown/mermaid.ts` | UPDATE (patch) | +166/-4 |
| `src/renderer/src/styles.css` | UPDATE (patch) | +265/-13 |
| `src/main/theme.test.ts` | UPDATE | +10/-1 |
| `src/main/settings.test.ts` | UPDATE | +2/-0 |
| `src/main/menu.test.ts` | UPDATE | +21/-2 |
| `src/renderer/src/markdown/mermaid.test.ts` | UPDATE | +11/-3 |
| `src/renderer/src/components/MermaidDiagram.test.tsx` | UPDATE | +21/-0 |
| `src/renderer/src/markdown/pipeline.test.ts` | UPDATE | +32/-2 |
| `src/renderer/src/App.test.tsx` | UPDATE | +31/-3 |
| `README.md` | UPDATE | +1/-1 |
| `PROJECT-GUIDE.md` | UPDATE | +1/-1 |

## Deviations from Plan

- `menu.test.ts`: the plan suggested the new test could check `options.setTheme`; that trips `@typescript-eslint/unbound-method`, so the test spreads the helper's options with its own `setTheme = vi.fn()` and asserts on that. The helper `template()` was split into `menuOptions()` + `build()` so the new test can pass its own options; the existing tests are unchanged.
- `theme.test.ts`: the four Modus `windowBackground` cases sit in their own `it` ("uses the light or dark Modus background as the system is light or dark") rather than appended to the existing one.
- E2E: the HEAD comparison and `before-dark.png` were taken from a scratch `git archive HEAD` export (with `node_modules` symlinked and built with `npx electron-vite build`) rather than by checking out HEAD, because the work stays uncommitted in the worktree. The export was deleted afterwards.
- The new "every variable the Dark block sets" test was checked with a negative control: deleting `--bg-stripe` from the Modus dark block made it fail with `modus dark: expected [ '--bg-stripe' ] to deeply equal []`; the file was restored byte-for-byte from a copy.

## Tests Written

| Test File | Test Cases |
|-----------|------------|
| `src/main/theme.test.ts` | native source `'system'` for `modus` / `modus-tinted` (retitled test); new "uses the light or dark Modus background as the system is light or dark" |
| `src/main/settings.test.ts` | `sanitizeUiPatch` keeps `modus` and `modus-tinted` |
| `src/main/menu.test.ts` | new "lists Modus and Modus Tinted under View → Theme and selects them" |
| `src/renderer/src/markdown/mermaid.test.ts` | `diagramStyle` light and dark for both ids; palette background/border/darkMode for all four palettes |
| `src/renderer/src/components/MermaidDiagram.test.tsx` | new "renders again in the other Modus palette when the system colour scheme changes" (stubbed `matchMedia`) |
| `src/renderer/src/markdown/pipeline.test.ts` | class list and variable order with the four Modus keys; new "colours code with the Modus palettes, plain and tinted, in light and dark" (8 tokens × 4 palettes, 4 backgrounds, no italic) |
| `src/renderer/src/App.test.tsx` | cycle through Modus and Modus Tinted; stripe for both ids; new "gives each Modus block every variable the Dark block sets"; 8 translucent active lines; font loop for both ids |
