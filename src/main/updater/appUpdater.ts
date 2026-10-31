import { app, BrowserWindow, ipcMain } from 'electron'
import { autoUpdater, type UpdateInfo } from 'electron-updater'

export interface UpdateStatusState {
  status: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
  version?: string | undefined
  releaseNotes?: string | undefined
  progressPercent?: number | undefined
  transferredBytes?: number | undefined
  totalBytes?: number | undefined
  error?: string | undefined
}

let lastState: UpdateStatusState = { status: 'not-available' }

export function initAutoUpdater(getMainWindow: () => BrowserWindow | null): void {
  // Configuración de electron-updater
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  const broadcast = (state: UpdateStatusState): void => {
    lastState = state
    const win = getMainWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send('updater:status-changed', state)
    }
  }

  autoUpdater.on('checking-for-update', () => {
    broadcast({ status: 'checking' })
  })

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    broadcast({
      status: 'available',
      version: info.version,
      releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined
    })
  })

  autoUpdater.on('update-not-available', () => {
    broadcast({ status: 'not-available' })
  })

  autoUpdater.on('download-progress', (progress) => {
    broadcast({
      status: 'downloading',
      version: lastState.version,
      progressPercent: Math.round(progress.percent),
      transferredBytes: progress.transferred,
      totalBytes: progress.total
    })
  })

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    broadcast({
      status: 'downloaded',
      version: info.version
    })
  })

  autoUpdater.on('error', (err) => {
    const msg = err ? err.message : ''
    console.warn('[AutoUpdater] Error:', msg)
    // No molestar con popups si el release aún no está publicado o retorna 404 (ej. latest.yml inexistente)
    if (!msg.includes('404') && !msg.includes('latest.yml')) {
      broadcast({
        status: 'error',
        error: msg || 'Error desconocido al comprobar actualizaciones'
      })
    }
  })

  // IPC Handlers
  ipcMain.handle('updater:get-status', () => {
    return lastState
  })

  ipcMain.handle('updater:check', async () => {
    if (!app.isPackaged) {
      // En modo desarrollo simulamos o intentamos comprobar si está configurado
      try {
        return await autoUpdater.checkForUpdates()
      } catch (e: any) {
        broadcast({
          status: 'error',
          error: 'Modo desarrollo: ' + (e?.message || 'No empaquetado')
        })
        return null
      }
    }
    try {
      return await autoUpdater.checkForUpdates()
    } catch (e: any) {
      broadcast({
        status: 'error',
        error: e?.message || 'Error al conectar con el servidor de actualizaciones'
      })
      return null
    }
  })

  ipcMain.handle('updater:download', async () => {
    try {
      await autoUpdater.downloadUpdate()
      return true
    } catch (e: any) {
      broadcast({
        status: 'error',
        error: e?.message || 'Error al descargar la actualización'
      })
      return false
    }
  })

  ipcMain.handle('updater:install', () => {
    autoUpdater.quitAndInstall(false, true)
    return true
  })

  // Comprobar automáticamente 5 segundos después de que la app haya cargado
  setTimeout(() => {
    if (app.isPackaged) {
      autoUpdater.checkForUpdates().catch(() => {
        // Fallos de red silenciosos en el chequeo inicial automático
      })
    }
  }, 5000)
}
