# Code Review: kingpin/kp-add-new-theme

**Scope**: branch `kingpin/kp-add-new-theme` (issue #12)
**Recommendation**: APPROVE WITH NITS

## Summary

The branch has no commits of its own (its merge base with `main` is `HEAD`, d8db23e), so the diff is `git diff HEAD` plus the untracked `src/renderer/src/markdown/modusThemes.ts`: 18 files, about 600 changed lines. The plan, prototype patch and implementation report under `.agents/` were read as context. `origin/main` has since gained #13 (issue #2), which touches none of these files. The change adds Modus and Modus Tinted cleanly through every place a theme id touches. I resolved every hex value against upstream `modus-themes.el` 5.3.0 and found no mismatch, and the built app shows the expected colours in all four palettes. The one finding is that code highlighting now costs twice as much, because the plan's claim that highlighting is cached is wrong.

## Acceptance Criteria

| Criterion | Status | How known |
|-----------|--------|-----------|
| Selecting Modus or Modus Tinted colours both the editor and the preview | met | Headless probe of the built app (`scratch/review/scripts/e2e-modus.mjs`): editor and preview take the palette in all four modes; captures `scratch/review/e2e/*.png` show coloured Markdown in the editor and coloured headings, links, code and diagram in the preview |
| Modus uses the Modus Operandi palette when it is in light mode and the Modus Vivendi palette when it is in dark mode | met | `scratch/review/scripts/resolve.mjs` resolves each upstream mapping (bg-main, bg-dim, fg-heading-1..6, accent-0, fg-link, fg-prose-code, bg-hl-line, bg-region, and the font-lock mappings); every value in `styles.css:185-329`, `modusThemes.ts:39-87` and `mermaid.ts:200-267` matches. The probe reads `#ffffff`/`#000000` page, `#624416`/`#d2b580` h2, `#531ab6`/`#b6a0ff` keyword |
| Modus Tinted uses the Modus Operandi Tinted palette when it is in light mode and the Modus Vivendi Tinted palette when it is in dark mode | met | Same resolver for the tinted palettes (`styles.css:221-329`, `modusThemes.ts:89-137`, `mermaid.ts:268-335`); probe reads `#fbf7f0`/`#0d0e1c` page, `#a0132f`/`#b6a0ff` diagram border, `#f1d5d0`/`#303a6f` selected row |
| View → Theme lists "Modus" and "Modus Tinted", the status-bar theme button cycles through both, and the choice survives a restart | met | `menu.ts:48-49` with `menu.test.ts:97-107`; `App.tsx:57-59` with the cycle in `App.test.tsx:446-456`; `sanitizeUiPatch` keeps both ids (`settings.test.ts:124-125`), and the probe launches the app with `theme: "modus"` / `"modus-tinted"` in `settings.json` and gets that theme on start |
| With either entry selected, the theme follows the system light/dark preference and switches live when the system changes | met | `nativeThemeSource` returns `'system'` for both (`theme.ts:21`, the same path the System theme uses). The probe switches `prefers-color-scheme` live over CDP without a reload and every colour, the Mermaid diagram included, follows. `MermaidDiagram.test.tsx:35-54` covers the re-render. A real OS toggle was not run (it would change the desktop setting) |
| Code blocks (Shiki), Mermaid diagrams, the sidebar, the status bar and the window background before first paint all take their colours from the active palette | met | Probe: Shiki keyword and block background, Mermaid node stroke, workspace/sidebar and status-bar backgrounds match in all four modes; window background from `theme.ts:28-32` via `index.ts:30,44`, tested in `theme.test.ts:26-31` |

## Issues Found

### Critical
None

### High Priority
None

### Medium Priority
None

### Suggestions (Low)

- **L1** `src/renderer/src/markdown/highlighter.ts:95`: the four new entries in `THEMES` make Shiki tokenize every code block eight times instead of four on every preview render, and nothing caches the result. **Why:** `loadHighlighter().highlight` (`highlighter.ts:157-161`) runs `codeToHast` for each block on each render (`pipeline.ts:124-125`), 200 ms after typing pauses. Shiki tokenizes once per theme, so on the renderer's main thread `src/main/ipc.ts` as a 408-line TS block takes 382 ms instead of 197 ms, and `highlighter.ts` (167 lines) takes 186 ms instead of 96 ms (`scratch/review/bench/bench.mts`). The plan's risk row (`issue-12-modus-theme-plan.md:539`) accepted this on the claim "Highlighting stays cached per language", but only grammar loading is cached. **Fix:** cache the highlighted `pre` element by `language` + `code` (a small bounded `Map` in `highlighter.ts`, cloned on reuse) so that blocks the user did not edit skip tokenizing; or, if the owner accepts the cost, correct the plan's claim and file a follow-up.

**Noted, not a finding**: the deuteranopia and tritanopia variants are out of scope per the owner's comment. The current search match is opaque `bg-yellow-intense` (`styles.css:215,251,288,324`), as in Emacs isearch, so the selection under it does not show; the plan left this as flag-only. The native window background is set at creation and on settings changes only, so a live OS switch while the app runs does not change it; the System theme behaves the same, and the criterion covers first paint. The manual desktop check with a real OS light/dark toggle is still the owner's to do.

## Validation Results

| Check | Status | Notes |
|-------|--------|-------|
| Build / Type Check | PASS | `npm run typecheck` (exit 0); host |
| Warnings | NONE | no warning lines in the typecheck, lint or test output |
| Lint | PASS | `npm run lint` (exit 0); host; run after the typecheck and before the tests, not in parallel |
| Tests | PASS | `npm test`: 28 files, 328 passed, 0 failed, 0 skipped; no `.skip`/`.todo`/`skipIf` in `src/` or `config/`; host |
| Behavioural checks | PASS | (1) `node scratch/review/scripts/resolve.mjs upstream-dl/modus-themes.el …`: upstream fetched at pinned commit 782743415b3e (byte-identical to the implementer's copy, `;; Version: 5.3.0`); every resolved value (48 mappings per palette, 4 palettes) matches the code. (2) Active-line mix: X at 50 % over bg-main gives bg-hl-line exactly for all four palettes (checked by hand). (3) `node scratch/review/bench/bench.mts <file>`: 4 vs 8 themes timings in L1 |
| UI verification | PASS | No verification skill in the repo; drove the built Electron app (`out/` built 20:34:45, after the last source edit at 20:34:07) headless over CDP with an extended copy of the implementer's probe: `node scratch/review/scripts/e2e-modus.mjs <repo> scratch/review/e2e`, fixed 1280×800 window, light→dark switched live per entry; `ok` in all four modes, exit 0. Captures: `scratch/review/e2e/{modus,modus-tinted}-{light,dark}.png` (scratch = `/home/lauri/.kingpin/tasks/kp-add-new-theme/scratch`). No layout defects seen |

## What's Good

- Every colour traces to a named upstream palette entry, and the comments say which (`modusThemes.ts:42-136`, the `styles.css` header at 172-184, the Mermaid comment at `mermaid.ts:194-199`).
- The active-line colours are worked out so that the translucent mix comes out as `bg-hl-line` exactly. This keeps the repository's translucency rule and still matches Emacs `hl-line`.
- `diagramStyle` gets an explicit `switch`, and `SYSTEM_THEME_BACKGROUNDS` keeps `nativeThemeSource` and `windowBackground` in agreement for themes that follow the system.
- New test "gives each Modus block every variable the Dark block sets" (`App.test.tsx:534-550`) guards against GitHub Dark colours leaking into Vivendi, and the implementer checked that it fails when a variable is removed.
- README and PROJECT-GUIDE describe the new themes.

## Recommendation

Ready to merge after L1 is either fixed (cache the highlighted blocks) or accepted by the owner with the plan's claim corrected. Run `/fix-findings .agents/reviews/kingpin-kp-add-new-theme-review.md L1`, or proceed to `/issue-flow-done 12` if the owner accepts it.
