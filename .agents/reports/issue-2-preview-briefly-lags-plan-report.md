# Implementation Report

**Plan**: `.agents/plans/completed/issue-2-preview-briefly-lags-plan.md`
**Branch**: `kingpin/kp-2-preview-briefly-lags`
**Status**: COMPLETE

## Summary

`useRenderedMarkdown` now returns `null` while the current `documentKey` has not rendered yet, instead of the previous document's tree. When another file opens in split view, or when the preview comes back after editor-only view with a different file open, the preview stays blank until the new file has rendered. It never shows the old file lined up with the new one, so it no longer jumps. Edits to the same document still keep the current tree visible during the typing debounce. Both resolved open questions were adopted: both scenarios (`switch` and `reveal`) count as the bug, and the preview is blank (not the old content) while the new file renders. The prototype patch applied cleanly and holds the whole change.

## Tasks Completed

| # | Task | File | Status |
|---|------|------|--------|
| 1 | Red, then green, on the regression test | `src/renderer/src/components/Preview.test.tsx` | PASS |
| 2 | Check the comments against the final code (no edit needed) | `src/renderer/src/markdown/useRenderedMarkdown.ts` | PASS |
| 3 | Full validation | `package.json` | PASS |
| 4 | End-to-end probe on production builds | `src/renderer/src/markdown/useRenderedMarkdown.ts` | PASS |

## Validation Results

| Check | Result | Command / environment |
|-------|--------|-----------------------|
| Type check | PASS | `npm run typecheck`: host, Node v22.23.1 |
| Lint | PASS | `npm run lint`: host |
| Tests | PASS (326 passed, 29 files) | `npm test`: host |
| End-to-End `switch` | PASS | `node drive.mjs <S>/fixed <S>/docs switch <electron>`: head FAIL (t=45ms preview shows Alpha while the editor shows Beta), fixed PASS (t=52ms empty, t=315ms Beta at line 1) |
| End-to-End `switch-plain` | PASS | same, scenario `switch-plain`: head FAIL (t=46ms Alpha while the editor shows Plain), fixed PASS |
| End-to-End `reopen-scrolled` | PASS | same, scenario `reopen-scrolled`: head FAIL (t=104ms Beta while the editor shows Alpha), fixed PASS |
| End-to-End `reveal` | PASS | same, scenario `reveal`: head FAIL (t=92ms Alpha while the editor shows Beta), fixed PASS (empty, then Beta at line 167.9, which stays at 167.9 as scrollTop goes from 5102 to 5412 when the Mermaid diagram renders) |
| End-to-End `reveal-same` | PASS | same, scenario `reveal-same`: head PASS, fixed PASS |
| End-to-End manual window check | PENDING | Owner-only, optional: `npm run dev`, then the steps in the plan's End-to-End Verification |
| Reproduction | PASS | `npx vitest run src/renderer/src/components/Preview.test.tsx`: red with only the test applied (`2 failed \| 1 passed (3)`, first failure `expected document not to contain element, found <h1 ... First` at line 17), green after the fix (`3 passed (3)`) |

The probe ran headless (`--ozone-platform=headless`) on Electron v45.2.0 with a throwaway `XDG_CONFIG_HOME`. Scratch directory: `/home/lauri/.kingpin/tasks/kp-2-preview-briefly-lags/scratch/impl`, with builds `head` (`git archive HEAD`) and `fixed` (working tree).

## Files Changed

| File | Action | Lines |
|------|--------|-------|
| `src/renderer/src/markdown/useRenderedMarkdown.ts` | UPDATE | +5/-2 |
| `src/renderer/src/components/Preview.test.tsx` | CREATE | +40 |

## Deviations from Plan

- The probe scripts were extracted verbatim from the plan into a fresh `scratch/impl` subfolder, because the scratch folder already held the builds made during planning. The builds and the probe used only the new subfolder.

No other deviations.

## Tests Written

| Test File | Test Cases |
|-----------|------------|
| `src/renderer/src/components/Preview.test.tsx` | never shows the previous document while the new one renders; never shows the previous document when it is shown again after being hidden; keeps showing the document while an edit waits to render |
