import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IpcChannel, type MdpadApi, type MenuCommand } from '../shared/api'

const MENU_COMMANDS: readonly string[] = ['open-file', 'open-folder', 'save', 'save-as'] satisfies MenuCommand[]

function isMenuCommand(value: unknown): value is MenuCommand {
  return typeof value === 'string' && MENU_COMMANDS.includes(value)
}

function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  return ipcRenderer.invoke(channel, ...args) as Promise<T>
}

function subscribe(channel: string, handler: (event: IpcRendererEvent, ...args: unknown[]) => void): () => void {
  ipcRenderer.on(channel, handler)
  return () => {
    ipcRenderer.removeListener(channel, handler)
  }
}

const api: MdpadApi = {
  openFolder: () => invoke(IpcChannel.OpenFolder),
  openFile: () => invoke(IpcChannel.OpenFile),
  listMarkdownFiles: () => invoke(IpcChannel.ListMarkdownFiles),
  readFile: (path) => invoke(IpcChannel.ReadFile, path),
  writeFile: (path, content) => invoke(IpcChannel.WriteFile, path, content),
  saveAs: (content, suggestedPath) => invoke(IpcChannel.SaveAs, content, suggestedPath),
  confirmUnsaved: (documentName) => invoke(IpcChannel.ConfirmUnsaved, documentName),
  setDocumentDirty: (dirty) => ipcRenderer.send(IpcChannel.SetDocumentDirty, dirty),
  closeWindow: () => ipcRenderer.send(IpcChannel.CloseWindow),
  onMenuCommand: (listener) =>
    subscribe(IpcChannel.MenuCommand, (_event, command) => {
      if (isMenuCommand(command)) listener(command)
    }),
  onCloseRequested: (listener) => subscribe(IpcChannel.CloseRequested, () => listener()),
}

contextBridge.exposeInMainWorld('mdpad', api)
