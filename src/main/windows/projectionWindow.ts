import { BrowserWindow, screen } from 'electron'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import type { ProjectionTarget } from '../../shared/ipc'
import type { StatusStore } from '../state/statusStore'
import { createSecureWebPreferences } from '../security/webPreferences'
import { chooseProjectionPlacement } from './placement'

export interface ProjectionWindowOptions {
  preloadPath: string
  allowDevTools: boolean
  load: (win: BrowserWindow) => Promise<void>
}

/**
 * Gestiona la ventana de proyección independiente.
 * En esta fase solo muestra una pantalla de prueba claramente identificada.
 */
export class ProjectionWindowManager {
  private window: BrowserWindow | null = null

  constructor(
    private readonly store: StatusStore,
    private readonly options: ProjectionWindowOptions
  ) {}

  getWebContentsId(): number | null {
    return this.window && !this.window.isDestroyed() ? this.window.webContents.id : null
  }

  sendStatus(status: unknown): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send('status:changed', status)
    }
  }

  isOpen(): boolean {
    return this.window !== null && !this.window.isDestroyed()
  }

  async open(target: ProjectionTarget): Promise<void> {
    const placement = chooseProjectionPlacement(screen.getAllDisplays(), screen.getPrimaryDisplay().id, target)

    const existing = this.window
    if (existing && !existing.isDestroyed()) {
      const sameMode = existing.isFullScreen() === placement.fullscreen
      if (sameMode) {
        existing.show()
        existing.focus()
        this.syncStatus()
        return
      }
      // El marco de la ventana no puede cambiarse en caliente: se recrea.
      await this.close()
    }

    const iconCandidates = [
      join(__dirname, '../../lumen.png'),
      join(process.resourcesPath, 'lumen.png'),
      join(process.cwd(), 'lumen.png')
    ]
    const iconPath = iconCandidates.find((p) => existsSync(p))

    const win = new BrowserWindow({
      ...placement.bounds,
      show: false,
      frame: !placement.fullscreen,
      title: 'Lumen Studio — Proyección',
      backgroundColor: '#000000',
      autoHideMenuBar: true,
      ...(iconPath ? { icon: iconPath } : {}),
      webPreferences: createSecureWebPreferences(this.options.preloadPath, this.options.allowDevTools)
    })
    win.setMenu(null)
    this.window = win

    win.on('closed', () => {
      if (this.window === win) this.window = null
      this.store.updateProjection({ windowOpen: false, fullscreen: false, displayId: null })
    })
    win.on('enter-full-screen', () => this.syncStatus())
    win.on('leave-full-screen', () => this.syncStatus())
    win.on('moved', () => this.syncStatus())
    win.webContents.on('before-input-event', (_event, input) => {
      if (input.type !== 'keyDown') return
      if (
        input.key === 'ArrowRight' ||
        input.key === 'ArrowDown' ||
        input.key === 'PageDown' ||
        input.key === ' '
      ) {
        this.store.goToSlide({ direction: 'next' })
      } else if (input.key === 'ArrowLeft' || input.key === 'ArrowUp' || input.key === 'PageUp') {
        this.store.goToSlide({ direction: 'prev' })
      }
    })

    try {
      await this.options.load(win)
    } catch (error) {
      if (!win.isDestroyed()) win.destroy()
      throw error
    }
    if (win.isDestroyed()) return

    win.show()
    if (placement.fullscreen) win.setFullScreen(true)
    this.syncStatus()
  }

  /** Cierra la ventana y espera a que se haya cerrado realmente. */
  close(): Promise<void> {
    const win = this.window
    if (!win || win.isDestroyed()) return Promise.resolve()
    return new Promise((resolve) => {
      win.once('closed', () => resolve())
      win.close()
    })
  }

  /** Cierre inmediato, usado al salir de la aplicación. */
  destroy(): void {
    const win = this.window
    if (win && !win.isDestroyed()) win.destroy()
  }

  private syncStatus(): void {
    const win = this.window
    if (!win || win.isDestroyed()) return
    this.store.updateProjection({
      windowOpen: true,
      fullscreen: win.isFullScreen(),
      displayId: screen.getDisplayMatching(win.getBounds()).id
    })
  }
}

