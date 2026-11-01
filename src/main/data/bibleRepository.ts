import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { BibleBookSummary, BibleVersionInfo, BibleVersionImportRequest, BibleVerse } from '../../shared/models'
import { parseBibleContent } from '../../shared/bibleImport'
import { DEFAULT_BIBLE_VERSES } from './defaultSeeds'

export interface RawBibleBook {
 abbrev: string
 name: string
 chapters: string[][]
}

interface IndexedBook {
 index: number
 abbrev: string
 normAbbrev: string
 name: string
 normName: string
 testament: 'AT' | 'NT'
 chapters: string[][]
}

function normalizeText(text: string): string {
 return text
 .toLowerCase()
 .normalize('NFD')
 .replace(/[\u0300-\u036f]/g, '')
 .trim()
}

let cachedBooks: IndexedBook[] | null = null

const BUILTIN_DATA_FILES: Record<string, string> = {
 rvr1960: 'es_rvr.json',
 rvr1909: 'es_rvr1909.json',
 nvi: 'es_nvi.json',
 dhh: 'es_dhh.json',
 lbla: 'es_lbla.json',
 tla: 'es_tla.json',
 ntv: 'es_ntv.json',
 pdt: 'es_pdt.json'
}

function locateDataJson(fileName: string): string | null {
 const candidates: string[] = [
 join(__dirname, fileName),
 join(__dirname, '../data', fileName),
 join(__dirname, '../../src/main/data', fileName),
 join(process.cwd(), 'src/main/data', fileName)
 ]
 if (typeof process.resourcesPath === 'string') {
 candidates.unshift(join(process.resourcesPath, fileName))
 }
 for (const candidate of candidates) {
 if (existsSync(candidate)) return candidate
 }
 return null
}

function loadIndexedFromFile(path: string): IndexedBook[] | null {
 try {
 const raw = readFileSync(path, 'utf-8').replace(/^\uFEFF/, '')
 const parsed = JSON.parse(raw) as RawBibleBook[]
 if (!Array.isArray(parsed) || parsed.length === 0) return null
 return parsed.map((b, idx) => ({
 index: idx,
 abbrev: b.abbrev,
 normAbbrev: normalizeText(b.abbrev),
 name: b.name,
 normName: normalizeText(b.name),
 testament: idx < 39 ? 'AT' : 'NT',
 chapters: b.chapters
 }))
 } catch {
 return null
 }
}

const dataBooksCache = new Map<string, IndexedBook[]>()

function getDataBooks(fileName: string): IndexedBook[] | null {
 const cached = dataBooksCache.get(fileName)
 if (cached) return cached
 const path = locateDataJson(fileName)
 if (!path) return null
 const books = loadIndexedFromFile(path)
 if (books) dataBooksCache.set(fileName, books)
 return books
}

function buildFallbackBooks(): IndexedBook[] {
 const map = new Map<string, Map<number, string[]>>()
 for (const v of DEFAULT_BIBLE_VERSES) {
 let chMap = map.get(v.book)
 if (!chMap) {
 chMap = new Map<number, string[]>()
 map.set(v.book, chMap)
 }
 let arr = chMap.get(v.chapter)
 if (!arr) {
 arr = []
 chMap.set(v.chapter, arr)
 }
 arr[v.verse - 1] = v.text
 }

 const books: IndexedBook[] = []
 let idx = 0
 for (const [bookName, chMap] of map.entries()) {
 const maxCh = Math.max(...chMap.keys())
 const chapters: string[][] = []
 for (let c = 1; c <= maxCh; c++) {
 chapters.push(chMap.get(c) ?? [])
 }
 const norm = normalizeText(bookName)
 books.push({
 index: idx,
 abbrev: norm.slice(0, 3),
 normAbbrev: norm.slice(0, 3),
 name: bookName,
 normName: norm,
 testament: idx < 5 ? 'AT' : 'NT',
 chapters
 })
 idx += 1
 }
 return books
}

function getIndexedBooks(): IndexedBook[] {
 if (cachedBooks) return cachedBooks
 const books = getDataBooks('es_rvr.json')
 cachedBooks = books ?? buildFallbackBooks()
 return cachedBooks
}

function findMatchingBook(bookQuery: string, books: readonly IndexedBook[]): IndexedBook | undefined {
 const q = normalizeText(bookQuery)
 .replace(/^san\s+/, '')
 .replace(/^el\s+/, '')
 .trim()
 if (!q) return undefined

 return (
 books.find((b) => b.normName === q || b.normAbbrev === q) ??
 books.find((b) => b.normName.startsWith(q)) ??
 books.find((b) => b.normName.includes(q))
 )
}

interface StoredVersionEntry {
 id: string
 name: string
 abbrev?: string
 fileName: string
 importedAt: string
}

export const BUILTIN_BIBLE_VERSIONS: BibleVersionInfo[] = [
 { id: 'rvr1960', name: 'Reina-Valera 1960', builtIn: true },
 { id: 'rvr1909', name: 'Reina-Valera 1909', builtIn: true },
 { id: 'nvi', name: 'Nueva Versión Internacional', builtIn: true },
 { id: 'dhh', name: 'Dios Habla Hoy', builtIn: true },
 { id: 'lbla', name: 'La Biblia de las Américas', builtIn: true },
 { id: 'tla', name: 'Traducción en Lenguaje Actual', builtIn: true },
 { id: 'ntv', name: 'Nueva Traducción Viviente', builtIn: true },
 { id: 'pdt', name: 'Palabra de Dios para Todos', builtIn: true }
]

/** Si el nombre/abbrev de una importación coincide con una versión built-in, la importación completa esa ranura. */
function findBuiltinSlot(name: string, abbrev?: string): BibleVersionInfo | undefined {
 const normName = normalizeText(name)
 const normAbbrev = abbrev?.trim() ? normalizeText(abbrev) : ''
 return BUILTIN_BIBLE_VERSIONS.find(
 (v) =>
 normName === v.id ||
 normName === normalizeText(v.name) ||
 normName.startsWith(`${v.id} `) ||
 normName.startsWith(`${normalizeText(v.name)} `) ||
 normAbbrev === v.id
 )
}

/**
 * Repositorio de la Biblia completa en español (66 libros) con textos incluidos de
 * Reina-Valera 1960 y Reina-Valera 1909 (dominio público), versiones built-in que
 * requieren importar el XML del usuario (NVI, DHH, LBLA, TLA) y versiones propias
 * importadas en formato XML Zefania (el que usa Holyrics), almacenadas en `bibleDir`
 * (`versions.json` + `<id>.json`).
 */
export class BibleRepository {
 private readonly bibleDir: string | undefined
 private readonly versionBooksCache = new Map<string, IndexedBook[]>()

 constructor(bibleDir?: string) {
 this.bibleDir = bibleDir
 }

 // --- Catálogo de versiones ---

 private get manifestPath(): string | null {
 return this.bibleDir ? join(this.bibleDir, 'versions.json') : null
 }

 private readManifest(): StoredVersionEntry[] {
 const path = this.manifestPath
 if (!path || !existsSync(path)) return []
 try {
 const parsed = JSON.parse(readFileSync(path, 'utf-8').replace(/^\uFEFF/, '')) as unknown
 if (!Array.isArray(parsed)) return []
 return parsed.filter(
 (e): e is StoredVersionEntry =>
 !!e &&
 typeof e === 'object' &&
 typeof (e as StoredVersionEntry).id === 'string' &&
 typeof (e as StoredVersionEntry).name === 'string' &&
 typeof (e as StoredVersionEntry).fileName === 'string'
 )
 } catch {
 return []
 }
 }

 private writeManifest(entries: StoredVersionEntry[]): void {
 const path = this.manifestPath
 if (!path) return
 try {
 if (this.bibleDir && !existsSync(this.bibleDir)) {
 mkdirSync(this.bibleDir, { recursive: true })
 }
 writeFileSync(path, JSON.stringify(entries, null, 2), 'utf-8')
 } catch (err) {
 console.warn('[BibleRepository] No se pudo guardar el manifiesto de versiones:', err)
 }
 }

 listVersions(): BibleVersionInfo[] {
 const manifest = this.readManifest()
 return [
 ...BUILTIN_BIBLE_VERSIONS.map((v) => {
 const dataFile = BUILTIN_DATA_FILES[v.id]
 const hasData = dataFile ? getDataBooks(dataFile) !== null : false
 return { ...v, available: hasData || manifest.some((e) => e.id === v.id) }
 }),
 ...manifest
 .filter((e) => !BUILTIN_BIBLE_VERSIONS.some((v) => v.id === e.id))
 .map((e) => ({ id: e.id, name: e.name, builtIn: false, available: true }))
 ]
 }

 /**
 * Importa una Biblia en XML Zefania (formato Holyrics) y la registra como versión propia.
 * Si el nombre coincide con una versión built-in (p. ej. "NVI"), la importación completa
 * esa ranura y se convierte en el texto real de esa versión.
 */
 importVersion(request: BibleVersionImportRequest): BibleVersionInfo[] {
 const parsedBooks = parseBibleContent(request.content, request.fileName)
 const name = request.name.trim().slice(0, 80)
 if (!name) throw new Error('La versión necesita un nombre.')

 const manifest = this.readManifest()
 const slot = findBuiltinSlot(name, request.abbrev)
 let id: string
 if (slot) {
 id = slot.id
 } else {
 const base =
 name
 .toLowerCase()
 .normalize('NFD')
 .replace(/[\u0300-\u036f]/g, '')
 .replace(/[^a-z0-9]+/g, '-')
 .replace(/^-+|-+$/g, '')
 .slice(0, 40) || 'version'
 id = base
 let suffix = 2
 while (manifest.some((e) => e.id === id)) {
 id = `${base}-${suffix}`
 suffix += 1
 }
 }

 const fileName = `${id}.json`
 if (this.bibleDir) {
 try {
 if (!existsSync(this.bibleDir)) mkdirSync(this.bibleDir, { recursive: true })
 writeFileSync(join(this.bibleDir, fileName), JSON.stringify(parsedBooks), 'utf-8')
 } catch (err) {
 throw new Error('No se pudo guardar el archivo de la versión.', { cause: err })
 }
 }

 const entry: StoredVersionEntry = {
 id,
 name: slot ? slot.name : name,
 ...(request.abbrev?.trim() ? { abbrev: request.abbrev.trim().slice(0, 16) } : {}),
 fileName,
 importedAt: new Date().toISOString()
 }
 this.writeManifest([...manifest.filter((e) => e.id !== id), entry])
 this.versionBooksCache.delete(id)
 return this.listVersions()
 }

 /** Elimina una versión propia (una importación sobre una ranura built-in sí se puede eliminar; las ranuras puras no existen en el manifiesto). */
 deleteVersion(id: string): BibleVersionInfo[] {
 const manifest = this.readManifest()
 const entry = manifest.find((e) => e.id === id)
 if (!entry) throw new Error('La versión no existe.')
 if (this.bibleDir) {
 try {
 const filePath = join(this.bibleDir, entry.fileName)
 if (existsSync(filePath)) rmSync(filePath)
 } catch (err) {
 console.warn('[BibleRepository] No se pudo eliminar el archivo de la versión:', err)
 }
 }
 this.versionBooksCache.delete(id)
 this.writeManifest(manifest.filter((e) => e.id !== id))
 return this.listVersions()
 }

 private findStoredEntry(version?: string): StoredVersionEntry | undefined {
 const raw = version?.trim()
 if (!raw) return undefined
 const q = normalizeText(raw)
 return this.readManifest().find(
 (e) => e.id === raw || normalizeText(e.name) === q || (e.abbrev ? normalizeText(e.abbrev) === q : false)
 )
 }

 private getStoredBooks(entry: StoredVersionEntry): IndexedBook[] | null {
 const cached = this.versionBooksCache.get(entry.id)
 if (cached) return cached
 if (!this.bibleDir) return null
 try {
 const filePath = join(this.bibleDir, entry.fileName)
 if (!existsSync(filePath)) return null
 const raw = readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '')
 const parsed = JSON.parse(raw) as RawBibleBook[]
 if (!Array.isArray(parsed) || parsed.length === 0) return null
 const books = parsed.map((b, idx): IndexedBook => ({
 index: idx,
 abbrev: b.abbrev,
 normAbbrev: normalizeText(b.abbrev),
 name: b.name,
 normName: normalizeText(b.name),
 testament: idx < 39 ? 'AT' : 'NT',
 chapters: b.chapters
 }))
 this.versionBooksCache.set(entry.id, books)
 return books
 } catch {
 return null
 }
 }

 /** Resuelve qué libros, etiqueta y disponibilidad usar según la versión pedida. */
 private resolveVersion(
 version?: string
 ): { books: readonly IndexedBook[]; versionLabel: string; isImported: boolean; available: boolean } {
 const entry = this.findStoredEntry(version)
 if (entry) {
 const stored = this.getStoredBooks(entry)
 if (stored) return { books: stored, versionLabel: entry.name, isImported: true, available: true }
 }
 const raw = version?.trim() || 'rvr1960'
 const normRaw = normalizeText(raw)
 const builtin = BUILTIN_BIBLE_VERSIONS.find((v) => v.id === raw || normalizeText(v.name) === normRaw)
 if (builtin) {
 const books = builtin.id === 'rvr1960' ? getIndexedBooks() : getDataBooks(BUILTIN_DATA_FILES[builtin.id] ?? '')
 if (books) return { books, versionLabel: builtin.name, isImported: false, available: true }
 }
 return { books: [], versionLabel: raw, isImported: false, available: false }
 }

 listBooks(version?: string): BibleBookSummary[] {
 return this.resolveVersion(version).books.map((b) => {
 const chapters: number[] = []
 b.chapters.forEach((verses, idx) => {
 if (verses.length > 0) chapters.push(idx + 1)
 })
 return {
 book: b.name,
 abbrev: b.abbrev,
 testament: b.testament,
 chapters
 }
 })
 }

 getChapter(book: string, chapter: number, version?: string): BibleVerse[] {
 const { books, versionLabel } = this.resolveVersion(version)
 const target = findMatchingBook(book, books)
 if (!target) return []
 const verses = target.chapters[chapter - 1]
 if (!verses) return []

 const result: BibleVerse[] = []
 verses.forEach((text, idx) => {
 if (text) {
 result.push({
 book: target.name,
 chapter,
 verse: idx + 1,
 text,
 version: versionLabel
 })
 }
 })
 return result
 }

 search(query: string, limit = 60, version?: string): BibleVerse[] {
 const trimmed = query.trim()
 const { books, versionLabel } = this.resolveVersion(version)
 if (!trimmed) {
 return this.getChapter('Salmos', 23, version)
 }

 // 1. Cita bíblica directa: ej. "Juan 3:16", "jn3:16", "jn 3 16", "Salmos 23:1-6", "1co13:4-8", "Gn 1:1"
 const refMatch =
 /^([1-3]?\s*[a-zA-ZáéíóúÁÉÍÓÚñÑ.\s]+?)\s*(\d+)(?:(?:\s*[:.,]\s*|\s+)(\d+)(?:\s*-\s*(\d+))?)?$/.exec(
 trimmed
 )
 if (refMatch) {
 const bookPart = refMatch[1] ?? ''
 const chapter = Number(refMatch[2])
 const verseStart = refMatch[3] ? Number(refMatch[3]) : undefined
 const verseEnd = refMatch[4] ? Number(refMatch[4]) : verseStart

 const targetBook = findMatchingBook(bookPart, books)
 if (targetBook && chapter >= 1 && chapter <= targetBook.chapters.length) {
 const chapterVerses = this.getChapter(targetBook.name, chapter, version)
 if (verseStart !== undefined && verseEnd !== undefined) {
 return chapterVerses.filter((v) => v.verse >= verseStart && v.verse <= verseEnd)
 }
 return chapterVerses
 }
 }

 // 2. Búsqueda de texto completo en los libros de la versión activa (acento-insensible, con límite)
 const terms = normalizeText(trimmed)
 .split(/\s+/)
 .filter((t) => t.length >= 2)
 if (terms.length === 0) return []

 const matches: BibleVerse[] = []
 for (const b of books) {
 for (let chIdx = 0; chIdx < b.chapters.length; chIdx++) {
 const ch = b.chapters[chIdx]
 if (!ch) continue
 for (let vIdx = 0; vIdx < ch.length; vIdx++) {
 const text = ch[vIdx]
 if (!text) continue
 const normVerse = normalizeText(text)
 if (terms.every((t) => normVerse.includes(t))) {
 matches.push({
 book: b.name,
 chapter: chIdx + 1,
 verse: vIdx + 1,
 text,
 version: versionLabel
 })
 if (matches.length >= limit) return matches
 }
 }
 }
 }
 return matches
 }
}

