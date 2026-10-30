import type { LanguageRegistration } from '@shikijs/types'
import type { Element, Root } from 'hast'
import { createHighlighterCore, type HighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import { gruvboxMaterialDarkHard } from './gruvboxMaterialTheme'

type LanguageModule = Promise<{ default: LanguageRegistration[] }>

/**
 * The languages mdpad colours. Each one is a separate chunk that loads the
 * first time a document uses it, so the app ships no grammar it never shows.
 */
const LANGUAGES: Record<string, () => LanguageModule> = {
  bash: () => import('@shikijs/langs/bash'),
  c: () => import('@shikijs/langs/c'),
  cpp: () => import('@shikijs/langs/cpp'),
  csharp: () => import('@shikijs/langs/csharp'),
  css: () => import('@shikijs/langs/css'),
  diff: () => import('@shikijs/langs/diff'),
  dockerfile: () => import('@shikijs/langs/dockerfile'),
  go: () => import('@shikijs/langs/go'),
  graphql: () => import('@shikijs/langs/graphql'),
  html: () => import('@shikijs/langs/html'),
  ini: () => import('@shikijs/langs/ini'),
  java: () => import('@shikijs/langs/java'),
  javascript: () => import('@shikijs/langs/javascript'),
  json: () => import('@shikijs/langs/json'),
  jsonc: () => import('@shikijs/langs/jsonc'),
  jsx: () => import('@shikijs/langs/jsx'),
  kotlin: () => import('@shikijs/langs/kotlin'),
  lua: () => import('@shikijs/langs/lua'),
  makefile: () => import('@shikijs/langs/makefile'),
  markdown: () => import('@shikijs/langs/markdown'),
  php: () => import('@shikijs/langs/php'),
  powershell: () => import('@shikijs/langs/powershell'),
  python: () => import('@shikijs/langs/python'),
  ruby: () => import('@shikijs/langs/ruby'),
  rust: () => import('@shikijs/langs/rust'),
  scss: () => import('@shikijs/langs/scss'),
  shellsession: () => import('@shikijs/langs/shellsession'),
  sql: () => import('@shikijs/langs/sql'),
  swift: () => import('@shikijs/langs/swift'),
  toml: () => import('@shikijs/langs/toml'),
  tsx: () => import('@shikijs/langs/tsx'),
  typescript: () => import('@shikijs/langs/typescript'),
  xml: () => import('@shikijs/langs/xml'),
  yaml: () => import('@shikijs/langs/yaml'),
}

const ALIASES: Record<string, string> = {
  'c#': 'csharp',
  'c++': 'cpp',
  console: 'shellsession',
  cs: 'csharp',
  docker: 'dockerfile',
  golang: 'go',
  js: 'javascript',
  kt: 'kotlin',
  make: 'makefile',
  md: 'markdown',
  mjs: 'javascript',
  cjs: 'javascript',
  ps1: 'powershell',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  sh: 'bash',
  shell: 'bash',
  shellscript: 'bash',
  svg: 'xml',
  ts: 'typescript',
  yml: 'yaml',
  zsh: 'bash',
}

/** The grammar name for a fenced code block's info string, or null when mdpad has no grammar for it. */
export function grammarFor(language: string): string | null {
  const name = language.toLowerCase()
  const resolved = ALIASES[name] ?? name
  return Object.hasOwn(LANGUAGES, resolved) ? resolved : null
}

/**
 * Every theme's code colours, by the key styles.css reads them with
 * (`--shiki-light`, `--shiki-dark`, `--shiki-gruvbox`, …).
 */
export const THEMES = { light: 'github-light', dark: 'github-dark', gruvbox: gruvboxMaterialDarkHard.name } as const

let highlighterPromise: Promise<HighlighterCore> | null = null
const loadingLanguages = new Map<string, Promise<void>>()

function getHighlighter(): Promise<HighlighterCore> {
  highlighterPromise ??= createHighlighterCore({
    themes: [import('@shikijs/themes/github-light'), import('@shikijs/themes/github-dark'), gruvboxMaterialDarkHard],
    langs: [],
    // The JavaScript engine needs no WebAssembly, which the app's CSP does not allow.
    engine: createJavaScriptRegexEngine({ forgiving: true }),
  })
  return highlighterPromise
}

/** Loads the grammars for `languages` (grammar names from `grammarFor`). */
async function ensureLanguages(highlighter: HighlighterCore, languages: Iterable<string>): Promise<void> {
  const pending: Promise<void>[] = []
  for (const language of languages) {
    const load = LANGUAGES[language]
    if (!load) continue
    let loading = loadingLanguages.get(language)
    if (!loading) {
      loading = load().then((module) => highlighter.loadLanguage(module.default))
      // A grammar that fails to load just leaves its code blocks uncoloured.
      loading.catch(() => loadingLanguages.delete(language))
      loadingLanguages.set(language, loading)
    }
    pending.push(loading.catch(() => undefined))
  }
  await Promise.all(pending)
}

/** A highlighter for one rendering pass: colours code in languages that are already loaded. */
export interface CodeHighlighter {
  highlight(code: string, language: string): Element | null
}

/**
 * Prepares a highlighter that can colour every language in `languages`.
 * Code is coloured with every theme at once, as CSS variables, so switching
 * themes needs no new rendering pass.
 */
export async function loadHighlighter(languages: Iterable<string>): Promise<CodeHighlighter> {
  const highlighter = await getHighlighter()
  await ensureLanguages(highlighter, languages)
  return {
    highlight(code, language) {
      if (!highlighter.getLoadedLanguages().includes(language)) return null
      const root: Root = highlighter.codeToHast(code, {
        lang: language,
        themes: THEMES,
        defaultColor: false,
      })
      const pre = root.children[0]
      return pre?.type === 'element' ? pre : null
    },
  }
}
