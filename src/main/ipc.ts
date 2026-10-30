import { app, dialog, ipcMain, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron'
import { access, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  IpcChannel,
  type FileTreeNode,
  type OpenedFile,
  type OpenedFolder,
  type UnsavedChoice,
} from '../shared/api'
import { listMarkdownTree } from './fileTree'
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

async function openFolder(state: WindowState): Promise<OpenedFolder | null> {
  const result = await dialog.showOpenDialog(state.window, {
    title: 'Open Folder',
    properties: ['openDirectory', 'createDirectory'],
  })
  const chosen = result.filePaths[0]
  if (result.canceled || !chosen) return null
  const rootPath = await state.scope.grantFolder(chosen)
  return { rootPath, tree: await listMarkdownTree(rootPath) }
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

export function registerIpcHandlers(): void {
  ipcMain.handle(IpcChannel.OpenFolder, (event) => openFolder(senderState(event)))

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
