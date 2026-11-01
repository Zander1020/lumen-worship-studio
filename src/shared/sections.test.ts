import { describe, expect, it } from 'vitest'
import { DEFAULT_SECTION, SECTIONS, isSectionId } from './sections'

describe('SECTIONS', () => {
  it('contiene las secciones principales y utilitarias en orden', () => {
    expect(SECTIONS.map((s) => s.label)).toEqual([
      'Inicio',
      'Alabanzas',
      'Biblia',
      'Imágenes',
      'Editor Gráfico',
      'Proyección',
      'Control remoto',
      'Inteligencia artificial',
      'Configuración',
      'Acerca de'
    ])
  })

  it('define "home" como sección inicial y valida identificadores', () => {
    expect(DEFAULT_SECTION).toBe('home')
    expect(isSectionId('home')).toBe(true)
    expect(isSectionId('design')).toBe(true)
    expect(isSectionId('projection')).toBe(true)
    expect(isSectionId('unknown')).toBe(false)
    expect(isSectionId(null)).toBe(false)
  })
})
