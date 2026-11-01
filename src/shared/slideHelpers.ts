import type { BibleVerse, PresentationSlide, Song, SongStanza, StanzaKind } from './models'

/**
 * Convierte texto plano de una alabanza en estrofas etiquetadas.
 * Soporta encabezados explícitos como `[Coro]`, `Coro:`, `Verso 1:` o bloques separados por líneas en blanco,
 * además de detección automática de `[Coro]` cuando un bloque se repite (Mejora 82).
 */
export function parseRawLyricsToStanzas(rawText: string): SongStanza[] {
 const normalized = rawText.replace(/\r\n/g, '\n').trim()
 if (!normalized) return []

 const blocks = normalized
 .split(/\n\s*\n+/)
 .map((b) => b.trim())
 .filter((b) => b.length > 0)

 // Contar bloques idénticos sin encabezado para detectar coros repetidos automáticamente
 const blockCounts = new Map<string, number>()
 for (const b of blocks) {
 const key = b.toLowerCase().trim()
 blockCounts.set(key, (blockCounts.get(key) ?? 0) + 1)
 }

 let verseCounter = 0

 return blocks.map((block, index) => {
 const rawLines = block
 .split('\n')
 .map((l) => l.trim())
 .filter((l) => l.length > 0)

 const firstLine = rawLines[0] ?? ''
 const headerMatch =
 /^(?:\[([^\]]+)\]|(verso\s*\d*|estrofa\s*\d*|coro|pre[-\s]?coro|puente|intro|final|outro)\s*:?)$/i.exec(firstLine)

 let label: string
 let kind: StanzaKind
 let lyricLines: string[]

 if (headerMatch && rawLines.length > 1) {
 const rawHeader = (headerMatch[1] ?? headerMatch[2] ?? '').trim()
 kind = classifyStanzaHeader(rawHeader)
 label = formatStanzaLabel(rawHeader, kind, ++verseCounter)
 lyricLines = rawLines.slice(1)
 } else if ((blockCounts.get(block.toLowerCase().trim()) ?? 0) > 1 && blocks.length > 2) {
 kind = 'chorus'
 label = 'Coro'
 lyricLines = rawLines
 } else {
 verseCounter += 1
 kind = 'verse'
 label = `Verso ${verseCounter}`
 lyricLines = rawLines
 }

 return {
 id: `stanza-${index + 1}`,
 label,
 kind,
 lines: lyricLines
 }
 })
}

function classifyStanzaHeader(header: string): StanzaKind {
 const lower = header.toLowerCase()
 if (lower.includes('coro')) return 'chorus'
 if (lower.includes('puente') || lower.includes('bridge')) return 'bridge'
 if (lower.includes('intro')) return 'intro'
 if (lower.includes('final') || lower.includes('outro')) return 'outro'
 if (lower.includes('verso') || lower.includes('estrofa')) return 'verse'
 return 'custom'
}

function formatStanzaLabel(rawHeader: string, kind: StanzaKind, fallbackIndex: number): string {
 if (rawHeader.length > 0) {
 return rawHeader.charAt(0).toUpperCase() + rawHeader.slice(1)
 }
 switch (kind) {
 case 'chorus':
 return 'Coro'
 case 'bridge':
 return 'Puente'
 case 'intro':
 return 'Intro'
 case 'outro':
 return 'Final'
 default:
 return `Verso ${fallbackIndex}`
 }
}

/**
 * Limpia letras copiadas de Internet: elimina líneas de acordes sueltos, marcas de agua,
 * numeraciones al inicio de línea y corrige mayúsculas litúrgicas básicas (Mejoras 81, 83).
 */
export function cleanInternetLyrics(rawText: string): string {
 const chordLineRegex =
 /^(?:\s*[A-G](?:#|b)?(?:m|maj|min|dim|aug|sus|add)?\d*(?:\/[A-G](?:#|b)?)?\s*)+$/
 const lines = rawText.replace(/\r\n/g, '\n').split('\n')
 const cleaned: string[] = []

 for (const rawLine of lines) {
 const trimmed = rawLine.trim()
 if (!trimmed) {
 cleaned.push('')
 continue
 }
 // Ignorar líneas que solo contienen acordes musicales
 if (chordLineRegex.test(trimmed)) continue
 // Eliminar acordes incrustados entre paréntesis/corchetes cortos tipo [Am] o (G7) si no son etiquetas de estrofa
 const withoutInlineChords = trimmed
 .replace(/\[([A-G](?:#|b)?(?:m|maj|min|sus|add)?\d*(?:\/[A-G](?:#|b)?)?)\]/g, '')
 .replace(/^\d+[.)]\s+/, '')
 .replace(/\s{2,}/g, ' ')
 .trim()
 if (withoutInlineChords) {
 cleaned.push(withoutInlineChords)
 }
 }

 return cleaned
 .join('\n')
 .replace(/\n{3,}/g, '\n\n')
 .trim()
}

/**
 * Divide automáticamente estrofas que superan `maxLines` en sub-diapositivas (A, B...) (Mejoras 13, 87).
 */
export function autoSplitLongStanzas(stanzas: readonly SongStanza[], maxLines = 4): SongStanza[] {
 const result: SongStanza[] = []
 let idx = 0
 for (const st of stanzas) {
 if (st.lines.length <= maxLines) {
 idx += 1
 result.push({ ...st, id: `stanza-${idx}` })
 continue
 }
 const totalParts = Math.ceil(st.lines.length / maxLines)
 for (let part = 0; part < totalParts; part++) {
 idx += 1
 const slice = st.lines.slice(part * maxLines, (part + 1) * maxLines)
 const suffix = String.fromCharCode(65 + part)
 result.push({
 id: `stanza-${idx}`,
 label: `${st.label} (${suffix})`,
 kind: st.kind,
 lines: slice
 })
 }
 }
 return result
}

/**
 * Expande el orden de ejecución (`verseOrder`, ej. "V1 C V2 C P C") sobre las estrofas de una canción (Mejora 11).
 */
export function applyVerseOrder(stanzas: readonly SongStanza[], verseOrder?: string): SongStanza[] {
 if (!verseOrder || !verseOrder.trim() || stanzas.length === 0) {
 return [...stanzas]
 }
 const tokens = verseOrder
 .trim()
 .split(/[\s,-]+/)
 .map((t) => t.trim().toUpperCase())
 .filter((t) => t.length > 0)
 if (tokens.length === 0) return [...stanzas]

 const ordered: SongStanza[] = []
 for (const token of tokens) {
 const match = stanzas.find((st) => {
 const lbl = st.label.toUpperCase()
 if (lbl === token) return true
 if (token === 'C' && (st.kind === 'chorus' || lbl.startsWith('CORO'))) return true
 if ((token === 'P' || token === 'B') && (st.kind === 'bridge' || lbl.startsWith('PUENTE'))) return true
 if (token === 'I' && (st.kind === 'intro' || lbl.startsWith('INTRO'))) return true
 if (token === 'F' && (st.kind === 'outro' || lbl.startsWith('FINAL'))) return true
 const vMatch = /^V(\d+)$/.exec(token)
 if (vMatch?.[1] && (lbl === `VERSO ${vMatch[1]}` || lbl === `ESTROFA ${vMatch[1]}`)) return true
 return false
 })
 if (match) ordered.push(match)
 }

 return ordered.length > 0 ? ordered : [...stanzas]
}

const CHROMATIC_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const
const FLAT_TO_SHARP: Record<string, string> = {
 Db: 'C#',
 Eb: 'D#',
 Gb: 'F#',
 Ab: 'G#',
 Bb: 'A#'
}

/**
 * Transpone notas o acordes musicales (`C`, `G`, `F#m`, `Bb/D`) un número de semitonos (Mejora 15).
 */
export function transposeChordText(text: string, semitones: number): string {
 if (!text || semitones === 0) return text
 return text.replace(/\b([A-G])(#|b)?/g, (_full, root: string, accidental?: string) => {
 const note = `${root}${accidental ?? ''}`
 const normalized = FLAT_TO_SHARP[note] ?? note
 const currentIndex = CHROMATIC_SHARP.indexOf(normalized as (typeof CHROMATIC_SHARP)[number])
 if (currentIndex === -1) return _full
 const nextIndex = (currentIndex + (semitones % 12) + 12) % 12
 return CHROMATIC_SHARP[nextIndex] ?? _full
 })
}

/**
 * Calcula una puntuación de coincidencia difusa insensible a tildes y mayúsculas (Mejora 84).
 */
export function fuzzyMatchScore(haystack: string, needle: string): number {
 const normH = haystack
 .normalize('NFD')
 .replace(/[\u0300-\u036f]/g, '')
 .toLowerCase()
 const normN = needle
 .normalize('NFD')
 .replace(/[\u0300-\u036f]/g, '')
 .toLowerCase()
 .trim()
 if (!normN) return 1
 if (normH.includes(normN)) return 100
 const words = normN.split(/\s+/).filter((w) => w.length > 0)
 let matchedWords = 0
 for (const w of words) {
 if (normH.includes(w)) matchedWords += 1
 }
 return words.length > 0 ? Math.round((matchedWords / words.length) * 80) : 0
}

/** Convierte una canción en diapositivas listas para proyectar (aplicando `verseOrder` si existe). */
export function songToSlides(song: Song, includeTitleSlide = false): PresentationSlide[] {
 const effectiveStanzas = applyVerseOrder(song.stanzas, song.verseOrder)
 const footer = `${song.title}${song.author ? ` · ${song.author}` : ''}${song.musicalKey ? ` (${song.musicalKey})` : ''}`
 const slides: PresentationSlide[] = effectiveStanzas.map((stanza, index) => ({
 id: `${song.id}-slide-${index + 1}`,
 sourceKind: 'song',
 sourceTitle: song.title,
 label: stanza.label,
 lines: [...stanza.lines],
 footer
 }))

 if (includeTitleSlide) {
 slides.unshift({
 id: `${song.id}-slide-title`,
 sourceKind: 'song',
 sourceTitle: song.title,
 label: 'Portada',
 lines: [song.title, song.author ? song.author : 'Alabanza'],
 footer
 })
 }
 return slides
}

export interface ParsedCitation {
 rawBook: string
 chapter: number
 verseStart?: number | undefined
 verseEnd?: number | undefined
}

const COMMON_BIBLE_ABBREVIATIONS: Record<string, string> = {
 sal: 'Salmos',
 salm: 'Salmos',
 sl: 'Salmos',
 jn: 'Juan',
 jhn: 'Juan',
 juan: 'Juan',
 gn: 'Génesis',
 gen: 'Génesis',
 genesis: 'Génesis',
 ex: 'Éxodo',
 exo: 'Éxodo',
 exod: 'Éxodo',
 lv: 'Levítico',
 lev: 'Levítico',
 nm: 'Números',
 num: 'Números',
 dt: 'Deuteronomio',
 deut: 'Deuteronomio',
 js: 'Josué',
 jos: 'Josué',
 jz: 'Jueces',
 jue: 'Jueces',
 rt: 'Rut',
 '1sm': '1 Samuel',
 '1sam': '1 Samuel',
 '2sm': '2 Samuel',
 '2sam': '2 Samuel',
 '1rs': '1 Reyes',
 '1rey': '1 Reyes',
 '2rs': '2 Reyes',
 '2rey': '2 Reyes',
 '1cr': '1 Crónicas',
 '1cron': '1 Crónicas',
 '2cr': '2 Crónicas',
 '2cron': '2 Crónicas',
 ed: 'Esdras',
 esd: 'Esdras',
 ne: 'Nehemías',
 neh: 'Nehemías',
 et: 'Ester',
 est: 'Ester',
 jb: 'Job',
 pv: 'Proverbios',
 pr: 'Proverbios',
 prov: 'Proverbios',
 ec: 'Eclesiastés',
 ecl: 'Eclesiastés',
 ct: 'Cantares',
 cant: 'Cantares',
 is: 'Isaías',
 isa: 'Isaías',
 jr: 'Jeremías',
 jer: 'Jeremías',
 lm: 'Lamentaciones',
 lam: 'Lamentaciones',
 ez: 'Ezequiel',
 ezeq: 'Ezequiel',
 dn: 'Daniel',
 dan: 'Daniel',
 os: 'Oseas',
 jl: 'Joel',
 am: 'Amós',
 ab: 'Abdías',
 abd: 'Abdías',
 jon: 'Jonás',
 mi: 'Miqueas',
 na: 'Nahúm',
 ha: 'Habacuc',
 hab: 'Habacuc',
 so: 'Sofonías',
 sof: 'Sofonías',
 hg: 'Hageo',
 hag: 'Hageo',
 za: 'Zacarías',
 zac: 'Zacarías',
 ml: 'Malaquías',
 mal: 'Malaquías',
 mt: 'Mateo',
 mat: 'Mateo',
 mc: 'Marcos',
 mar: 'Marcos',
 mr: 'Marcos',
 lc: 'Lucas',
 luc: 'Lucas',
 hch: 'Hechos',
 hech: 'Hechos',
 rm: 'Romanos',
 ro: 'Romanos',
 rom: 'Romanos',
 '1co': '1 Corintios',
 '1cor': '1 Corintios',
 '2co': '2 Corintios',
 '2cor': '2 Corintios',
 gl: 'Gálatas',
 gal: 'Gálatas',
 ef: 'Efesios',
 efe: 'Efesios',
 fl: 'Filipenses',
 fil: 'Filipenses',
 cl: 'Colosenses',
 col: 'Colosenses',
 '1ts': '1 Tesalonicenses',
 '1tes': '1 Tesalonicenses',
 '2ts': '2 Tesalonicenses',
 '2tes': '2 Tesalonicenses',
 '1tm': '1 Timoteo',
 '1tim': '1 Timoteo',
 '2tm': '2 Timoteo',
 '2tim': '2 Timoteo',
 tt: 'Tito',
 tit: 'Tito',
 fm: 'Filemón',
 flm: 'Filemón',
 hb: 'Hebreos',
 heb: 'Hebreos',
 st: 'Santiago',
 sant: 'Santiago',
 stg: 'Santiago',
 '1pe': '1 Pedro',
 '1ped': '1 Pedro',
 '2pe': '2 Pedro',
 '2ped': '2 Pedro',
 '1jn': '1 Juan',
 '2jn': '2 Juan',
 '3jn': '3 Juan',
 jd: 'Judas',
 jud: 'Judas',
 ap: 'Apocalipsis',
 apoc: 'Apocalipsis'
}

export function parseBibleCitation(text: string): ParsedCitation | null {
 const trimmed = text.trim()
 if (!trimmed) return null
 const refMatch =
 /^([1-3]?\s*[a-zA-ZáéíóúÁÉÍÓÚñÑ.\s]+?)\s*(\d+)(?:(?:\s*[:.,]\s*|\s+)(\d+)(?:\s*-\s*(\d+))?)?$/.exec(
 trimmed
 )
 if (!refMatch) return null
 return {
 rawBook: (refMatch[1] ?? '').trim(),
 chapter: Number(refMatch[2]),
 verseStart: refMatch[3] ? Number(refMatch[3]) : undefined,
 verseEnd: refMatch[4] ? Number(refMatch[4]) : refMatch[3] ? Number(refMatch[3]) : undefined
 }
}

export function resolveBibleCitationBook(
 rawBook: string,
 availableBooks: readonly { book: string; abbrev?: string }[]
): string | undefined {
 const norm = rawBook
 .toLowerCase()
 .normalize('NFD')
 .replace(/[\u0300-\u036f]/g, '')
 .trim()
 .replace(/\s+/g, '')

 const mapped = COMMON_BIBLE_ABBREVIATIONS[norm]
 if (mapped) {
 const found = availableBooks.find((b) => b.book.toLowerCase() === mapped.toLowerCase())
 if (found) return found.book
 }

 const byAbbrev = availableBooks.find((b) => (b.abbrev ?? '').toLowerCase().trim() === norm)
 if (byAbbrev) return byAbbrev.book

 const exact = availableBooks.find(
 (b) =>
 b.book
 .toLowerCase()
 .normalize('NFD')
 .replace(/[\u0300-\u036f]/g, '')
 .replace(/\s+/g, '') === norm
 )
 if (exact) return exact.book

 const starts = availableBooks.find((b) =>
 b.book
 .toLowerCase()
 .normalize('NFD')
 .replace(/[\u0300-\u036f]/g, '')
 .replace(/\s+/g, '')
 .startsWith(norm)
 )
 if (starts) return starts.book

 const contains = availableBooks.find((b) =>
 b.book
 .toLowerCase()
 .normalize('NFD')
 .replace(/[\u0300-\u036f]/g, '')
 .replace(/\s+/g, '')
 .includes(norm)
 )
 return contains?.book
}

/**
 * Convierte uno o varios versículos bíblicos en diapositivas listas para proyectar.
 * Si `splitLongVerses` es `true`, divide automáticamente los versículos muy extensos en partes A/B (Mejora 24).
 */
export function versesToSlides(
 verses: readonly BibleVerse[],
 splitLongVerses = false,
 versionName = 'Reina-Valera 1960'
): PresentationSlide[] {
 const slides: PresentationSlide[] = []
 for (const v of verses) {
 const ref = `${v.book} ${v.chapter}:${v.verse}`
 const finalVersion = v.version ?? versionName
 if (splitLongVerses && v.text.length > 190) {
 const mid = Math.floor(v.text.length / 2)
 let splitPos = v.text.indexOf(', ', mid - 35)
 if (splitPos === -1 || splitPos > mid + 45) splitPos = v.text.indexOf(' ', mid)
 if (splitPos > 20) {
 const partA = v.text.slice(0, splitPos + 1).trim()
 const partB = v.text.slice(splitPos + 1).trim()
 slides.push(
 {
 id: `bible-${v.book}-${v.chapter}-${v.verse}-a`,
 sourceKind: 'bible',
 sourceTitle: `${ref} (A)`,
 label: `${ref} (A)`,
 lines: [partA],
 footer: `${ref} · ${finalVersion}`
 },
 {
 id: `bible-${v.book}-${v.chapter}-${v.verse}-b`,
 sourceKind: 'bible',
 sourceTitle: `${ref} (B)`,
 label: `${ref} (B)`,
 lines: [partB],
 footer: `${ref} · ${finalVersion}`
 }
 )
 continue
 }
 }
 slides.push({
 id: `bible-${v.book}-${v.chapter}-${v.verse}`,
 sourceKind: 'bible',
 sourceTitle: ref,
 label: ref,
 lines: [v.text],
 footer: `${ref} · ${finalVersion}`
 })
 }
 return slides
}

/** Crea una diapositiva de anuncio o nota libre. */
export function createAnnouncementSlide(
 title: string,
 bodyText: string,
 footer = 'Aviso a la congregación'
): PresentationSlide {
 const lines = bodyText
 .replace(/\r\n/g, '\n')
 .split('\n')
 .map((l) => l.trim())
 .filter((l) => l.length > 0)

 return {
 id: `announcement-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
 sourceKind: 'announcement',
 sourceTitle: title.trim() || 'Anuncio',
 label: title.trim() || 'Anuncio',
 lines: lines.length > 0 ? lines : [title.trim() || 'Anuncio'],
 footer
 }
}

/**
 * Caché en memoria para convertir Data URLs Base64 de vídeo a Blob URLs de alto rendimiento.
 * Los Blob URLs permiten peticiones por rangos (byte-range streaming) y aceleración por GPU
 * sin las restricciones ni bloqueos de decodificación que sufren los Data URLs grandes en Chromium.
 */
const videoBlobCache = new Map<string, string>()

/**
 * Resuelve una URL de vídeo para el reproductor HTML5.
 * Si es un Data URL Base64, lo convierte a un Blob URL nativo reproducible.
 */
export function resolveMediaVideoUrl(url?: string): string {
 if (!url) return ''
 if (
 url.startsWith('motion:') ||
 url.startsWith('blob:') ||
 url.startsWith('lumen-media:') ||
 url.startsWith('http://') ||
 url.startsWith('https://') ||
 url.startsWith('file://')
 ) {
 return url
 }
 if (url.startsWith('data:')) {
 const cached = videoBlobCache.get(url)
 if (cached) return cached
 try {
 const comma = url.indexOf(',')
 if (comma !== -1) {
 const rawB64 = url.slice(comma + 1)
 const mimeMatch = /^data:([^;,]+)/i.exec(url)
 let mime = mimeMatch ? mimeMatch[1] : 'video/mp4'
 if (mime === 'application/octet-stream' || !mime || mime === 'data:') {
 mime = 'video/mp4'
 }
 if (
 typeof globalThis !== 'undefined' &&
 typeof globalThis.atob === 'function' &&
 typeof URL !== 'undefined' &&
 typeof URL.createObjectURL === 'function'
 ) {
 const binary = globalThis.atob(rawB64)
 const len = binary.length
 const u8 = new Uint8Array(len)
 for (let i = 0; i < len; i++) {
 u8[i] = binary.charCodeAt(i)
 }
 const blob = new Blob([u8], { type: mime })
 const blobUrl = URL.createObjectURL(blob)
 videoBlobCache.set(url, blobUrl)
 return blobUrl
 }
 }
 } catch {
 return url
 }
 }
 return url
}

/**
 * Detecta si una URL o valor multimedia corresponde a un vídeo (.mp4, .webm, data:video, blob, motion).
 */
export function isVideoUrl(url?: string): boolean {
 if (!url) return false
 const lower = url.toLowerCase()
 if (lower.startsWith('motion:')) return true
 if (lower.startsWith('data:video/')) return true
 if (lower.startsWith('blob:')) return true
 if (lower.startsWith('lumen-media:')) {
 let decoded = lower
 try {
 decoded = decodeURIComponent(lower)
 } catch {
 // ignore
 }
 if (/\.(mp4|webm|mkv|mov|avi|ogv|m4v)($|\?|#)/i.test(decoded)) return true
 if (decoded.includes('video') || decoded.includes('vídeo') || decoded.includes('whatsapp_video')) return true
 return /\.(mp4|webm|mkv|mov|avi|ogv|m4v)($|\?|#)/i.test(lower)
 }
 if (lower.startsWith('data:application/octet-stream') || lower.startsWith('data:;base64')) return true
 return /\.(mp4|webm|mkv|mov|avi|ogv|m4v)($|\?|#)/i.test(lower)
}
