/**
 * The contract between the renderer and the main process.
 *
 * The preload script exposes an object of type `MdpadApi` as `window.mdpad`.
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

/** The command-line switch that hands a new window's theme to its preload script, so the first paint is right. */
export const INITIAL_THEME_SWITCH = '--mdpad-theme='

/** The settings the renderer can see and change. The main process stores them in userData. */
export interface UiSettings {
  viewMode: ViewMode
  theme: ThemeSetting
  /** Sidebar width in CSS pixels. */
  sidebarWidth: number
  /** The editor's share of the editor + preview width in split view, between 0 and 1. */
  editorFraction: number
}

export const DEFAULT_UI_SETTINGS: UiSettings = {
  viewMode: 'split',
  theme: 'system',
  sidebarWidth: 240,
  editorFraction: 0.5,
}

export const SIDEBAR_WIDTH_RANGE = { min: 160, max: 600 } as const
export const EDITOR_FRACTION_RANGE = { min: 0.15, max: 0.85 } as const

export interface MdpadApi {
  /** The theme setting when the window opened, available before `getSettings` resolves. */
  readonly initialTheme: ThemeSetting
  /** Shows the native folder picker. Resolves to null when cancelled. */
  openFolder(): Promise<OpenedFolder | null>
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
  /** Subscribes to folders opened from the Open Recent menu. */
  onFolderOpened(listener: (folder: OpenedFolder) => void): () => void
  /** Subscribes to changes of the watched document made by other programs. */
  onDocumentChanged(listener: (path: string) => void): () => void
  /** Subscribes to Markdown files being added to or removed from the open folder. */
  onTreeChanged(listener: () => void): () => void
}

export const IpcChannel = {
  OpenFolder: 'mdpad:open-folder',
  OpenFile: 'mdpad:open-file',
  ListMarkdownFiles: 'mdpad:list-markdown-files',
  ReadFile: 'mdpad:read-file',
  WriteFile: 'mdpad:write-file',
  SaveAs: 'mdpad:save-as',
  ConfirmUnsaved: 'mdpad:confirm-unsaved',
  ConfirmReload: 'mdpad:confirm-reload',
  SetDocumentDirty: 'mdpad:set-document-dirty',
  CloseWindow: 'mdpad:close-window',
  WatchDocument: 'mdpad:watch-document',
  LoadImage: 'mdpad:load-image',
  OpenExternal: 'mdpad:open-external',
  GetSettings: 'mdpad:get-settings',
  UpdateSettings: 'mdpad:update-settings',
  MenuCommand: 'mdpad:menu-command',
  CloseRequested: 'mdpad:close-requested',
  SettingsChanged: 'mdpad:settings-changed',
  FolderOpened: 'mdpad:folder-opened',
  DocumentChanged: 'mdpad:document-changed',
  TreeChanged: 'mdpad:tree-changed',
} as const

export const MARKDOWN_EXTENSIONS = ['.md', '.markdown'] as const

export function isMarkdownFileName(name: string): boolean {
  const lower = name.toLowerCase()
  return MARKDOWN_EXTENSIONS.some((extension) => lower.endsWith(extension))
}
