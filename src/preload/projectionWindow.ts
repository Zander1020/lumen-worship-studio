/**
 * Preload de la ventana de proyección.
 *
 * Expone la API mínima necesaria: consultar el estado, suscribirse a cambios en vivo y cerrar.
 */
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { LumenProjectionApi } from '../shared/api'
import { IpcChannels, type AppStatus } from '../shared/ipc'

const api: LumenProjectionApi = {
  getStatus: () => ipcRenderer.invoke(IpcChannels.statusGet) as Promise<AppStatus>,
  onStatusChanged: (listener) => {
    const wrapped = (_event: IpcRendererEvent, status: AppStatus): void => {
      listener(status)
    }
    ipcRenderer.on(IpcChannels.statusChanged, wrapped)
    return () => {
      ipcRenderer.removeListener(IpcChannels.statusChanged, wrapped)
    }
  },
  close: () => ipcRenderer.invoke(IpcChannels.projectionClose) as Promise<AppStatus>
}

contextBridge.exposeInMainWorld('lumenProjection', api)
