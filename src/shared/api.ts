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

export type MenuCommand = 'open-file' | 'open-folder' | 'save' | 'save-as'

export type UnsavedChoice = 'save' | 'discard' | 'cancel'

export type ViewMode = 'editor' | 'split' | 'preview'
export const VIEW_MODES = ['editor', 'split', 'preview'] as const satisfies readonly ViewMode[]

export type ThemeSetting = 'system' | 'light' | 'dark'
export const THEME_SETTINGS = ['system', 'light', 'dark'] as const satisfies readonly ThemeSetting[]

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
  /** Tells the main process whether closing the window would lose changes. */
  setDocumentDirty(dirty: boolean): void
  /** Closes the window after the renderer has dealt with unsaved changes. */
  closeWindow(): void
  /** Subscribes to menu commands. Returns an unsubscribe function. */
  onMenuCommand(listener: (command: MenuCommand) => void): () => void
  /** Subscribes to close requests made while the document is dirty. Returns an unsubscribe function. */
  onCloseRequested(listener: () => void): () => void
}

export const IpcChannel = {
  OpenFolder: 'mdpad:open-folder',
  OpenFile: 'mdpad:open-file',
  ListMarkdownFiles: 'mdpad:list-markdown-files',
  ReadFile: 'mdpad:read-file',
  WriteFile: 'mdpad:write-file',
  SaveAs: 'mdpad:save-as',
  ConfirmUnsaved: 'mdpad:confirm-unsaved',
  SetDocumentDirty: 'mdpad:set-document-dirty',
  CloseWindow: 'mdpad:close-window',
  MenuCommand: 'mdpad:menu-command',
  CloseRequested: 'mdpad:close-requested',
} as const

export const MARKDOWN_EXTENSIONS = ['.md', '.markdown'] as const

export function isMarkdownFileName(name: string): boolean {
  const lower = name.toLowerCase()
  return MARKDOWN_EXTENSIONS.some((extension) => lower.endsWith(extension))
}
