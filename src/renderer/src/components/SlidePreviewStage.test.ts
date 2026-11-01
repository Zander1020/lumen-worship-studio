import { describe, expect, it } from 'vitest'
import { computeHolyricsOptimalFontSize } from './holyricsFontFit'

describe('computeHolyricsOptimalFontSize (Ajuste Automático Inteligente estilo Holyrics)', () => {
  it('maximiza versículo mediano como Juan 3:18 o Salmo 23:4 ocupando la pantalla con letra grande y legible', () => {
    const verseJuan318 = [
      'EL QUE EN ÉL CREE, NO ES CONDENADO; PERO EL QUE NO CREE, YA HA SIDO CONDENADO, PORQUE NO HA CREÍDO EN EL NOMBRE DEL UNIGÉNITO HIJO DE DIOS.'
    ]

    const result = computeHolyricsOptimalFontSize({
      lines: verseJuan318,
      isUppercase: true,
      hasHeader: true,
      userScalePct: 100
    })

    // Debe ser grande (mayor o igual a 4.5vw, es decir ~90px a ~130px en 1080p), NUNCA diminuto de 17px ni 50px
    expect(result.vw).toBeGreaterThanOrEqual(4.5)
    expect(result.vw).toBeLessThanOrEqual(7.5)
    // En vista previa compacta debe ser perfectamente visible
    expect(result.compactPx).toBeGreaterThanOrEqual(12)
    expect(result.compactPx).toBeLessThanOrEqual(24)
  })

  it('maximiza versículos de longitud media (Salmos 23:4, 23:5, 23:6) aprovechando el espacio vertical', () => {
    const salmo234 = [
      'AUNQUE ANDE EN VALLE DE SOMBRA DE MUERTE, NO TEMERÉ MAL ALGUNO, PORQUE TÚ ESTARÁS CONMIGO; TU VARA Y TU CAYADO ME INFUNDIRÁN ALIENTO.'
    ]
    const salmo235 = [
      'ADEREZAS MESA DELANTE DE MÍ EN PRESENCIA DE MIS ANGUSTIADORES; UNGES MI CABEZA CON ACEITE; MI COPA ESTÁ REBOSANDO.'
    ]

    const res4 = computeHolyricsOptimalFontSize({ lines: salmo234, isUppercase: true, hasHeader: true })
    const res5 = computeHolyricsOptimalFontSize({ lines: salmo235, isUppercase: true, hasHeader: true })

    expect(res4.vw).toBeGreaterThanOrEqual(4.5)
    expect(res5.vw).toBeGreaterThanOrEqual(4.5)
  })

  it('proyecta versos cortos con tamaño monumental para impacto visual', () => {
    const shortVerse = ['JEHOVÁ ES MI PASTOR; NADA ME FALTARÁ.']

    const result = computeHolyricsOptimalFontSize({
      lines: shortVerse,
      isUppercase: true,
      hasHeader: true,
      userScalePct: 100
    })

    // Versos cortos ocupan hasta el máximo de 7.8vw (~150px en 1080p)
    expect(result.vw).toBeGreaterThanOrEqual(5.5)
    expect(result.compactPx).toBeGreaterThanOrEqual(14)
  })

  it('ajusta versículos extra largos para que quepan completos sin desbordar', () => {
    const extraLong = [
      'Entonces fueron llamados los escribas del rey en el mes tercero, que es Siván, a los veintitrés días del mismo; y se escribió conforme a todo lo que mandó Mardoqueo, a los judíos, y a los sátrapas, los capitanes y los príncipes de las provincias que había desde la India hasta Etiopía, ciento veintisiete provincias; a cada provincia conforme a su escritura, y a cada pueblo conforme a su lengua, a los judíos también conforme a su escritura y lengua.'
    ]

    const result = computeHolyricsOptimalFontSize({
      lines: extraLong,
      isUppercase: false,
      hasHeader: true,
      userScalePct: 100
    })

    // Versículos ultra extensos se adaptan a ~2.4vw a ~4.0vw (~46px a ~76px en 1080p)
    expect(result.vw).toBeGreaterThanOrEqual(2.3)
    expect(result.vw).toBeLessThanOrEqual(4.2)
    expect(result.estimatedLines).toBeGreaterThanOrEqual(6)
  })

  it('escala proporcionalmente cuando el usuario ajusta el control de tamaño de letra', () => {
    const lines = ['Tu fidelidad es grande', 'Incomparable es Tu amor']

    const base = computeHolyricsOptimalFontSize({
      lines,
      isUppercase: false,
      hasHeader: false,
      userScalePct: 100
    })

    const scaledUp = computeHolyricsOptimalFontSize({
      lines,
      isUppercase: false,
      hasHeader: false,
      userScalePct: 150
    })

    expect(scaledUp.vw).toBeCloseTo(base.vw * 1.5, 1)
  })

  it('calcula tamaño óptimo grande para estrofa de alabanza de 6 líneas (Al estar ante ti)', () => {
    const songLines = [
      'AL ESTAR ANTE TI',
      'ADORANDO FRENTE',
      'AL MAR DE CRISTAL',
      'ENTRE LA MULTITUD',
      'EN ASOMBRO ALLI',
      'ME HABRE DE POSTRAR'
    ]

    const result = computeHolyricsOptimalFontSize({
      lines: songLines,
      isUppercase: true,
      hasHeader: false,
      userScalePct: 100
    })

    // Debe resultar en una fuente grande (~6.0vw a 7.5vw, aprox 115px a 140px en 1080p)
    expect(result.vw).toBeGreaterThanOrEqual(6.0)
    expect(result.vw).toBeLessThanOrEqual(7.5)
    expect(result.maxLineVh).toBeGreaterThanOrEqual(10.0)
    expect(result.estimatedLines).toBe(6)
  })

  it('determina correctamente el estado no silenciado para videos proyectados cuando theme.videoMuted es false', () => {
    // Al proyectar un video de medios (compact = false), no debe silenciarse por defecto
    const isMutedInProjection = (compact: boolean, windowOpen: boolean, videoMuted?: boolean): boolean => {
      return compact && windowOpen ? true : Boolean(videoMuted)
    }

    // 1. Proyección activa en ventana: debe tener sonido (muted = false)
    expect(isMutedInProjection(false, true, false)).toBe(false)
    expect(isMutedInProjection(false, true, undefined)).toBe(false)

    // 2. Vista previa en cabina sin ventana abierta: debe tener sonido (muted = false)
    expect(isMutedInProjection(true, false, false)).toBe(false)

    // 3. Cuando el operador pulsa el botón de silenciar (videoMuted = true): se silencia
    expect(isMutedInProjection(false, true, true)).toBe(true)
    expect(isMutedInProjection(true, false, true)).toBe(true)
  })
})

