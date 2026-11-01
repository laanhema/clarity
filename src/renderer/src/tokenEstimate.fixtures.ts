/**
 * Texts with their Claude Opus 5.5 input-token counts, measured on
 * 2026-10-31 the same way as the calibration samples (see TOKEN_WEIGHTS).
 * The baseline request varied by up to 2 tokens between runs, so each count
 * is good to about ±2. None of these texts was part of the calibration.
 */
export interface TokenFixture {
  name: string
  text: string
  opusTokens: number
}

export const TOKEN_FIXTURES: TokenFixture[] = [
  {
    name: 'SKILL.md with frontmatter',
    opusTokens: 359,
    text: `---
name: release-notes
description: >
  Write release notes for the current version from the merged pull requests and the
  CHANGELOG. Use when the user asks for release notes, a version summary, or an
  announcement draft. For a full changelog rewrite, use /update-changelog instead.
---

# Release notes

Collect what changed since the last tag, group it for readers, and write it in plain words.

## Steps

1. Find the previous tag with \`git describe --tags --abbrev=0\` and list the merged pull requests since then.
2. Group each change under **Added**, **Changed**, **Fixed** or **Removed**. Skip refactors and test-only changes.
3. Write one line per change, starting with a verb, and link the pull request.
4. Put breaking changes first, under their own heading, with the migration step a user must take.
5. Save the draft to \`.agents/release-notes/<version>.md\` and show it in the reply.

## Rules

- Never invent a change that is not in the history.
- Keep each line under 100 characters; readers skim.
- Name users' settings and commands exactly as the app shows them.
`,
  },
  {
    name: 'AGENTS.md rules with paths and commands',
    opusTokens: 386,
    text: `# AGENTS.md

## Project layout

- \`src/main/\` — the Electron main process: windows, menus, file access over IPC (\`ipc.ts\`), settings (\`settings.ts\`).
- \`src/preload/index.ts\` — the bridge that exposes \`window.clarity\` to the renderer; keep it small and typed.
- \`src/renderer/src/\` — the React app: \`App.tsx\` owns document state; components live in \`components/\`.
- \`config/csp.ts\` — the Content-Security-Policy. Do not loosen it; a failing test guards each directive.

## Validation

Run all four before you report a change as done:

\`\`\`sh
npm run typecheck
npm run lint
npm test
npm run build
\`\`\`

## Conventions

- TypeScript strict mode with \`noUncheckedIndexedAccess\`; prefer narrowing over \`as\` casts.
- File access goes through \`pathGuard.ts\`: never read a path the user did not open.
- Tests sit next to the code as \`*.test.ts\`; the renderer tests run in jsdom (see \`vitest.config.mts\`).
- Commit messages follow Conventional Commits, for example \`feat(renderer): show word count\`.
`,
  },
  {
    name: 'Markdown table with numbers',
    opusTokens: 353,
    text: `## Benchmarks

Measured on a ThinkPad X13 (Ryzen 7 PRO 5850U, 16 GB), Fedora 44, Electron 45.2.0, median of 20 runs.

| File | Size | Open (ms) | First paint (ms) | Re-render after edit (ms) |
|------|-----:|----------:|-----------------:|--------------------------:|
| README.md | 4.2 KB | 38 | 61 | 3.1 |
| AGENTS.md | 51 KB | 52 | 88 | 7.4 |
| CHANGELOG.md | 108 KB | 71 | 140 | 12.9 |
| docs/spec.md | 420 KB | 166 | 395 | 41.0 |
| large-test.md | 1.0 MB | 402 | 910 | 96.5 |

Re-render time grows about linearly: roughly 0.09 ms per KB. The 1.0 MB file stays under 100 ms, which keeps typing smooth at 60 Hz when edits are debounced by 150–300 ms.
`,
  },
  {
    name: 'TypeScript code block',
    opusTokens: 213,
    text: `## Watching the open file

\`\`\`ts
import { watch, type FSWatcher } from 'chokidar'

export function watchDocument(path: string, onChange: (path: string) => void): () => void {
  const watcher: FSWatcher = watch(path, { ignoreInitial: true, awaitWriteFinish: { stabilityThreshold: 120 } })
  watcher.on('change', () => onChange(path))
  watcher.on('unlink', () => onChange(path))
  return () => {
    void watcher.close()
  }
}
\`\`\`

The watcher reports both edits and deletions; the renderer decides whether to reload, ask, or keep the user's text.
`,
  },
  {
    name: 'Finnish instructions',
    opusTokens: 426,
    text: `# Ohjeet raportin kirjoittamiseen

Raportti kirjoitetaan aina suomeksi ja oppilaitoksen raporttipohjaan. Aloita kansilehdestä, johon tulevat tekijän nimi, opintojakson tunnus, päivämäärä ja työn otsikko.

## Rakenne

1. **Johdanto** kertoo, mitä tehtiin ja miksi. Pidä se lyhyenä: kolme tai neljä virkettä riittää.
2. **Toteutus** kuvaa työvaiheet siinä järjestyksessä, jossa ne tehtiin. Lisää kuvakaappaukset niiden vaiheiden kohdalle, joita tekstistä on vaikea ymmärtää.
3. **Pohdinta** arvioi, mikä onnistui ja mitä tekisit seuraavalla kerralla toisin.

Lähteet merkitään tekstiin sulkeisiin, esimerkiksi (Virtanen 2024, 15), ja lähdeluettelo kootaan raportin loppuun aakkosjärjestyksessä. Älä kopioi lähteen tekstiä sellaisenaan, vaan kirjoita asia omin sanoin.
`,
  },
]
