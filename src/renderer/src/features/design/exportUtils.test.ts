import { describe, expect, it } from 'vitest'
import { DEFAULT_TEMPLATES } from './defaultTemplates'
import { parseProjectFile } from './exportUtils'
import { CANVAS_PRESETS, type GraphicDesignProject } from './types'

describe('GraphicEditor exportUtils & models', () => {
  it('incluye todos los tamaños y proporciones requeridos para la iglesia', () => {
    const ids = CANVAS_PRESETS.map((p) => p.id)
    expect(ids).toContain('post-square')
    expect(ids).toContain('post-portrait')
    expect(ids).toContain('story-vertical')
    expect(ids).toContain('presentation-hdtv')
    expect(ids).toContain('broadcast-hd')

    const square = CANVAS_PRESETS.find((p) => p.id === 'post-square')
    expect(square?.width).toBe(1080)
    expect(square?.height).toBe(1080)

    const vertical = CANVAS_PRESETS.find((p) => p.id === 'post-portrait')
    expect(vertical?.width).toBe(1080)
    expect(vertical?.height).toBe(1350)

    const story = CANVAS_PRESETS.find((p) => p.id === 'story-vertical')
    expect(story?.width).toBe(1080)
    expect(story?.height).toBe(1920)

    const presentation = CANVAS_PRESETS.find((p) => p.id === 'presentation-hdtv')
    expect(presentation?.width).toBe(1920)
    expect(presentation?.height).toBe(1080)
  })

  it('proporciona plantillas iniciales válidas para sermones y versículos bíblicos', () => {
    expect(DEFAULT_TEMPLATES.length).toBeGreaterThanOrEqual(3)

    const preacherTemplate = DEFAULT_TEMPLATES.find((t) => t.id === 'template-preacher-quote')
    expect(preacherTemplate).toBeDefined()
    expect(preacherTemplate?.project.layers.some((l) => l.kind === 'image')).toBe(true)
    expect(preacherTemplate?.project.layers.some((l) => l.kind === 'text')).toBe(true)

    const bibleTemplate = DEFAULT_TEMPLATES.find((t) => t.id === 'template-bible-promise')
    expect(bibleTemplate).toBeDefined()
    expect(bibleTemplate?.project.layers.some((l) => l.kind === 'text')).toBe(true)
  })

  it('serializa y recupera proyectos editables conservando todas las propiedades', () => {
    const original: GraphicDesignProject = {
      version: 1,
      id: 'test-project-1',
      name: 'Culto Especial',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      width: 1080,
      height: 1080,
      backgroundColor: '#090d16',
      layers: [
        {
          id: 'text-1',
          name: 'Frase Pastor',
          kind: 'text',
          visible: true,
          locked: false,
          transform: { x: 100, y: 200, width: 800, height: 150, rotation: 0, opacity: 1 },
          textProps: {
            text: 'Dios sigue obrando',
            fontFamily: 'Montserrat',
            fontSize: 48,
            fontWeight: '700',
            fontStyle: 'normal',
            textDecoration: 'none',
            color: '#ffffff',
            textAlign: 'center',
            lineHeight: 1.3,
            letterSpacing: 1,
            uppercase: false,
            shadowEnabled: true,
            shadowColor: '#000000',
            shadowBlur: 10,
            shadowOffsetX: 2,
            shadowOffsetY: 4,
            strokeEnabled: false,
            strokeColor: '#000000',
            strokeWidth: 0,
            bgBoxEnabled: false,
            bgBoxColor: '#000',
            bgBoxOpacity: 0,
            bgBoxPadding: 0,
            bgBoxRadius: 0
          }
        }
      ]
    }

    const jsonStr = JSON.stringify(original)
    const restored = parseProjectFile(jsonStr)

    expect(restored.name).toBe('Culto Especial')
    expect(restored.width).toBe(1080)
    expect(restored.height).toBe(1080)
    expect(restored.layers.length).toBe(1)
    expect(restored.layers[0]?.textProps?.text).toBe('Dios sigue obrando')
  })

  it('aplica valores predeterminados seguros ante archivos parciales o incompletos', () => {
    const raw = JSON.stringify({ name: 'Incompleto' })
    const parsed = parseProjectFile(raw)
    expect(parsed.name).toBe('Incompleto')
    expect(parsed.width).toBe(1080)
    expect(parsed.height).toBe(1080)
    expect(parsed.layers).toEqual([])
  })
})

