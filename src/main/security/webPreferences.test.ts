import { describe, expect, it } from 'vitest'
import { createSecureWebPreferences } from './webPreferences'

describe('createSecureWebPreferences', () => {
  it('activa contextIsolation, sandbox y webSecurity, y desactiva nodeIntegration', () => {
    const prefs = createSecureWebPreferences('C:/app/preload/mainWindow.js', false)

    expect(prefs.preload).toBe('C:/app/preload/mainWindow.js')
    expect(prefs.contextIsolation).toBe(true)
    expect(prefs.nodeIntegration).toBe(false)
    expect(prefs.nodeIntegrationInWorker).toBe(false)
    expect(prefs.nodeIntegrationInSubFrames).toBe(false)
    expect(prefs.sandbox).toBe(true)
    expect(prefs.webSecurity).toBe(true)
    expect(prefs.allowRunningInsecureContent).toBe(false)
    expect(prefs.webviewTag).toBe(false)
    expect(prefs.navigateOnDragDrop).toBe(false)
    expect(prefs.devTools).toBe(false)
    expect(prefs.backgroundThrottling).toBe(false)
  })
})

