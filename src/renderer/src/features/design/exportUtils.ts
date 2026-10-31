import type { GraphicDesignProject, GraphicLayer } from './types'

/**
 * Carga una imagen en un elemento HTMLImageElement de forma asíncrona.
 */
function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`No se pudo cargar la imagen: ${src.slice(0, 40)}`))
    img.src = src
  })
}

/**
 * Dibuja un rectángulo con esquinas redondeadas en el contexto 2D.
 */
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number
): void {
  const r = Math.min(radius, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/**
 * Divide un texto largo en líneas que se ajusten al ancho máximo disponible.
 */
function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const rawParagraphs = text.split('\n')
  const resultLines: string[] = []

  for (const para of rawParagraphs) {
    if (!para.trim()) {
      resultLines.push('')
      continue
    }

    const words = para.split(' ')
    let currentLine = words[0] ?? ''

    for (let i = 1; i < words.length; i++) {
      const word = words[i] ?? ''
      const candidate = `${currentLine} ${word}`
      const metrics = ctx.measureText(candidate)
      if (metrics.width <= maxWidth) {
        currentLine = candidate
      } else {
        resultLines.push(currentLine)
        currentLine = word
      }
    }
    if (currentLine) {
      resultLines.push(currentLine)
    }
  }

  return resultLines.length > 0 ? resultLines : ['']
}

/**
 * Renderiza el proyecto completo en un elemento HTMLCanvasElement en sus dimensiones
 * reales (p. ej. 1080x1080, 1920x1080) sin ningún control de edición, guías ni bordes.
 */
export async function renderProjectToCanvas(
  project: GraphicDesignProject
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas')
  canvas.width = project.width
  canvas.height = project.height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('No se pudo inicializar el contexto 2D del lienzo.')
  }

  // 1. Dibujar fondo
  if (project.backgroundImage) {
    try {
      const bgImg = await loadImageElement(project.backgroundImage)
      const fit = project.backgroundImageFit || 'cover'
      if (fit === 'contain') {
        const hRatio = project.width / bgImg.naturalWidth
        const vRatio = project.height / bgImg.naturalHeight
        const ratio = Math.min(hRatio, vRatio)
        const centerShiftX = (project.width - bgImg.naturalWidth * ratio) / 2
        const centerShiftY = (project.height - bgImg.naturalHeight * ratio) / 2
        ctx.fillStyle = project.backgroundColor || '#090d16'
        ctx.fillRect(0, 0, project.width, project.height)
        ctx.drawImage(
          bgImg,
          0,
          0,
          bgImg.naturalWidth,
          bgImg.naturalHeight,
          centerShiftX,
          centerShiftY,
          bgImg.naturalWidth * ratio,
          bgImg.naturalHeight * ratio
        )
      } else if (fit === 'fill') {
        ctx.drawImage(bgImg, 0, 0, project.width, project.height)
      } else {
        // cover
        const hRatio = project.width / bgImg.naturalWidth
        const vRatio = project.height / bgImg.naturalHeight
        const ratio = Math.max(hRatio, vRatio)
        const centerShiftX = (project.width - bgImg.naturalWidth * ratio) / 2
        const centerShiftY = (project.height - bgImg.naturalHeight * ratio) / 2
        ctx.drawImage(
          bgImg,
          0,
          0,
          bgImg.naturalWidth,
          bgImg.naturalHeight,
          centerShiftX,
          centerShiftY,
          bgImg.naturalWidth * ratio,
          bgImg.naturalHeight * ratio
        )
      }
    } catch {
      ctx.fillStyle = project.backgroundColor || '#090d16'
      ctx.fillRect(0, 0, project.width, project.height)
    }
  } else if (project.backgroundGradient && project.backgroundGradient.includes('gradient')) {
    // Si es un gradiente sintético simple, crear un degradado vertical
    const grad = ctx.createLinearGradient(0, 0, project.width, project.height)
    grad.addColorStop(0, '#1e293b')
    grad.addColorStop(1, project.backgroundColor || '#090d16')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, project.width, project.height)
  } else {
    ctx.fillStyle = project.backgroundColor || '#090d16'
    ctx.fillRect(0, 0, project.width, project.height)
  }

  // 2. Dibujar capas en orden de índice (0 = fondo, length-1 = frente)
  for (const layer of project.layers) {
    if (!layer.visible) continue

    ctx.save()
    const { x, y, width, height, rotation, opacity } = layer.transform
    ctx.globalAlpha = Math.max(0, Math.min(1, opacity))

    // Centrar transformación para rotación suave
    const centerX = x + width / 2
    const centerY = y + height / 2
    ctx.translate(centerX, centerY)
    if (rotation) {
      ctx.rotate((rotation * Math.PI) / 180)
    }
    ctx.translate(-width / 2, -height / 2)

    if (layer.kind === 'rect' && layer.shapeProps) {
      const { fillColor, strokeColor, strokeWidth, borderRadius } = layer.shapeProps
      drawRoundedRect(ctx, 0, 0, width, height, borderRadius || 0)
      if (fillColor && fillColor !== 'transparent') {
        ctx.fillStyle = fillColor
        ctx.fill()
      }
      if (strokeWidth && strokeWidth > 0 && strokeColor && strokeColor !== 'transparent') {
        ctx.lineWidth = strokeWidth
        ctx.strokeStyle = strokeColor
        ctx.stroke()
      }
    } else if (layer.kind === 'circle' && layer.shapeProps) {
      const { fillColor, strokeColor, strokeWidth } = layer.shapeProps
      ctx.beginPath()
      ctx.ellipse(width / 2, height / 2, width / 2, height / 2, 0, 0, 2 * Math.PI)
      if (fillColor && fillColor !== 'transparent') {
        ctx.fillStyle = fillColor
        ctx.fill()
      }
      if (strokeWidth && strokeWidth > 0 && strokeColor && strokeColor !== 'transparent') {
        ctx.lineWidth = strokeWidth
        ctx.strokeStyle = strokeColor
        ctx.stroke()
      }
    } else if (layer.kind === 'image' && layer.imageProps?.src) {
      try {
        const img = await loadImageElement(layer.imageProps.src)
        const radius = layer.imageProps.borderRadius || 0
        if (radius > 0) {
          drawRoundedRect(ctx, 0, 0, width, height, radius)
          ctx.clip()
        }
        if (layer.imageProps.shadowEnabled) {
          ctx.shadowColor = layer.imageProps.shadowColor || 'rgba(0,0,0,0.5)'
          ctx.shadowBlur = layer.imageProps.shadowBlur || 12
          ctx.shadowOffsetX = 0
          ctx.shadowOffsetY = 4
        }
        ctx.drawImage(img, 0, 0, width, height)
      } catch (err) {
        console.warn(`[exportUtils] No se pudo cargar la imagen de la capa "${layer.name}":`, err)
      }
    } else if (layer.kind === 'text' && layer.textProps) {
      const tp = layer.textProps
      const fontStyle = tp.fontStyle
      const fontWeight = tp.fontWeight
      const fontSize = tp.fontSize
      const fontFamily = tp.fontFamily || 'Montserrat, sans-serif'
      ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`
      ctx.textBaseline = 'top'

      const rawText = tp.uppercase ? tp.text.toUpperCase() : tp.text
      const lines = wrapTextLines(ctx, rawText, width)
      const lineHeightPx = fontSize * (tp.lineHeight || 1.25)
      const totalTextHeight = lines.length * lineHeightPx

      // Fondo del bloque de texto (caja decorativa de realce)
      if (tp.bgBoxEnabled) {
        const pad = tp.bgBoxPadding || 12
        const rad = tp.bgBoxRadius || 8
        ctx.save()
        ctx.fillStyle = tp.bgBoxColor || 'rgba(0,0,0,0.65)'
        drawRoundedRect(ctx, -pad, -pad, width + pad * 2, totalTextHeight + pad * 2, rad)
        ctx.fill()
        ctx.restore()
      }

      // Sombra
      if (tp.shadowEnabled) {
        ctx.shadowColor = tp.shadowColor || 'rgba(0,0,0,0.85)'
        ctx.shadowBlur = tp.shadowBlur || 10
        ctx.shadowOffsetX = tp.shadowOffsetX || 2
        ctx.shadowOffsetY = tp.shadowOffsetY || 3
      } else {
        ctx.shadowColor = 'transparent'
      }

      // Alineación horizontal
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? ''
        const lineY = i * lineHeightPx
        let lineX = 0

        const metrics = ctx.measureText(line)
        if (tp.textAlign === 'center') {
          lineX = Math.max(0, (width - metrics.width) / 2)
        } else if (tp.textAlign === 'right') {
          lineX = Math.max(0, width - metrics.width)
        }

        // Contorno
        if (tp.strokeEnabled && tp.strokeWidth > 0) {
          ctx.strokeStyle = tp.strokeColor || '#000000'
          ctx.lineWidth = tp.strokeWidth
          ctx.strokeText(line, lineX, lineY)
        }

        // Relleno
        ctx.fillStyle = tp.color || '#ffffff'
        ctx.fillText(line, lineX, lineY)
      }
    }

    ctx.restore()
  }

  return canvas
}

/**
 * Exporta el diseño a Data URL en formato PNG, JPEG o WebP.
 */
export async function exportProjectToDataUrl(
  project: GraphicDesignProject,
  format: 'png' | 'jpeg' | 'webp' = 'png',
  quality = 0.95
): Promise<string> {
  const canvas = await renderProjectToCanvas(project)
  const mimeType = format === 'png' ? 'image/png' : format === 'jpeg' ? 'image/jpeg' : 'image/webp'
  return canvas.toDataURL(mimeType, quality)
}

/**
 * Descarga una Data URL directamente en el navegador del usuario como archivo local.
 */
export function downloadDataUrl(dataUrl: string, filename: string): void {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

/**
 * Guarda el proyecto serializado en formato .lumen-design (JSON).
 */
export function exportProjectFile(project: GraphicDesignProject): void {
  const jsonStr = JSON.stringify(project, null, 2)
  const blob = new Blob([jsonStr], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const filename = `${project.name.toLowerCase().replace(/[^a-z0-9_-]/g, '_') || 'diseno'}.lumen-design`
  downloadDataUrl(url, filename)
  URL.revokeObjectURL(url)
}

/**
 * Parsea y normaliza un archivo de proyecto JSON .lumen-design.
 */
export function parseProjectFile(jsonContent: string): GraphicDesignProject {
  const parsed: unknown = JSON.parse(jsonContent)
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('El archivo no contiene un objeto de diseño válido.')
  }
  const projectObj = parsed as Record<string, unknown>

  const width = typeof projectObj['width'] === 'number' && projectObj['width'] >= 200 ? projectObj['width'] : 1080
  const height = typeof projectObj['height'] === 'number' && projectObj['height'] >= 200 ? projectObj['height'] : 1080
  const name =
    typeof projectObj['name'] === 'string' && projectObj['name'].trim()
      ? projectObj['name'].trim()
      : 'Diseño Sin Título'
  const layers: GraphicLayer[] = Array.isArray(projectObj['layers'])
    ? (projectObj['layers'] as GraphicLayer[])
    : []

  const result: GraphicDesignProject = {
    version: 1,
    id: typeof projectObj['id'] === 'string' ? projectObj['id'] : `proj-${Date.now()}`,
    name,
    createdAt: typeof projectObj['createdAt'] === 'string' ? projectObj['createdAt'] : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    width,
    height,
    backgroundColor: typeof projectObj['backgroundColor'] === 'string' ? projectObj['backgroundColor'] : '#090d16',
    layers
  }
  if (typeof projectObj['backgroundGradient'] === 'string') {
    result.backgroundGradient = projectObj['backgroundGradient']
  }
  if (typeof projectObj['backgroundImage'] === 'string') {
    result.backgroundImage = projectObj['backgroundImage']
  }
  if (
    projectObj['backgroundImageFit'] === 'cover' ||
    projectObj['backgroundImageFit'] === 'contain' ||
    projectObj['backgroundImageFit'] === 'fill'
  ) {
    result.backgroundImageFit = projectObj['backgroundImageFit']
  }
  return result
}
