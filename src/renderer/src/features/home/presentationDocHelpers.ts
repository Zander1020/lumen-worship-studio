import * as pdfjsLib from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import JSZip from 'jszip'
import type { PresentationSlide } from '../../../../shared/models'

// Configurar worker de pdfjs en entorno web/renderer
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker
}

export interface ExtractedSlideItem {
  pageNumber: number
  imageUrl: string
  title: string
}

export interface ParsedDocumentDeck {
  title: string
  slides: PresentationSlide[]
}

/**
 * Convierte un archivo PDF a diapositivas proyectables HD en formato imagen de alta resoluciÃ³n.
 */
export async function convertPdfToSlides(
  fileOrBuffer: File | ArrayBuffer | Uint8Array,
  fileName: string
): Promise<ParsedDocumentDeck> {
  const baseName = fileName.replace(/\.[^/.]+$/, '')
  let data: ArrayBuffer | Uint8Array
  if (fileOrBuffer instanceof File) {
    data = await fileOrBuffer.arrayBuffer()
  } else {
    data = fileOrBuffer
  }

  const loadingTask = pdfjsLib.getDocument({
    data,
    useSystemFonts: true,
    isEvalSupported: false
  })

  const pdf = await loadingTask.promise
  const slides: PresentationSlide[] = []

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    // Escala para resoluciÃ³n Full HD nÃ­tida
    const viewport = page.getViewport({ scale: 2.0 })

    let dataUrl: string | undefined = undefined
    if (typeof document !== 'undefined') {
      try {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (ctx) {
          canvas.width = viewport.width
          canvas.height = viewport.height

          await page.render({
            canvasContext: ctx,
            viewport
          }).promise

          dataUrl = canvas.toDataURL('image/jpeg', 0.92)
        }
      } catch (renderErr) {
        console.warn('[PDF] Error al renderizar lienzo de pÃ¡gina:', renderErr)
      }
    }

    slides.push({
      id: `pdf-${Date.now()}-${pageNum}`,
      sourceKind: 'custom',
      sourceTitle: baseName,
      label: `PÃ¡gina ${pageNum}`,
      lines: [],
      footer: `${baseName} Â· PÃ¡g. ${pageNum} de ${pdf.numPages}`,
      ...(dataUrl ? { imageUrl: dataUrl, mediaKind: 'image' } : { mediaKind: 'image' })
    })
  }

  return {
    title: baseName,
    slides
  }
}

/**
 * FunciÃ³n auxiliar para dividir lÃ­neas de texto largas en mÃºltiples renglones
 * que quepan cÃ³modamente en el lienzo Canvas sin deformar la tipografÃ­a.
 */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  if (!text) return []
  if (ctx.measureText(text).width <= maxWidth) return [text]

  const words = text.split(/\s+/)
  const result: string[] = []
  let current = ''

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (ctx.measureText(candidate).width > maxWidth && current) {
      result.push(current)
      current = word
    } else {
      current = candidate
    }
  }
  if (current) result.push(current)
  return result
}

/**
 * Busca un archivo dentro del ZIP de forma tolerante a mayÃºsculas/minÃºsculas y barras invertidas.
 */
function findZipFileCaseInsensitive(zip: JSZip, targetPath: string): JSZip.JSZipObject | null {
  const cleanTarget = targetPath.replace(/^(\.\.[/\\])+/, '').replace(/^\/+/, '')
  const exact = zip.file(cleanTarget)
  if (exact) return exact
  const normalized = cleanTarget.toLowerCase().replace(/\\/g, '/')
  for (const [path, obj] of Object.entries(zip.files)) {
    const cleanPath = path.replace(/^\/+/, '').toLowerCase().replace(/\\/g, '/')
    if (cleanPath === normalized) {
      return obj
    }
  }
  return null
}

/**
 * Extractor de respaldo para archivos PowerPoint binarios (.ppt de PowerPoint 97-2003).
 */
function extractFallbackFromBinaryPpt(
  data: ArrayBuffer | Uint8Array,
  baseName: string
): ParsedDocumentDeck {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  const extractedStrings: string[] = []

  let currentUtf16 = ''
  for (let i = 0; i < bytes.length - 1; i += 2) {
    const b0 = bytes[i] ?? 0
    const b1 = bytes[i + 1] ?? 0
    const code = b0 | (b1 << 8)
    if ((code >= 32 && code <= 126) || (code >= 160 && code <= 65533)) {
      currentUtf16 += String.fromCharCode(code)
    } else {
      if (currentUtf16.trim().length >= 4) {
        extractedStrings.push(currentUtf16.trim())
      }
      currentUtf16 = ''
    }
  }
  if (currentUtf16.trim().length >= 4) {
    extractedStrings.push(currentUtf16.trim())
  }

  const ignored = /^(Calibri|Arial|Times|Verdana|Segoe|Tahoma|Wingdings|Symbol|Microsoft|Current User|PowerPoint Document|SummaryInformation|DocumentSummaryInformation|Default Design|_PID_)/i
  const validLines = extractedStrings
    .map((s) => s.trim())
    .filter((s) => s.length >= 4 && !ignored.test(s) && /[a-zA-ZÃ¡Ã©Ã­Ã³ÃºÃÃ‰ÃÃ“ÃšÃ±Ã‘]/.test(s))

  const slides: PresentationSlide[] = []
  if (validLines.length > 0) {
    const chunkSize = 5
    let slideIndex = 1
    for (let i = 0; i < validLines.length; i += chunkSize) {
      const chunk = validLines.slice(i, i + chunkSize)
      slides.push({
        id: `ppt-${Date.now()}-${slideIndex}`,
        sourceKind: 'custom',
        sourceTitle: baseName,
        label: `Diapositiva ${slideIndex}`,
        lines: chunk,
        footer: `${baseName} Â· Diapositiva ${slideIndex}`
      })
      slideIndex++
    }
  }

  if (slides.length === 0) {
    slides.push({
      id: `ppt-${Date.now()}-1`,
      sourceKind: 'custom',
      sourceTitle: baseName,
      label: 'Diapositiva 1',
      lines: [
        baseName,
        'PresentaciÃ³n PowerPoint (.ppt binario)',
        'Para una experiencia visual idÃ©ntica con fondos y fuentes de PowerPoint,',
        'guarda el archivo en PowerPoint como .pptx o .pdf y cÃ¡rgalo de nuevo.'
      ],
      footer: `${baseName} Â· PresentaciÃ³n`
    })
  }

  return {
    title: baseName,
    slides
  }
}

/**
 * Extrae texto de un fragmento XML de PowerPoint usando mÃºltiples mÃ©todos tolerantes a namespaces.
 */
function extractLinesFromOpenXml(xmlText: string): string[] {
  const lines: string[] = []

  // Normalizar saltos de lÃ­nea explÃ­citos dentro de pÃ¡rrafos <a:br/>
  const normalizedXml = xmlText.replace(/<[^:>]*:?br\b[^>]*\/?>/gi, '\n')

  // 1. Intento por DOMParser
  if (typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser()
      const doc = parser.parseFromString(normalizedXml, 'application/xml')
      const allEls = Array.from(doc.querySelectorAll('*'))
      const paragraphs = allEls.filter(
        (el) => el.localName === 'p' || el.tagName.toLowerCase().endsWith(':p')
      )
      for (const p of paragraphs) {
        const pChildren = Array.from(p.querySelectorAll('*'))
        const textNodes = pChildren.filter(
          (el) => el.localName === 't' || el.tagName.toLowerCase().endsWith(':t')
        )
        const pText = textNodes
          .map((n) => n.textContent || '')
          .join('')
          .trim()
        if (pText) {
          const splitLines = pText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
          lines.push(...splitLines)
        }
      }
    } catch {
      // Ignorar fallo y continuar con regex
    }
  }

  // 2. ExtracciÃ³n por Regex (100% inmune a namespaces XML complejos o malformados)
  if (lines.length === 0) {
    const pMatches = Array.from(normalizedXml.matchAll(/<[^:>]*:?p[\s>]([\s\S]*?)<\/[^:>]*:?p>/gi))
    for (const pm of pMatches) {
      const pInner = pm[1] ?? ''
      const tMatches = Array.from(pInner.matchAll(/<[^:>]*:?t[^>]*>([\s\S]*?)<\/[^:>]*:?t>/gi))
      const text = tMatches
        .map((m) =>
          (m[1] ?? '')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'")
        )
        .join('')
        .trim()
      if (text) {
        const splitLines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
        lines.push(...splitLines)
      }
    }
  }

  // 3. Respaldo directo si no se detectaron etiquetas <p>
  if (lines.length === 0) {
    const directMatches = Array.from(normalizedXml.matchAll(/<[^:>]*:?t[^>]*>([\s\S]*?)<\/[^:>]*:?t>/gi))
    for (const dm of directMatches) {
      const text = (dm[1] ?? '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .trim()
      if (text) {
        const splitLines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
        lines.push(...splitLines)
      }
    }
  }

  return lines
}

/**
 * Renderiza una diapositiva de PowerPoint a una imagen Full HD (1920x1080).
 * Si tiene imagen embebida, la usa como FONDO REAL cubriendo todo el lienzo,
 * y superpone el texto encima con sombra para legibilidad.
 * Si solo tiene texto, muestra el texto sobre fondo oscuro neutro.
 */
async function renderPptxSlideToHdCanvas(
  title: string,
  lines: string[],
  imageSrc?: string,
  slideIndex = 1,
  totalSlides = 1
): Promise<string | undefined> {
  if (typeof document === 'undefined') {
    return imageSrc
  }

  try {
    const canvas = document.createElement('canvas')
    canvas.width = 1920
    canvas.height = 1080
    const ctx = canvas.getContext('2d')
    if (!ctx) return imageSrc

    // Cargar la imagen incrustada si existe
    let loadedImg: HTMLImageElement | null = null
    if (imageSrc) {
      try {
        loadedImg = await new Promise<HTMLImageElement | null>((resolve) => {
          const img = new Image()
          img.crossOrigin = 'anonymous'
          img.onload = () => resolve(img)
          img.onerror = () => resolve(null)
          img.src = imageSrc
        })
      } catch {
        loadedImg = null
      }
    }

    if (loadedImg) {
      // CASO 1 y 2: Hay imagen â†’ usarla como FONDO REAL que llena el canvas completo
      // Escalar "cover" (recortar para llenar sin distorsiÃ³n)
      const imgAspect = loadedImg.width / loadedImg.height
      const canvasAspect = 1920 / 1080
      let dw: number, dh: number, dx: number, dy: number
      if (imgAspect > canvasAspect) {
        // Imagen mÃ¡s ancha que el canvas â†’ ajustar por altura, centrar horizontalmente
        dh = 1080
        dw = 1080 * imgAspect
        dx = (1920 - dw) / 2
        dy = 0
      } else {
        // Imagen mÃ¡s alta â†’ ajustar por anchura, centrar verticalmente
        dw = 1920
        dh = 1920 / imgAspect
        dx = 0
        dy = (1080 - dh) / 2
      }
      ctx.drawImage(loadedImg, dx, dy, dw, dh)

      // Superponer texto si existe (con fondo semitransparente para legibilidad)
      if (lines.length > 0) {
        // Franja inferior semitransparente para el texto
        const gradOverlay = ctx.createLinearGradient(0, 580, 0, 1080)
        gradOverlay.addColorStop(0, 'rgba(0,0,0,0)')
        gradOverlay.addColorStop(0.4, 'rgba(0,0,0,0.65)')
        gradOverlay.addColorStop(1, 'rgba(0,0,0,0.88)')
        ctx.fillStyle = gradOverlay
        ctx.fillRect(0, 580, 1920, 500)

        // Texto sobre la imagen
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 52px system-ui, -apple-system, sans-serif'
        ctx.textBaseline = 'top'
        ctx.shadowColor = 'rgba(0,0,0,0.95)'
        ctx.shadowBlur = 20
        const titleLine = lines[0] ?? title
        const titleWrapped = wrapText(ctx, titleLine, 1680)
        let textY = 620
        for (const tl of titleWrapped.slice(0, 2)) {
          ctx.fillText(tl, 120, textY, 1680)
          textY += 64
        }
        ctx.shadowBlur = 8
        ctx.fillStyle = '#f1f5f9'
        ctx.font = '36px system-ui, -apple-system, sans-serif'
        textY = Math.max(textY + 10, 720)
        for (let i = 1; i < Math.min(lines.length, 6); i++) {
          const wrapped = wrapText(ctx, lines[i] ?? '', 1680)
          for (const wl of wrapped) {
            if (textY > 1020) break
            ctx.fillText(wl, 120, textY, 1680)
            textY += 52
          }
          if (textY > 1020) break
        }
        ctx.shadowBlur = 0
      }
    } else {
      // CASO 3: Solo texto â†’ fondo oscuro neutro + texto claro y legible
      const bgGrad = ctx.createLinearGradient(0, 0, 0, 1080)
      bgGrad.addColorStop(0, '#1a1f2e')
      bgGrad.addColorStop(1, '#0d1117')
      ctx.fillStyle = bgGrad
      ctx.fillRect(0, 0, 1920, 1080)

      if (lines.length > 0) {
        if (lines.length <= 3) {
          // Pocas lÃ­neas (tÃ­tulo o anuncio corto): Centrado cinematogrÃ¡fico
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillStyle = '#38bdf8'
          ctx.font = 'bold 30px system-ui, -apple-system, sans-serif'
          ctx.fillText(title.toUpperCase(), 960, 360)

          ctx.fillStyle = '#ffffff'
          ctx.font = 'bold 64px system-ui, -apple-system, sans-serif'
          ctx.shadowColor = 'rgba(0,0,0,0.85)'
          ctx.shadowBlur = 20
          const allLinesWrapped: string[] = []
          for (const l of lines) {
            allLinesWrapped.push(...wrapText(ctx, l, 1600))
          }
          let startY = 540 - ((allLinesWrapped.length - 1) * 44)
          for (const wl of allLinesWrapped.slice(0, 4)) {
            ctx.fillText(wl, 960, startY, 1600)
            startY += 88
          }
          ctx.shadowBlur = 0
          ctx.textAlign = 'left'
          ctx.textBaseline = 'top'
        } else {
          // Barra de acento decorativa
          ctx.fillStyle = '#3b82f6'
          ctx.fillRect(100, 120, 6, 72)

          ctx.fillStyle = '#f8fafc'
          ctx.font = 'bold 54px system-ui, -apple-system, sans-serif'
          ctx.textBaseline = 'top'
          ctx.shadowColor = 'rgba(0,0,0,0.8)'
          ctx.shadowBlur = 16
          const titleLine = lines[0] ?? title
          const titleWrapped = wrapText(ctx, titleLine, 1680)
          let titleY = 126
          for (const tl of titleWrapped.slice(0, 2)) {
            ctx.fillText(tl, 130, titleY, 1680)
            titleY += 65
          }
          ctx.shadowBlur = 0

          ctx.fillStyle = '#cbd5e1'
          ctx.font = '38px system-ui, -apple-system, sans-serif'
          let textY = Math.max(titleY + 30, 260)
          const restLines = lines.slice(1)
          for (let i = 0; i < restLines.length; i++) {
            const wrapped = wrapText(ctx, restLines[i] ?? '', 1680)
            for (const wl of wrapped) {
              if (textY > 990) break
              ctx.fillText(wl, 130, textY, 1680)
              textY += 56
            }
            if (textY > 990) break
          }
        }
      } else {
        // Diapositiva vacÃ­a â€” mostrar tÃ­tulo del documento
        ctx.fillStyle = '#64748b'
        ctx.font = 'bold 40px system-ui, -apple-system, sans-serif'
        ctx.textBaseline = 'middle'
        ctx.textAlign = 'center'
        ctx.fillText(title, 960, 540)
        ctx.textAlign = 'left'
        ctx.textBaseline = 'top'
      }

      // Pie de pÃ¡gina sutil
      ctx.strokeStyle = 'rgba(255,255,255,0.1)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(100, 1018)
      ctx.lineTo(1820, 1018)
      ctx.stroke()
      ctx.fillStyle = '#475569'
      ctx.font = '22px system-ui, -apple-system, sans-serif'
      ctx.fillText(`${title}  Â·  Diapositiva ${slideIndex} de ${totalSlides}`, 100, 1028)
    }

    return canvas.toDataURL('image/jpeg', 0.93)
  } catch (err) {
    console.warn('[PPTX] Error al generar lienzo HD para lÃ¡mina:', err)
    return imageSrc
  }
}

/**
 * Extrae y parsea diapositivas de una presentaciÃ³n PowerPoint (.pptx).
 * Un archivo .pptx es un paquete ZIP con especificaciÃ³n OpenXML.
 * Compatible con cualquier presentaciÃ³n creada en PowerPoint (2007-365), Google Slides, LibreOffice o Keynote.
 */
export async function convertPptxToSlides(
  fileOrBuffer: File | ArrayBuffer | Uint8Array,
  fileName: string
): Promise<ParsedDocumentDeck> {
  const baseName = fileName.replace(/\.[^/.]+$/, '')
  let data: ArrayBuffer | Uint8Array
  if (fileOrBuffer instanceof File) {
    data = await fileOrBuffer.arrayBuffer()
  } else {
    data = fileOrBuffer
  }

  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(data)
  } catch (zipErr) {
    console.warn('[PPTX] No es un paquete ZIP OpenXML estÃ¡ndar (posible formato binario .ppt o protegido):', zipErr)
    return extractFallbackFromBinaryPpt(data, baseName)
  }
  const slides: PresentationSlide[] = []

  // 1. Determinar el orden exacto de diapositivas mediante ppt/presentation.xml o escaneo directo
  let orderedSlidePaths: string[] = []

  try {
    const presXml = await (findZipFileCaseInsensitive(zip, 'ppt/presentation.xml')?.async('text') ?? Promise.resolve(null))
    const presRelsXml = await (findZipFileCaseInsensitive(zip, 'ppt/_rels/presentation.xml.rels')?.async('text') ?? Promise.resolve(null))

    if (presXml && presRelsXml) {
      // Mapear relaciÃ³n rId -> ruta de slide
      const relMap = new Map<string, string>()
      const relMatches = Array.from(
        presRelsXml.matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/gi)
      )
      for (const rm of relMatches) {
        relMap.set(rm[1] ?? '', rm[2] ?? '')
      }

      const sldIdMatches = Array.from(presXml.matchAll(/r:id="([^"]+)"/gi))
      for (const sm of sldIdMatches) {
        const target = relMap.get(sm[1] ?? '')
        if (target) {
          const cleanTarget = target.replace(/^\.\.\//, '').replace(/^\//, '')
          const fullPath = cleanTarget.startsWith('ppt/') ? cleanTarget : `ppt/${cleanTarget}`
          if (findZipFileCaseInsensitive(zip, fullPath)) {
            orderedSlidePaths.push(fullPath)
          }
        }
      }
    }
  } catch {
    // Si falla la lectura de presentation.xml, continuar con escaneo
  }

  // 2. Si no se pudo obtener el orden por presentation.xml, escanear todos los ppt/slides/slide*.xml
  if (orderedSlidePaths.length === 0) {
    const slideEntries: { index: number; path: string }[] = []
    zip.forEach((relativePath) => {
      const match = /(?:^|\/)ppt\/slides\/slide(\d+)\.xml$/i.exec(relativePath)
      if (match) {
        slideEntries.push({ index: parseInt(match[1] ?? '0', 10), path: relativePath })
      }
    })
    slideEntries.sort((a, b) => a.index - b.index)
    orderedSlidePaths = slideEntries.map((e) => e.path)
  }

  const totalSlides = orderedSlidePaths.length

  for (let idx = 0; idx < orderedSlidePaths.length; idx++) {
    const slidePath = orderedSlidePaths[idx] ?? ''
    const slideFile = findZipFileCaseInsensitive(zip, slidePath)
    const slideXmlText = await slideFile?.async('text')
    if (!slideXmlText) continue

    // Extraer texto
    const lines = extractLinesFromOpenXml(slideXmlText)

    // Extraer imagen(es) si existe en relaciones _rels/slideX.xml.rels
    // Prioridad: imagen de mayor resoluciÃ³n (la que tenga mayor Ã­ndice suele ser la principal)
    let embeddedImageUrl: string | undefined = undefined
    const relsPath = slidePath.replace(/(?:^|\/)slide(\d+)\.xml$/i, '/_rels/slide$1.xml.rels')
    const relsFile = findZipFileCaseInsensitive(zip, relsPath)
    const relsXml = await relsFile?.async('text')
    if (relsXml) {
      const imageRels = Array.from(
        relsXml.matchAll(/Type="[^"]*\/image"[^>]*Target="([^"]+)"/gi)
      )
      // Recolectar todas las imÃ¡genes disponibles para elegir la mÃ¡s grande
      const candidateImages: Array<{ url: string; size: number }> = []
      for (const ir of imageRels) {
        let rawTarget = ir[1] ?? ''
        try { rawTarget = decodeURIComponent(rawTarget) } catch { /* mantener */ }
        let mediaPath = rawTarget.replace(/^\.\.\//, '').replace(/^\//, '')
        if (!mediaPath.startsWith('ppt/')) mediaPath = `ppt/${mediaPath}`
        // Ignorar EMF/WMF (metaarchivos vectoriales) â€” no son imÃ¡genes rasterizadas
        const ext = mediaPath.split('.').pop()?.toLowerCase() ?? ''
        if (['emf', 'wmf', 'bin'].includes(ext)) continue
        const imgZip = findZipFileCaseInsensitive(zip, mediaPath)
        if (imgZip) {
          const imgData = await imgZip.async('base64')
          const mime =
            ext === 'jpg' || ext === 'jpeg'
              ? 'image/jpeg'
              : ext === 'webp'
                ? 'image/webp'
                : ext === 'gif'
                  ? 'image/gif'
                  : 'image/png'
          candidateImages.push({ url: `data:${mime};base64,${imgData}`, size: imgData.length })
        }
      }
      if (candidateImages.length > 0) {
        // Elegir la imagen de mayor tamaÃ±o (generalmente la imagen principal)
        candidateImages.sort((a, b) => b.size - a.size)
        embeddedImageUrl = candidateImages[0]?.url
      } else {
        // Si la diapositiva no tiene imagen directa, buscar si el slideLayout tiene fondo
        const layoutMatch = relsXml.match(/Type="[^"]*\/slideLayout"[^>]*Target="([^"]+)"/i)
        if (layoutMatch) {
          const layoutTarget = (layoutMatch[1] ?? '').replace(/^(\.\.[/\\])+/, '').replace(/^\/+/, '')
          const cleanLayoutPath = layoutTarget.startsWith('ppt/') ? layoutTarget : `ppt/${layoutTarget}`
          const layoutRelsPath = cleanLayoutPath.replace(/(?:^|\/)slideLayout(\d+)\.xml$/i, '/_rels/slideLayout$1.xml.rels')
          const layoutRelsFile = findZipFileCaseInsensitive(zip, layoutRelsPath)
          const layoutRelsXml = await layoutRelsFile?.async('text')
          if (layoutRelsXml) {
            const layoutImageRels = Array.from(
              layoutRelsXml.matchAll(/Type="[^"]*\/image"[^>]*Target="([^"]+)"/gi)
            )
            for (const ir of layoutImageRels) {
              let rawTarget = ir[1] ?? ''
              try { rawTarget = decodeURIComponent(rawTarget) } catch { /* mantener */ }
              let mediaPath = rawTarget.replace(/^(\.\.[/\\])+/, '').replace(/^\/+/, '')
              if (!mediaPath.startsWith('ppt/')) mediaPath = `ppt/${mediaPath}`
              const ext = mediaPath.split('.').pop()?.toLowerCase() ?? ''
              if (['emf', 'wmf', 'bin'].includes(ext)) continue
              const imgZip = findZipFileCaseInsensitive(zip, mediaPath)
              if (imgZip) {
                const imgData = await imgZip.async('base64')
                const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : ext === 'gif' ? 'image/gif' : 'image/png'
                embeddedImageUrl = `data:${mime};base64,${imgData}`
                break
              }
            }
          }
        }
      }
    }

    // Respaldo global si no se encontrÃ³ imagen: buscar en ppt/media/
    if (!embeddedImageUrl) {
      const mediaImages: string[] = []
      zip.forEach((path) => {
        if (/^ppt\/media\/[^/]+\.(png|jpe?g|webp)$/i.test(path)) {
          mediaImages.push(path)
        }
      })
      if (mediaImages.length === 1 && mediaImages[0]) {
        const imgZip = zip.file(mediaImages[0])
        if (imgZip) {
          const imgData = await imgZip.async('base64')
          const ext = mediaImages[0].split('.').pop()?.toLowerCase() ?? ''
          const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png'
          embeddedImageUrl = `data:${mime};base64,${imgData}`
        }
      } else if (mediaImages.length > 1) {
        const indexedMatch = mediaImages.find((p) => new RegExp(`image${idx + 1}\\.`, 'i').test(p))
        const targetImgPath = indexedMatch || mediaImages[idx % mediaImages.length]
        if (targetImgPath) {
          const imgZip = zip.file(targetImgPath)
          if (imgZip) {
            const imgData = await imgZip.async('base64')
            const ext = targetImgPath.split('.').pop()?.toLowerCase() ?? ''
            const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png'
            embeddedImageUrl = `data:${mime};base64,${imgData}`
          }
        }
      }
    }

    const slideNum = idx + 1

    // Generar renderizado HD visual para la lÃ¡mina
    const hdImageUrl = await renderPptxSlideToHdCanvas(
      baseName,
      lines,
      embeddedImageUrl,
      slideNum,
      totalSlides
    )

    slides.push({
      id: `pptx-${Date.now()}-${slideNum}`,
      sourceKind: 'custom',
      sourceTitle: baseName,
      label: `Diapositiva ${slideNum}`,
      lines: lines.slice(0, 10),
      footer: `${baseName} Â· Diapositiva ${slideNum} de ${totalSlides}`,
      ...(hdImageUrl ? { imageUrl: hdImageUrl, mediaKind: 'image' } : {})
    })
  }

  // Si no se encontraron diapositivas XML o viene protegido, generar lÃ¡mina de presentaciÃ³n
  if (slides.length === 0) {
    const coverUrl = await renderPptxSlideToHdCanvas(
      baseName,
      [baseName, 'PresentaciÃ³n de Diapositivas'],
      undefined,
      1,
      1
    )
    slides.push({
      id: `pptx-${Date.now()}-1`,
      sourceKind: 'custom',
      sourceTitle: baseName,
      label: 'Diapositiva 1',
      lines: [baseName],
      footer: `${baseName} Â· PresentaciÃ³n`,
      ...(coverUrl ? { imageUrl: coverUrl, mediaKind: 'image' } : { mediaKind: 'image' })
    })
  }

  return {
    title: baseName,
    slides
  }
}
