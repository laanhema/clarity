# Plan: Preview Never Shows the Previous Document When a File Opens

## Summary

When another file opens in split view, the editor shows the new file at once, scrolled to its top. The preview keeps showing the previous file's rendered tree until the new file has rendered, which takes about 70 to 250 ms and longer with code blocks and math. During that time scroll sync lines the previous file up with the new file in the editor. If the previous file was scrolled down, the preview first jumps to the old file's top and then swaps in the new file. The same stale tree also shows when the preview comes back after editor-only view and a different file was opened there in the meantime. The preview then shows the old file at the editor's offset before the new file replaces it. The cause is `useRenderedMarkdown` (`src/renderer/src/markdown/useRenderedMarkdown.ts:43`), which returns the last rendered tree even when it belongs to another `documentKey`. The fix makes the hook return `null` while the current document has not rendered yet. The preview stays empty for that moment, and the new document's first painted frame already sits where scroll sync puts it. The issue suspected late Shiki, KaTeX or Mermaid output. The probes rule that out as the visible cause: Shiki and KaTeX run before the tree reaches the DOM, and when a Mermaid diagram changes height, scroll sync corrects the preview in the same frame. The prototype patch holds the fix and a component regression test.

Every `file:line` in this plan is a line of HEAD (`d8db23e`) before the prototype patch is applied.

## User Story

As a Clarity user who reads long Markdown files side by side
I want the preview to show the file I just opened, at the editor's position, from its first frame
So that the two panes never disagree and the preview does not jump while a file opens.

## Metadata

| Field | Value |
|-------|-------|
| Type | BUG_FIX |
| Complexity | LOW |
| Systems Affected | `src/renderer/src/markdown/useRenderedMarkdown.ts`, `src/renderer/src/components/Preview.test.tsx` (new) |
| GitHub Issue | #2 |
| PRD Phase | N/A |
| Prototype Patch | `.agents/plans/issue-2-preview-briefly-lags-prototype.patch` |

---

## Reproduction Evidence

Measured with the headless probe in **Scratch Probe Scripts** against two production builds: HEAD (`head`) and HEAD with the prototype patch (`proto`). The probe records each frame just before it paints, after every `requestAnimationFrame` callback, the scroll-sync one included. It reports the document each pane shows and the fractional source line at the preview's top edge.

| Scenario | What the user does | HEAD (painted frames) | With the patch |
|----------|--------------------|-----------------------|----------------|
| `switch` | Scroll a.md down in split view, open b.md | t=41 ms: editor shows Beta at the top, preview shows **Alpha** scrolled to its top; t=221 ms: Beta. VERDICT FAIL | t=50 ms: preview empty; t=283 ms: Beta at the top. VERDICT PASS |
| `switch-plain` | As `switch`, opening a file with no code, math or diagrams | **Alpha** shown for 70 to 150 ms. FAIL | Empty, then Plain at the top. PASS |
| `reopen-scrolled` | a.md scrolled, open b.md and scroll it, open a.md again | **Beta** shown for 90 to 130 ms while the editor shows Alpha. FAIL | Empty, then Alpha at the top. PASS |
| `reveal` | Editor-only view, open b.md, scroll it, switch to split view | First visible frame shows **Alpha** at line 167.9, then Beta. FAIL | Empty, then Beta at line 167.9 and it stays there (scrollTop 5102 then 5412 as a Mermaid diagram above renders, top line unchanged). PASS |
| `reveal-same` | Editor-only view on the same file, scroll it, switch to split view | First visible frame already at the matching line 173. PASS | PASS |

Each FAIL and PASS above repeated on every run: 3 runs of `switch` and `reveal` on each build and 1 to 2 runs of the other scenarios, all with the same verdict.

### Hypotheses

| # | Hypothesis | Prediction | Probe | Result |
|---|------------|------------|-------|--------|
| 1 | The preview keeps showing the previous document's tree until the new one renders, and scroll sync positions that stale tree | A frame shows a different document in each pane; making `useRenderedMarkdown` drop another document's tree removes it | `switch`, `reopen-scrolled` on `head` and `proto`; `Preview.test.tsx` red on HEAD | **Confirmed** |
| 2 | Shiki, KaTeX or Mermaid output changes the preview's height after the first sync and the preview jumps (the issue's suspect) | With `switch-plain` the lag disappears; frames after the new document appears show its top line moving | `switch-plain`; top line in `reveal` on `proto` | **Ruled out as the visible cause.** Shiki and KaTeX run inside `renderMarkdown` before the tree is committed (`src/renderer/src/markdown/pipeline.ts:201-207`), so they only lengthen the stale window (about 180 ms against 70 to 150 ms for plain text). Mermaid renders after the commit (`src/renderer/src/components/MermaidDiagram.tsx:78-91`) and does change the height, but its DOM change triggers a sync before the next paint, and the top line stays at 167.9 |
| 3 | The editor's scroll reset in a passive effect (`src/renderer/src/components/Editor.tsx:183-184`) makes the preview follow one frame late | A painted frame shows the editor at its new offset and the preview at its old one | `switch` on `head` | **Ruled out**: the first frame after the switch already shows both panes at offset 0 |
| 4 | The hidden preview renders nothing (`active` is false), so after editor-only view it shows the tree of the file that was open before | `reveal` shows the old file; `reveal-same` does not | `reveal`, `reveal-same` on `head` | **Confirmed**, the second path of hypothesis 1 |

### Environment Findings

| Item | Finding |
|------|---------|
| Node | v22.23.1 |
| Electron | v45.2.0 at `node_modules/electron/dist/electron`, runs with `--ozone-platform=headless`; no window opens |
| App name and user data | Run with the app directory (the one holding `package.json`) as Electron's argument, not `out/main/index.js`, so the user data folder is `$XDG_CONFIG_HOME/clarity` and the seeded `settings.json` is read |
| Edit guard | The session's edit guard denied writes outside the worktree and the task folder, so the probes ran from the task folder `/home/lauri/.kingpin/tasks/kp-2-preview-briefly-lags/scratch` |
| Frame rate | Headless frames came at a steady 60 fps (16.7 ms apart) when the page was idle |
| Baseline | `npm run typecheck` and `npm run lint` clean; `npm test`: 28 files, 323 tests passed |
| With the patch | 29 files, 326 tests passed; `tsc --build --noEmit` and `eslint` on the two files clean |
| Other worktrees | The only uncommitted work in another worktree is the issue #11 prototype in `/tmp/clarity-issue11-Yein/proto`. It edits `App.tsx` and `Editor.tsx`, and this plan edits neither. No open PRs |

---

## Patterns to Follow

### Naming
```ts
// SOURCE: src/renderer/src/markdown/useRenderedMarkdown.ts:18-21
export function useRenderedMarkdown(markdown: string, documentKey: number, active: boolean): Root | null {
  const [rendered, setRendered] = useState<Rendered | null>(null)
  const isNewDocument = rendered?.key !== documentKey
  const upToDate = !isNewDocument && rendered.markdown === markdown
```

### Error Handling
```ts
// SOURCE: src/renderer/src/markdown/useRenderedMarkdown.ts:28-33
        renderMarkdown(markdown).then(
          (tree) => {
            if (!cancelled) setRendered({ key: documentKey, markdown, tree })
          },
          (error: unknown) => console.error('Preview failed to render:', error),
        )
```

### Tests
```tsx
// SOURCE: src/renderer/src/components/MermaidDiagram.test.tsx:18-23
  it('shows the source until the diagram is ready', () => {
    renderMermaidMock.mockReturnValue(new Promise(() => undefined))
    render(<MermaidDiagram source="graph TD; A-->B" />)
    expect(screen.getByText('graph TD; A-->B')).toBeInTheDocument()
    expect(renderMermaidMock).toHaveBeenCalledWith('graph TD; A-->B', 'light', 'commit-mono')
  })
```

---

## Files to Change

| File | Action | Purpose | In the patch |
|------|--------|---------|--------------|
| `src/renderer/src/markdown/useRenderedMarkdown.ts` | UPDATE | Return `null` instead of another document's tree; the doc comment says so | Yes |
| `src/renderer/src/components/Preview.test.tsx` | CREATE | Regression tests: no previous document while a new one renders, none after the preview is shown again, and an edit keeps the current tree until it re-renders | Yes |

`README.md` and `PROJECT-GUIDE.md` describe no behaviour that this fix changes, so neither needs an edit.

---

## Tasks

Execute in order. `/implement` applies the prototype patch before Task 1, first the test path `src/renderer/src/components/Preview.test.tsx` for the red run, then the rest.

### Task 1: Red, then green, on the regression test

- **File**: `src/renderer/src/components/Preview.test.tsx`
- **Action**: CHECK
- **Implement**: With only the test file applied, run the reproduction. Expect `2 failed | 1 passed (3)`. The first failing assertion is `expect(screen.queryByRole('heading', { name: 'First' })).not.toBeInTheDocument()` in `never shows the previous document while the new one renders`, failing with `expected document not to contain element, found <h1`. The third test, `keeps showing the document while an edit waits to render`, passes on HEAD as well; it keeps the fix from hiding the tree during the typing debounce. Then apply the rest of the patch and expect `3 passed (3)`.
- **Mirror**: `src/renderer/src/components/MermaidDiagram.test.tsx:18-23`
- **Validate**: `npx vitest run src/renderer/src/components/Preview.test.tsx`

### Task 2: Check the comments against the final code

- **File**: `src/renderer/src/markdown/useRenderedMarkdown.ts`
- **Action**: UPDATE (only if the wording no longer matches)
- **Implement**: The patch rewrites the hook's doc comment to say that a new `documentKey` yields `null` until it renders. It also adds a two-line comment above the `return` with the reason. Keep both in the project's comment style (full sentences, the reason rather than the mechanics). `Editor.tsx:183` ("A new document opens at its top; the preview follows the editor there.") stays true and needs no edit.
- **Mirror**: `src/renderer/src/markdown/useRenderedMarkdown.ts:13-17`
- **Validate**: `npm run lint`

### Task 3: Full validation

- **File**: `package.json`
- **Action**: CHECK
- **Implement**: Run the project's gate. Expect 29 test files and 326 tests passing (28 and 323 on HEAD, plus the new file's 3 tests).
- **Mirror**: `AGENTS.md` (Validation section)
- **Validate**: `npm run typecheck && npm run lint && npm test`

### Task 4: End-to-end probe on production builds

- **File**: `src/renderer/src/markdown/useRenderedMarkdown.ts`
- **Action**: CHECK
- **Implement**: Follow **End-to-End Verification** below: build HEAD and the working tree in a scratch directory and run the probe's scenarios on both. HEAD must FAIL `switch`, `switch-plain`, `reopen-scrolled` and `reveal`, and the working tree must PASS all five.
- **Mirror**: Scratch Probe Scripts below
- **Validate**: `node <scratch>/probe/drive.mjs <scratch>/fixed <scratch>/docs switch <repo>/node_modules/electron/dist/electron` prints `VERDICT switch PASS`

---

## Validation

```bash
# Type check
npm run typecheck

# Lint
npm run lint

# Tests (HEAD: 28 files, 323 tests; after the patch: 29 files, 326 tests)
npm test

# Reproduction (BUG_FIX): red on the unfixed code (2 failed | 1 passed), green after the fix (3 passed)
npx vitest run src/renderer/src/components/Preview.test.tsx
```

## End-to-End Verification

The probe launches Electron with `--ozone-platform=headless`, so no window opens on the desktop. It uses a throwaway `XDG_CONFIG_HOME` that it deletes on exit, so the user's own Clarity settings are never touched. Use a scratch directory outside the repository; when an edit guard limits where the session may write, use the task folder it allows. All commands run from the repository root, with `S` set to the scratch directory.

```bash
S=<scratch>
mkdir -p "$S/probe" "$S/docs" "$S/head" "$S/fixed"
# Save gen-docs.mjs and drive.mjs from "Scratch Probe Scripts" into $S/probe, then:
node "$S/probe/gen-docs.mjs" "$S/docs"

# HEAD build (the base commit, without the fix)
git archive HEAD | tar -x -C "$S/head"
ln -s "$PWD/node_modules" "$S/head/node_modules"
(cd "$S/head" && npx electron-vite build)

# Working-tree build (with the fix, before it is committed)
git ls-files -z --cached --others --exclude-standard | xargs -0 cp --parents -t "$S/fixed"
ln -s "$PWD/node_modules" "$S/fixed/node_modules"
(cd "$S/fixed" && npx electron-vite build)

E="$PWD/node_modules/electron/dist/electron"
for app in head fixed; do
  for sc in switch switch-plain reopen-scrolled reveal reveal-same; do
    node "$S/probe/drive.mjs" "$S/$app" "$S/docs" "$sc" "$E" | grep VERDICT | sed "s/^/$app /"
  done
done
```

Expected output (run while planning; the `fixed` lines came from a copy with the patch applied):

```
head VERDICT switch FAIL: t=48ms preview shows Alpha while the editor shows Beta
head VERDICT switch-plain FAIL: t=45ms preview shows Alpha while the editor shows Plain
head VERDICT reopen-scrolled FAIL: t=61ms preview shows Beta while the editor shows Alpha
head VERDICT reveal FAIL: t=139ms preview shows Alpha while the editor shows Beta
head VERDICT reveal-same PASS
fixed VERDICT switch PASS
fixed VERDICT switch-plain PASS
fixed VERDICT reopen-scrolled PASS
fixed VERDICT reveal PASS
fixed VERDICT reveal-same PASS
```

The timings vary by a few tens of milliseconds between runs; the verdicts do not. A run prints every frame where something changed above its VERDICT line. Drop the `grep` to see them.

For the owner, a manual check in the real window (optional, opens the app): `npm run dev`, open a folder with two long files, scroll the first one well down in split view, then click the second one in the sidebar. The preview goes blank for a moment and shows the second file at its top, without first showing the old file. Repeat from editor-only view (**View → Editor**): open the second file there, scroll down, switch to split view. The preview appears at the editor's position and stays there.

### Scratch Probe Scripts

`gen-docs.mjs`:

```js
// Writes the probe's Markdown files into <dir>: a.md and b.md are long, with
// code (Shiki), math (KaTeX) and Mermaid diagrams whose sources differ per
// file; plain.md has none of them.
import { writeFileSync } from 'node:fs'

const [dir] = process.argv.slice(2)
if (!dir) throw new Error('usage: node gen-docs.mjs <dir>')

function doc(name, sections, rich) {
  let out = `# ${name}\n\n`
  for (let i = 1; i <= sections; i++) {
    out += `## ${name} section ${i}\n\nParagraph ${i} of ${name}. ${'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(4)}\n\n`
    if (rich && i % 3 === 0) {
      out += '```ts\n' + Array.from({ length: 8 }, (_, k) => `const value${k} = compute(${k}) // line ${k}`).join('\n') + '\n```\n\n'
    }
    if (rich && i % 4 === 0) out += '$$\n\\sum_{k=0}^{n} \\frac{k^2}{\\sqrt{k+1}} = \\int_0^1 f(x)\\,dx\n$$\n\n'
    if (rich && i % 10 === 5) out += `\`\`\`mermaid\ngraph TD\n  ${name}${i}A --> B\n  B --> C\n  C --> D\n  D --> E\n\`\`\`\n\n`
    out += '- item one\n- item two\n- item three\n\n'
  }
  return out
}

writeFileSync(`${dir}/a.md`, doc('Alpha', 40, true))
writeFileSync(`${dir}/b.md`, doc('Beta', 40, true))
writeFileSync(`${dir}/plain.md`, doc('Plain', 40, false))
```

`drive.mjs`:

```js
// Runs a built Clarity headless, opens a file the way a scenario says, and
// records what every frame paints in the editor and the preview.
// Usage: node drive.mjs <app-dir with out/> <docs-dir> <scenario> <electron-binary>
// Prints the frames where something changed and a VERDICT line; exits 1 on FAIL.
import { spawn } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const [appDir, docsDir, scenario, electronBin] = process.argv.slice(2)
if (!appDir || !docsDir || !scenario || !electronBin) throw new Error('usage: node drive.mjs <app> <docs> <scenario> <electron>')
const port = 9300 + Math.floor(Math.random() * 600)
// A scratch config dir: settings.json reopens a.md from docsDir in split view.
const cfg = mkdtempSync(join(import.meta.dirname, 'cfg-'))
mkdirSync(join(cfg, 'clarity'), { recursive: true })
writeFileSync(
  join(cfg, 'clarity', 'settings.json'),
  JSON.stringify({
    ui: { viewMode: 'split', theme: 'dark', sidebarWidth: 240, editorFraction: 0.5, font: 'commit-mono', fontSize: 14 },
    recentFolders: [docsDir],
    window: { x: 0, y: 0, width: 1400, height: 900, maximized: false },
    lastFolder: docsDir,
    lastFile: join(docsDir, 'a.md'),
  }),
)
const env = { ...process.env, XDG_CONFIG_HOME: cfg }
delete env.ELECTRON_RUN_AS_NODE
const child = spawn(
  electronBin,
  [
    '--ozone-platform=headless',
    '--ozone-override-screen-size=1400,900',
    '--window-size=1400,900',
    `--remote-debugging-port=${port}`,
    '--no-sandbox',
    appDir,
  ],
  // Its own process group, so that finish() stops Electron's helper processes too.
  { env, stdio: ['ignore', 'ignore', 'pipe'], detached: true },
)
let stderr = ''
child.stderr.on('data', (d) => (stderr += d))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const finish = async (code) => {
  try {
    process.kill(-child.pid, 'SIGKILL')
  } catch {}
  // The killed processes may still be closing files in the config dir.
  await sleep(500)
  try {
    rmSync(cfg, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
  } catch (error) {
    console.error(`could not remove ${cfg}: ${error.message}`)
  }
  process.exit(code)
}
const killTimer = setTimeout(() => {
  console.error('timeout', stderr.slice(-2000))
  finish(2)
}, 40000)

async function pageSocket() {
  for (let i = 0; i < 100; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
      const page = list.find((t) => t.type === 'page')
      if (page) return page.webSocketDebuggerUrl
    } catch {}
    await sleep(100)
  }
  throw new Error('no page target')
}
const ws = new WebSocket(await pageSocket())
await new Promise((r) => ws.addEventListener('open', r, { once: true }))
let id = 0
const pending = new Map()
ws.addEventListener('message', (e) => {
  const msg = JSON.parse(e.data)
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg)
    pending.delete(msg.id)
  }
})
async function run(expression) {
  const n = ++id
  ws.send(JSON.stringify({ id: n, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } }))
  const res = await new Promise((r) => pending.set(n, r))
  if (res.result?.exceptionDetails) throw new Error(JSON.stringify(res.result.exceptionDetails))
  return res.result?.result?.value
}

const helpers = `
  window.__p = {
    ed: () => document.querySelector('section[aria-label="Editor"]').shadowRoot.querySelector('.cm-scroller'),
    pv: () => document.querySelector('section[aria-label="Preview"]'),
    wait: (f, ms = 8000) => new Promise((res, rej) => { const t0 = performance.now(); const tick = () => { let v; try { v = f() } catch {} if (v) res(v); else if (performance.now() - t0 > ms) rej(new Error('wait timeout')); else requestAnimationFrame(tick) }; tick() }),
    frames: (n) => new Promise((res) => { let k = 0; const tick = () => (++k >= n ? res() : requestAnimationFrame(tick)); requestAnimationFrame(tick) }),
    // The fractional source line at the preview's top edge, from the first block that reaches below it.
    pvLine: () => { const pv = window.__p.pv(); const top = pv.getBoundingClientRect().top; for (const el of pv.querySelectorAll('[data-source-line]')) { const r = el.getBoundingClientRect(); if (r.height > 0 && r.bottom > top + 1) { const start = Number(el.dataset.sourceLine), end = Number(el.dataset.sourceLineEnd); return Math.round((start + Math.max(0, (top - r.top) / r.height) * (end - start + 1)) * 10) / 10 } } return -1 },
    heading: () => window.__p.pv().querySelector('h1')?.textContent ?? '',
    edDoc: () => (window.__p.ed().querySelector('.cm-line')?.textContent ?? '').slice(2, 8),
    // Samples each frame right before it paints: a ResizeObserver callback runs after every
    // requestAnimationFrame callback (scroll sync included) and after layout. A probe
    // element whose width changes every frame makes it fire once per frame.
    sample: (ms) => new Promise((res) => { const out = []; const t0 = performance.now(); const probe = document.createElement('div'); Object.assign(probe.style, { position: 'fixed', left: '0', top: '0', height: '1px', width: '1px', pointerEvents: 'none' }); document.body.append(probe); let w = 1; const ro = new ResizeObserver(() => { const ed = window.__p.ed(), pv = window.__p.pv(); out.push({ t: Math.round(performance.now() - t0), ed: Math.round(ed.scrollTop), edDoc: window.__p.edDoc(), pv: Math.round(pv.scrollTop), hidden: pv.hidden, line: window.__p.pvLine(), doc: window.__p.heading() }) }); ro.observe(probe); const tick = () => { w = w === 1 ? 2 : 1; probe.style.width = w + 'px'; if (performance.now() - t0 < ms) requestAnimationFrame(tick); else { ro.disconnect(); probe.remove(); res(out) } }; requestAnimationFrame(tick) }),
    open: (name) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === name).click(),
    state: () => ({ ed: __p.ed().scrollTop, pv: __p.pv().scrollTop, line: __p.pvLine() }),
  }; true`

const scenarios = {
  // Scroll a.md down in the editor (the leader), then open b.md.
  switch: `__p.ed().scrollTop = 4000; await __p.frames(30); const before = __p.state(); const s = __p.sample(1500); __p.open('b.md')`,
  // As switch, but the opened file has no code, math or diagrams.
  'switch-plain': `__p.ed().scrollTop = 4000; await __p.frames(30); const before = __p.state(); const s = __p.sample(1500); __p.open('plain.md')`,
  // Scroll a.md, open b.md and scroll it, then open a.md again.
  'reopen-scrolled': `__p.ed().scrollTop = 4000; await __p.frames(30); __p.open('b.md'); await __p.wait(() => __p.heading() === 'Beta'); await __p.frames(60); __p.ed().scrollTop = 2500; await __p.frames(30); const before = __p.state(); const s = __p.sample(1500); __p.open('a.md')`,
  // Editor-only view: open b.md and scroll it, then switch to split view.
  reveal: `await window.clarity.updateSettings({ viewMode: 'editor' }); await __p.frames(30); __p.open('b.md'); await __p.frames(60); __p.ed().scrollTop = 4000; await __p.frames(30); const before = __p.state(); const s = __p.sample(1500); window.clarity.updateSettings({ viewMode: 'split' })`,
  // Editor-only view on the same file: scroll it, then switch to split view.
  'reveal-same': `await window.clarity.updateSettings({ viewMode: 'editor' }); await __p.frames(30); __p.ed().scrollTop = 4000; await __p.frames(30); const before = __p.state(); const s = __p.sample(1500); window.clarity.updateSettings({ viewMode: 'split' })`,
}

let code = 0
try {
  if (!scenarios[scenario]) throw new Error(`unknown scenario ${scenario}; one of ${Object.keys(scenarios).join(', ')}`)
  await run(`new Promise((r) => { const go = () => document.querySelector('section[aria-label="Preview"] h1') ? r(true) : setTimeout(go, 50); go() })`)
  await run(helpers)
  await run(`__p.wait(() => __p.pv().querySelector('.shiki'))`)
  await run(`__p.frames(30)`)
  const result = await run(`(async () => { ${scenarios[scenario]}; return { before, samples: await s } })()`)
  console.log('before', JSON.stringify(result.before))
  let last = ''
  for (const s of result.samples) {
    const key = `${s.ed} ${s.edDoc} ${s.pv} ${s.hidden} ${s.line} ${s.doc}`
    if (key !== last) console.log(`t=${s.t}ms editor=${s.edDoc}@${s.ed} preview=${s.hidden ? 'hidden' : `${s.doc || '(empty)'}@${s.pv} line ${s.line}`}`)
    last = key
  }
  // FAIL when a painted frame shows another document in the preview than in the
  // editor, or when the preview's top line moves after the editor's document first appears there.
  const visible = result.samples.filter((s) => !s.hidden && s.edDoc === result.samples.at(-1).edDoc)
  const stale = visible.find((s) => s.doc !== '' && s.doc !== s.edDoc)
  const firstMatch = visible.find((s) => s.doc === s.edDoc)
  const jump = firstMatch && visible.find((s) => s.t > firstMatch.t && Math.abs(s.line - firstMatch.line) > 0.5)
  const reasons = []
  if (stale) reasons.push(`t=${stale.t}ms preview shows ${stale.doc} while the editor shows ${stale.edDoc}`)
  if (!firstMatch) reasons.push('the preview never showed the editor document')
  if (jump) reasons.push(`t=${jump.t}ms preview top line moved from ${firstMatch.line} to ${jump.line}`)
  console.log(`VERDICT ${scenario} ${reasons.length ? 'FAIL: ' + reasons.join('; ') : 'PASS'}`)
  code = reasons.length ? 1 : 0
} catch (error) {
  console.error(error)
  code = 2
} finally {
  clearTimeout(killTimer)
  ws.close()
  finish(code)
}
```

## Risks

| Risk | Mitigation | Scope |
|------|------------|-------|
| The preview is now blank for the time a new file takes to render (about 75 ms for plain text, about 230 ms for the probe's file with code, math and diagrams), where it used to show the previous file | It replaces a wrong document and a jump with an empty pane; the editor shows the new file at once. See Open Question 2 for the alternatives | In scope (accepted) |
| A test or component relied on the previous tree staying up across documents | The full suite passed with the patch (29 files, 326 tests); `App.test.tsx` preview tests wait for content with `findBy*` | In scope (checked) |
| An edit made while the preview was hidden (editor-only view, same file) shows the older text of the same file for up to `PREVIEW_DELAY_MS` (200 ms) after the preview comes back, aligned by its old line map | The tree is of the right file and lines up closely; the third regression test keeps the debounce behaviour that this depends on. Not measured by the probe | Out of scope (flag only) |
| Content whose height changes without a DOM mutation (KaTeX fonts loading for the first time, an image that finishes decoding) only reaches scroll sync through the `ResizeObserver` (`src/renderer/src/components/Preview.tsx:146-148`), whose sync runs in the next frame, so one frame could paint shifted content when the editor is not at the top | Not observed in the probe (fonts were already loaded). Fixing it would mean syncing inside the observer callback | Out of scope (flag only) |
| jsdom has no layout, so the component test covers the cause (a stale tree) but not what a frame paints | The headless probe covers the painted frames; it runs in End-to-End Verification and is kept verbatim in this plan | In scope |

## Open Questions

1. **Which scenario did the report describe?** The issue says the preview lags "when opening a scrolled file". The editor always opens a file at its top (`src/renderer/src/components/Editor.tsx:183-184`). Two cases match the description: opening another file after scrolling the current one down (`switch`), and showing the preview again after opening and scrolling a file in editor-only view (`reveal`). Proposed default: treat both as the reported bug, since one change fixes both and the probe checks both. The owner confirms with the manual check above.
2. **Empty preview or old content while the new file renders?** Proposed default: empty. Showing the old file is the bug itself. Keeping the old tree but hiding it with a CSS class looks the same as an empty pane and costs more code. A loading indicator would flash for under a quarter of a second, which is more distracting than an empty pane.

## Acceptance Criteria

- [ ] All tasks completed
- [ ] Type check passes (`npm run typecheck`)
- [ ] Lint passes (`npm run lint`)
- [ ] Tests pass (`npm test`), the existing scroll-sync tests in `src/renderer/src/scrollSync/lineMap.test.ts` among them
- [ ] The bug is reproduced as an automated test: `src/renderer/src/components/Preview.test.tsx` fails on HEAD and passes with the fix
- [ ] Opening a file while the current one is scrolled down never paints the previous file in the preview; the probe's `switch`, `switch-plain` and `reopen-scrolled` scenarios PASS on the fixed build and FAIL on HEAD
- [ ] Showing the preview again after opening a file in editor-only view lands on the editor's line without a catch-up jump; the probe's `reveal` scenario PASSes on the fixed build and `reveal-same` still PASSes
- [ ] Follows existing patterns
