# Code Review: kingpin/kp-2-preview-briefly-lags

**Scope**: branch `kingpin/kp-2-preview-briefly-lags` against `main` (issue #2)
**Recommendation**: APPROVE

## Summary

The branch has no commits of its own: its merge base with `origin/main` is `HEAD` (`d8db23e`), so the diff is `git diff HEAD` plus the untracked files. That covers the edit to `src/renderer/src/markdown/useRenderedMarkdown.ts` and the new `src/renderer/src/components/Preview.test.tsx`. The plan, its prototype patch and the implementation report were read as context, and both source files match the patch byte for byte. The fix is small and correct: the hook returns `null` instead of another document's tree, and every gate passes. The headless Electron probe fails four scenarios on `HEAD` and passes all five on the working tree. Issue #2 has no checkbox list; its "Done when" section holds three plain bullets, and the table below judges one row per bullet.

## Acceptance Criteria

| Criterion | Status | How known |
|-----------|--------|-----------|
| The bug is reproduced (ideally as an automated test, or at least a documented manual reproduction). | met | `npx vitest run src/renderer/src/components/Preview.test.tsx` in a throwaway worktree at `HEAD` with only the test file copied in: `2 failed \| 1 passed (3)`, both failures `expected document not to contain element, found <h1`. The plan's headless probe on a `HEAD` production build: `switch`, `switch-plain`, `reopen-scrolled` and `reveal` FAIL (e.g. `t=47ms preview shows Alpha while the editor shows Beta`) |
| It is fixed so that on opening a scrolled file the preview lands at the matching position without a visible catch-up jump. | met | The same probe on a production build of the working tree: all five scenarios PASS. In `switch` the frames are Alpha@4225, then an empty preview@0, then Beta@0 line 1. In `reveal`, Beta first paints at line 167.9 and stays at 167.9 while a Mermaid diagram moves `scrollTop` from 5102 to 5412 |
| The fix is verified against the reproduction, and existing scroll-sync tests still pass. | met | The new test file passes (3/3) on the working tree; `npx vitest run src/renderer/src/scrollSync` passes 20/20; `npm test` passes 326/326 |

## Issues Found

### Critical
None

### High Priority
None

### Medium Priority
None

### Suggestions (Low)
None

**Noted, not a finding**: The preview is now blank while a newly opened file renders: about 80 ms for `plain.md` and 226 ms for `b.md` (with code, math and diagrams) in this run's probe. The plan chose this over the old file (Open Question 2), and no fix avoids both a blank pane and a stale one while `renderMarkdown` is async. Two risks the plan marked "Out of scope (flag only)" stay open and were not measured here. The first: an edit made in editor-only view to the same file shows the older tree for up to `PREVIEW_DELAY_MS` after the preview comes back. The second: a height change without a DOM mutation (first KaTeX font load, image decode) reaches scroll sync one frame late through the `ResizeObserver` at `src/renderer/src/components/Preview.tsx:146`. The owner's manual check in a real window is still optional and pending. The editor's `scrollTop` also shifts by 45 to 90 px when split view comes back (`reveal`, `reveal-same`) on both `HEAD` and the fix, so it is pre-existing and unrelated.

## Validation Results

| Check | Status | Notes |
|-------|--------|-------|
| Build / Type Check | PASS | `npm run typecheck` (`tsc --build --noEmit`), host, Node v22. `npx electron-vite build` of both scratch copies also succeeded |
| Warnings | 1 found | No warning lines in the typecheck, lint or test output. `electron-vite build` prints a chunk-size warning (`build.chunkSizeWarningLimit`) on both the `HEAD` and the fixed build, so it is pre-existing |
| Lint | PASS | `npm run lint` (`eslint .`), host |
| Tests | PASS | `npm test` (vitest run), host: 29 files, 326 passed, 0 failed, 0 skipped; a grep for `.skip`, `.todo`, `skipIf`, `runIf` and `.only` under `src` and `config` found none. `git status --porcelain` was identical before and after the run |
| Behavioural checks | PASS | Red run: the new test on a `HEAD` worktree, `2 failed \| 1 passed (3)`. Probe: `gen-docs.mjs` and `drive.mjs` were extracted from the plan and diffed identical. Both builds ran headless (`--ozone-platform=headless`, Electron v45.2.0, throwaway `XDG_CONFIG_HOME`) under `/home/lauri/.kingpin/tasks/kp-2-preview-briefly-lags/scratch/review/`. `HEAD`: `switch`, `switch-plain`, `reopen-scrolled`, `reveal` FAIL and `reveal-same` PASS. Working tree: all five PASS. Logs are `prefix-*.log` and `fixed-*.log` in that folder |
| UI verification | PASS | The repo has no verification skill (`.claude/skills/` does not exist). The probe above records every painted frame of the real renderer at the app's fixed 1400x900 window, which is the gate for this change. Each run re-captured the frames from this run's builds rather than reusing the implementer's logs |

## What's Good

- The fix sits at the cause: one expression at `src/renderer/src/markdown/useRenderedMarkdown.ts:46`, and it reuses `isNewDocument` from line 21, so the debounce path for edits to the same document is untouched.
- `documentKey` changes only through `loadedDocument` (`src/renderer/src/App.tsx:38`). An external reload keeps the key (`src/renderer/src/App.tsx:303`, `:311`), so a file changed on disk does not blank the preview.
- The third test pins the behaviour that the fix must keep: during the typing debounce the current tree stays on screen.
- The comments explain why, and they match the code.
- The plan's claims held up when checked. Shiki and KaTeX finish inside `renderMarkdown` before the commit (`src/renderer/src/markdown/pipeline.ts:201-207`), and the probe shows Mermaid's late height change keeps the top line.

## Recommendation

Nothing blocks the change. Commit it and open the PR with `/issue-flow-done 2`. The owner may still run the optional manual check in a real window (`npm run dev`, the steps in the plan's End-to-End Verification).
