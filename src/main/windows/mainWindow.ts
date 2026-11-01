import { BrowserWindow } from 'electron'
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
 webPreferences: createSecureWebPreferences(options.preloadPath, options.allowDevTools)
 })

 win.setMenu(null)

 win.once('ready-to-show', () => {
 win.show()
 })

 return win
}

