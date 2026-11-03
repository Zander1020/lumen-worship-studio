import { BrowserWindow, Menu } from 'electron'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { createSecureWebPreferences } from '../security/webPreferences'

export interface MainWindowOptions {
  preloadPath: string
  allowDevTools: boolean
}

export function createMainWindow(options: MainWindowOptions): BrowserWindow {
  const iconCandidates = [
    join(__dirname, '../../lumen.png'),
    join(process.resourcesPath, 'lumen.png'),
    join(process.cwd(), 'lumen.png')
  ]
  const iconPath = iconCandidates.find((p) => existsSync(p))
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    title: 'Lumen Studio',
    ...(iconPath ? { icon: iconPath } : {}),
    backgroundColor: '#0f1117',
    frame: false,
    autoHideMenuBar: true,
    webPreferences: createSecureWebPreferences(options.preloadPath, options.allowDevTools, {
      backgroundThrottling: true
    })
  })

  win.webContents.on('context-menu', (_event, params) => {
    if (params.isEditable) {
      Menu.buildFromTemplate([
        { role: 'undo', label: 'Deshacer' },
        { role: 'redo', label: 'Rehacer' },
        { type: 'separator' },
        { role: 'cut', label: 'Cortar' },
        { role: 'copy', label: 'Copiar' },
        { role: 'paste', label: 'Pegar' },
        { type: 'separator' },
        { role: 'selectAll', label: 'Seleccionar todo' }
      ]).popup({ window: win })
    } else if (params.selectionText && params.selectionText.trim().length > 0) {
      Menu.buildFromTemplate([
        { role: 'copy', label: 'Copiar' },
        { type: 'separator' },
        { role: 'selectAll', label: 'Seleccionar todo' }
      ]).popup({ window: win })
    }
  })

  win.setMenu(null)

  win.once('ready-to-show', () => {
    win.show()
  })

  return win
}

