import { constants } from 'node:fs'
import { access, copyFile, mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  DEFAULT_UI_SETTINGS,
  EDITOR_FRACTION_RANGE,
  FONT_SETTINGS,
  FONT_SIZE_RANGE,
  SIDEBAR_WIDTH_RANGE,
  THEME_SETTINGS,
  VIEW_MODES,
  type FontSetting,
  type ThemeSetting,
  type UiSettings,
  type ViewMode,
} from '../shared/api'

export interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
  maximized: boolean
}

export interface Settings {
  ui: UiSettings
  /** Most recent first. */
  recentFolders: string[]
  window: WindowBounds | null
}

export const MAX_RECENT_FOLDERS = 10
export function defaultSettings(): Settings {
  return { ui: { ...DEFAULT_UI_SETTINGS }, recentFolders: [], window: null }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function oneOf<T extends string>(allowed: readonly T[], value: unknown): T | undefined {
  return allowed.find((item) => item === value)
}

function clampedNumber(value: unknown, range: { min: number; max: number }): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  return Math.min(range.max, Math.max(range.min, value))
}

/**
 * Keeps only the valid fields of an untrusted settings patch, from the
 * renderer or from a settings file, clamping numbers into their ranges.
 */
export function sanitizeUiPatch(patch: unknown): Partial<UiSettings> {
  if (!isRecord(patch)) return {}
  const result: Partial<UiSettings> = {}
  const viewMode: ViewMode | undefined = oneOf(VIEW_MODES, patch['viewMode'])
  if (viewMode) result.viewMode = viewMode
  const theme: ThemeSetting | undefined = oneOf(THEME_SETTINGS, patch['theme'])
  if (theme) result.theme = theme
  const sidebarWidth = clampedNumber(patch['sidebarWidth'], SIDEBAR_WIDTH_RANGE)
  if (sidebarWidth !== undefined) result.sidebarWidth = Math.round(sidebarWidth)
  const editorFraction = clampedNumber(patch['editorFraction'], EDITOR_FRACTION_RANGE)
  if (editorFraction !== undefined) result.editorFraction = editorFraction
  const font: FontSetting | undefined = oneOf(FONT_SETTINGS, patch['font'])
  if (font) result.font = font
  const fontSize = clampedNumber(patch['fontSize'], FONT_SIZE_RANGE)
  if (fontSize !== undefined) result.fontSize = Math.round(fontSize)
  return result
}

function parseWindowBounds(value: unknown): WindowBounds | null {
  if (!isRecord(value)) return null
  const { x, y, width, height, maximized } = value
  const numbers = [x, y, width, height]
  if (!numbers.every((n) => typeof n === 'number' && Number.isFinite(n))) return null
  if ((width as number) < 200 || (height as number) < 150) return null
  return {
    x: Math.round(x as number),
    y: Math.round(y as number),
    width: Math.round(width as number),
    height: Math.round(height as number),
    maximized: maximized === true,
  }
}

/** Parses a settings file, falling back to defaults for anything missing or invalid. */
export function parseSettings(raw: string): Settings {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return defaultSettings()
  }
  if (!isRecord(data)) return defaultSettings()
  const recent = Array.isArray(data['recentFolders']) ? data['recentFolders'] : []
  return {
    ui: { ...DEFAULT_UI_SETTINGS, ...sanitizeUiPatch(data['ui']) },
    recentFolders: recent
      .filter((entry): entry is string => typeof entry === 'string' && path.isAbsolute(entry))
      .filter((entry, index, all) => all.indexOf(entry) === index)
      .slice(0, MAX_RECENT_FOLDERS),
    window: parseWindowBounds(data['window']),
  }
}

/** Moves `folder` to the front of the list, without duplicates, keeping at most `MAX_RECENT_FOLDERS`. */
export function addRecentFolder(recent: readonly string[], folder: string): string[] {
  return [folder, ...recent.filter((entry) => entry !== folder)].slice(0, MAX_RECENT_FOLDERS)
}

async function isDirectory(folder: string): Promise<boolean> {
  try {
    return (await stat(folder)).isDirectory()
  } catch {
    return false
  }
}

/** Drops the folders that no longer exist. */
export async function pruneRecentFolders(
  recent: readonly string[],
  exists: (folder: string) => Promise<boolean> = isDirectory,
): Promise<string[]> {
  const checks = await Promise.all(recent.map(exists))
  return recent.filter((_folder, index) => checks[index])
}

/** The userData folder names of the app's earlier names, most recent first. */
export const LEGACY_USER_DATA_FOLDERS = ['lantern', 'mdpad'] as const

async function exists(file: string): Promise<boolean> {
  try {
    await access(file)
    return true
  } catch {
    return false
  }
}

/**
 * Copies the settings file of the app's most recent old name to `filePath`
 * when `filePath` does not exist yet, so a rename keeps the user's settings.
 * `legacyFilePaths` is ordered most recent first; the first one that exists
 * is copied. Never changes the old files. Returns whether it copied.
 */
export async function migrateLegacySettings(filePath: string, legacyFilePaths: readonly string[]): Promise<boolean> {
  if (await exists(filePath)) return false
  let legacyFilePath: string | undefined
  for (const candidate of legacyFilePaths) {
    if (await exists(candidate)) {
      legacyFilePath = candidate
      break
    }
  }
  if (legacyFilePath === undefined) return false
  try {
    await mkdir(path.dirname(filePath), { recursive: true })
    await copyFile(legacyFilePath, filePath, constants.COPYFILE_EXCL)
    return true
  } catch (error) {
    console.error('Could not copy the old settings:', error)
    return false
  }
}

/**
 * Settings kept in `settings.json` in the app's userData folder.
 *
 * Writes are batched and go to a temporary file that is then renamed over the
 * real one, so a crash mid-write cannot leave a half-written file behind.
 */
export class SettingsStore {
  #settings: Settings
  #timer: ReturnType<typeof setTimeout> | null = null
  #writing: Promise<void> = Promise.resolve()
  readonly #listeners = new Set<(settings: Settings) => void>()

  private constructor(
    readonly filePath: string,
    settings: Settings,
    readonly saveDelayMs: number,
  ) {
    this.#settings = settings
  }

  static async load(filePath: string, saveDelayMs = 300): Promise<SettingsStore> {
    let settings = defaultSettings()
    try {
      settings = parseSettings(await readFile(filePath, 'utf8'))
    } catch {
      // A missing or unreadable file means defaults.
    }
    return new SettingsStore(filePath, settings, saveDelayMs)
  }

  get current(): Settings {
    return this.#settings
  }

  /** Subscribes to changes. Returns an unsubscribe function. */
  onChange(listener: (settings: Settings) => void): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  update(change: (settings: Settings) => Settings): void {
    this.#settings = change(this.#settings)
    this.#listeners.forEach((listener) => listener(this.#settings))
    this.#scheduleSave()
  }

  /** Updates the window bounds without notifying listeners; nothing in the UI depends on them. */
  setWindowBounds(bounds: WindowBounds): void {
    this.#settings = { ...this.#settings, window: bounds }
    this.#scheduleSave()
  }

  /** Writes pending changes now. */
  async flush(): Promise<void> {
    if (this.#timer) {
      clearTimeout(this.#timer)
      this.#timer = null
      this.#writing = this.#writing.then(() => this.#write())
    }
    await this.#writing
  }

  #scheduleSave(): void {
    if (this.#timer) return
    this.#timer = setTimeout(() => {
      this.#timer = null
      this.#writing = this.#writing.then(() => this.#write())
    }, this.saveDelayMs)
  }

  async #write(): Promise<void> {
    const temporary = path.join(path.dirname(this.filePath), `.${path.basename(this.filePath)}.tmp`)
    try {
      await mkdir(path.dirname(this.filePath), { recursive: true })
      await writeFile(temporary, `${JSON.stringify(this.#settings, null, 2)}\n`, 'utf8')
      await rename(temporary, this.filePath)
    } catch (error) {
      console.error('Could not save settings:', error)
    }
  }
}
