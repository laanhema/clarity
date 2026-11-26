# Implementation Report

**Plan**: `.agents/plans/completed/issue-11-drop-image-into-editor-plan.md`
**Branch**: `kingpin/kp-let-user-drag`
**Status**: COMPLETE

## Summary

Dropping image files on the CodeMirror editor now inserts `![<stem>](<encoded relative path>)` at the drop position, one line per image, in drop order. The preload exposes `pathForFile` (`webUtils.getPathForFile`), and a new IPC call `importImage(documentPath, imagePath)` (`src/main/imageImport.ts`) returns the path to reference: an image whose real path is inside the open folder is referenced where it is; any other image is copied next to the document as `<doc stem>-<image name>` (`-2`, `-3`… on a clash) with an exclusive create, never overwriting. Images over 15 MB, non-image files, drops into a never-saved document, into a document outside the open folder, or with no folder open insert nothing and the status bar says why. A successful copy shows `Copied into the document's folder: <names>`.

The prototype patch applied cleanly on HEAD (d8db23e); the tasks then checked, reviewed and polished it. The owner's resolved Open Questions all match the patch defaults: (1) "unsaved" means never saved, (2) the copy message stays, (3) a non-image drop inserts nothing and says why, (4) a drop into a document outside the open folder is refused.

## Tasks Completed

| # | Task | File | Status |
|---|------|------|--------|
| 0 | Apply prototype patch (`git apply --check`, then `git apply`) | 16 files | PASS |
| 1 | Check main-process tests (images 4, imageImport 9, accessScope green; size test uses sparse `truncate` and checks no copy appears) | `src/main/images.test.ts`, `src/main/imageImport.test.ts`, `src/main/accessScope.test.ts` | PASS (27 tests) |
| 2 | Check renderer tests (imageDrop 6, App 71 with 7 drop tests) | `src/renderer/src/imageDrop.test.ts`, `src/renderer/src/App.test.tsx` | PASS (77 tests) |
| 3 | Security review of `importImage`, `readDroppedImage`, `resolveDropDocument`, `resolveImageCopy`: unknown args validated (absolute, no `\0`); image extension on dropped name and real path; regular file and size checked, re-checked on the `O_NONBLOCK` handle; target folder via `resolveInsideRoot` on the document's real folder, plain-basename image name; `flag: 'wx'`, only `EEXIST` retries, up to 1000. No change needed. | `src/main/imageImport.ts`, `src/main/accessScope.ts` | PASS |
| 4 | Add `imageImport.ts` line to the Architecture block | `AGENTS.md` | PASS |
| 5 | Review README wording; clarified the refusal sentence to match Open Questions 1 and 4 | `README.md` | PASS |
| 6 | Full validation gate | `package.json` | PASS |

## Validation Results

| Check | Result | Command / environment |
|-------|--------|-----------------------|
| Type check | PASS | `npm run typecheck`: host (Node v22) |
| Lint | PASS | `npm run lint`: host |
| Tests | PASS (31 files, 349 passed) | `npm test`: host |
| End-to-End step 1 (scratch folder, `npm run dev`) | PENDING | Owner at the desktop: a real OS drag source cannot be scripted headlessly, and `npm run dev` opens a window |
| End-to-End step 2 (in-folder image inserted at drop cursor, no copy, preview shows it) | PENDING | Owner: `npm run dev`, then drag `img/inside.png` onto the editor |
| End-to-End step 3 (outside image copied as `notes-my photo (1).png`, encoded reference, status message; second drop gives `-2`) | PENDING | Owner: `npm run dev`, drag `my photo (1).png` twice |
| End-to-End step 4 (two images, two lines, drop order) | PENDING | Owner: `npm run dev`, drag both images together |
| End-to-End step 5 (`readme.txt` and 16 MB `big.png` refused with messages, no copy) | PENDING | Owner: `npm run dev`, drag each file |
| End-to-End step 6 (Untitled document and no-folder messages) | PENDING | Owner: `npm run dev`, Ctrl+N then drop; Close Folder, Open File, drop |
| End-to-End step 7 (dragging selected text still moves it) | PENDING | Owner: `npm run dev`, drag a selected word |

The jsdom App tests (`dropping images on the editor`, 7 tests) cover the drop handler, the messages, multi-file order and text drag at the component level; the real drop position and the real `webUtils.getPathForFile` path wait for the owner run above.

## Files Changed

| File | Action | Lines |
|------|--------|-------|
| `src/shared/api.ts` | UPDATE | +19/-0 |
| `src/preload/index.ts` | UPDATE | +4/-1 |
| `src/main/images.ts` | UPDATE | +18/-0 |
| `src/main/accessScope.ts` | UPDATE | +31/-1 |
| `src/main/imageImport.ts` | CREATE | +71 |
| `src/main/ipc.ts` | UPDATE | +5/-0 |
| `src/renderer/src/imageDrop.ts` | CREATE | +21 |
| `src/renderer/src/components/Editor.tsx` | UPDATE | +58/-3 |
| `src/renderer/src/App.tsx` | UPDATE | +40/-0 |
| `src/renderer/src/test/mockApi.ts` | UPDATE | +2/-0 |
| `src/main/images.test.ts` | CREATE | +30 |
| `src/main/imageImport.test.ts` | CREATE | +96 |
| `src/renderer/src/imageDrop.test.ts` | CREATE | +40 |
| `src/renderer/src/App.test.tsx` | UPDATE | +94/-0 |
| `README.md` | UPDATE | +2/-1 |
| `AGENTS.md` | UPDATE | +1/-0 |

## Deviations from Plan

- `README.md` (Task 5): the patch's refusal sentence said "drops into an unsaved document"; it now reads "drops into a new document that was never saved, into a document outside the open folder, or while no folder is open", so it matches the owner's answers to Open Questions 1 and 4 and does not suggest that edited documents refuse drops.
- `AGENTS.md` (Task 4): the plan's line text had six spaces after `imageImport.ts`; five were used so the description lines up with the other entries in the block.
- End-to-End steps 1-7 are PENDING owner verification, as the plan states they need a person at the desktop; `npm run dev` was not launched.
- Not committed or pushed, per the invoking request.

## Tests Written

| Test File | Test Cases |
|-----------|------------|
| `src/main/images.test.ts` | `copyNameFor` document-name prefix; numbering before the extension; `relativeReference` forward slashes; `localImageReference` decodes encoded dropped paths (4) |
| `src/main/imageImport.test.ts` | in-folder reference; copy from outside; clash numbering never overwrites; no write through a link at the copy name; link inside folder pointing outside is copied; size limit refused, nothing written; non-images and folders named like images refused; relative/invalid paths refused; no folder or document outside folder refused (9) |
| `src/renderer/src/imageDrop.test.ts` | alt text is the stem; brackets and backslashes escaped; encoding round trip through `markdownToSafeTree` for spaces/parentheses, non-ASCII, `#?%`, unbalanced `(` (6) |
| `src/renderer/src/App.test.tsx` | `dropping images on the editor`: encoded reference at drop position; one line per image in drop order; copy message; refused file inserts nothing and says why; unsaved document; no folder open; dragged text left to CodeMirror (7) |
