import type { Song, SongInput, SongStanza } from './models'
import { parseRawLyricsToStanzas } from './slideHelpers'

/**
 * Compatibilidad de importación y exportación con formatos de catálogo de Holyrics:
 * - JSON de Holyrics (canción individual, arreglo de canciones, o contenedor `{ songs | musicas | items }`)
 * - XML OpenLyrics / XML de Holyrics (`<song>`, `<songs>`, `<musicas>`)
 * - Texto plano `.txt` de Holyrics (una canción por archivo o catálogo separado por `===` / `---`)
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asString(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

function extractTags(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .map((item) => asString(item))
      .filter((t) => t.length > 0)
      .slice(0, 15)
  }
  if (typeof raw === 'string' && raw.trim().length > 0) {
    return raw
      .split(/[,;|]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0)
      .slice(0, 15)
  }
  return ['Holyrics']
}

function extractStanzasFromHolyricsRecord(rec: Record<string, unknown>): SongStanza[] {
  // Caso 1: `stanzas` ya estructuradas
  const rawStanzas = rec['stanzas']
  if (Array.isArray(rawStanzas) && rawStanzas.length > 0) {
    const parsed: SongStanza[] = []
    rawStanzas.forEach((item, idx) => {
      if (isRecord(item)) {
        const label = asString(item['label'] ?? item['name'] ?? item['description']) || `Verso ${idx + 1}`
        const rawLines = item['lines']
        const text = asString(item['text'] ?? item['content'])
        const lines = Array.isArray(rawLines)
          ? rawLines.map((l) => asString(l)).filter((l) => l.length > 0)
          : text
              .split(/\r?\n/)
              .map((l) => l.trim())
              .filter((l) => l.length > 0)
        if (lines.length > 0) {
          parsed.push({
            id: `stanza-${idx + 1}`,
            label,
            kind: label.toLowerCase().includes('coro') ? 'chorus' : 'verse',
            lines
          })
        }
      }
    })
    if (parsed.length > 0) return parsed
  }

  // Caso 2: estructura nativa de Holyrics `lyrics: { paragraphs: [{ text, description }] }` o `slides` / `estrofes`
  const lyricsField = rec['lyrics'] ?? rec['letra']
  const paragraphsCandidate = isRecord(lyricsField)
    ? (lyricsField['paragraphs'] ?? lyricsField['slides'] ?? lyricsField['verses'])
    : (rec['paragraphs'] ?? rec['slides'] ?? rec['estrofes'])

  if (Array.isArray(paragraphsCandidate) && paragraphsCandidate.length > 0) {
    const parsed: SongStanza[] = []
    paragraphsCandidate.forEach((p, idx) => {
      if (typeof p === 'string') {
        const lines = p
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter((l) => l.length > 0)
        if (lines.length > 0) {
          parsed.push({
            id: `stanza-${idx + 1}`,
            label: `Verso ${idx + 1}`,
            kind: 'verse',
            lines
          })
        }
      } else if (isRecord(p)) {
        const label =
          asString(p['description'] ?? p['label'] ?? p['name'] ?? p['title'] ?? p['tag']) || `Verso ${idx + 1}`
        const text = asString(p['text'] ?? p['lyrics'] ?? p['content'] ?? p['lines'])
        const lines = text
          .split(/\r?\n|<br\s*\/?>/i)
          .map((l) => l.trim())
          .filter((l) => l.length > 0)
        if (lines.length > 0) {
          parsed.push({
            id: `stanza-${idx + 1}`,
            label,
            kind: label.toLowerCase().includes('coro') || label.toLowerCase().includes('refr') ? 'chorus' : 'verse',
            lines
          })
        }
      }
    })
    if (parsed.length > 0) return parsed
  }

  // Caso 3: texto plano en `lyrics`, `letra`, `text`, `body` o `content`
  const plainLyrics =
    typeof lyricsField === 'string'
      ? lyricsField
      : asString(rec['text'] ?? rec['letra'] ?? rec['body'] ?? rec['content'])

  if (plainLyrics) {
    return parseRawLyricsToStanzas(plainLyrics)
  }

  return []
}

function parseSingleHolyricsObject(rec: Record<string, unknown>, fallbackTitle?: string): SongInput | null {
  const title =
    asString(rec['title'] ?? rec['titulo'] ?? rec['nome'] ?? rec['name']) ||
    (fallbackTitle ? fallbackTitle.trim() : '')
  if (!title) return null

  const author = asString(rec['author'] ?? rec['artist'] ?? rec['autor'] ?? rec['artista'] ?? rec['composer'])
  const musicalKey = asString(rec['musicalKey'] ?? rec['key'] ?? rec['tom'] ?? rec['tonalidad'])
  const rawBpm = Number(rec['bpm'] ?? rec['tempo'])
  const bpm = Number.isFinite(rawBpm) && rawBpm >= 30 && rawBpm <= 260 ? Math.round(rawBpm) : null
  const tags = extractTags(rec['tags'] ?? rec['categorias'] ?? rec['categories'] ?? rec['theme'])
  const stanzas = extractStanzasFromHolyricsRecord(rec)
  if (stanzas.length === 0) return null

  return {
    title: title.slice(0, 160),
    author: author.slice(0, 160),
    musicalKey: musicalKey.slice(0, 20),
    bpm,
    tags,
    stanzas
  }
}

/** Parsea canciones en formato XML (OpenLyrics o XML de Holyrics). */
function parseHolyricsXmlSongs(xmlContent: string, fallbackTitle?: string): SongInput[] {
  const songs: SongInput[] = []
  const songBlocks = xmlContent.match(/<(?:song|musica)\b[\s\S]*?<\/(?:song|musica)>/gi) ?? [xmlContent]

  for (const block of songBlocks) {
    const titleMatch = /<(?:title|titulo|nome)\b[^>]*>([\s\S]*?)<\/(?:title|titulo|nome)>/i.exec(block)
    const authorMatch = /<(?:author|artist|autor|artista)\b[^>]*>([\s\S]*?)<\/(?:author|artist|autor|artista)>/i.exec(
      block
    )
    const keyMatch = /<(?:key|tom|tonalidad)\b[^>]*>([\s\S]*?)<\/(?:key|tom|tonalidad)>/i.exec(block)

    const title = decodeXmlEntities((titleMatch?.[1] ?? fallbackTitle ?? '').trim())
    if (!title) continue
    const author = decodeXmlEntities((authorMatch?.[1] ?? '').trim())
    const musicalKey = decodeXmlEntities((keyMatch?.[1] ?? '').trim())

    const verseRegex = /<(?:verse|slide|estrofe|paragraph)\b([^>]*)>([\s\S]*?)<\/(?:verse|slide|estrofe|paragraph)>/gi
    const stanzas: SongStanza[] = []
    let match: RegExpExecArray | null
    let idx = 0
    while ((match = verseRegex.exec(block)) !== null) {
      idx += 1
      const attrs = match[1] ?? ''
      const inner = match[2] ?? ''
      const nameAttr = /(?:name|label|description)\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1] ?? ''
      const cleaned = decodeXmlEntities(
        inner
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<\/lines>/gi, '\n')
          .replace(/<[^>]+>/g, '')
      )
      const lines = cleaned
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0)

      if (lines.length > 0) {
        const isChorus = /^c/i.test(nameAttr) || nameAttr.toLowerCase().includes('coro')
        const label = isChorus
          ? 'Coro'
          : /^v(\d+)$/i.test(nameAttr)
            ? `Verso ${nameAttr.slice(1)}`
            : nameAttr || `Verso ${idx}`
        stanzas.push({
          id: `stanza-${idx}`,
          label,
          kind: isChorus ? 'chorus' : 'verse',
          lines
        })
      }
    }

    if (stanzas.length === 0) {
      const lyricsMatch = /<(?:lyrics|letra|text)[^>]*>([\s\S]*?)<\/(?:lyrics|letra|text)>/i.exec(block)
      if (lyricsMatch?.[1]) {
        const raw = decodeXmlEntities(lyricsMatch[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''))
        stanzas.push(...parseRawLyricsToStanzas(raw))
      }
    }

    if (stanzas.length > 0) {
      songs.push({
        title: title.slice(0, 160),
        author: author.slice(0, 160),
        musicalKey: musicalKey.slice(0, 20),
        bpm: null,
        tags: ['Holyrics'],
        stanzas
      })
    }
  }

  return songs
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

/**
 * Parsea texto plano de Holyrics (una canción o catálogo múltiple separado por `===`).
 */
function parseHolyricsTextSongs(rawContent: string, fallbackTitle?: string): SongInput[] {
  const normalized = rawContent.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trim()
  if (!normalized) return []

  // Si contiene separadores de catálogo múltiple `===` (3 o más signos igual en su propia línea)
  const sections = normalized
    .split(/\n={3,}\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  const results: SongInput[] = []

  sections.forEach((section, idx) => {
    const lines = section.split('\n')
    let title = fallbackTitle && sections.length === 1 ? fallbackTitle : ''
    let author = ''
    let musicalKey = ''
    let bodyStartIndex = 0

    // Detectar metadatos tipo `# Título`, `Título: ...`, `Autor: ...`, `Tono: ...` en las primeras líneas
    for (let i = 0; i < Math.min(lines.length, 5); i++) {
      const line = (lines[i] ?? '').trim()
      if (!line) {
        bodyStartIndex = i + 1
        break
      }
      const titleHeader = /^(?:#+\s*|t[íi]tulo\s*:\s*|title\s*:\s*)(.+)$/i.exec(line)
      const authorHeader = /^(?:autor|artista|author|artist)\s*:\s*(.+)$/i.exec(line)
      const keyHeader = /^(?:tono|tonalidad|tom|key)\s*:\s*(.+)$/i.exec(line)

      if (titleHeader?.[1]) {
        title = titleHeader[1].trim()
        bodyStartIndex = i + 1
      } else if (authorHeader?.[1]) {
        author = authorHeader[1].trim()
        bodyStartIndex = i + 1
      } else if (keyHeader?.[1]) {
        musicalKey = keyHeader[1].trim()
        bodyStartIndex = i + 1
      } else if (i === 0 && !line.startsWith('[') && (lines[1] ?? '').trim() === '') {
        // En muchos archivos .txt de Holyrics, la primera línea seguida de línea en blanco es el título
        title = line
        bodyStartIndex = 2
        break
      } else {
        break
      }
    }

    const body = lines.slice(bodyStartIndex).join('\n').trim()
    const effectiveBody = body || section
    const stanzas = parseRawLyricsToStanzas(effectiveBody)
    if (stanzas.length === 0) return

    const finalTitle =
      title ||
      fallbackTitle ||
      stanzas[0]?.lines[0]?.replace(/[.,;:!?]+$/, '').slice(0, 60) ||
      `Alabanza ${idx + 1}`

    results.push({
      title: finalTitle.slice(0, 160),
      author: author.slice(0, 160),
      musicalKey: musicalKey.slice(0, 20),
      bpm: null,
      tags: ['Holyrics'],
      stanzas
    })
  })

  return results
}

/**
 * Deserializador nativo de bases de datos de canciones de Holyrics en formato `.mufl`
 * (Java Object Serialization Stream de ArrayList<com.limagiran.holyrics.model.Music>).
 */
export function parseHolyricsMufl(buffer: Uint8Array): SongInput[] {
  if (buffer.byteLength < 4) return []
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  let pos = 0
  const magic = view.getUint16(pos)
  pos += 2
  const version = view.getUint16(pos)
  pos += 2
  if (magic !== 0xaced || version !== 0x0005) {
    return []
  }

  const decoder = new TextDecoder('utf-8')
  const decodeUtf8 = (start: number, end: number): string => {
    return decoder.decode(buffer.subarray(start, end))
  }

  const objects: unknown[] = []
  const newHandle = (obj: unknown): unknown => {
    objects.push(obj)
    return obj
  }

  const readObject = (): unknown => {
    if (pos >= buffer.byteLength) return null
    const tc = view.getUint8(pos++)
    if (tc === 0x70) return null // TC_NULL
    if (tc === 0x71) {
      // TC_REFERENCE
      const handle = view.getInt32(pos) - 0x7e0000
      pos += 4
      return objects[handle]
    }
    if (tc === 0x74) {
      // TC_STRING
      const len = view.getUint16(pos)
      pos += 2
      const str = decodeUtf8(pos, pos + len)
      pos += len
      newHandle(str)
      return str
    }
    if (tc === 0x7c) {
      // TC_LONGSTRING
      const len = Number(view.getBigInt64(pos))
      pos += 8
      const str = decodeUtf8(pos, pos + len)
      pos += len
      newHandle(str)
      return str
    }
    if (tc === 0x72) {
      // TC_CLASSDESC
      const len = view.getUint16(pos)
      pos += 2
      const className = decodeUtf8(pos, pos + len)
      pos += len
      pos += 8 // serialVersionUID
      const flags = view.getUint8(pos++)
      const fieldCount = view.getUint16(pos)
      pos += 2
      const fields: Array<{ typeCode: string; name: string }> = []
      const classDesc = { className, flags, fields }
      newHandle(classDesc)
      for (let i = 0; i < fieldCount; i++) {
        const typeCode = String.fromCharCode(view.getUint8(pos++))
        const fnLen = view.getUint16(pos)
        pos += 2
        const fnName = decodeUtf8(pos, pos + fnLen)
        pos += fnLen
        if (typeCode === 'L' || typeCode === '[') {
          readObject()
        }
        fields.push({ typeCode, name: fnName })
      }
      while (pos < buffer.byteLength && view.getUint8(pos) !== 0x78) {
        readObject()
      }
      if (pos < buffer.byteLength && view.getUint8(pos) === 0x78) pos++ // TC_ENDBLOCKDATA
      readObject() // superDesc
      return classDesc
    }
    if (tc === 0x73) {
      // TC_OBJECT
      const classDesc = readObject() as { className: string; fields: Array<{ typeCode: string; name: string }> } | null
      const obj: Record<string, unknown> = { __class: classDesc?.className }
      newHandle(obj)
      if (classDesc && Array.isArray(classDesc.fields)) {
        for (const field of classDesc.fields) {
          if (pos >= buffer.byteLength) break
          if (field.typeCode === 'B' || field.typeCode === 'Z') {
            obj[field.name] = view.getUint8(pos++)
          } else if (field.typeCode === 'C') {
            obj[field.name] = String.fromCharCode(view.getUint16(pos))
            pos += 2
          } else if (field.typeCode === 'S') {
            obj[field.name] = view.getInt16(pos)
            pos += 2
          } else if (field.typeCode === 'I') {
            obj[field.name] = view.getInt32(pos)
            pos += 4
          } else if (field.typeCode === 'J') {
            obj[field.name] = view.getBigInt64(pos)
            pos += 8
          } else if (field.typeCode === 'F') {
            obj[field.name] = view.getFloat32(pos)
            pos += 4
          } else if (field.typeCode === 'D') {
            obj[field.name] = view.getFloat64(pos)
            pos += 8
          } else if (field.typeCode === 'L' || field.typeCode === '[') {
            obj[field.name] = readObject()
          }
        }
      }

      if (classDesc?.className === 'java.util.ArrayList') {
        const listSize = typeof obj['size'] === 'number' ? obj['size'] : 0
        if (pos < buffer.byteLength && view.getUint8(pos) === 0x77) {
          pos++
          const blockLen = view.getUint8(pos++)
          pos += blockLen
        }
        const elements: unknown[] = []
        for (let i = 0; i < listSize && pos < buffer.byteLength; i++) {
          elements.push(readObject())
        }
        obj['elements'] = elements
      }
      return obj
    }
    if (tc === 0x77) {
      // TC_BLOCKDATA
      const len = view.getUint8(pos++)
      pos += len
      return null
    }
    if (tc === 0x78) return null // TC_ENDBLOCKDATA
    return null
  }

  const root = readObject() as { elements?: unknown[] } | null
  const items = root && Array.isArray(root.elements) ? root.elements : objects

  const parsedSongs: SongInput[] = []
  for (const item of items) {
    if (isRecord(item) && item['__class'] === 'com.limagiran.holyrics.model.Music') {
      const rawTitle = asString(item['titleHTML'] ?? item['title'] ?? item['titleToSearch'])
      const rawLyrics = asString(item['lyrics'] ?? item['lyricsToSearch'])
      if (!rawTitle && !rawLyrics) continue

      const title = rawTitle || `Alabanza ${parsedSongs.length + 1}`
      const author = asString(item['artist'] ?? item['author']) || 'Tradicional'
      const stanzas = parseRawLyricsToStanzas(rawLyrics)
      if (stanzas.length === 0) continue

      parsedSongs.push({
        title,
        author,
        musicalKey: '',
        bpm: null,
        tags: ['Holyrics', 'MUFL', ...(author && author !== 'Tradicional' ? [author] : [])],
        stanzas
      })
    }
  }

  return parsedSongs
}

/**
 * Importa una o varias canciones desde cualquier formato usado por Holyrics
 * (`.mufl`, `.json`, `.hly`, `.xml` OpenLyrics/Holyrics o `.txt`).
 */
export function parseHolyricsCatalogPayload(rawContent: string, fileName?: string): SongInput[] {
  const trimmed = rawContent.replace(/^\uFEFF/, '').trim()
  if (!trimmed) return []

  const cleanFileName = fileName
    ? fileName.replace(/^.*[\\/]/, '').replace(/\.(mufl|json|hly|xml|txt)$/i, '').trim()
    : undefined

  // 1. Intentar archivo binario Java Serialized de Holyrics (.mufl)
  if (
    fileName?.toLowerCase().endsWith('.mufl') ||
    trimmed.startsWith('base64:') ||
    (trimmed.length >= 4 &&
      trimmed.charCodeAt(0) === 0xac &&
      trimmed.charCodeAt(1) === 0xed)
  ) {
    let bytes: Uint8Array
    if (trimmed.startsWith('base64:')) {
      const b64 = trimmed.slice(7)
      const bin = typeof atob === 'function' ? atob(b64) : ''
      bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    } else {
      bytes = new Uint8Array(trimmed.length)
      for (let i = 0; i < trimmed.length; i++) bytes[i] = trimmed.charCodeAt(i)
    }
    const muflSongs = parseHolyricsMufl(bytes)
    if (muflSongs.length > 0) return muflSongs
  }

  // 1. Intentar JSON
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown
      const items: unknown[] = Array.isArray(parsed)
        ? parsed
        : isRecord(parsed) && Array.isArray(parsed['songs'])
          ? (parsed['songs'] as unknown[])
          : isRecord(parsed) && Array.isArray(parsed['musicas'])
            ? (parsed['musicas'] as unknown[])
            : isRecord(parsed) && Array.isArray(parsed['items'])
              ? (parsed['items'] as unknown[])
              : [parsed]

      const results: SongInput[] = []
      for (const item of items) {
        if (isRecord(item)) {
          const song = parseSingleHolyricsObject(item, items.length === 1 ? cleanFileName : undefined)
          if (song) results.push(song)
        }
      }
      if (results.length > 0) return results
    } catch {
      // Si no es JSON válido, continúa con XML o texto plano
    }
  }

  // 2. Intentar XML (OpenLyrics / Holyrics XML)
  if (trimmed.startsWith('<')) {
    const xmlSongs = parseHolyricsXmlSongs(trimmed, cleanFileName)
    if (xmlSongs.length > 0) return xmlSongs
  }

  // 3. Texto plano (.txt individual o múltiple)
  return parseHolyricsTextSongs(trimmed, cleanFileName)
}

/**
 * Exporta el catálogo de canciones al formato JSON compatible con Holyrics y Lumen.
 */
export function exportCatalogToHolyricsJson(songs: readonly Song[]): string {
  const payload = {
    format: 'holyrics-compatible-catalog',
    exportedAt: new Date().toISOString(),
    totalSongs: songs.length,
    songs: songs.map((song) => ({
      title: song.title,
      titulo: song.title,
      artist: song.author,
      autor: song.author,
      key: song.musicalKey,
      tom: song.musicalKey,
      bpm: song.bpm,
      tags: song.tags,
      lyrics: {
        paragraphs: song.stanzas.map((st) => ({
          description: st.label,
          text: st.lines.join('\n')
        }))
      }
    }))
  }
  return JSON.stringify(payload, null, 2)
}
