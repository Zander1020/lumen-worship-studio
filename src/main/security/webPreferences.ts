import type { WebPreferences } from 'electron'

/**
 * Preferencias web seguras comunes a todas las ventanas.
 * Solo importa tipos de Electron para poder probarse sin ejecutar Electron.
 */
export function createSecureWebPreferences(preloadPath: string, allowDevTools: boolean): WebPreferences {
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
 backgroundThrottling: false
 }
}

