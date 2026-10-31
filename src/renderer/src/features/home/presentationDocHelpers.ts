import * as pdfjsLib from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import JSZip from 'jszip'
import type { PresentationSlide } from '../../../../shared/models'

// Configurar worker de pdfjs en entorno web/renderer
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
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
 * Convierte un archivo PDF a diapositivas proyectables HD en formato imagen de alta resolución.
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
    // Escala para resolución Full HD nítida
    const viewport = page.getViewport({ scale: 2.0 })

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) continue

    canvas.width = viewport.width
    canvas.height = viewport.height

    await page.render({
      canvasContext: ctx,
      viewport
    }).promise

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)

    slides.push({
      id: `pdf-${Date.now()}-${pageNum}`,
      sourceKind: 'custom',
      sourceTitle: baseName,
      label: `Página ${pageNum}`,
      lines: [],
      footer: `${baseName} · Pág. ${pageNum} de ${pdf.numPages}`,
      imageUrl: dataUrl,
      mediaKind: 'image'
    })
  }

  return {
    title: baseName,
    slides
  }
}

/**
 * Extrae y parsea diapositivas de una presentación PowerPoint (.pptx).
 * Un archivo .pptx es un paquete ZIP con especificación OpenXML.
 * Extrae texto, títulos y las imágenes/gráficos de cada lámina.
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

  const zip = await JSZip.loadAsync(data)
  const slides: PresentationSlide[] = []

  // Buscar archivos de diapositivas ppt/slides/slide1.xml, slide2.xml...
  const slideEntries: { index: number; path: string }[] = []
  zip.forEach((relativePath) => {
    const match = /^ppt\/slides\/slide(\d+)\.xml$/i.exec(relativePath)
    if (match) {
      slideEntries.push({ index: parseInt(match[1] ?? '0', 10), path: relativePath })
    }
  })

  // Ordenar por número de diapositiva
  slideEntries.sort((a, b) => a.index - b.index)

  const parser = new DOMParser()

  for (const entry of slideEntries) {
    const slideXmlText = await zip.file(entry.path)?.async('text')
    if (!slideXmlText) continue

    const doc = parser.parseFromString(slideXmlText, 'application/xml')

    // Extraer todos los párrafos de texto de la diapositiva (<a:p>)
    const paragraphs = Array.from(doc.getElementsByTagName('a:p')) as Element[]
    const lines: string[] = []

    for (const p of paragraphs) {
      const textRuns = Array.from(p.getElementsByTagName('a:t')) as Element[]
      const paragraphText = textRuns
        .map((t) => t.textContent || '')
        .join('')
        .trim()
      if (paragraphText) {
        lines.push(paragraphText)
      }
    }

    // Verificar si la diapositiva tiene imágenes incrustadas buscando relaciones en ppt/slides/_rels/slideX.xml.rels
    let embeddedImageUrl: string | undefined = undefined
    const relsPath = `ppt/slides/_rels/slide${entry.index}.xml.rels`
    const relsXml = await zip.file(relsPath)?.async('text')
    if (relsXml) {
      const relsDoc = parser.parseFromString(relsXml, 'application/xml')
      const relationships = Array.from(relsDoc.getElementsByTagName('Relationship')) as Element[]
      for (const rel of relationships) {
        const type = rel.getAttribute('Type') || ''
        const target = rel.getAttribute('Target') || ''
        if (type.includes('/image') && target) {
          // Ruta de la imagen, típicamente ../media/image1.png
          const mediaPath = target.replace(/^\.\.\//, 'ppt/')
          const imgZip = zip.file(mediaPath)
          if (imgZip) {
            const imgData = await imgZip.async('base64')
            const ext = mediaPath.split('.').pop()?.toLowerCase() || 'png'
            const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`
            embeddedImageUrl = `data:${mime};base64,${imgData}`
            break
          }
        }
      }
    }

    const slideNum = entry.index

    slides.push({
      id: `pptx-${Date.now()}-${slideNum}`,
      sourceKind: 'custom',
      sourceTitle: baseName,
      label: `Diapositiva ${slideNum}`,
      lines: lines.slice(0, 10),
      footer: `${baseName} · Diapositiva ${slideNum} de ${slideEntries.length}`,
      ...(embeddedImageUrl ? { imageUrl: embeddedImageUrl, mediaKind: 'image' } : {})
    })
  }

  // Si no se encontraron diapositivas XML o el PPTX viene protegido, generar al menos la carátula
  if (slides.length === 0) {
    slides.push({
      id: `pptx-${Date.now()}-1`,
      sourceKind: 'custom',
      sourceTitle: baseName,
      label: 'Diapositiva 1',
      lines: [baseName],
      footer: `${baseName} · Presentación`,
      mediaKind: 'image'
    })
  }

  return {
    title: baseName,
    slides
  }
}
