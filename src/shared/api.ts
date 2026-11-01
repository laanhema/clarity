/**
 * The contract between the renderer and the main process.
 *
 * The preload script exposes an object of type `LanternApi` as `window.lantern`.
 * The renderer never touches the file system directly; every disk operation
 * goes through these calls, and the main process checks every path.
 */

export type FileTreeNode =
  | { kind: 'file'; name: string; path: string }
  | { kind: 'directory'; name: string; path: string; children: FileTreeNode[] }

export interface OpenedFolder {
  rootPath: string
  tree: FileTreeNode[]
}

export interface OpenedFile {
  path: string
  content: string
}

export type MenuCommand = 'new-file' | 'open-file' | 'open-folder' | 'save' | 'save-as' | 'undo' | 'redo' | 'find'

export const MENU_COMMANDS = [
  'new-file',
  'open-file',
  'open-folder',
  'save',
  'save-as',
  'undo',
  'redo',
  'find',
] as const satisfies readonly MenuCommand[]

export type UnsavedChoice = 'save' | 'discard' | 'cancel'

/** What to do when the open file changed on disk while it has unsaved edits. */
export type ReloadChoice = 'reload' | 'keep'

export type ViewMode = 'editor' | 'split' | 'preview'
export const VIEW_MODES = ['editor', 'split', 'preview'] as const satisfies readonly ViewMode[]

export type ThemeSetting = 'system' | 'light' | 'dark' | 'gruvbox-material-dark-hard' | 'tokyo-night-moon'
export const THEME_SETTINGS = [
  'system',
  'light',
  'dark',
  'gruvbox-material-dark-hard',
  'tokyo-night-moon',
] as const satisfies readonly ThemeSetting[]

/**
 * The one typeface of everything Lantern draws: the sidebar, the editor, the
 * preview and its code, and the status bar, in every theme. Both fonts are
 * bundled and have no ligatures. The native menu bar, title bar and dialogs
 * keep the system font.
 */
export type FontSetting = 'jetbrains-mono-nl' | 'commit-mono'
export const FONT_SETTINGS = ['jetbrains-mono-nl', 'commit-mono'] as const satisfies readonly FontSetting[]

/** The command-line switch that hands a new window's theme to its preload script, so the first paint is right. */
export const INITIAL_THEME_SWITCH = '--lantern-theme='

/** The settings the renderer can see and change. The main process stores them in userData. */
export interface UiSettings {
  viewMode: ViewMode
  theme: ThemeSetting
  /** Sidebar width in CSS pixels. */
  sidebarWidth: number
  /** The editor's share of the editor + preview width in split view, between 0 and 1. */
  editorFraction: number
  font: FontSetting
  /**
   * Editor text size in CSS pixels. The preview scales with it: prose is 15/14
   * and code blocks 13/14 of this size.
   */
  fontSize: number
}

export const DEFAULT_UI_SETTINGS: UiSettings = {
  viewMode: 'split',
  theme: 'dark',
  sidebarWidth: 240,
  editorFraction: 0.5,
  font: 'commit-mono',
  fontSize: 14,
}

export const SIDEBAR_WIDTH_RANGE = { min: 160, max: 600 } as const
export const EDITOR_FRACTION_RANGE = { min: 0.15, max: 0.85 } as const
export const FONT_SIZE_RANGE = { min: 10, max: 28 } as const

export interface LanternApi {
  /** The theme setting when the window opened, available before `getSettings` resolves. */
  readonly initialTheme: ThemeSetting
  /**
   * Shows the native folder picker and resolves to the real path of the chosen
   * folder, or null when cancelled. The folder opens only once `enterFolder` is called.
   */
  pickFolder(): Promise<string | null>
  /**
   * Opens the folder that `pickFolder` or Open Recent picked last, or the open
   * folder again, and drops the old folder's access. Null forgets the pick and resolves to null.
   */
  enterFolder(rootPath: string | null): Promise<OpenedFolder | null>
  /** Shows the native file picker and reads the chosen file. Resolves to null when cancelled. */
  openFile(): Promise<OpenedFile | null>
  /** Lists the Markdown files of the open folder again. */
  listMarkdownFiles(): Promise<FileTreeNode[]>
  readFile(path: string): Promise<string>
  writeFile(path: string, content: string): Promise<void>
  /** Shows the native save dialog and writes the content there. Resolves to the new path, or null when cancelled. */
  saveAs(content: string, suggestedPath: string | null): Promise<string | null>
  /** Asks the user what to do with unsaved changes in a native dialog. */
  confirmUnsaved(documentName: string): Promise<UnsavedChoice>
  /** Asks whether to reload a file that another program changed while it has unsaved edits. */
  confirmReload(documentName: string): Promise<ReloadChoice>
  /** Tells the main process whether closing the window would lose changes. */
  setDocumentDirty(dirty: boolean): void
  /** Closes the window after the renderer has dealt with unsaved changes. */
  closeWindow(): void
  /** Starts watching the open document for changes by other programs; null stops watching. */
  watchDocument(path: string | null): Promise<void>
  /**
   * Reads an image that a document links with a relative path, as a data URL.
   * Only images inside the open folder load; anything else resolves to null.
   */
  loadImage(documentPath: string, src: string): Promise<string | null>
  /** Opens an http or https link in the system browser. Other links are ignored. */
  openExternal(url: string): void
  getSettings(): Promise<UiSettings>
  updateSettings(patch: Partial<UiSettings>): void
  /** Subscribes to menu commands. Returns an unsubscribe function. */
  onMenuCommand(listener: (command: MenuCommand) => void): () => void
  /** Subscribes to close requests made while the document is dirty. Returns an unsubscribe function. */
  onCloseRequested(listener: () => void): () => void
  /** Subscribes to settings changes, including those made from the menu. */
  onSettingsChanged(listener: (settings: UiSettings) => void): () => void
  /** Subscribes to folders picked from the Open Recent menu; the listener answers with `enterFolder`. */
  onFolderPicked(listener: (rootPath: string) => void): () => void
  /** Subscribes to changes of the watched document made by other programs. */
  onDocumentChanged(listener: (path: string) => void): () => void
  /** Subscribes to Markdown files being added to or removed from the open folder. */
  onTreeChanged(listener: () => void): () => void
}

export const IpcChannel = {
  PickFolder: 'lantern:pick-folder',
  EnterFolder: 'lantern:enter-folder',
  OpenFile: 'lantern:open-file',
  ListMarkdownFiles: 'lantern:list-markdown-files',
  ReadFile: 'lantern:read-file',
  WriteFile: 'lantern:write-file',
  SaveAs: 'lantern:save-as',
  ConfirmUnsaved: 'lantern:confirm-unsaved',
  ConfirmReload: 'lantern:confirm-reload',
  SetDocumentDirty: 'lantern:set-document-dirty',
  CloseWindow: 'lantern:close-window',
  WatchDocument: 'lantern:watch-document',
  LoadImage: 'lantern:load-image',
  OpenExternal: 'lantern:open-external',
  GetSettings: 'lantern:get-settings',
  UpdateSettings: 'lantern:update-settings',
  MenuCommand: 'lantern:menu-command',
  CloseRequested: 'lantern:close-requested',
  SettingsChanged: 'lantern:settings-changed',
  FolderPicked: 'lantern:folder-picked',
  DocumentChanged: 'lantern:document-changed',
  TreeChanged: 'lantern:tree-changed',
} as const

export const MARKDOWN_EXTENSIONS = ['.md', '.markdown'] as const

export function isMarkdownFileName(name: string): boolean {
  const lower = name.toLowerCase()
  return MARKDOWN_EXTENSIONS.some((extension) => lower.endsWith(extension))
}
