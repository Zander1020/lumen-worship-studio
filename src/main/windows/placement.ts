import type { ProjectionTarget } from '../../shared/ipc'

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface DisplayLike {
  id: number
  bounds: Rect
  workArea: Rect
}

export interface ProjectionPlacement {
  displayId: number
  bounds: Rect
  fullscreen: boolean
}

export const WINDOWED_SIZE = { width: 960, height: 540 } as const

/**
 * Decide en qué monitor y con qué tamaño se abre la ventana de proyección.
 *
 * - `auto` con un monitor secundario: pantalla completa en el secundario.
 * - En cualquier otro caso: ventana 16:9 centrada en el área de trabajo del principal.
 */
export function chooseProjectionPlacement(
  displays: readonly DisplayLike[],
  primaryId: number,
  target: ProjectionTarget
): ProjectionPlacement {
  const primary = displays.find((d) => d.id === primaryId) ?? displays[0]
  if (!primary) {
    throw new Error('No se detectó ningún monitor.')
  }

  if (target === 'auto') {
    const external = displays.find((d) => d.id !== primary.id)
    if (external) {
      return { displayId: external.id, bounds: { ...external.bounds }, fullscreen: true }
    }
  }

  const area = primary.workArea
  const width = Math.min(WINDOWED_SIZE.width, area.width)
  const height = Math.min(WINDOWED_SIZE.height, area.height)
  return {
    displayId: primary.id,
    bounds: {
      x: Math.round(area.x + (area.width - width) / 2),
      y: Math.round(area.y + (area.height - height) / 2),
      width,
      height
    },
    fullscreen: false
  }
}

