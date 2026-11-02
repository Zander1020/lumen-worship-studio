import type { WebPreferences } from 'electron'

/**
 * Preferencias web seguras comunes a todas las ventanas.
 * Solo importa tipos de Electron para poder probarse sin ejecutar Electron.
 *
 * `backgroundThrottling` se mantiene en `false` por defecto (la ventana de
 * proyección debe seguir pintando aunque quede cubierta por otra ventana).
 * La ventana principal sí lo activa para que, al minimizarse, no siga
 * consumiendo CPU con relojes, vídeos y animaciones.
 */
export function createSecureWebPreferences(
  preloadPath: string,
  allowDevTools: boolean,
  options?: { backgroundThrottling?: boolean }
): WebPreferences {
  return {
    preload: preloadPath,
    contextIsolation: true,
    nodeIntegration: false,
    nodeIntegrationInWorker: false,
    nodeIntegrationInSubFrames: false,
    sandbox: true,
    webSecurity: true,
    allowRunningInsecureContent: false,
    webviewTag: false,
    experimentalFeatures: false,
    navigateOnDragDrop: false,
    spellcheck: false,
    devTools: allowDevTools,
    backgroundThrottling: options?.backgroundThrottling ?? false
  }
}

