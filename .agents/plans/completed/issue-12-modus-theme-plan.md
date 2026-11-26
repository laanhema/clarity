# Plan: Modus and Modus Tinted themes (Operandi light, Vivendi dark)

## Summary

This plan adds two theme entries, **Modus** (setting id `modus`) and **Modus Tinted** (`modus-tinted`), built from Protesilaos Stavrou's Emacs modus-themes. Each entry follows the system light/dark preference and switches live. Modus uses the Modus Operandi palette when the system is light and Modus Vivendi when it is dark. Modus Tinted does the same with Operandi Tinted and Vivendi Tinted. That makes four palettes in total. Deuteranopia and tritanopia variants are out of scope.

The approach reuses the mechanism that the System theme already uses. `nativeThemeSource` returns `'system'` for both ids, so `prefers-color-scheme` follows the OS. `styles.css` then holds a light variable block per entry plus a dark block for each inside `@media (prefers-color-scheme: dark)`, and every block sets each variable that the GitHub Dark block sets. Code colours come from four new Shiki `ThemeRegistration`s in one new file, `markdown/modusThemes.ts`. Each is emitted as its own CSS variable set (`--shiki-operandi`, `--shiki-vivendi`, `--shiki-operandi-tinted`, `--shiki-vivendi-tinted`), and the media query chooses between them. Mermaid gets four palettes, and `diagramStyle()` resolves each entry against the system's dark flag. `MermaidDiagram` already re-renders when the colour scheme changes.

Every colour is pinned to upstream `modus-themes.el` 5.3.0 at commit `782743415b3eedac0b99db2342fb35703deb752f` (see Value Provenance). A prototype patch already holds all production code. The tasks cover tests, docs and verification. A headless end-to-end probe passed on the prototype build and fails on HEAD.

All `file:line` references in this plan are lines of HEAD (`d8db23e`) before the prototype patch is applied.

## User Story

As a Clarity user who likes the Emacs Modus themes,
I want to pick "Modus" or "Modus Tinted" and have the editor, preview, code, diagrams, sidebar and status bar use the Modus Operandi palette in light mode and Modus Vivendi in dark mode,
So that Clarity matches my editor and still follows my system's light/dark switch.

## Metadata

| Field | Value |
|-------|-------|
| Type | NEW_CAPABILITY |
| Complexity | MEDIUM |
| Systems Affected | `src/shared/api.ts`, `src/main/menu.ts`, `src/main/theme.ts`, `src/renderer/src/App.tsx`, `src/renderer/src/components/StatusBar.tsx`, `src/renderer/src/styles.css`, `src/renderer/src/markdown/{highlighter,mermaid,modusThemes}.ts`, tests, `README.md`, `PROJECT-GUIDE.md` |
| GitHub Issue | #12 |
| PRD Phase | N/A |
| Prototype Patch | `.agents/plans/issue-12-modus-theme-prototype.patch` |

---

## Value Provenance

Upstream: `https://github.com/protesilaos/modus-themes`, file `modus-themes.el` (`;; Version: 5.3.0`, line 8), pinned at commit `782743415b3eedac0b99db2342fb35703deb752f` (main on 2026-10-31). The palettes live in that file. The per-theme files (`modus-operandi-theme.el` and so on) only call `modus-themes-theme` with the palette symbol. Palette `defconst`s: `modus-themes-operandi-palette` L749, `modus-themes-operandi-tinted-palette` L1076, `modus-themes-vivendi-palette` L2056, `modus-themes-vivendi-tinted-palette` L2382. The shared semantic mappings are in `modus-themes-common-palette-mappings` L597. In that block `number`, `operator`, `punctuation`, `bracket` and `delimiter` map to `fg-main` (L600–L606), `bg-prose-block-contents` maps to `bg-dim`, and `bg-prose-code` is `unspecified`. Italic and bold code are off by default (`modus-themes-italic-constructs` L339 and `modus-themes-bold-constructs` L347 are both `nil`).

Named colours (value, upstream line):

| Name | Operandi | Operandi Tinted | Vivendi | Vivendi Tinted |
|---|---|---|---|---|
| `bg-main` | #ffffff (L754) | #fbf7f0 (L1081) | #000000 (L2061) | #0d0e1c (L2387) |
| `bg-dim` | #f2f2f2 (L755) | #efe9dd (L1082) | #1e1e1e (L2062) | #1d2235 (L2388) |
| `fg-main` | #000000 (L756) | #000000 (L1083) | #ffffff (L2063) | #ffffff (L2389) |
| `fg-dim` | #595959 (L757) | #595959 (L1084) | #989898 (L2064) | #989898 (L2390) |
| `fg-alt` | #193668 (L758) | #193668 (L1085) | #c6daff (L2065) | #c6daff (L2391) |
| `bg-inactive` | #e0e0e0 (L760) | #dfd5cf (L1087) | #303030 (L2067) | #2b3045 (L2393) |
| `border` | #9f9f9f (L761) | #9f9690 (L1088) | #646464 (L2068) | #61647a (L2394) |
| `bg-hl-line` | #dae5ec (L864) | #f1d5d0 (L1191) | #2f3849 (L2171) | #303a6f (L2497) |
| `bg-region` | #bdbdbd (L865) | #c2bcb5 (L1192) | #5a5a5a (L2172) | #555a66 (L2498) |
| `bg-yellow-intense` | #f3d000 (L810) | #f3d000 (L1137) | #7a6100 (L2117) | #7a6100 (L2443) |
| `bg-cyan-intense` | #a4d5f9 (L813) | #a4d5f9 (L1140) | #2266ae (L2120) | #2266ae (L2446) |
| `bg-red-nuanced` | #ffe8e8 (L822) | #ffe8e8 (L1149) | #3a0c14 (L2129) | #3a0c14 (L2455) |
| `bg-yellow-nuanced` | #f8f0d0 (L824) | #f8f0d0 (L1151) | #381d0f (L2131) | #381d0f (L2457) |
| `bg-blue-nuanced` | #ecedff (L825) | #ecedff (L1152) | #12154a (L2132) | #12154a (L2458) |
| `bg-magenta-nuanced` | #f8e6f5 (L826) | #f8e6f5 (L1153) | #2f0c3f (L2133) | #2f0c3f (L2459) |
| `red` | #a60000 (L765) | #a60000 (L1092) | #ff5f59 (L2072) | #ff5f59 (L2398) |
| `red-cooler` | #a0132f (L767) | #a0132f (L1094) | #ff7f86 (L2074) | #ff7f86 (L2400) |
| `red-faint` | #7f0000 (L768) | #7f0000 (L1095) | #ff9580 (L2075) | #ef8386 (L2401) |
| `green-warmer` | #316500 (L771) | #306010 (L1098) | #70b900 (L2078) | #75c13e (L2404) |
| `green-cooler` | #00663f (L772) | #00603f (L1099) | #00c06f (L2079) | #11c777 (L2405) |
| `green-faint` | #2a5045 (L773) | #2a5045 (L1100) | #88ca9f (L2080) | #88ca9f (L2406) |
| `yellow` | #6f5500 (L775) | #6d5000 (L1102) | #d0bc00 (L2082) | #d0bc00 (L2408) |
| `yellow-warmer` | #884900 (L776) | #894000 (L1103) | #fec43f (L2083) | #fec43f (L2409) |
| `yellow-cooler` | #7a4f2f (L777) | #602938 (L1104) | #dfaf7a (L2084) | #dfaf7a (L2410) |
| `yellow-faint` | #624416 (L778) | #574316 (L1105) | #d2b580 (L2085) | #d2b580 (L2411) |
| `blue` | #0031a9 (L780) | #0031a9 (L1107) | #2fafff (L2087) | #2fafff (L2413) |
| `blue-warmer` | #3548cf (L781) | #3546c2 (L1108) | #79a8ff (L2088) | #79a8ff (L2414) |
| `blue-cooler` | #0000b0 (L782) | #0000b0 (L1109) | #00bcff (L2089) | #00bcff (L2415) |
| `blue-faint` | #003497 (L783) | #003497 (L1110) | #82b0ec (L2090) | #82b0ec (L2416) |
| `magenta` | #721045 (L785) | #721045 (L1112) | #feacd0 (L2092) | #feacd0 (L2418) |
| `magenta-warmer` | #8f0075 (L786) | #8f0075 (L1113) | #f78fe7 (L2093) | #f78fe7 (L2419) |
| `magenta-cooler` | #531ab6 (L787) | #531ab6 (L1114) | #b6a0ff (L2094) | #b6a0ff (L2420) |
| `cyan` | #005e8b (L790) | #00598b (L1117) | #00d3d0 (L2097) | #00d3d0 (L2423) |
| `cyan-warmer` | #3f578f (L791) | #32548f (L1118) | #4ae2f0 (L2098) | #4ae2f0 (L2424) |
| `cyan-cooler` | #005f5f (L792) | #005f5f (L1119) | #6ae4b9 (L2099) | #6ae4b9 (L2425) |
| `cyan-faint` | #005077 (L793) | #304463 (L1120) | #9ac8e0 (L2100) | #9ac8e0 (L2426) |
| `pink` | #7b435c (L804) | #7b435c (L1131) | #d09dc0 (L2111) | #d09dc0 (L2437) |
| `fg-added` | #005000 (L887) | #005000 (L1214) | #a0e0a0 (L2194) | #a0e0a0 (L2520) |
| `fg-changed` | #553d00 (L894) | #553d00 (L1221) | #efef80 (L2201) | #efef80 (L2527) |
| `fg-removed` | #8f1313 (L901) | #8f1313 (L1228) | #ffbfbf (L2208) | #ffbfbf (L2534) |

Semantic mappings, which differ between the plain and tinted palettes (name → named colour):

| Mapping | Operandi | Operandi Tinted | Vivendi | Vivendi Tinted |
|---|---|---|---|---|
| `accent-0` | blue (L959) | red-cooler (L1285) | blue-cooler (L2265) | magenta-cooler (L2591) |
| `warning` | yellow-warmer (L920) | yellow (L1246) | yellow-warmer (L2226) | yellow (L2552) |
| `err` | red (L919) | red (L1245) | red (L2225) | red (L2551) |
| `comment` | fg-dim (L942) | red-faint (L1268) | fg-dim (L2248) | red-faint (L2574) |
| `keyword` | magenta-cooler (L947) | blue (L1273) | magenta-cooler (L2253) | blue-warmer (L2579) |
| `string` | blue-warmer (L952) | cyan (L1278) | blue-warmer (L2258) | blue (L2584) |
| `fnname` | magenta (L945) | yellow-cooler (L1271) | magenta (L2251) | magenta-warmer (L2577) |
| `fnname-call` | pink (L946) | pink (L1272) | pink (L2252) | pink (L2578) |
| `type` | cyan-cooler (L953) | green-warmer (L1279) | cyan-cooler (L2259) | green-cooler (L2585) |
| `constant` | blue-cooler (L943) | magenta-cooler (L1269) | blue-cooler (L2249) | magenta-cooler (L2575) |
| `builtin` | magenta-warmer (L941) | magenta (L1267) | magenta-warmer (L2247) | magenta (L2573) |
| `property`, `variable` | cyan (L949, L954) | green-cooler (L1275, L1280) | cyan (L2255, L2260) | cyan-warmer (L2581, L2586) |
| `docstring` | green-faint (L944) | cyan-faint (L1270) | cyan-faint (L2250) | cyan-faint (L2576) |
| `preprocessor` | red-cooler (L948) | yellow-warmer (L1274) | red-cooler (L2254) | red-cooler (L2580) |
| `rx-construct` | green-cooler (L951) | magenta-cooler (L1277) | green-cooler (L2257) | magenta-cooler (L2583) |
| `rx-backslash` | magenta (L950) | magenta-warmer (L1276) | magenta (L2256) | magenta-warmer (L2582) |
| `fg-link` | blue-warmer (L987) | blue-warmer (L1313) | blue-warmer (L2293) | blue-warmer (L2619) |
| `fg-prose-code` | cyan-cooler (L1020) | green-cooler (L1346) | cyan-cooler (L2326) | cyan-cooler (L2652) |
| `fg-heading-1` … `-6` | fg-main, yellow-faint, fg-alt, magenta, green-faint, red-faint (L1058–L1063) | same as Operandi (L1384–L1389) | fg-main, yellow-faint, **blue-faint**, magenta, green-faint, red-faint (L2364–L2369) | same as Vivendi (L2690–L2695) |
| `bg-search-current` / `bg-search-lazy` | bg-yellow-intense / bg-cyan-intense (L1045–L1046) | same (L1371–L1372) | same (L2351–L2352) | same (L2677–L2678) |

Faces that choose the app mapping (upstream `modus-themes.el`): `dired-directory` uses `accent-0` (L5131), so it drives `--dir`. The `markdown-header-face-1..6` faces use `fg-heading-1..6` (L6141–L6146). `markdown-markup-face` uses `fg-dim` (L6153), which drives `--md-mark` and `--md-list`. `markdown-inline-code-face` uses `fg-prose-code` (L6148). `markdown-blockquote-face` uses `docstring` (L6136). `markdown-link-face` and `markdown-url-face` use `fg-link` (L6152, L6159). `markdown-code-face` sits on `bg-prose-block-contents` = `bg-dim` (L6138). The `font-lock-*` faces (L5514–L5537) choose the Shiki scopes. `hl-line` uses `bg-hl-line` (L5697), `region` uses `bg-region` (L4662), and `isearch` / `lazy-highlight` use the search-current/lazy faces (L4605–L4606, L5835, L5839).

### Resolved app colours (what the prototype writes)

`styles.css` variables. Light block = Operandi / Operandi Tinted; dark block = Vivendi / Vivendi Tinted:

| Variable | Upstream source | Operandi | Op. Tinted | Vivendi | Viv. Tinted |
|---|---|---|---|---|---|
| `--bg` | bg-main | #ffffff | #fbf7f0 | #000000 | #0d0e1c |
| `--bg-sidebar`, `--bg-stripe`, `--code-bg`, `--inline-code-bg` | bg-dim | #f2f2f2 | #efe9dd | #1e1e1e | #1d2235 |
| `--bg-hover` (= `--bg-row-hover`) | bg-inactive | #e0e0e0 | #dfd5cf | #303030 | #2b3045 |
| `--bg-active` (selected row) | bg-hl-line | #dae5ec | #f1d5d0 | #2f3849 | #303a6f |
| `--fg` | fg-main | #000000 | #000000 | #ffffff | #ffffff |
| `--fg-muted`, `--md-mark`, `--md-list` | fg-dim | #595959 | #595959 | #989898 | #989898 |
| `--border` | border | #9f9f9f | #9f9690 | #646464 | #61647a |
| `--dir`, `--accent` | accent-0 | #0031a9 | #a0132f | #00bcff | #b6a0ff |
| `--unsaved` | warning | #884900 | #6d5000 | #fec43f | #d0bc00 |
| `--danger` | err | #a60000 | #a60000 | #ff5f59 | #ff5f59 |
| `--md-heading` | fg-main (metadata keys are bold fg-main upstream) | var(--fg) | var(--fg) | var(--fg) | var(--fg) |
| `--h1`…`--h6` | fg-heading-1…6 | #000000 #624416 #193668 #721045 #2a5045 #7f0000 | #000000 #574316 #193668 #721045 #2a5045 #7f0000 | #ffffff #d2b580 #82b0ec #feacd0 #88ca9f #ff9580 | #ffffff #d2b580 #82b0ec #feacd0 #88ca9f #ef8386 |
| `--md-link` | fg-link | #3548cf | #3546c2 | #79a8ff | #79a8ff |
| `--md-code`, `--inline-code-fg` | fg-prose-code | #005f5f | #00603f | #6ae4b9 | #6ae4b9 |
| `--md-quote` | docstring | #2a5045 | #304463 | #9ac8e0 | #9ac8e0 |
| `--editor-selection` | bg-region | #bdbdbd | #c2bcb5 | #5a5a5a | #555a66 |
| `--editor-active-line` | bg-hl-line, as `color-mix(in srgb, X 50%, transparent)` | X = #b5cbd9 | X = #e7b3b0 | X = #5e7092 | X = #5366c2 |
| `--editor-match` | bg-search-lazy | #a4d5f9 | #a4d5f9 | #2266ae | #2266ae |
| `--editor-match-selected` | bg-search-current | #f3d000 | #f3d000 | #7a6100 | #7a6100 |

X is chosen so that X at 50 % over `bg-main` is exactly `bg-hl-line`. The repo's test needs a translucent active line (`App.test.tsx:538-548`). The probe `node scripts/activeline.mjs` prints `exact` for all four. Its script is in End-to-End Verification.

Window background before first paint (`src/main/theme.ts`): `modus` gives #ffffff light / #000000 dark, and `modus-tinted` gives #fbf7f0 light / #0d0e1c dark (bg-main).

Mermaid palettes (`PALETTES` in `markdown/mermaid.ts`). Node fill = the nuanced background of the accent-0 hue, and the border = accent-0:

| Key | modus-operandi | modus-vivendi | modus-operandi-tinted | modus-vivendi-tinted |
|---|---|---|---|---|
| darkMode | false | true | false | true |
| background, edgeLabelBackground (bg-main) | #ffffff | #000000 | #fbf7f0 | #0d0e1c |
| primaryColor, actorBkg, labelBoxBkgColor | #ecedff (bg-blue-nuanced) | #12154a (bg-blue-nuanced) | #ffe8e8 (bg-red-nuanced) | #2f0c3f (bg-magenta-nuanced) |
| primaryBorderColor, actorBorder, labelBoxBorderColor, activationBorderColor (accent-0) | #0031a9 | #00bcff | #a0132f | #b6a0ff |
| all text colours (fg-main) | #000000 | #ffffff | #000000 | #ffffff |
| secondaryColor (bg-inactive) | #e0e0e0 | #303030 | #dfd5cf | #2b3045 |
| tertiaryColor, clusterBkg, activationBkgColor (bg-dim) | #f2f2f2 | #1e1e1e | #efe9dd | #1d2235 |
| secondary/tertiary/cluster borders, actorLineColor (border) | #9f9f9f | #646464 | #9f9690 | #61647a |
| lineColor (fg-dim) | #595959 | #989898 | #595959 | #989898 |
| titleColor (fg-alt) | #193668 | #c6daff | #193668 | #c6daff |
| noteBkgColor (bg-yellow-nuanced) | #f8f0d0 | #381d0f | #f8f0d0 | #381d0f |
| noteBorderColor (warning) | #884900 | #fec43f | #6d5000 | #d0bc00 |

Shiki token colours (`markdown/modusThemes.ts`): code blocks sit on `bg-dim`. Comments use `comment` and keywords (including `storage.type`, `new`, `typeof`) use `keyword`. Function definitions use `fnname` and calls use `fnname-call`. `support.function`, `this` and `support.constant` use `builtin`. `constant.language`, `constant.other` and `variable.other.constant` use `constant`. Types use `type` and strings use `string`. String escapes use `rx-backslash`, and regexp groups, quantifiers and character classes use `rx-construct`. Properties and attributes use `property`, while parameters and the names in variable definitions use `variable`. Variable uses, numbers, operators and punctuation use `fg-main`, as in Emacs font-lock level 3. Tags use `fnname`, preprocessor scopes use `preprocessor` and `invalid` uses `err`. In Markdown, inline code and raw spans use `fg-prose-code`, links use `fg-link` and quotes use `docstring`, and diffs use `fg-added`, `fg-removed` and `fg-changed`. No italics or bold apart from `markup.bold` / `markup.italic`, following the upstream defaults.

---

## Patterns to Follow

### Naming
```ts
// SOURCE: src/shared/api.ts:58-65
export type ThemeSetting = 'system' | 'light' | 'dark' | 'gruvbox-material-dark-hard' | 'tokyo-night-moon'
export const THEME_SETTINGS = [
  'system',
  'light',
  'dark',
  'gruvbox-material-dark-hard',
  'tokyo-night-moon',
] as const satisfies readonly ThemeSetting[]
```

```ts
// SOURCE: src/renderer/src/markdown/highlighter.ts:84-93
/**
 * Every theme's code colours, by the key styles.css reads them with
 * (`--shiki-light`, `--shiki-dark`, `--shiki-gruvbox`, `--shiki-tokyo`).
 */
export const THEMES = {
  light: 'github-light',
  dark: 'github-dark-default',
  gruvbox: gruvboxMaterialDarkHard.name,
  tokyo: tokyoNightMoon.name,
} as const
```

### Error Handling

Themes have no error path. An unknown theme id falls back instead of throwing:
```ts
// SOURCE: src/renderer/src/markdown/mermaid.ts:7-10
/** Reads the app theme from the `data-theme` value App puts on the root element; anything else counts as "system". */
export function parseThemeSetting(value: string | undefined): ThemeSetting {
  return THEME_SETTINGS.find((theme) => theme === value) ?? 'system'
}
```
`sanitizeUiPatch` (`src/main/settings.ts:62-63`) accepts a theme only when it is in `THEME_SETTINGS`, so adding the ids to that array is all that persistence needs.

### Tests
```ts
// SOURCE: src/renderer/src/markdown/pipeline.test.ts:156-173
  it('colours code with the Tokyo Night Moon palette, not Tokyo Night', async () => {
    const out = toHtml(
      await renderMarkdown('```ts\n// note\nimport { x } from "y"\nfunction add(a: number): Point {\n  return a + 42\n}\n```'),
    )
    const tokyo = (token: string) => new RegExp(`--shiki-tokyo:(#[0-9a-f]+)[^>]*>\\s*${token}<`, 'i').exec(out)?.[1]
    expect(tokyo('import')?.toLowerCase()).toBe('#86e1fc')
    ...
    expect(out).toMatch(/--shiki-tokyo-bg:#1e2030/i)
```

```ts
// SOURCE: src/renderer/src/components/MermaidDiagram.test.tsx:24-32
  it("renders again in the new theme's palette when the app theme changes", async () => {
    renderMermaidMock.mockReturnValue(new Promise(() => undefined))
    render(<MermaidDiagram source="graph TD; A-->B" />)
    act(() => {
      document.documentElement.dataset['theme'] = 'tokyo-night-moon'
    })
    await waitFor(() => expect(renderMermaidMock).toHaveBeenLastCalledWith('graph TD; A-->B', 'tokyo-night-moon', 'commit-mono'))
    delete document.documentElement.dataset['theme']
  })
```

---

## Files to Change

| File | Action | Purpose | In patch |
|------|--------|---------|----------|
| `src/shared/api.ts` | UPDATE | `modus`, `modus-tinted` in `ThemeSetting` + `THEME_SETTINGS` | yes |
| `src/main/menu.ts` | UPDATE | `THEME_ITEMS`: "Modus", "Modus Tinted" | yes |
| `src/main/theme.ts` | UPDATE | `SYSTEM_THEME_BACKGROUNDS`; `nativeThemeSource` → `'system'`; `windowBackground` per light/dark | yes |
| `src/renderer/src/App.tsx` | UPDATE | `NEXT_THEME`: tokyo → modus → modus-tinted → system | yes |
| `src/renderer/src/components/StatusBar.tsx` | UPDATE | `THEME_LABELS` "Modus theme" / "Modus Tinted theme"; cycle tooltip | yes |
| `src/renderer/src/markdown/modusThemes.ts` | CREATE | four Shiki `ThemeRegistration`s from the pinned palettes | yes |
| `src/renderer/src/markdown/highlighter.ts` | UPDATE | `THEMES` keys `operandi`, `vivendi`, `operandi-tinted`, `vivendi-tinted`; load the four themes | yes |
| `src/renderer/src/markdown/mermaid.ts` | UPDATE | `DiagramStyle` + four `PALETTES`; `diagramStyle()` resolves modus ids by `systemDark` | yes |
| `src/renderer/src/styles.css` | UPDATE | four variable blocks (two inside the dark media query), Shiki selectors, shared preview rules extended to the modus ids | yes |
| `src/main/theme.test.ts` | UPDATE | native source + window background for both ids | no (Task 2) |
| `src/main/settings.test.ts` | UPDATE | `sanitizeUiPatch` keeps both ids | no (Task 2) |
| `src/main/menu.test.ts` | UPDATE | View → Theme lists both and calls `setTheme` | no (Task 2) |
| `src/renderer/src/markdown/mermaid.test.ts` | UPDATE | `diagramStyle` + palette tables | no (Task 3) |
| `src/renderer/src/components/MermaidDiagram.test.tsx` | UPDATE | live switch on a system colour-scheme change | no (Task 3) |
| `src/renderer/src/markdown/pipeline.test.ts` | UPDATE | class list + Modus token colours | no (Task 4) |
| `src/renderer/src/App.test.tsx` | UPDATE | cycle, active-line count, stripe, dark-variable coverage, font loop | no (Task 5) |
| `README.md` | UPDATE | Themes line (`README.md:14`) | no (Task 6) |
| `PROJECT-GUIDE.md` | UPDATE | theme list (`PROJECT-GUIDE.md:70`) | no (Task 6) |

---

## Tasks

Execute in order. `/implement` applies the prototype patch before Task 1.

### Task 1: Confirm the patch builds and see the expected test failures

- **File**: (whole tree)
- **Action**: CHECK
- **Implement**: Run typecheck and lint, which must pass. Then run `npm test`. On the prototype it failed exactly four tests, and every one of them enumerates the theme list. Tasks 3–5 update those four. The four are `mermaid.test.ts` "gives each app theme its own palette…", `pipeline.test.ts` "colours code blocks with the variables of every theme", `App.test.tsx` "cycles through the custom themes…" and `App.test.tsx` "keeps the active line translucent in every theme" (4 → 8). Any other failure is a regression of the patch.
- **Mirror**: n/a
- **Validate**: `npm run typecheck && npm run lint && npm test` (expect `4 failed | 319 passed (323)` before Tasks 2–5)

### Task 2: Main-process tests

- **File**: `src/main/theme.test.ts`, `src/main/settings.test.ts`, `src/main/menu.test.ts`
- **Action**: UPDATE
- **Implement**:
  - `theme.test.ts`: retitle the first test, for example to "passes the built-in themes through, follows the system for Modus, and runs the other custom themes in dark mode". Add `expect(nativeThemeSource('modus')).toBe('system')` and the same for `'modus-tinted'`. In `windowBackground`, add `('modus', false)` → `#ffffff`, `('modus', true)` → `#000000`, `('modus-tinted', false)` → `#fbf7f0` and `('modus-tinted', true)` → `#0d0e1c`.
  - `settings.test.ts`: next to line 123, add `sanitizeUiPatch({ theme: 'modus' })` → `{ theme: 'modus' }` and the same for `'modus-tinted'`. This covers "the choice survives a restart" (AC3).
  - `menu.test.ts`: add a `describe('theme menu')` test that finds the View menu's `Theme` submenu in `template(false)`, expects its labels to end with `['Tokyo Night Moon', 'Modus', 'Modus Tinted']`, and checks that clicking the "Modus Tinted" item calls `setTheme` with `'modus-tinted'`. `template()` creates `setTheme: vi.fn()` inline, so let the test build its own `MenuOptions` or return the options from a helper.
- **Mirror**: `src/main/theme.test.ts:4-23`, `src/main/settings.test.ts:120-124`, `src/main/menu.test.ts:20-34,79-87`
- **Validate**: `npx vitest run src/main`

### Task 3: Mermaid tests, including the live switch

- **File**: `src/renderer/src/markdown/mermaid.test.ts`, `src/renderer/src/components/MermaidDiagram.test.tsx`
- **Action**: UPDATE
- **Implement**:
  - `mermaid.test.ts:75-86`: extend the `styles(false)` table with `['modus', 'modus-operandi']` and `['modus-tinted', 'modus-operandi-tinted']`. Add `diagramStyle('modus', true)` → `'modus-vivendi'` and `diagramStyle('modus-tinted', true)` → `'modus-vivendi-tinted'`, and retitle the test to mention Modus.
  - `mermaid.test.ts:99-110`: let the `palette` helper take `systemDark`. Expect `modus` light `['#ffffff', '#0031a9', false]`, `modus` dark `['#000000', '#00bcff', true]`, `modus-tinted` light `['#fbf7f0', '#a0132f', false]` and `modus-tinted` dark `['#0d0e1c', '#b6a0ff', true]`.
  - `MermaidDiagram.test.tsx`: add "renders again in the other Modus palette when the system colour scheme changes". Stub `window.matchMedia` with `vi.stubGlobal`, because jsdom has none (`src/renderer/src/test/setup.ts` does not define it). The stub returns one fake `MediaQueryList` whose `matches` is mutable and whose `addEventListener('change', fn)` stores `fn`. Set `data-theme='modus'` and render, then expect `'modus-operandi'`. Set `matches = true`, call the stored listener inside `act`, and expect the last call to use `'modus-vivendi'`. Clean up `data-theme` and `vi.unstubAllGlobals()`.
- **Mirror**: `src/renderer/src/markdown/mermaid.test.ts:75-110`, `src/renderer/src/components/MermaidDiagram.test.tsx:24-32`
- **Validate**: `npx vitest run src/renderer/src/markdown/mermaid.test.ts src/renderer/src/components/MermaidDiagram.test.tsx`

### Task 4: Shiki tests

- **File**: `src/renderer/src/markdown/pipeline.test.ts`
- **Action**: UPDATE
- **Implement**:
  - Line 138: the class becomes `shiki shiki-themes github-light github-dark-default gruvbox-material-dark-hard tokyo-night-moon modus-operandi modus-vivendi modus-operandi-tinted modus-vivendi-tinted`. Extend the line 140 regex with `;--shiki-operandi:#…;--shiki-vivendi:#…;--shiki-operandi-tinted:#…;--shiki-vivendi-tinted:#…`, in that order (the probe output confirms it).
  - Add "colours code with the Modus palettes" with the same source as the Tokyo test (line 158). Use a helper `modus(key, token)` with the regex `--shiki-${key}:(#[0-9a-f]+)[^>]*>\s*${token}<`. The `:` right after the key keeps `operandi` from matching `operandi-tinted`. Expected values, measured on the prototype:

    | token | operandi | vivendi | operandi-tinted | vivendi-tinted |
    |---|---|---|---|---|
    | `import` (keyword) | #531ab6 | #b6a0ff | #0031a9 | #79a8ff |
    | `"y"` (string) | #3548cf | #79a8ff | #00598b | #2fafff |
    | `add` (fnname) | #721045 | #feacd0 | #602938 | #f78fe7 |
    | `a` (parameter → variable) | #005e8b | #00d3d0 | #00603f | #4ae2f0 |
    | `number` / `Point` (type) | #005f5f | #6ae4b9 | #306010 | #11c777 |
    | `42` (number → fg-main) | #000000 | #ffffff | #000000 | #ffffff |
    | `// note` (comment) | #595959 | #989898 | #7f0000 | #ef8386 |
    | `-bg` | #f2f2f2 | #1e1e1e | #efe9dd | #1d2235 |

    Also assert that the comment is not italic: no `--shiki-operandi-font-style:italic` appears before `// note`.
- **Mirror**: `src/renderer/src/markdown/pipeline.test.ts:136-173`
- **Validate**: `npx vitest run src/renderer/src/markdown/pipeline.test.ts`

### Task 5: App and stylesheet tests

- **File**: `src/renderer/src/App.test.tsx`
- **Action**: UPDATE
- **Implement**:
  - Lines 434-449, the cycle test: after the Gruvbox → Tokyo step, clicking "Tokyo Night theme" now gives `{ theme: 'modus' }` and `data-theme='modus'`. Then "Modus theme" → `modus-tinted`, and "Modus Tinted theme" → `system`.
  - Lines 514-522, the stripe loop: add `'modus'` and `'modus-tinted'`. The regex finds each id's first (light) block.
  - Add "gives each Modus block every variable the Dark block sets". Collect the variable names in the dark media query's `:root` block (the same regex as line 528). For each id in `['modus', 'modus-tinted']`, take both matches of ``new RegExp(`:root\\[data-theme='${id}'\\] \\{([^}]*)\\}`, 'g')`` (expect length 2: light and dark). Assert that every Dark variable name is declared in both. This is what stops GitHub Dark colours leaking into Vivendi (see Risks).
  - Line 542: `toHaveLength(4)` → `toHaveLength(8)`.
  - Lines 828-833: add `'modus'` and `'modus-tinted'` to the font loop.
- **Mirror**: `src/renderer/src/App.test.tsx:425-457,514-548,828-833`
- **Validate**: `npx vitest run src/renderer/src/App.test.tsx`

### Task 6: Docs

- **File**: `README.md`, `PROJECT-GUIDE.md`
- **Action**: UPDATE
- **Implement**:
  - `README.md:14`: "… or pick Light, Gruvbox Material Dark Hard, Tokyo Night Moon, Modus or Modus Tinted from **View → Theme** or the button in the status bar. Modus and Modus Tinted come from Protesilaos Stavrou's Emacs Modus themes and follow the system: Modus Operandi (or Operandi Tinted) when it is light, Modus Vivendi (or Vivendi Tinted) when it is dark. The editor, preview and code colours all follow the choice, and Clarity remembers it."
  - `PROJECT-GUIDE.md:70`: add "Modus, Modus Tinted" to the theme list in parentheses.
- **Mirror**: `README.md:14`
- **Validate**: `grep -n "Modus Tinted" README.md PROJECT-GUIDE.md`

### Task 7: Full validation and end-to-end check

- **File**: (whole tree)
- **Action**: CHECK
- **Implement**: Run the full gate, then the End-to-End Verification below.
- **Mirror**: n/a
- **Validate**: `npm run typecheck && npm run lint && npm test` (expect 0 failed, with more than 323 tests passing)

---

## Validation

```bash
# Type check
npm run typecheck

# Lint
npm run lint

# Tests (baseline on HEAD d8db23e: Test Files 28 passed (28), Tests 323 passed (323))
npm test
```

The renderer tests run in jsdom. They read `styles.css` as text and render Shiki HTML, but they do not apply `prefers-color-scheme`, and they do not paint Mermaid. The headless check below covers that gap.

## Environment Findings

| Probe | Result |
|---|---|
| Baseline `npm run typecheck && npm run lint && npm test` on HEAD | all exit 0; 28 files, 323 tests passed |
| Prototype: typecheck, lint | pass |
| Prototype: `npm test` | 4 failed / 319 passed: the four enumerating tests listed in Task 1 |
| `git apply --check` of the patch on HEAD | passes |
| Headless e2e (`e2e-modus.mjs`) on the prototype build | `ok` for modus light/dark and modus-tinted light/dark; exit 0 |
| Same script on a HEAD build | FAIL in all four modes, because `modus` is not a known theme and the app falls back to Dark; exit 1 |
| `activeline.mjs` | `exact` for all four palettes |
| Upstream `modus-themes.el` at main = pinned SHA `782743415b3e…` | byte-identical (`cmp`) |
| Other worktrees | `kp-let-user-drag` has uncommitted edits in `README.md` (inserts after line 16), `App.tsx`, `App.test.tsx` and `api.ts`, none in theme lines; `kp-2-preview-briefly-lags` touches only `useRenderedMarkdown.ts` / `Preview.test.tsx`. No open PRs. No forward references to `#12` in source or plans. |

## End-to-End Verification

Headless, with no window on the desktop: Electron runs with `--ozone-platform=headless` and a scratch `XDG_CONFIG_HOME`. The script opens a Markdown file with a TypeScript block and a Mermaid diagram, with the theme set in `settings.json`. It reads the page colours over CDP, then switches `prefers-color-scheme` from light to dark with `Emulation.setEmulatedMedia` without reloading. This is the live switch of AC4. It checks the body, the workspace (sidebar) and the status bar backgrounds, the body text, a Shiki keyword and the code block background, and the Mermaid node border in the shadow root. It also saves `<theme>-<mode>.png` screenshots for a human look.

1. `npm run build` (typecheck, then `electron-vite build` into `out/`).
2. Save the scripts below to a scratch dir outside the repo, for example `$S=$(mktemp -d)`.
3. `node $S/activeline.mjs` must print `exact` four times.
4. `node $S/e2e-modus.mjs "$PWD" "$S"`, run from the repo root, must print `ok` for `modus light`, `modus dark`, `modus-tinted light` and `modus-tinted dark`, and exit 0. On HEAD it prints FAIL for all four and exits 1.
5. Open `$S/modus-light.png`, `$S/modus-dark.png`, `$S/modus-tinted-light.png` and `$S/modus-tinted-dark.png`. Check that the colours look like Modus: a white/black or ochre/navy page, a bg-dim workspace and status bar, a purple or blue `const`, and Mermaid nodes with an accent border.
6. Manual, on the owner's desktop (opens a window, so warn the owner first): `npm start`, then View → Theme → Modus. Switch the OS between light and dark, and check that the editor, preview, code, diagram, sidebar and status bar all change without a restart. Repeat with Modus Tinted. Restart the app and check that the choice is kept and the status bar reads "Modus theme" / "Modus Tinted theme".

`activeline.mjs`:
```js
// Finds the colour X such that X at 50% over bg-main composites to bg-hl-line.
const pairs = {
  operandi: ['#ffffff', '#dae5ec'],
  vivendi: ['#000000', '#2f3849'],
  'operandi-tinted': ['#fbf7f0', '#f1d5d0'],
  'vivendi-tinted': ['#0d0e1c', '#303a6f'],
}
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('')
for (const [name, [bg, hl]] of Object.entries(pairs)) {
  const x = rgb(hl).map((h, i) => 2 * h - rgb(bg)[i])
  if (x.some((v) => v < 0 || v > 255)) throw new Error(`${name}: out of range ${x}`)
  const back = x.map((v, i) => Math.round(0.5 * v + 0.5 * rgb(bg)[i]))
  console.log(name, hex(x), '->', hex(back), back.every((v, i) => v === rgb(hl)[i]) ? 'exact' : 'MISMATCH')
}
```

`e2e-modus.mjs` (usage: `node e2e-modus.mjs <repo-dir-with-out/> <scratch-dir>`):
```js
// End-to-end check of the Modus themes in the built app, headless.
// Usage: node e2e-modus.mjs <repo-dir-with-out/> <scratch-dir>
// Launches out/ with a scratch XDG_CONFIG_HOME, opens a Markdown file with a
// TypeScript block and a Mermaid diagram, and prints the colours the page uses
// in light and dark mode (switched live with CDP media emulation) for both
// Modus entries. Exits 1 when a colour differs from the expected palette.
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const [repo, scratch] = process.argv.slice(2)
if (!repo || !scratch) throw new Error('usage: node e2e-modus.mjs <repo> <scratch>')
const PORT = 9339
const electron = join(repo, 'node_modules/electron/dist/electron')

const EXPECTED = {
  modus: {
    light: { bg: '#ffffff', sidebar: '#f2f2f2', status: '#f2f2f2', fg: '#000000', code: '#531ab6', codeBg: '#f2f2f2', node: '#0031a9' },
    dark: { bg: '#000000', sidebar: '#1e1e1e', status: '#1e1e1e', fg: '#ffffff', code: '#b6a0ff', codeBg: '#1e1e1e', node: '#00bcff' },
  },
  'modus-tinted': {
    light: { bg: '#fbf7f0', sidebar: '#efe9dd', status: '#efe9dd', fg: '#000000', code: '#0031a9', codeBg: '#efe9dd', node: '#a0132f' },
    dark: { bg: '#0d0e1c', sidebar: '#1d2235', status: '#1d2235', fg: '#ffffff', code: '#79a8ff', codeBg: '#1d2235', node: '#b6a0ff' },
  },
}

const doc = join(scratch, 'doc.md')
writeFileSync(doc, '# Modus\n\n```ts\nconst answer = 42\n```\n\n```mermaid\ngraph TD; A-->B\n```\n')

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl)
  await new Promise((resolve, reject) => {
    ws.onopen = resolve
    ws.onerror = reject
  })
  let id = 0
  const pending = new Map()
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data)
    pending.get(message.id)?.(message)
    pending.delete(message.id)
  }
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      pending.set(++id, resolve)
      ws.send(JSON.stringify({ id, method, params }))
    })
  return { send, close: () => ws.close() }
}

// Reads the page colours as hex; the Mermaid node border is inside the diagram's shadow root.
const READ = `(() => {
  const hex = (c) => { const m = c.match(/\\d+/g); return m ? '#' + m.slice(0, 3).map((v) => Number(v).toString(16).padStart(2, '0')).join('') : c }
  // The sidebar is transparent over the workspace, which paints --bg-sidebar.
  const workspace = document.querySelector('.workspace')
  const status = document.querySelector('.status-bar')
  const keyword = [...document.querySelectorAll('.markdown-body pre.shiki span')].find((s) => s.textContent.trim() === 'const')
  const pre = document.querySelector('.markdown-body pre.shiki')
  const node = document.querySelector('.mermaid-diagram')?.shadowRoot?.querySelector('.node rect, .node polygon')
  return {
    theme: document.documentElement.dataset.theme,
    bg: hex(getComputedStyle(document.body).backgroundColor),
    sidebar: workspace ? hex(getComputedStyle(workspace).backgroundColor) : null,
    status: status ? hex(getComputedStyle(status).backgroundColor) : null,
    fg: hex(getComputedStyle(document.body).color),
    code: keyword ? hex(getComputedStyle(keyword).color) : null,
    codeBg: pre ? hex(getComputedStyle(pre).backgroundColor) : null,
    node: node ? hex(getComputedStyle(node).stroke) : null,
  }
})()`

async function run(theme) {
  const config = join(scratch, `config-${theme}`)
  mkdirSync(join(config, 'clarity'), { recursive: true })
  writeFileSync(join(config, 'clarity', 'settings.json'), JSON.stringify({ ui: { theme, viewMode: 'split' } }))
  const env = { ...process.env, XDG_CONFIG_HOME: config }
  delete env.ELECTRON_RUN_AS_NODE
  const child = spawn(
    electron,
    [
      '.',
      '--ozone-platform=headless',
      '--ozone-override-screen-size=1280,800',
      '--window-size=1280,800',
      `--remote-debugging-port=${PORT}`,
      doc,
    ],
    { cwd: repo, env, stdio: 'ignore' },
  )
  let failed = false
  try {
    let page
    for (let i = 0; i < 50 && !page; i++) {
      await sleep(200)
      page = await fetch(`http://127.0.0.1:${PORT}/json`)
        .then((r) => r.json())
        .then((list) => list.find((t) => t.type === 'page'))
        .catch(() => undefined)
    }
    if (!page) throw new Error('no page')
    const { send, close } = await cdp(page.webSocketDebuggerUrl)
    for (const mode of ['light', 'dark']) {
      await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: mode }] })
      let got
      for (let i = 0; i < 50; i++) {
        await sleep(200)
        got = (await send('Runtime.evaluate', { expression: READ, returnByValue: true })).result.result.value
        if (got.code && got.node && got.node === EXPECTED[theme][mode].node) break
      }
      const want = EXPECTED[theme][mode]
      const wrong = Object.keys(want).filter((key) => got[key] !== want[key])
      console.log(`${theme} ${mode}: ${wrong.length ? 'FAIL ' + wrong.map((k) => `${k}=${got[k]} (want ${want[k]})`).join(', ') : 'ok'}`, JSON.stringify(got))
      if (wrong.length) failed = true
      const shot = await send('Page.captureScreenshot', { format: 'png' })
      writeFileSync(join(scratch, `${theme}-${mode}.png`), Buffer.from(shot.result.data, 'base64'))
    }
    close()
  } finally {
    child.kill()
  }
  return failed
}

let failed = false
for (const theme of Object.keys(EXPECTED)) if (await run(theme)) failed = true
process.exit(failed ? 1 : 0)
```

## Risks

| Risk | Mitigation | Scope |
|------|------------|-------|
| In dark mode the base `@media (prefers-color-scheme: dark) :root` block also applies, so any variable that a Modus dark block leaves out keeps its GitHub Dark value (for example `--md-list: #ffa657`) | Each Modus block sets every variable the Dark block sets. Task 5 adds a test that fails when one is missing | in scope |
| Shiki now writes 8 CSS variables per token instead of 4 (plus font-style/weight/decoration when set), so the preview HTML of code-heavy documents grows | Same mechanism as the existing themes. Highlighting stays cached per language. Look at a large document in the manual E2E step; if the preview feels slower, raise it as a follow-up | flag only |
| The window background (`setBackgroundColor`) is set only when settings change, not when the OS switches light/dark while Clarity runs. For System this is already true today. The page paints over it, so it only shows during a resize | Matches existing System behaviour. A `nativeTheme.on('updated')` listener in `src/main/index.ts` would fix both | out of scope (flag) |
| Shiki TextMate scopes are only an approximation of Emacs tree-sitter font-lock, so some tokens differ from Emacs (for example `console` stays `fg-main`, and `\n` inside a regexp is a character class, shown as `rx-construct`) | Mapping measured on TS and checked token by token (Task 4 table). Other grammars inherit the generic scopes | in scope (accepted) |
| The current search match is opaque `bg-yellow-intense` (Emacs isearch), so the selection colour does not show under it | Faithful to upstream. Gruvbox uses a translucent value here, but no test requires one | flag only |
| Merge with the in-flight `kp-let-user-drag` worktree (README, App.tsx, App.test.tsx, api.ts) | Its hunks are in other lines (README insert after line 16, new App effects and API fields). Expect a clean merge; re-run the gate after the rebase | flag only |
| Upstream palettes change in a later modus-themes release | Values are pinned to the 5.3.0 commit above and cited in the code comments | out of scope |

## Open Questions

- **Inline code background.** Upstream `bg-prose-code` is `unspecified` (no chip in Emacs). Proposed default: `--inline-code-bg` = `bg-dim`, which the prototype uses. Rationale: every other Clarity theme draws a chip, and with one monospace font everywhere a chip-less span is easy to miss. The alternative is `transparent` for strict fidelity.
- **Selected sidebar row.** The prototype uses `bg-hl-line` (Emacs `hl-line`, which dired and treemacs use for the current line), and hover uses `bg-inactive`. The alternative is upstream `bg-active` (#c4c4c4 / #535353), which is louder. Proposed default: keep `bg-hl-line`.
- **Cycle order and labels.** Proposed: Tokyo Night → Modus → Modus Tinted → System. The status-bar labels are "Modus theme" / "Modus Tinted theme" and the menu labels are "Modus" / "Modus Tinted". Rationale: this appends after the existing custom themes, the same way Tokyo Night was added.

## Acceptance Criteria

- [ ] All tasks completed
- [ ] Type check passes
- [ ] Tests pass
- [ ] Follows existing patterns
- [ ] Selecting Modus or Modus Tinted colours the editor and the preview (Tasks 4–5, e2e)
- [ ] Modus uses Operandi in light mode and Vivendi in dark mode; Modus Tinted uses Operandi Tinted and Vivendi Tinted (Tasks 2–5, e2e)
- [ ] View → Theme lists "Modus" and "Modus Tinted", the status-bar button cycles through them, and the choice survives a restart (Tasks 2, 5; manual step 6)
- [ ] With either selected, the theme follows the system preference and switches live (Task 3, e2e step 4, manual step 6)
- [ ] Shiki, Mermaid, the sidebar, the status bar and the window background before first paint use the active Modus palette (Tasks 2–4, e2e)
