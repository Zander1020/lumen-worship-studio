export interface HolyricsFontFitOptions {
  lines: readonly string[]
  isUppercase: boolean
  hasHeader: boolean
  userScalePct?: number
}

export interface HolyricsFontFitResult {
  vw: number
  compactPx: number
  maxLineVh: number
  estimatedLines: number
}

/**
 * Motor de Auto-Ajuste de Texto Holyrics:
 * Maximiza de forma inteligente el tamaño de fuente para llenar el área útil
 * de la pantalla de proyección, logrando que el texto sea lo más grande y nítido
 * posible (legible desde el fondo de la iglesia), pero adaptando la escala
 * dinámicamente según la longitud del versículo o estrofa para que jamás se corte.
 */
export function computeHolyricsOptimalFontSize(options: HolyricsFontFitOptions): HolyricsFontFitResult {
  const { lines, isUppercase, hasHeader, userScalePct = 100 } = options
  const userMultiplier = Math.max(0.6, Math.min(2.0, userScalePct / 100))

  const fullText = lines.join(' ').trim()
  const totalChars = fullText.length
  const rawLineCount = lines.length

  if (totalChars === 0) {
    return { vw: 5.5, compactPx: 16, maxLineVh: 25, estimatedLines: 1 }
  }

  // En mayúsculas las palabras ocupan ~16% más de ancho promedio
  const charRatio = isUppercase ? 0.58 : 0.50

  // Dimensiones útiles de proyección en pantalla panorámica 16:9:
  // Ancho útil: 92vw (dejando 4% de margen a cada lado)
  // Alto útil: 78vh si tiene cabecera de cita bíblica / reloj, 84vh si no tiene cabecera
  // En 16:9, 1vh = 0.5625vw (alto total = 56.25vw)
  const availVw = 92
  const availVh = hasHeader ? 78 : 84
  const availVhInVw = availVh * 0.5625

  // Evaluamos de 1 a 8 renglones de ajuste (k) para encontrar el mayor tamaño de fuente posible
  let bestVw = 2.4
  const minK = Math.max(1, rawLineCount)
  const maxK = Math.max(minK, 8)

  for (let k = minK; k <= maxK; k++) {
    const maxLineChars = rawLineCount > 1
      ? Math.max(...lines.map((l) => l.trim().length), Math.ceil(totalChars / k))
      : Math.ceil(totalChars / k)

    const maxVwHorizontal = availVw / (Math.max(1, maxLineChars) * charRatio)
    const maxVwVertical = availVhInVw / (k * 1.20)
    const safeVw = Math.min(maxVwHorizontal, maxVwVertical)

    if (safeVw > bestVw) {
      bestVw = safeVw
    }
  }

  // Techo y piso estéticos para proyección:
  // Entre 2.4vw (textos ultra largos de 350+ caracteres) y 7.8vw (versos cortos / estrofas de alabanza)
  const clampedBaseVw = Math.max(2.4, Math.min(7.8, bestVw))
  const finalVw = clampedBaseVw * userMultiplier

  const estimatedLines = Math.max(
    rawLineCount,
    Math.ceil(totalChars / Math.max(12, availVw / (finalVw * charRatio)))
  )
  const maxLineVh = Math.max(4.0, availVh / (Math.max(1, estimatedLines) * 1.18))

  // En monitor compacto (vista previa en el LiveDock de cabina):
  const compactPx = Math.max(9, Math.min(24, Math.round((finalVw / 5.5) * 16)))

  return {
    vw: finalVw,
    compactPx,
    maxLineVh,
    estimatedLines
  }
}
