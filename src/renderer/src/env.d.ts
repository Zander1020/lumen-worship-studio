import type { LumenApi, LumenProjectionApi } from '../../shared/api'

declare global {
  interface Window {
    /** Disponible solo en la ventana principal (preload `mainWindow`). */
    readonly lumen?: LumenApi
    /** Disponible solo en la ventana de proyección (preload `projectionWindow`). */
    readonly lumenProjection?: LumenProjectionApi
  }
}

export {}

