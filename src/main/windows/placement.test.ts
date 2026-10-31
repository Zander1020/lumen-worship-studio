import { describe, expect, it } from 'vitest'
import { chooseProjectionPlacement, type DisplayLike } from './placement'

const primary: DisplayLike = {
  id: 1,
  bounds: { x: 0, y: 0, width: 1920, height: 1080 },
  workArea: { x: 0, y: 0, width: 1920, height: 1040 }
}

const secondary: DisplayLike = {
  id: 2,
  bounds: { x: 1920, y: 0, width: 1920, height: 1080 },
  workArea: { x: 1920, y: 0, width: 1920, height: 1080 }
}

describe('chooseProjectionPlacement', () => {
  it('abre en ventana centrada cuando solo hay un monitor', () => {
    const placement = chooseProjectionPlacement([primary], 1, 'auto')
    expect(placement).toEqual({
      displayId: 1,
      bounds: { x: 480, y: 250, width: 960, height: 540 },
      fullscreen: false
    })
  })

  it('abre a pantalla completa en el monitor secundario cuando target es "auto"', () => {
    const placement = chooseProjectionPlacement([primary, secondary], 1, 'auto')
    expect(placement).toEqual({
      displayId: 2,
      bounds: { x: 1920, y: 0, width: 1920, height: 1080 },
      fullscreen: true
    })
  })

  it('fuerza ventana en el monitor principal cuando target es "windowed"', () => {
    const placement = chooseProjectionPlacement([primary, secondary], 1, 'windowed')
    expect(placement.fullscreen).toBe(false)
    expect(placement.displayId).toBe(1)
  })
})

