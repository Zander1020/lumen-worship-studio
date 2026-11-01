/**
 * Importación de versiones bíblicas en formato XML Zefania,
 * el mismo formato que importa Holyrics (Biblia Importar *.xml).
 *
 * Estructura esperada:
 * <XMLBIBLE>
 * <BIBLEBOOK bnumber="1" name="Génesis" sname="Gn">
 * <CHAPTER cnumber="1">
 * <VERS vnumber="1">Texto del versículo</VERS>
 * </CHAPTER>
 * </BIBLEBOOK>
 * </XMLBIBLE>
 */

export interface BibleJsonBook {
 abbrev: string
 name: string
 chapters: string[][]
}

/** 66 libros del canon protestante en el mismo orden y abreviaturas que es_rvr.json (bnumber 1..66). */
const CANONICAL_BOOKS: Array<{ abbrev: string; name: string }> = [
 { abbrev: 'gn', name: 'Génesis' },
 { abbrev: 'ex', name: 'Éxodo' },
 { abbrev: 'lv', name: 'Levítico' },
 { abbrev: 'nm', name: 'Números' },
 { abbrev: 'dt', name: 'Deuteronomio' },
 { abbrev: 'js', name: 'Josué' },
 { abbrev: 'jz', name: 'Jueces' },
 { abbrev: 'rt', name: 'Rut' },
 { abbrev: '1sm', name: '1 Samuel' },
 { abbrev: '2sm', name: '2 Samuel' },
 { abbrev: '1rs', name: '1 Reyes' },
 { abbrev: '2rs', name: '2 Reyes' },
 { abbrev: '1cr', name: '1 Crónicas' },
 { abbrev: '2cr', name: '2 Crónicas' },
 { abbrev: 'ed', name: 'Esdras' },
 { abbrev: 'ne', name: 'Nehemías' },
 { abbrev: 'et', name: 'Ester' },
 { abbrev: 'jó', name: 'Job' },
 { abbrev: 'sl', name: 'Salmos' },
 { abbrev: 'pv', name: 'Proverbios' },
 { abbrev: 'ec', name: 'Eclesiastés' },
 { abbrev: 'ct', name: 'Cantares' },
 { abbrev: 'is', name: 'Isaías' },
 { abbrev: 'jr', name: 'Jeremías' },
 { abbrev: 'lm', name: 'Lamentaciones' },
 { abbrev: 'ez', name: 'Ezequiel' },
 { abbrev: 'dn', name: 'Daniel' },
 { abbrev: 'os', name: 'Oseas' },
 { abbrev: 'jl', name: 'Joel' },
 { abbrev: 'am', name: 'Amós' },
 { abbrev: 'ob', name: 'Abdías' },
 { abbrev: 'jn', name: 'Jonás' },
 { abbrev: 'mq', name: 'Miqueas' },
 { abbrev: 'na', name: 'Nahum' },
 { abbrev: 'hc', name: 'Habacuc' },
 { abbrev: 'sf', name: 'Sofonías' },
 { abbrev: 'ag', name: 'Hageo' },
 { abbrev: 'zc', name: 'Zacarías' },
 { abbrev: 'ml', name: 'Malaquías' },
 { abbrev: 'mt', name: 'Mateo' },
 { abbrev: 'mc', name: 'Marcos' },
 { abbrev: 'lc', name: 'Lucas' },
 { abbrev: 'jo', name: 'Juan' },
 { abbrev: 'atos', name: 'Hechos' },
 { abbrev: 'rm', name: 'Romanos' },
 { abbrev: '1co', name: '1 Corintios' },
 { abbrev: '2co', name: '2 Corintios' },
 { abbrev: 'gl', name: 'Gálatas' },
 { abbrev: 'ef', name: 'Efesios' },
 { abbrev: 'fp', name: 'Filipenses' },
 { abbrev: 'cl', name: 'Colosenses' },
 { abbrev: '1ts', name: '1 Tesalonicenses' },
 { abbrev: '2ts', name: '2 Tesalonicenses' },
 { abbrev: '1tm', name: '1 Timoteo' },
 { abbrev: '2tm', name: '2 Timoteo' },
 { abbrev: 'tt', name: 'Tito' },
 { abbrev: 'fm', name: 'Filemón' },
 { abbrev: 'hb', name: 'Hebreos' },
 { abbrev: 'tg', name: 'Santiago' },
 { abbrev: '1pe', name: '1 Pedro' },
 { abbrev: '2pe', name: '2 Pedro' },
 { abbrev: '1jo', name: '1 Juan' },
 { abbrev: '2jo', name: '2 Juan' },
 { abbrev: '3jo', name: '3 Juan' },
 { abbrev: 'jd', name: 'Judas' },
 { abbrev: 'ap', name: 'Apocalipsis' }
]

function normalizeText(text: string): string {
 return text
 .toLowerCase()
 .normalize('NFD')
 .replace(/[\u0300-\u036f]/g, '')
 .replace(/^san\s+/, '')
 .replace(/^el\s+/, '')
 .replace(/\./g, '')
 .trim()
}

function decodeEntities(text: string): string {
 return text
 .replace(/&amp;/g, '&')
 .replace(/&lt;/g, '<')
 .replace(/&gt;/g, '>')
 .replace(/&quot;/g, '"')
 .replace(/&apos;/g, "'")
 .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
 .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCharCode(parseInt(code, 16)))
}

function extractAttr(attrs: string, name: string): string {
 const match = new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i').exec(attrs)
 return match?.[1]?.trim() ?? ''
}

/** Limpia el contenido de un <VERS>: conserva saltos de <BR>, elimina el resto de etiquetas. */
function cleanVerseText(raw: string): string {
 const withBreaks = raw
 .replace(/<br\s*\/?>/gi, '\n')
 .replace(/<\/?(?:p|div)\b[^>]*>/gi, '\n')
 const withoutTags = withBreaks.replace(/<[^>]+>/g, '')
 return decodeEntities(withoutTags)
 .split(/\r?\n/)
 .map((line) => line.replace(/[ \t\u00a0]+/g, ' ').trim())
 .filter((line) => line.length > 0)
 .join('\n')
 .trim()
}

function resolveBookMeta(bnumber: string, rawName: string): { abbrev: string; name: string } {
 const num = Number(bnumber)
 if (Number.isInteger(num) && num >= 1 && num <= 66) {
 const canonical = CANONICAL_BOOKS[num - 1]
 if (canonical) return canonical
 }
 const norm = normalizeText(rawName)
 const byName = CANONICAL_BOOKS.find((b) => normalizeText(b.name) === norm)
 if (byName) return byName
 const byAbbrev = CANONICAL_BOOKS.find((b) => normalizeText(b.abbrev) === norm)
 if (byAbbrev) return byAbbrev
 const startswith = CANONICAL_BOOKS.find((b) => norm.length >= 3 && normalizeText(b.name).startsWith(norm))
 if (startswith) return startswith
 return {
 abbrev: (norm.replace(/\s+/g, '').slice(0, 4) || 'lib').slice(0, 8),
 name: rawName.trim().slice(0, 80) || `Libro ${num > 0 ? num : '?'}`
 }
}

/**
 * Parsea una Biblia en formato XML Zefania (usado por Holyrics).
 * Lanza un Error con mensaje en español si el archivo no es válido.
 */
export function parseZefaniaXml(xmlContent: string): BibleJsonBook[] {
 const trimmed = xmlContent.replace(/^\uFEFF/, '').trim()
 if (!trimmed) throw new Error('El archivo está vacío.')
 if (!trimmed.startsWith('<')) {
 throw new Error('No es un archivo XML válido. Holyrics importa Biblias en formato XML (*.xml).')
 }

 const bookBlocks = trimmed.match(/<BIBLEBOOK\b[^>]*>[\s\S]*?<\/BIBLEBOOK>/gi) ?? []
 if (bookBlocks.length === 0) {
 throw new Error('No se encontraron libros (<BIBLEBOOK>) en el XML. ¿Es un XML Zefania de Biblia?')
 }

 const books: BibleJsonBook[] = []
 for (const block of bookBlocks) {
 const openTag = /^<BIBLEBOOK\b([^>]*)>/i.exec(block)
 const attrs = openTag?.[1] ?? ''
 const meta = resolveBookMeta(extractAttr(attrs, 'bnumber'), extractAttr(attrs, 'name') || extractAttr(attrs, 'sname'))

 const chapterBlocks = block.match(/<CHAPTER\b[^>]*>[\s\S]*?<\/CHAPTER>/gi) ?? []
 const chapters: string[][] = []
 for (const chBlock of chapterBlocks) {
 const chMatch = /^<CHAPTER\b([^>]*)>/i.exec(chBlock)
 const cnumber = Number(extractAttr(chMatch?.[1] ?? '', 'cnumber'))
 const verseBlocks = chBlock.match(/<VERS\b[^>]*>[\s\S]*?<\/VERS>/gi) ?? []
 const verses: Array<{ num: number; text: string }> = []
 for (const vBlock of verseBlocks) {
 const vMatch = /^<VERS\b([^>]*)>/i.exec(vBlock)
 const inner = vBlock.replace(/^<VERS\b[^>]*>/i, '').replace(/<\/VERS>$/i, '')
 const text = cleanVerseText(inner)
 if (!text) continue
 const declared = Number(extractAttr(vMatch?.[1] ?? '', 'vnumber'))
 verses.push({ num: Number.isInteger(declared) && declared > 0 ? declared : verses.length + 1, text })
 }
 if (verses.length === 0) continue
 const chapterIndex = Number.isInteger(cnumber) && cnumber > 0 ? cnumber - 1 : chapters.length
 while (chapters.length <= chapterIndex) chapters.push([])
 const target = chapters[chapterIndex] ?? []
 verses.forEach((v) => {
 const pos = Math.max(0, v.num - 1)
 while (target.length < pos) target.push('')
 target[pos] = v.text
 })
 }

 if (chapters.length > 0 && chapters.some((ch) => ch.length > 0)) {
 books.push({ abbrev: meta.abbrev, name: meta.name, chapters })
 }
 }

 if (books.length === 0) {
 throw new Error('El XML no contiene versículos legibles.')
 }
 return books
}

/** Limpia el texto de un versículo .xmm: elimina etiquetas, marcadores de nota [n] y normaliza espacios. */
function cleanXmmVerse(raw: string): string {
 const withoutTags = raw.replace(/<[^>]+>/g, ' ')
 const withoutFootnotes = withoutTags.replace(/\[\d+\]/g, '').replace(/\*/g, '')
 const decoded = decodeEntities(withoutFootnotes)
 return decoded
 .split(/\r?\n/)
 .map((line) => line.replace(/[ \t\u00a0]+/g, ' ').trim())
 .filter((line) => line.length > 0)
 .join(' ')
 .replace(/\s+/g, ' ')
 .trim()
}

/**
 * Parsea una Biblia en formato .xmm de Holyrics (<bible><b n="..."><c n="..."><v n="...">).
 * Lanza un Error con mensaje en español si el archivo no es válido.
 */
export function parseXmmBible(xmmContent: string): BibleJsonBook[] {
 const trimmed = xmmContent.replace(/^\uFEFF/, '').trim()
 if (!trimmed) throw new Error('El archivo está vacío.')
 if (!/<bible[\s>]/i.test(trimmed) && !/<b\s+n=/i.test(trimmed)) {
 throw new Error('No es un archivo .xmm de Biblia válido.')
 }

 const bookRegex = /<b\s+n="([^"]*)">(.*?)<\/b>/gis
 const chapterRegex = /<c\s+n="(\d+)">(.*?)<\/c>/gis
 const verseRegex = /<v\s+n="(\d+)">(.*?)<\/v>/gis

 const books: BibleJsonBook[] = []
 let bookIdx = 0
 for (const bookMatch of trimmed.matchAll(bookRegex)) {
 bookIdx += 1
 const rawName = bookMatch[1] ?? ""
 const body = bookMatch[2] ?? ""
 const meta = resolveBookMeta(String(bookIdx), rawName)

 const chapters: string[][] = []
 for (const chMatch of body.matchAll(chapterRegex)) {
 const cnum = Number(chMatch[1])
 const chapterIndex = Number.isInteger(cnum) && cnum > 0 ? cnum - 1 : chapters.length
 while (chapters.length <= chapterIndex) chapters.push([])
 const target = chapters[chapterIndex]
 if (!target) continue
 for (const vMatch of (chMatch[2] ?? "").matchAll(verseRegex)) {
 const vnum = Number(vMatch[1])
 const text = cleanXmmVerse(vMatch[2] ?? "")
 if (!text) continue
 const pos = Number.isInteger(vnum) && vnum > 0 ? vnum - 1 : target.length
 while (target.length <= pos) target.push('')
 target[pos] = text
 }
 }
 while (chapters.length > 0 && (chapters[chapters.length - 1] ?? []).every((v) => !v || !v.trim())) {
 chapters.pop()
 }
 if (chapters.length > 0 && chapters.some((ch) => ch.some((v) => v && v.trim()))) {
 books.push({ abbrev: meta.abbrev, name: meta.name, chapters })
 }
 }

 if (books.length === 0) {
 throw new Error('El archivo .xmm no contiene versículos legibles.')
 }
 return books
}

/** Detecta el formato del contenido y lo parsea (Zefania XML o .xmm de Holyrics). */
export function parseBibleContent(content: string, _fileName?: string): BibleJsonBook[] {
 const trimmed = content.replace(/^\uFEFF/, '').trim()
 if (!trimmed) throw new Error('El archivo está vacío.')
 if (!trimmed.startsWith('<')) {
 throw new Error('No es un archivo XML válido. Holyrics importa Biblias en formato XML (*.xml) o .xmm.')
 }
 if (/<bible[\s>]/i.test(trimmed) || /<b\s+n=/i.test(trimmed)) {
 return parseXmmBible(content)
 }
 return parseZefaniaXml(content)
}

/** Sugiere un nombre de versión a partir del nombre del archivo importado. */
export function suggestVersionName(fileName?: string): string {
 if (!fileName) return ''
 const base = fileName.replace(/^.*[\\/]/, '').replace(/\.(xml|XML|xmm|XMM|bib|BIB)$/, '').trim()
 if (!base) return ''
 return base
 .replace(/[_-]+/g, ' ')
 .replace(/\s+/g, ' ')
 .slice(0, 80)
}
