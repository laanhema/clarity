import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IpcChannel, MENU_COMMANDS, type MdpadApi, type MenuCommand, type OpenedFolder, type UiSettings } from '../shared/api'

function isMenuCommand(value: unknown): value is MenuCommand {
  return typeof value === 'string' && (MENU_COMMANDS as readonly string[]).includes(value)
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
  confirmReload: (documentName) => invoke(IpcChannel.ConfirmReload, documentName),
  setDocumentDirty: (dirty) => ipcRenderer.send(IpcChannel.SetDocumentDirty, dirty),
  closeWindow: () => ipcRenderer.send(IpcChannel.CloseWindow),
  watchDocument: (path) => invoke(IpcChannel.WatchDocument, path),
  loadImage: (documentPath, src) => invoke(IpcChannel.LoadImage, documentPath, src),
  openExternal: (url) => ipcRenderer.send(IpcChannel.OpenExternal, url),
  getSettings: () => invoke(IpcChannel.GetSettings),
  updateSettings: (patch) => ipcRenderer.send(IpcChannel.UpdateSettings, patch),
  onMenuCommand: (listener) =>
    subscribe(IpcChannel.MenuCommand, (_event, command) => {
      if (isMenuCommand(command)) listener(command)
    }),
  onCloseRequested: (listener) => subscribe(IpcChannel.CloseRequested, () => listener()),
  onSettingsChanged: (listener) =>
    subscribe(IpcChannel.SettingsChanged, (_event, settings) => listener(settings as UiSettings)),
  onFolderOpened: (listener) => subscribe(IpcChannel.FolderOpened, (_event, folder) => listener(folder as OpenedFolder)),
  onDocumentChanged: (listener) =>
    subscribe(IpcChannel.DocumentChanged, (_event, path) => {
      if (typeof path === 'string') listener(path)
    }),
  onTreeChanged: (listener) => subscribe(IpcChannel.TreeChanged, () => listener()),
}

contextBridge.exposeInMainWorld('mdpad', api)
