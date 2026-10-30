import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_UI_SETTINGS } from '../shared/api'
import {
  MAX_RECENT_FOLDERS,
  SettingsStore,
  addRecentFolder,
  parseSettings,
  pruneRecentFolders,
  sanitizeUiPatch,
} from './settings'
import { makeTempDir, removeDir } from './testFs'

describe('recent folders', () => {
  it('puts the newest folder first without duplicates', () => {
    expect(addRecentFolder(['/a', '/b', '/c'], '/b')).toEqual(['/b', '/a', '/c'])
    expect(addRecentFolder([], '/a')).toEqual(['/a'])
  })

  it(`keeps at most ${MAX_RECENT_FOLDERS} folders`, () => {
    const many = Array.from({ length: MAX_RECENT_FOLDERS }, (_, index) => `/f${index}`)
    const updated = addRecentFolder(many, '/new')
    expect(updated).toHaveLength(MAX_RECENT_FOLDERS)
    expect(updated[0]).toBe('/new')
    expect(updated).not.toContain(`/f${MAX_RECENT_FOLDERS - 1}`)
  })

  it('prunes folders that no longer exist', async () => {
    const workspace = await makeTempDir()
    try {
      const kept = path.join(workspace, 'kept')
      const file = path.join(workspace, 'file.md')
      await mkdir(kept)
      await writeFile(file, '')
      const pruned = await pruneRecentFolders([path.join(workspace, 'gone'), kept, file])
      expect(pruned).toEqual([kept])
    } finally {
      await removeDir(workspace)
    }
  })
})

describe('parseSettings', () => {
  it('falls back to defaults for missing, broken or foreign files', () => {
    for (const raw of ['', 'not json', '[]', 'null', '42']) {
      expect(parseSettings(raw)).toEqual({ ui: DEFAULT_UI_SETTINGS, recentFolders: [], window: null })
    }
  })

  it('keeps valid values and drops invalid ones', () => {
    const settings = parseSettings(
      JSON.stringify({
        ui: { viewMode: 'preview', theme: 'purple', sidebarWidth: 5000, editorFraction: 'half' },
        recentFolders: ['/a', 'relative/b', 3, '/a', '/c'],
        window: { x: 10.4, y: 20, width: 900, height: 700, maximized: true },
      }),
    )
    expect(settings.ui).toEqual({ ...DEFAULT_UI_SETTINGS, viewMode: 'preview', sidebarWidth: 600 })
    expect(settings.recentFolders).toEqual(['/a', '/c'])
    expect(settings.window).toEqual({ x: 10, y: 20, width: 900, height: 700, maximized: true })
  })

  it('rejects unusable window bounds', () => {
    expect(parseSettings(JSON.stringify({ window: { x: 0, y: 0, width: 10, height: 10 } })).window).toBeNull()
    expect(parseSettings(JSON.stringify({ window: { x: 'a', y: 0, width: 800, height: 600 } })).window).toBeNull()
  })
})

describe('sanitizeUiPatch', () => {
  it('accepts only known settings with valid values', () => {
    expect(sanitizeUiPatch({ viewMode: 'editor', theme: 'dark', extra: 1 })).toEqual({ viewMode: 'editor', theme: 'dark' })
    expect(sanitizeUiPatch({ editorFraction: 2, sidebarWidth: 100.6 })).toEqual({ editorFraction: 0.85, sidebarWidth: 160 })
    expect(sanitizeUiPatch({ editorFraction: Number.NaN, viewMode: 'zen' })).toEqual({})
    expect(sanitizeUiPatch('viewMode=editor')).toEqual({})
    expect(sanitizeUiPatch(null)).toEqual({})
  })
})

describe('SettingsStore', () => {
  let dir: string
  let file: string

  beforeEach(async () => {
    dir = await makeTempDir()
    file = path.join(dir, 'userData', 'settings.json')
  })

  afterEach(() => removeDir(dir))

  it('starts from defaults when there is no file yet', async () => {
    const store = await SettingsStore.load(file)
    expect(store.current.ui).toEqual(DEFAULT_UI_SETTINGS)
  })

  it('saves changes and loads them again', async () => {
    const store = await SettingsStore.load(file, 0)
    const seen: string[] = []
    store.onChange((settings) => seen.push(settings.ui.viewMode))
    store.update((current) => ({ ...current, ui: { ...current.ui, viewMode: 'editor' } }))
    store.update((current) => ({ ...current, recentFolders: addRecentFolder(current.recentFolders, '/notes') }))
    store.setWindowBounds({ x: 1, y: 2, width: 800, height: 600, maximized: false })
    await store.flush()

    expect(seen).toEqual(['editor', 'editor'])
    const reloaded = await SettingsStore.load(file)
    expect(reloaded.current).toEqual({
      ui: { ...DEFAULT_UI_SETTINGS, viewMode: 'editor' },
      recentFolders: ['/notes'],
      window: { x: 1, y: 2, width: 800, height: 600, maximized: false },
    })
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual(reloaded.current)
  })

  it('batches several quick changes into one write', async () => {
    const store = await SettingsStore.load(file, 50)
    for (const width of [200, 210, 220]) {
      store.update((current) => ({ ...current, ui: { ...current.ui, sidebarWidth: width } }))
    }
    await store.flush()
    expect((await SettingsStore.load(file)).current.ui.sidebarWidth).toBe(220)
  })
})
