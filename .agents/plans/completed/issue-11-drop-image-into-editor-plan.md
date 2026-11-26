# Plan: Insert a Markdown image reference when an image file is dropped into the editor

## Summary

Dropping an image file on the CodeMirror editor inserts `![<stem>](<encoded relative path>)` at the drop position, one line per image, in drop order. The renderer gets each file's disk path from a new `pathForFile` call, which the preload answers with `webUtils.getPathForFile`. A new IPC call, `importImage(documentPath, imagePath)`, then returns the path to reference. The main process (`src/main/imageImport.ts`) accepts only a regular image file of at most `MAX_IMAGE_BYTES`. An image whose real path is inside the open folder is referenced where it is. Any other image is copied next to the document as `<doc stem>-<image name>`, then `-2`, `-3`… The copy is written with an exclusive create (`flag: 'wx'`), so it never replaces a file or follows a link. The renderer (`src/renderer/src/imageDrop.ts`) percent-encodes each path segment, parentheses included, and the preview's existing `loadImage` path decodes it again. Non-image files, drops into an Untitled document and drops with no folder open insert nothing, and the status bar says why.

The complete change, tests and README text are in `.agents/plans/issue-11-drop-image-into-editor-prototype.patch`. With it applied, typecheck, lint and the full suite pass (31 files, 349 tests). All `file:line` references in this plan are lines of HEAD (d8db23e) before the patch.

## User Story

As a Clarity user writing a Markdown document
I want to drag an image file from my file manager onto the editor
So that a working image reference appears where I dropped it, without typing paths or copying files by hand

## Metadata

| Field | Value |
|-------|-------|
| Type | NEW_CAPABILITY |
| Complexity | MEDIUM |
| Systems Affected | `src/shared/api.ts`, `src/preload/index.ts`, `src/main/ipc.ts`, `src/main/accessScope.ts`, `src/main/images.ts`, `src/main/imageImport.ts` (new), `src/renderer/src/components/Editor.tsx`, `src/renderer/src/App.tsx`, `src/renderer/src/imageDrop.ts` (new), `src/renderer/src/test/mockApi.ts`, tests, `README.md` |
| GitHub Issue | #11 |
| PRD Phase | N/A |
| Prototype Patch | `.agents/plans/issue-11-drop-image-into-editor-prototype.patch` |

---

## Environment Findings

| Probe | Result |
|-------|--------|
| Baseline `npm test` on HEAD | 28 files, 323 tests pass. Typecheck and lint pass. |
| Prototype: `npm run typecheck && npm run lint && npm test` | Pass. 31 files, 349 tests (26 new). |
| Electron version (`node_modules/.bin/electron --version`) | v45.2.0 |
| Headless Electron 45 probe: sandboxed, context-isolated preload exposes `webUtils.getPathForFile` through `contextBridge`, and the page passes it a `new File([...], 'photo.png')` | The `File` crosses the bridge and the call works. It returns `''` for a file that is not on disk, and `'path' in file` is `false`. The renderer's empty-path branch is therefore real. |
| HEAD behaviour, jsdom: drop a `notes.txt` with text, then a binary `photo.png`, on the editor | `notes.txt` inserts its text (`"hello text"`): CodeMirror's own `handlers.drop` (`node_modules/@codemirror/view/dist/index.js:5159-5180`) reads every dropped file with `readAsText`. The PNG inserts nothing, because CodeMirror skips binary text. |
| `File` type in `src/shared/api.ts` under `tsconfig.node.json` (no DOM lib) | Compiles: `@types/node` declares a global `File`. |
| Encoding round trip (`src/renderer/src/imageDrop.test.ts` in the patch) | `markdownToSafeTree` keeps the encoded `src` unchanged. Stripping `?#…` and running `decodeURIComponent`, as `localImageReference` does (`src/main/images.ts:32-50`), gives back the original path for spaces, parentheses (balanced and not), `#`, `?`, `%` and non-ASCII names. |
| Other worktrees | `kp-2-preview-briefly-lags` touches only `Preview.test.tsx` and `useRenderedMarkdown.ts`, so it has no overlap. `kp-add-new-theme` has no changes yet, but a theme change usually edits `src/shared/api.ts`, `App.tsx` and `README.md`, which this patch also edits in other hunks. |
| Forward references to #11 in source, docs, plans | None. |

Scratch probe script for the Electron row (not part of the patch). The HEAD-behaviour row ran a throwaway jsdom test in a `git archive` copy; the patch's App drop tests repeat that check.

```js
// main.cjs — run: XDG_CONFIG_HOME=<scratch>/cfg node_modules/.bin/electron --ozone-platform=headless --ozone-override-screen-size=800,600 --window-size=800,600 <scratch>/main.cjs
const { app, BrowserWindow } = require('electron')
const path = require('node:path')
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 400, height: 300, webPreferences: {
    preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } })
  await win.loadURL('data:text/html,<p>probe</p>')
  const result = await win.webContents.executeJavaScript(`(() => {
    const f = new File(['x'], 'photo.png', { type: 'image/png' })
    return JSON.stringify({ hasApi: typeof window.probe?.pathForFile, path: window.probe.pathForFile(f), filePath: 'path' in f })
  })()`)
  console.log('PROBE', result) // PROBE {"hasApi":"function","path":"","filePath":false}
  app.quit()
})
// preload.cjs
const { contextBridge, webUtils } = require('electron')
contextBridge.exposeInMainWorld('probe', { pathForFile: (file) => webUtils.getPathForFile(file) })
```

---

## Patterns to Follow

### Naming

```typescript
// SOURCE: src/shared/api.ts:143-147
  /**
   * Reads an image that a document links with a relative path, as a data URL.
   * Only images inside the open folder load; anything else resolves to null.
   */
  loadImage(documentPath: string, src: string): Promise<string | null>
```

### Error Handling

```typescript
// SOURCE: src/main/accessScope.ts:79-89
  async resolveImage(documentPath: unknown, src: unknown): Promise<string> {
    const folder = this.#folder
    if (!folder) throw new PathAccessError('Images load only from an open folder', String(src))
    const document = await this.resolveForRead(documentPath)
```

```typescript
// SOURCE: src/renderer/src/App.tsx:154-165 — main-process errors reach the status bar through errorMessage
  async function exclusive(task: () => Promise<void>): Promise<void> {
    if (busy.current) return
    busy.current = true
    setMessage(null)
    try {
      await task()
    } catch (error) {
      setMessage(errorMessage(error))
```

### Tests

```typescript
// SOURCE: src/main/accessScope.test.ts:12-15 — real temp dirs from testFs
  beforeEach(async () => {
    workspace = await makeTempDir()
    folder = path.join(workspace, 'notes')
    await writeAt(folder, 'a.md', 'a')
```

```typescript
// SOURCE: src/renderer/src/App.test.tsx:58-63 — driving CodeMirror inside its shadow root
function typeInEditor(text: string): void {
  act(() => {
    const view = editorView()
    view.dispatch({ changes: { from: view.state.doc.length, insert: text }, userEvent: 'input.type' })
  })
}
```

---

## Files to Change

| File | Action | Purpose | In patch |
|------|--------|---------|----------|
| `src/shared/api.ts` | UPDATE | `DroppedImage` type, `ClarityApi.pathForFile` and `importImage`, `IpcChannel.ImportImage` | Yes |
| `src/preload/index.ts` | UPDATE | `pathForFile` → `webUtils.getPathForFile`, `importImage` → invoke | Yes |
| `src/main/images.ts` | UPDATE | Pure helpers `copyNameFor` and `relativeReference` | Yes |
| `src/main/accessScope.ts` | UPDATE | `resolveDropDocument` (the document must be inside the open folder) and `resolveImageCopy` (copy target: a plain image name in a folder whose real path is inside the open folder) | Yes |
| `src/main/imageImport.ts` | CREATE | `importImage(scope, documentPath, imagePath)`: validation, in-folder reference, exclusive copy with numbered names | Yes |
| `src/main/ipc.ts` | UPDATE | `ipcMain.handle(IpcChannel.ImportImage, …)` through `senderState` | Yes |
| `src/renderer/src/imageDrop.ts` | CREATE | `encodeImagePath` and `markdownImage` (alt = file stem, `\ [ ]` escaped) | Yes |
| `src/renderer/src/components/Editor.tsx` | UPDATE | `onDropFiles` prop. `fileDropHandlers` (`EditorView.domEventHandlers` for `dragover` and `drop`) takes every file drop away from CodeMirror; the text is inserted at `posAtCoords` once the main process answers, if the same document is still open. | Yes |
| `src/renderer/src/App.tsx` | UPDATE | `dropImages(files)`: refusal messages, one `importImage` call per file in order, copy message, returns the references joined by `\n` | Yes |
| `src/renderer/src/test/mockApi.ts` | UPDATE | Mocks for `pathForFile` (returns `''`) and `importImage` (rejects unless a test sets it) | Yes |
| `src/main/images.test.ts` | CREATE | Naming, clash numbering, relative paths, decoding of encoded references | Yes |
| `src/main/imageImport.test.ts` | CREATE | Temp-dir tests: in-folder reference, copy, clash, link at the copy name, link to outside, size limit, non-images, invalid paths, no folder or document outside the folder | Yes |
| `src/renderer/src/imageDrop.test.ts` | CREATE | Alt text, escaping, encoding round trip through `markdownToSafeTree` | Yes |
| `src/renderer/src/App.test.tsx` | UPDATE | `dropOnEditor` helper and a `dropping images on the editor` block with 7 tests | Yes |
| `README.md` | UPDATE | New **Dropping images** feature bullet, and the Security bullet's exception for a dropped image | Yes |
| `AGENTS.md` | UPDATE | One Architecture line for `src/main/imageImport.ts` (Task 4) | No |

---

## Tasks

Execute in order. `/implement` applies the prototype patch before Task 1, so the tasks only check, review and polish.

### Task 1: Check the new main-process tests

- **File**: `src/main/images.test.ts`, `src/main/imageImport.test.ts`, `src/main/accessScope.test.ts`
- **Action**: CHECK
- **Implement**: Run the main project tests. Expect `images.test.ts` (4 tests) and `imageImport.test.ts` (9 tests) to pass, with `accessScope.test.ts` still green. Confirm that the size-limit test makes its file with `truncate` (sparse, so nothing is really written) and checks that no copy appears.
- **Mirror**: `src/main/accessScope.test.ts:7-22` (`beforeEach` at 12-20)
- **Validate**: `npx vitest run src/main/images.test.ts src/main/imageImport.test.ts src/main/accessScope.test.ts`

### Task 2: Check the renderer tests

- **File**: `src/renderer/src/imageDrop.test.ts`, `src/renderer/src/App.test.tsx`
- **Action**: CHECK
- **Implement**: Run both files. Expect 6 tests in `imageDrop.test.ts` and 71 in `App.test.tsx`, 7 of them in `dropping images on the editor`. jsdom has no layout, so `posAtCoords` returns 0 there and the drop tests insert at the start of `# First`. That is expected; the real drop position is checked in End-to-End Verification step 2. These tests fail on HEAD, where CodeMirror inserts the dropped file's text (`x`) instead of a reference (see Environment Findings).
- **Mirror**: `src/renderer/src/App.test.tsx:372-388`
- **Validate**: `npx vitest run src/renderer/src/imageDrop.test.ts src/renderer/src/App.test.tsx`

### Task 3: Review the security boundary of `importImage`

- **File**: `src/main/imageImport.ts`, `src/main/accessScope.ts`
- **Action**: CHECK
- **Implement**: Read `importImage`, `readDroppedImage`, `AccessScope.resolveDropDocument` and `AccessScope.resolveImageCopy` against `AGENTS.md` "Code Patterns". Check each of these:
  1. Both arguments are `unknown` and validated. `imagePath` must be an absolute string without `\0`.
  2. The source's dropped name and its real path both need an image extension (`imageMimeType`), and the source must be a regular file of at most `MAX_IMAGE_BYTES`. The checks run again on the open handle, and the open uses `O_NONBLOCK`, so a FIFO cannot hang it. The open also uses `O_NOFOLLOW`, and the handle must have the device and inode that were checked, so a file swapped in after the check is refused.
  3. The write target is `join(realpath(dirname(document)), copyNameFor(...))`. Its folder is resolved inside the open folder by `resolveInsideRoot`, and the name is a plain basename with an image extension.
  4. The write uses `flag: 'wx'`, and only `EEXIST` moves on to the next number, up to 1000 tries.

  If you change anything, keep the tests from Task 1 green.
- **Mirror**: `src/main/accessScope.ts:79-89`
- **Validate**: `npx vitest run src/main/imageImport.test.ts`

### Task 4: Keep the AGENTS.md architecture list in step

- **File**: `AGENTS.md`
- **Action**: UPDATE
- **Implement**: Under `src/main/` in the Architecture block, add one line: `imageImport.ts      dropped images: in-folder reference or exclusive copy next to the document`. The block lists the security-relevant main modules, and this module reads a path that comes from outside the grants. Leave the rest of the file unchanged.
- **Mirror**: `AGENTS.md:36-37`
- **Validate**: `git diff --stat AGENTS.md`

### Task 5: Review the README wording

- **File**: `README.md`
- **Action**: CHECK
- **Implement**: Read the new **Dropping images** bullet (after README.md:16) and the sentence added to the Security bullet (README.md:101). Check them against the behaviour: the copy goes to the document's own folder, the name is `<doc>-<image>` with `-2` on a clash, the limit is 15 MB, and a drop that inserts nothing shows a message. If Open Question 1 or 2 is answered differently from its default, update the bullet to match.
- **Mirror**: `README.md:16`
- **Validate**: `grep -n "Dropping images" README.md`

### Task 6: Full validation

- **File**: `package.json`
- **Action**: CHECK
- **Implement**: Run the project gate. Expect typecheck and lint clean, and 31 test files with 349 tests passing.
- **Mirror**: `AGENTS.md` "Validation"
- **Validate**: `npm run typecheck && npm run lint && npm test`

---

## Validation

```bash
# Type check
npm run typecheck

# Lint
npm run lint

# Tests (baseline 28 files / 323 tests; with the patch 31 files / 349 tests)
npm test
```

## End-to-End Verification

The real OS drag source cannot be scripted headlessly, so these steps need a person at the desktop. Tell the owner before launching, because `npm run dev` opens a window.

1. Make a scratch folder `<tmp>/notes` with `notes.md` (`# Notes`) and `img/inside.png`. Outside it, put `<tmp>/downloads/my photo (1).png`, `<tmp>/downloads/readme.txt`, and a file over 15 MB, made with `truncate -s 16M <tmp>/downloads/big.png`. Run `npm run dev` and open `<tmp>/notes` and `notes.md`.
2. Drag `img/inside.png` from the file manager into the middle of the text. Expected: `![inside](img/inside.png)` appears where the drop cursor was, no new file appears, and the preview shows the image.
3. Drag `my photo (1).png` onto the editor. Expected: `![notes-my photo (1)](notes-my%20photo%20%281%29.png)` is inserted, `<tmp>/notes/notes-my photo (1).png` exists, the status bar says `Copied into the document's folder: notes-my photo (1).png`, and the preview shows the image. Drop it again: the file is now `notes-my photo (1)-2.png`, and the first copy is unchanged.
4. Select both `inside.png` and `my photo (1).png` and drop them together. Expected: two references on separate lines, in the order the file manager sends them.
5. Drop `readme.txt`. Expected: nothing is inserted (HEAD inserted the file's text), and the status bar says `readme.txt is not an image.` Drop `big.png`. Expected: nothing is inserted, the status bar says `big.png is larger than the 15 MB image limit.`, and no copy appears.
6. Press Ctrl+N and drop an image into the Untitled document: the status bar says `Save the document before dropping images into it.` Close the folder, open `notes.md` with Open File, and drop again: the status bar says `Open a folder to drop images into its documents.`
7. Select a word in the editor and drag it elsewhere in the text: it still moves as before, because CodeMirror keeps text drops.

## Risks

| Risk | Mitigation | Scope |
|------|------------|-------|
| A dropped file path comes from outside every grant, which is new for this app's IPC. | Only regular files with an image extension (dropped name and real path) and at most 15 MB are read. The checks run again on the open handle. Writes go only to a plain image name in the document's real folder, inside the open folder, with an exclusive create. `imageImport.test.ts` covers links, folders named `.png`, non-images and size. | In scope (Task 3 reviews it) |
| Behaviour change: dropping a text or Markdown file used to insert its contents. Now every file drop goes through the image path, and a non-image is refused with a message. | The issue's acceptance criteria require this ("a file that is not an image … inserts nothing, and the message line says why"). The README describes the new behaviour. Dragged text without files still reaches CodeMirror (App test `leaves dragged text to the editor`). | In scope, flagged in Open Question 3 |
| The user types while `importImage` runs, so the drop position is stale. | A `StateField` in `Editor.tsx` maps the pending drop position through the edits made meanwhile. If another document was loaded, nothing is inserted, and the status bar names the copies that no document references. | Mitigated |
| A copy of up to 15 MB is held in memory. | It is bounded by `MAX_IMAGE_BYTES` and freed after the write. | Accepted |
| Dropping a file on the preview or the sidebar still triggers Chromium's default file navigation, which `security.ts` `will-navigate` blocks. | Out of scope per the issue's technical notes. | Out of scope |
| Merge conflicts with the `kp-add-new-theme` worktree in `src/shared/api.ts`, `App.tsx` or `README.md`. | The hunks are in different places (new API members next to `loadImage`, a new function before `reconcileWithDisk`, a new README bullet after the images bullet). Rebase on whichever lands first. | Flag only |
| The status-bar message for several refused files is long. | Problems are joined with spaces, one sentence each. That is acceptable for a rare case. | Accepted |

## Open Questions

1. **"While the document is unsaved"**: the patch reads it as "never saved" (Untitled, `doc.path === null`). A document with unsaved edits but a path on disk still accepts drops, because its folder is known and the reference resolves once it is saved. *Proposed default*: keep this reading, since refusing drops into every edited document would block the feature during normal writing.
2. **Copy message**: the issue does not say whether a successful copy is announced. The patch shows `Copied into the document's folder: <names>` in the status bar. *Proposed default*: keep it, because a drop that silently creates a file in the user's folder is surprising.
3. **Non-image file drops**: HEAD inserts a dropped text file's contents (a CodeMirror default). The acceptance criteria say a non-image inserts nothing and shows a message, and the patch follows them. *Proposed default*: follow the acceptance criteria. If the owner wants text files to keep inserting their contents, `fileDropHandlers` could return `false` when no dropped file has an image extension. That needs an image-extension list on the renderer side, and the "says why" criterion would change.
4. **Document outside the open folder** (granted through Open File while a folder is open): the patch refuses the drop with `Images can be dropped only into a document inside the open folder`, because a copy would have to be written outside the folder. *Proposed default*: refuse, as the patch does.

## Acceptance Criteria

- [ ] Dropping an image file (png, jpg, jpeg, gif, webp, avif, bmp, ico, svg) that lies inside the open folder onto the editor inserts `![<file name without extension>](<path relative to the document's folder>)` at the drop position, and the preview shows the image
- [ ] A path with spaces, parentheses or non-ASCII characters is encoded so the preview still resolves it
- [ ] Dropping several image files at once inserts one reference per image, each on its own line, in drop order
- [ ] Dropping an image from outside the open folder copies it into the document's folder as `<document name without extension>-<image file name>`; a name clash gets a numeric suffix and never overwrites; an image over the 15 MB limit is refused with a message
- [ ] Dropping a file that is not an image, or any image while the document is unsaved or no folder is open, inserts nothing, and the message line says why
- [ ] The file path reaches the renderer through `webUtils.getPathForFile` in the preload; the copy goes through a new IPC call that validates its arguments and writes only inside the open folder through the access scope; tests cover the relative-path computation, the naming and clash rules, and the drop handler; the README feature list describes the drop
- [ ] All tasks completed
- [ ] Type check passes (`npm run typecheck`)
- [ ] Lint passes (`npm run lint`)
- [ ] Tests pass (`npm test`)
- [ ] Follows existing patterns
