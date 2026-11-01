import { app, dialog, ipcMain, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron'
import { access, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  IpcChannel,
  type FileTreeNode,
  type OpenedFile,
  type OpenedFolder,
  type ReloadChoice,
  type UiSettings,
  type UnsavedChoice,
} from '../shared/api'
import { listMarkdownTree } from './fileTree'
import { MAX_IMAGE_BYTES, imageMimeType } from './images'
import { openExternally } from './security'
import { addRecentFolder, sanitizeUiPatch, type SettingsStore } from './settings'
import { watchDocumentFile, watchFolderTree } from './watchers'
import { stateFor, type WindowState } from './windowState'

const MAX_FILE_BYTES = 20 * 1024 * 1024
const MARKDOWN_FILTERS = [{ name: 'Markdown', extensions: ['md', 'markdown'] }]

/** Requests must come from the main frame of a window this app created. */
function senderState(event: IpcMainInvokeEvent | IpcMainEvent): WindowState {
  const state = stateFor(event.sender)
  if (!state || event.senderFrame !== event.sender.mainFrame) {
    throw new Error('Request from an unknown sender')
  }
  return state
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== 'string') throw new TypeError(`${name} must be a string`)
  return value
}

async function readTextFile(filePath: string): Promise<string> {
  const info = await stat(filePath)
  if (!info.isFile()) throw new Error('Not a file')
  if (info.size > MAX_FILE_BYTES) throw new Error('File is too large to open')
  return readFile(filePath, 'utf8')
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

function send(state: WindowState, channel: string, ...args: unknown[]): void {
  if (!state.window.isDestroyed()) state.window.webContents.send(channel, ...args)
}

/**
 * Makes the folder the user picked the window's open folder: grants access,
 * watches it for added and removed files, and records it in Open Recent. The
 * old folder's grant goes with it.
 */
async function enterFolder(state: WindowState, requested: unknown, settings: SettingsStore): Promise<OpenedFolder | null> {
  if (requested === null) {
    state.scope.dropPickedFolder()
    return null
  }
  const rootPath = await state.scope.grantPickedFolder(requested)
  state.stopFolderWatch?.()
  state.stopFolderWatch = watchFolderTree(rootPath, () => send(state, IpcChannel.TreeChanged))
  settings.update((current) => ({ ...current, recentFolders: addRecentFolder(current.recentFolders, rootPath) }))
  return { rootPath, tree: await listMarkdownTree(rootPath) }
}

/** Picks a folder from the Open Recent menu and hands it to the renderer, which settles the document and enters it. */
export async function openRecentFolder(state: WindowState, folder: string, settings: SettingsStore): Promise<void> {
  let rootPath: string
  try {
    rootPath = await state.scope.pickFolder(folder)
  } catch {
    settings.update((current) => ({
      ...current,
      recentFolders: current.recentFolders.filter((entry) => entry !== folder),
    }))
    await dialog.showMessageBox(state.window, {
      type: 'error',
      message: `"${path.basename(folder)}" can no longer be opened.`,
      detail: `${folder}\n\nIt was removed from Open Recent.`,
    })
    return
  }
  send(state, IpcChannel.FolderPicked, rootPath)
}

async function pickFolder(state: WindowState): Promise<string | null> {
  const result = await dialog.showOpenDialog(state.window, {
    title: 'Open Folder',
    properties: ['openDirectory', 'createDirectory'],
  })
  const chosen = result.filePaths[0]
  if (result.canceled || !chosen) return null
  return state.scope.pickFolder(chosen)
}

async function openFile(state: WindowState): Promise<OpenedFile | null> {
  const result = await dialog.showOpenDialog(state.window, {
    title: 'Open File',
    properties: ['openFile'],
    filters: MARKDOWN_FILTERS,
  })
  const chosen = result.filePaths[0]
  if (result.canceled || !chosen) return null
  const filePath = await state.scope.grantFile(chosen)
  return { path: filePath, content: await readTextFile(filePath) }
}

/**
 * Picks the Save As target. A name typed without an extension gets `.md`;
 * the dialog did not ask about overwriting that name, so ask here.
 */
async function chooseSaveTarget(state: WindowState, suggestedPath: string | null): Promise<string | null> {
  const defaultPath =
    suggestedPath ?? path.join(state.scope.folder ?? app.getPath('documents'), 'Untitled.md')
  const result = await dialog.showSaveDialog(state.window, {
    title: 'Save As',
    defaultPath,
    filters: MARKDOWN_FILTERS,
    properties: ['createDirectory', 'showOverwriteConfirmation'],
  })
  if (result.canceled || !result.filePath) return null
  if (path.extname(result.filePath) !== '') return result.filePath

  const withExtension = `${result.filePath}.md`
  if (await exists(withExtension)) {
    const { response } = await dialog.showMessageBox(state.window, {
      type: 'warning',
      buttons: ['Replace', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
      message: `"${path.basename(withExtension)}" already exists. Do you want to replace it?`,
    })
    if (response !== 0) return null
  }
  return withExtension
}

async function saveAs(state: WindowState, content: string, suggestedPath: string | null): Promise<string | null> {
  const target = await chooseSaveTarget(state, suggestedPath)
  if (!target) return null
  await writeFile(target, content, 'utf8')
  return state.scope.grantFile(target)
}

async function confirmUnsaved(state: WindowState, documentName: string): Promise<UnsavedChoice> {
  const { response } = await dialog.showMessageBox(state.window, {
    type: 'warning',
    buttons: ['Save', "Don't Save", 'Cancel'],
    defaultId: 0,
    cancelId: 2,
    noLink: true,
    message: `Do you want to save the changes you made to ${documentName}?`,
    detail: "Your changes will be lost if you don't save them.",
  })
  const choices: UnsavedChoice[] = ['save', 'discard', 'cancel']
  return choices[response] ?? 'cancel'
}

async function confirmReload(state: WindowState, documentName: string): Promise<ReloadChoice> {
  const { response } = await dialog.showMessageBox(state.window, {
    type: 'warning',
    buttons: ['Reload', 'Keep My Changes'],
    defaultId: 1,
    cancelId: 1,
    noLink: true,
    message: `${documentName} was changed by another program.`,
    detail:
      'Reload it from disk and lose your unsaved changes, or keep your version? If you keep it, saving replaces the file on disk.',
  })
  return response === 0 ? 'reload' : 'keep'
}

async function watchDocument(state: WindowState, requested: unknown): Promise<void> {
  const generation = ++state.documentWatchGeneration
  state.stopDocumentWatch?.()
  state.stopDocumentWatch = null
  state.documentPath = null
  if (requested === null) return

  const reportedPath = requireString(requested, 'path')
  const realPath = await state.scope.resolveForRead(reportedPath)
  if (generation !== state.documentWatchGeneration) return
  state.documentPath = realPath
  state.stopDocumentWatch = watchDocumentFile(realPath, () => send(state, IpcChannel.DocumentChanged, reportedPath))
}

async function loadImage(state: WindowState, documentPath: unknown, src: unknown): Promise<string | null> {
  try {
    const imagePath = await state.scope.resolveImage(documentPath, src)
    const info = await stat(imagePath)
    if (!info.isFile() || info.size > MAX_IMAGE_BYTES) return null
    const data = await readFile(imagePath)
    return `data:${imageMimeType(imagePath)};base64,${data.toString('base64')}`
  } catch {
    // A missing or forbidden image shows as its alt text; there is nothing to report.
    return null
  }
}

export function registerIpcHandlers(settings: SettingsStore): void {
  ipcMain.handle(IpcChannel.PickFolder, (event) => pickFolder(senderState(event)))

  ipcMain.handle(IpcChannel.EnterFolder, (event, rootPath: unknown) =>
    enterFolder(senderState(event), rootPath, settings),
  )

  ipcMain.handle(IpcChannel.OpenFile, (event) => openFile(senderState(event)))

  ipcMain.handle(IpcChannel.ListMarkdownFiles, async (event): Promise<FileTreeNode[]> => {
    const { folder } = senderState(event).scope
    return folder ? listMarkdownTree(folder) : []
  })

  ipcMain.handle(IpcChannel.ReadFile, async (event, requested: unknown) => {
    const filePath = await senderState(event).scope.resolveForRead(requested)
    return readTextFile(filePath)
  })

  ipcMain.handle(IpcChannel.WriteFile, async (event, requested: unknown, content: unknown) => {
    const text = requireString(content, 'content')
    const filePath = await senderState(event).scope.resolveForWrite(requested)
    await writeFile(filePath, text, 'utf8')
  })

  ipcMain.handle(IpcChannel.SaveAs, (event, content: unknown, suggestedPath: unknown) => {
    const text = requireString(content, 'content')
    const suggestion = typeof suggestedPath === 'string' && path.isAbsolute(suggestedPath) ? suggestedPath : null
    return saveAs(senderState(event), text, suggestion)
  })

  ipcMain.handle(IpcChannel.ConfirmUnsaved, (event, documentName: unknown) =>
    confirmUnsaved(senderState(event), requireString(documentName, 'documentName')),
  )

  ipcMain.handle(IpcChannel.ConfirmReload, (event, documentName: unknown) =>
    confirmReload(senderState(event), requireString(documentName, 'documentName')),
  )

  ipcMain.handle(IpcChannel.WatchDocument, (event, requested: unknown) => watchDocument(senderState(event), requested))

  ipcMain.handle(IpcChannel.LoadImage, (event, documentPath: unknown, src: unknown) =>
    loadImage(senderState(event), documentPath, src),
  )

  ipcMain.handle(IpcChannel.GetSettings, (event): UiSettings => {
    senderState(event)
    return settings.current.ui
  })

  ipcMain.on(IpcChannel.UpdateSettings, (event, patch: unknown) => {
    senderState(event)
    const valid = sanitizeUiPatch(patch)
    if (Object.keys(valid).length === 0) return
    settings.update((current) => ({ ...current, ui: { ...current.ui, ...valid } }))
  })

  ipcMain.on(IpcChannel.OpenExternal, (event, url: unknown) => {
    senderState(event)
    if (typeof url === 'string') openExternally(url)
  })

  ipcMain.on(IpcChannel.SetDocumentDirty, (event, dirty: unknown) => {
    senderState(event).dirty = dirty === true
  })

  ipcMain.on(IpcChannel.CloseWindow, (event) => {
    const state = senderState(event)
    state.closeConfirmed = true
    if (state.quitAfterClose) app.quit()
    else state.window.close()
  })
}
