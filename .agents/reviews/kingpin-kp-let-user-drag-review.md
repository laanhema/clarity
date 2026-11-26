# Code Review: kingpin/kp-let-user-drag

**Scope**: branch `kingpin/kp-let-user-drag` against `main` (merge base `d8db23e`). The branch has no commits of its own, so the diff is `git diff HEAD` plus the untracked files.
**Recommendation**: NEEDS CHANGES

## Summary

I reviewed the drop-an-image feature for issue #11: the new `importImage` IPC call (`src/main/imageImport.ts`, `AccessScope.resolveDropDocument` / `resolveImageCopy`), the preload `pathForFile`, the editor drop handler, `App.dropImages`, the Markdown encoding in `imageDrop.ts`, and the README, AGENTS.md and test changes. All 16 files were read in full. The main-process boundary holds up: the sender frame is checked, both arguments are validated, the target folder goes through realpath containment, and the copy is created exclusively (`wx`), so it never follows a link at the copy name. The real-path image check and the size check run before anything is read. One acceptance criterion is not met: several dropped images are not each on their own line. The real OS drag and drop needs the owner at the desktop. I did not write this code.

## Acceptance Criteria

| Criterion | Status | How known |
|-----------|--------|-----------|
| Dropping an image file (png, jpg, jpeg, gif, webp, avif, bmp, ico, svg) that lies inside the open folder onto the editor inserts `![<file name without extension>](<path relative to the document's folder>)` at the drop position, and the preview shows the image | met | `src/main/imageImport.ts:56` returns the real path relative to the document's folder with no copy (`imageImport.test.ts:29` expects `../img/inside.png`); `src/renderer/src/components/Editor.tsx:186-188` inserts at `posAtCoords`; `imageDrop.test.ts:28-39` shows the inserted `src` decodes back to the same path that `loadImage` resolves. Judged from code and tests; the desktop drag is pending owner verification |
| A path with spaces, parentheses or non-ASCII characters is encoded so the preview still resolves it | met | `src/renderer/src/imageDrop.ts:7-12`; `imageDrop.test.ts:28-39` (spaces, parentheses, `Résumé ä 写真`, `#?%`, unbalanced `(`) and `images.test.ts:26` both pass |
| Dropping several image files at once inserts one reference per image, each on its own line, in drop order | unmet | H1: the references are joined with `\n` only, so the first and last share a line with the text at the drop point; the branch's own test expects `![b](img/b.png)\n![a](img/a.png)# First` (`App.test.tsx:435`) |
| Dropping an image from outside the open folder copies it into the document's folder as `<document name without extension>-<image file name>` (for example `notes.md` + `photo.png` gives `notes-photo.png`) and references the copy; a name clash gets a numeric suffix (`notes-photo-2.png`) and never overwrites an existing file; an image over the 15 MB image limit is refused with a message | met | `src/main/imageImport.ts:58-70` and `src/main/images.ts:56-62`; `imageImport.test.ts:37-69` (copy name, `-2`/`-3` with the original intact, no write through a link, 15 MB + 1 refused with `big.png is larger than the 15 MB image limit` and nothing written); `App.tsx:310` shows the message |
| Dropping a file that is not an image, or any image while the document is unsaved or no folder is open, inserts nothing, and the message line says why | pending | Non-image, Untitled and no-folder cases are met (`App.tsx:285`, `App.tsx:290`, `imageImport.ts:50`; App tests `inserts nothing for a refused file`, `into an unsaved document`, `when no folder is open`). The run reads "unsaved" as "never saved" (plan Open Question 1); a document with unsaved edits still accepts drops. The implementation report says the owner chose this reading, but no issue comment records it, so the reading is open for the owner |
| The file path reaches the renderer through `webUtils.getPathForFile` in the preload; the copy goes through a new IPC call that validates its arguments and writes only inside the open folder through the access scope; tests cover the relative-path computation, the naming and clash rules, and the drop handler, and the README feature list describes the drop | met | `src/preload/index.ts:54-55`; `src/main/ipc.ts:369-371` (`senderState` checks the sender frame); `src/main/imageImport.ts:45-47` validates the path; `src/main/accessScope.ts:110-118` writes only through `resolveInsideRoot`; tests in `images.test.ts`, `imageImport.test.ts`, `App.test.tsx` (`dropping images on the editor`); README "Dropping images" bullet at `README.md:17` |

## Issues Found

### Critical
None

### High Priority
- **H1** `src/renderer/src/App.tsx:312`: several dropped images are joined with a bare `\n` and inserted at the drop position, so the first reference continues the text before the drop point and the last one runs into the text after it. **Why:** the criterion asks for each reference on its own line. The branch's own test shows the result `![a](img/a.png)# First` (`App.test.tsx:435`), which also turns the `# First` heading into a paragraph. Dropping mid-paragraph gives `abc![b](b.png)` and `![a](a.png)def`. **Fix:** in the insert at `src/renderer/src/components/Editor.tsx:186-188`, add a `\n` before the text when `from` is not at the start of its line and one after it when `from` is not at the end of its line, at least when more than one reference is inserted. Change the test expectation to `'![b](img/b.png)\n![a](img/a.png)\n# First'`.

### Medium Priority
None

### Suggestions (Low)
- **L1** `src/main/imageImport.ts:26`: `readDroppedImage` opens `real` without `O_NOFOLLOW` and does not check that the opened file is the one that was checked, yet the comment at lines 21-22 says the file "cannot be swapped for another between the check and the read". **Why:** a local user who can write to the folder the image was dropped from could swap the last path component for a symlink to any regular file of 15 MB or less, between `realpath`/`stat` (lines 49-53) and `open`. That file would then be copied into the open folder under an image name. The race is narrow, and the user starts it with a drop. **Fix:** keep the `stat(real)` result and, after `handle.stat()`, refuse when `dev`/`ino` differ (adding `constants.O_NOFOLLOW` to the flags is a cheap extra), or correct the comment to say what the handle checks do.
- **L2** `src/renderer/src/components/Editor.tsx:185-186`: the drop position is only clamped, not mapped through edits made while `importImage` runs, and a drop discarded because another document was opened has already copied the file. **Why:** a copy of a large image takes long enough to type a few characters, so the reference lands inside the new text. If the document was switched, the status bar still says "Copied into the document's folder" for a file that no document references. The plan accepted the stale position on its own, and no owner comment accepts it. **Fix:** map the position through the transactions made meanwhile (for example a `StateField` that holds the pending position and applies `tr.changes.mapPos`). When the key no longer matches, show a message that names the copy left behind.
- **L3** `src/renderer/src/App.tsx:310-311`: when one file in a drop is refused and another is copied, only the problems are shown, so the user is not told that a new file was created. **Why:** the plan's Open Question 2 keeps the copy message so that a file is never created silently, and a mixed drop does exactly that. **Fix:** when both lists are non-empty, show the problems followed by the "Copied into the document's folder: …" sentence in one message.

**Noted, not a finding**: the IPC call cannot tell a real drop from a forged call, so a compromised renderer could copy any image file of 15 MB or less from anywhere on disk into the open folder. The issue's technical notes accept this ("The source of a copy is a path the user dropped, outside any grant: accept only regular files with an image extension"). The README's "The one exception is an image file you drop on the editor" describes the intended use. Dropping on the preview or the sidebar is out of scope per the issue. The "unsaved means never saved" reading under criterion 5 is open for the owner.

## Validation Results

| Check | Status | Notes |
|-------|--------|-------|
| Build / Type Check | PASS | `npm run typecheck`; host, Node 22 |
| Warnings | NONE | no warning lines in the typecheck, lint or test output of `npm run typecheck && npm run lint && npm test` |
| Lint | PASS | `npm run lint`; host |
| Tests | PASS | `npm test`; host; 31 files, 349 passed, 0 failed, 0 skipped (no `.skip`/`.todo`/`skipIf` in `src` or `config`) |
| Behavioural checks | N/A | H1 rests on the branch's own passing test (`App.test.tsx:435`); L1 is a race that needs a filesystem swap between two awaits and was judged from the code, not reproduced |
| UI verification | N/A | No verification skill in the repo, and a real OS drag cannot run headlessly. Reviewed statically. Pending owner check at the desktop: `npm run dev`, then plan "End-to-End Verification" steps 1-7 (in-folder drop, outside copy and `-2`, two images, refused `.txt` and 16 MB image, Untitled and no-folder messages, text drag still moves text) |

## What's Good

- The main-process boundary is careful. `senderState` checks the frame, `imagePath` must be an absolute string without `\0`, and both the dropped name and the real path must have an image extension, so a `.png` link to a text file is refused. The regular-file and size checks run before any read. The target folder is resolved with `resolveInsideRoot` from the document's real folder, the name must be a plain image basename, and `writeFile(..., { flag: 'wx' })` retries only on `EEXIST`, so a link at the copy name is never written through. A test covers that case.
- `O_NONBLOCK` keeps a FIFO from hanging the open, and the size test uses a sparse file, so it stays fast.
- The link encoding is tested end to end through `markdownToSafeTree` and the main-process decoder, not only as a string.
- Text drags still reach CodeMirror, and a test covers it.
- README and AGENTS.md are updated in the existing style.

## Recommendation

Fix H1 (put each reference on its own line, and update the test), and ideally L1 to L3, with `/fix-findings`. Then the owner runs the desktop drag check and confirms the "never saved" reading of criterion 5.
