import { app, type BrowserWindow, Menu, net, protocol, screen, session } from 'electron'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { IpcChannels, type AppInfo } from '../shared/ipc'
import { registerIpcHandlers } from './ipc/registerIpcHandlers'
import { RemoteControlServer } from './remote/remoteControlServer'
import { applyGlobalSecurity, getDevServerUrl, hardenSession, loadRendererPage } from './security/appSecurity'
import { StatusStore } from './state/statusStore'
import { WorkspaceStore } from './state/workspaceStore'
import { createMainWindow } from './windows/mainWindow'
import { ProjectionWindowManager } from './windows/projectionWindow'
import { initAutoUpdater } from './updater/appUpdater'

// Registrar esquema multimedia local privilegiado con soporte de streaming, audio y vídeo por rangos
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'lumen-media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: true
    }
  }
])

// Todos los renderers se ejecutan en sandbox, sin excepción.
app.enableSandbox()

// Permitir reproducción automática inmediata de vídeos y fondos sin requerir gesto previo del usuario
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  bootstrap()
}

function bootstrap(): void {
  const devServerUrl = getDevServerUrl()
  const allowDevTools = !app.isPackaged
  const preloadDir = join(__dirname, '../preload')

  applyGlobalSecurity(devServerUrl)

  const store = new StatusStore()
  let mainWindow: BrowserWindow | null = null

  const projection = new ProjectionWindowManager(store, {
    preloadPath: join(preloadDir, 'projectionWindow.js'),
    allowDevTools,
    load: (win) => loadRendererPage(win, 'projection', devServerUrl)
  })

  const getAppInfo = (): AppInfo => ({
    name: 'Lumen Studio',
    version: app.getVersion(),
    platform: process.platform,
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node
  })

  app.on('second-instance', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  // Aplicación orientada a Windows: al cerrar todas las ventanas se sale.
  app.on('window-all-closed', () => {
    app.quit()
  })

  app
    .whenReady()
    .then(async () => {
      hardenSession(session.defaultSession)
      Menu.setApplicationMenu(null)

      // Servidor de streaming multimedia local: transmite vídeos y audios locales con HTTP 206 y GPU
      protocol.handle('lumen-media', (request) => {
        try {
          const url = new URL(request.url)
          let rawPath = decodeURIComponent(url.pathname)
          if (/^\/[a-zA-Z]:/.test(rawPath)) {
            rawPath = rawPath.slice(1)
          }
          return net.fetch(pathToFileURL(rawPath).toString())
        } catch (e) {
          console.error('[protocol] Error al servir lumen-media:', e)
          return new Response('Not Found', { status: 404 })
        }
      })

      const workspaceFile = join(app.getPath('userData'), 'lumen-workspace.json')
      const workspace = new WorkspaceStore(workspaceFile)
      // Generar siempre un PIN nuevo de 4 dígitos por seguridad cada vez que se abre la app
      const sessionPin = String(Math.floor(1000 + Math.random() * 9000))
      workspace.updateSettings({ remotePin: sessionPin })
      const initialSettings = workspace.getSettings()
      store.updateLive({
        churchName: initialSettings.churchName,
        welcomeSubtitle: initialSettings.welcomeSubtitle,
        showClockOnLogo: initialSettings.showClockOnLogo,
        theme: initialSettings.theme
      })

      const remote = new RemoteControlServer(
        store,
        workspace,
        async () => {
          if (!projection.isOpen()) {
            await projection.open('auto')
          }
        },
        async () => {
          if (projection.isOpen()) {
            await projection.close()
          }
        }
      )

      const updateDisplayCount = (): void => {
        store.updateProjection({ displayCount: screen.getAllDisplays().length })
      }
      updateDisplayCount()
      screen.on('display-added', updateDisplayCount)
      screen.on('display-removed', updateDisplayCount)

      registerIpcHandlers({
        store,
        workspace,
        remote,
        projection,
        getMainWebContentsId: () => (mainWindow && !mainWindow.isDestroyed() ? mainWindow.webContents.id : null),
        getMainWindow: () => (mainWindow && !mainWindow.isDestroyed() ? mainWindow : null),
        getAppInfo,
        devServerUrl
      })

      // Tanto la ventana principal como la ventana de proyección reciben cambios de estado.
      store.subscribe((status) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(IpcChannels.statusChanged, status)
        }
        projection.sendStatus(status)
      })

      const win = createMainWindow({ preloadPath: join(preloadDir, 'mainWindow.js'), allowDevTools })
      mainWindow = win
      initAutoUpdater(() => (mainWindow && !mainWindow.isDestroyed() ? mainWindow : null))
      win.on('closed', () => {
        mainWindow = null
        void remote.stop()
        // Cerrar la ventana principal cierra también la proyección.
        projection.destroy()
      })

      await loadRendererPage(win, 'index', devServerUrl)
    })
    .catch((error: unknown) => {
      console.error('[app] Error al iniciar:', error)
      app.quit()
    })
}
