import { isTrustedAppUrl } from '../../shared/validation'

export interface SenderInfo {
  /** Id del `webContents` que envía el mensaje. */
  webContentsId: number
  /** URL del frame emisor (puede faltar si el frame ya no existe). */
  frameUrl: string | undefined
  /** `true` si el mensaje proviene del frame principal (no de un iframe). */
  isMainFrame: boolean
}

/**
 * Decide si un mensaje IPC puede ser atendido.
 *
 * Se exige que:
 *  1. Provenga del frame principal.
 *  2. Provenga de una de las ventanas autorizadas para ese canal.
 *  3. La URL del frame sea local (file://) o del servidor de desarrollo.
 */
export function isSenderAllowed(
  sender: SenderInfo,
  allowedWebContentsIds: readonly number[],
  devServerUrl?: string
): boolean {
  if (!sender.isMainFrame) return false
  if (!allowedWebContentsIds.includes(sender.webContentsId)) return false
  if (!sender.frameUrl) return false
  return isTrustedAppUrl(sender.frameUrl, devServerUrl)
}

