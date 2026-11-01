import { app, shell, type BrowserWindow, type Session } from 'electron'
import { join } from 'node:path'
import { isTrustedAppUrl } from '../../shared/validation'

export type RendererPage = 'index' | 'projection'

/**
 * URL del servidor de desarrollo de Vite. Solo se acepta si la app no está
 * empaquetada y la URL apunta a localhost; en producción siempre es `undefined`.
 */
export function getDevServerUrl(): string | undefined {
  if (app.isPackaged) return undefined
  const url = process.env['ELECTRON_RENDERER_URL']
  if (!url || !isTrustedAppUrl(url, url)) return undefined
  return url
}

/**
 * Carga una página local del renderer. Nunca carga contenido remoto:
 * en producción usa `file://` y en desarrollo solo el servidor local de Vite.
 */
export async function loadRendererPage(
  win: BrowserWindow,
  page: RendererPage,
  devServerUrl: string | undefined
): Promise<void> {
  if (devServerUrl) {
    const base = devServerUrl.endsWith('/') ? devServerUrl : `${devServerUrl}/`
    await win.loadURL(new URL(`${page}.html`, base).toString())
    return
  }
  await win.loadFile(join(__dirname, '../renderer', `${page}.html`))
}

/**
 * Endurecimiento global aplicado a todos los `webContents` creados:
 * bloquea ventanas emergentes, navegación externa y etiquetas `<webview>`.
 */
export function applyGlobalSecurity(devServerUrl: string | undefined): void {
  app.on('web-contents-created', (_event, contents) => {
    contents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('https://wa.me/') || url.startsWith('mailto:') || url.startsWith('https://api.whatsapp.com/')) {
        void shell.openExternal(url)
      } else {
        console.warn(`[seguridad] Ventana emergente bloqueada: ${url}`)
      }
      return { action: 'deny' }
    })

    contents.on('will-navigate', (event) => {
      if (event.url.startsWith('https://wa.me/') || event.url.startsWith('mailto:') || event.url.startsWith('https://api.whatsapp.com/')) {
        event.preventDefault()
        void shell.openExternal(event.url)
        return
      }
      if (!isTrustedAppUrl(event.url, devServerUrl)) {
        console.warn(`[seguridad] Navegación bloqueada: ${event.url}`)
        event.preventDefault()
      }
    })

    contents.on('will-redirect', (event) => {
      if (!isTrustedAppUrl(event.url, devServerUrl)) {
        console.warn(`[seguridad] Redirección bloqueada: ${event.url}`)
        event.preventDefault()
      }
    })

    contents.on('will-attach-webview', (event) => {
      console.warn('[seguridad] <webview> bloqueado')
      event.preventDefault()
    })
  })
}

/** Deniega todas las solicitudes de permisos (cámara, micrófono, notificaciones…). */
export function hardenSession(ses: Session): void {
  ses.setPermissionRequestHandler((_webContents, permission, callback) => {
    console.warn(`[seguridad] Permiso denegado: ${permission}`)
    callback(false)
  })
  ses.setPermissionCheckHandler(() => false)
}

