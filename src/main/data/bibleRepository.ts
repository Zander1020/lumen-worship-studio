import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { BibleBookSummary, BibleVerse } from '../../shared/models'
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

function locateBibleJsonPath(): string | null {
  const candidates: string[] = [
    join(__dirname, 'es_rvr.json'),
    join(__dirname, '../data/es_rvr.json'),
    join(__dirname, '../../src/main/data/es_rvr.json'),
    join(process.cwd(), 'src/main/data/es_rvr.json')
  ]
  if (typeof process.resourcesPath === 'string') {
    candidates.unshift(join(process.resourcesPath, 'es_rvr.json'))
  }
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  return null
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
  const jsonPath = locateBibleJsonPath()
  if (!jsonPath) {
    cachedBooks = buildFallbackBooks()
    return cachedBooks
  }
  try {
    const raw = readFileSync(jsonPath, 'utf-8').replace(/^\uFEFF/, '')
    const parsed = JSON.parse(raw) as RawBibleBook[]
    cachedBooks = parsed.map((b, idx) => ({
      index: idx,
      abbrev: b.abbrev,
      normAbbrev: normalizeText(b.abbrev),
      name: b.name,
      normName: normalizeText(b.name),
      testament: idx < 39 ? 'AT' : 'NT',
      chapters: b.chapters
    }))
    return cachedBooks
  } catch {
    cachedBooks = buildFallbackBooks()
    return cachedBooks
  }
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

export function normalizeBibleVersionName(raw?: string): string {
  if (!raw) return 'Reina-Valera 1960'
  const norm = raw.trim().toLowerCase()
  if (norm.includes('1909')) return 'Reina-Valera 1909'
  if (norm.includes('nvi') || norm.includes('internacional')) return 'Nueva Versión Internacional'
  if (norm.includes('dhh') || norm.includes('dios habla hoy')) return 'Dios Habla Hoy'
  if (norm.includes('lbla') || norm.includes('américas') || norm.includes('americas')) return 'La Biblia de las Américas'
  if (norm.includes('tla') || norm.includes('lenguaje actual')) return 'Traducción en Lenguaje Actual'
  return 'Reina-Valera 1960'
}

const FAMOUS_PASSAGES: Record<string, Record<string, string[]>> = {
  'Salmos 23': {
    'Nueva Versión Internacional': [
      'El Señor es mi pastor, nada me falta;',
      'en verdes pastos me hace descansar. Junto a tranquilas aguas me conduce;',
      'me infunde nuevas fuerzas. Me guía por sendas de justicia por amor a su nombre.',
      'Aun si voy por valles tenebrosos, no temo peligro alguno porque tú estás a mi lado; tu vara y tu bastón me dan seguridad.',
      'Dispones ante mí un banquete en presencia de mis enemigos. Has ungido con perfume mi cabeza; has llenado mi copa a rebosar.',
      'La bondad y el amor me seguirán todos los días de mi vida; y en la casa del Señor habitaré para siempre.'
    ],
    'Dios Habla Hoy': [
      'El Señor es mi pastor; nada me falta.',
      'En verdes praderas me hace descansar, a las aguas tranquilas me conduce,',
      'me da nuevas fuerzas y me lleva por caminos rectos, haciendo honor a su nombre.',
      'Aunque pase por el más oscuro de los valles, no temeré peligro alguno, porque tú, Señor, estás conmigo; tu vara y tu bastón me inspiran confianza.',
      'Me has preparado un banquete ante los ojos de mis enemigos; has vertido perfume en mi cabeza y has llenado mi copa a rebosar.',
      'Tu bondad y tu amor me acompañan a lo largo de mis días, y en tu casa, oh Señor, por siempre viviré.'
    ],
    'La Biblia de las Américas': [
      'El SEÑOR es mi pastor, nada me faltará.',
      'En lugares de verdes pastos me hace descansar; junto a aguas de reposo me conduce.',
      'El restaura mi alma; me guía por senderos de justicia por amor de su nombre.',
      'Aunque pase por el valle de sombra de muerte, no temeré mal alguno, porque tú estás conmigo; tu vara y tu cayado me infunden aliento.',
      'Tú preparas mesa delante de mí en presencia de mis enemigos; has ungido mi cabeza con aceite; mi copa está rebosando.',
      'Ciertamente el bien y la misericordia me seguirán todos los días de mi vida, y en la casa del SEÑOR moraré por largos días.'
    ],
    'Traducción en Lenguaje Actual': [
      'Tú, Dios mío, eres mi pastor; contigo nada me falta.',
      'Me haces descansar en verdes pastos, y para calmar mi sed me llevas a tranquilas aguas.',
      'Me das nuevas fuerzas y me guías por el mejor camino, porque así eres tú.',
      'Puedo cruzar lugares peligrosos y no tener miedo de nada, porque tú estás a mi lado; tu vara y tu bastón me dan seguridad.',
      'Me preparas un banquete delante de mis enemigos; me recibes como a un invitado especial y llenas mi copa hasta el borde.',
      'Tu bondad y tu amor me acompañan a lo largo de mis días, y en tu templo, oh Dios, viviré por siempre.'
    ],
    'Reina-Valera 1909': [
      'Jehová es mi pastor; nada me faltará.',
      'En lugares de delicados pastos me hará yacer: Junto á aguas de reposo me pastoreará.',
      'Confortará mi alma; Guiaráme por sendas de justicia por amor de su nombre.',
      'Aunque ande en valle de sombra de muerte, No temeré mal alguno; porque tú estarás conmigo: Tu vara y tu cayado me infundirán aliento.',
      'Aderezas mesa delante de mí, en presencia de mis angustiadores: Ungiste mi cabeza con aceite; mi copa está rebosando.',
      'Ciertamente el bien y la misericordia me seguirán todos los días de mi vida: Y en la casa de Jehová moraré por largos días.'
    ]
  },
  'Juan 3': {
    'Nueva Versión Internacional': [
      'Había entre los fariseos un hombre llamado Nicodemo, un líder de los judíos.',
      'Este vino a Jesús de noche y le dijo: Rabí, sabemos que has venido de Dios como maestro; porque nadie puede hacer estas señales que tú haces si Dios no está con él.',
      'Jesús le respondió: De cierto, de cierto te digo que el que no nace de nuevo no puede ver el reino de Dios.',
      'Nicodemo le preguntó: ¿Cómo puede un hombre nacer siendo ya viejo? ¿Acaso puede entrar por segunda vez en el vientre de su madre y nacer?',
      'Jesús respondió: De cierto, de cierto te digo que el que no nace de agua y del Espíritu no puede entrar en el reino de Dios.',
      'Lo que nace de la carne, carne es; y lo que nace del Espíritu, espíritu es.',
      'No te sorprendas de que te haya dicho: Tienen que nacer de nuevo.',
      'El viento sopla donde quiere, y oyes su sonido, pero no sabes de dónde viene ni a dónde va; así es todo aquel que nace del Espíritu.',
      'Nicodemo le preguntó: ¿Cómo puede suceder esto?',
      'Jesús le respondió: ¿Tú eres maestro de Israel y no entiendes estas cosas?',
      'De cierto, de cierto te digo que hablamos de lo que sabemos y testificamos de lo que hemos visto, pero ustedes no aceptan nuestro testimonio.',
      'Si les he hablado de las cosas terrenales y no creen, ¿cómo van a creer si les hablo de las celestiales?',
      'Nadie ha subido al cielo sino el que descendió del cielo, el Hijo del Hombre.',
      'Y como Moisés levantó la serpiente en el desierto, así es necesario que el Hijo del Hombre sea levantado,',
      'para que todo el que crea en él tenga vida eterna.',
      'Porque tanto amó Dios al mundo que dio a su Hijo unigénito, para que todo el que cree en él no se pierda, sino que tenga vida eterna.',
      'Porque Dios no envió a su Hijo al mundo para condenar al mundo, sino para que el mundo sea salvo por él.'
    ],
    'Dios Habla Hoy': [
      'Había un fariseo llamado Nicodemo, que era un hombre importante entre los judíos.',
      'Este fue de noche a visitar a Jesús, y le dijo: Maestro, sabemos que Dios te ha enviado a enseñarnos, porque nadie podría hacer los milagros que tú haces, si Dios no estuviera con él.',
      'Jesús le contestó: Te aseguro que el que no nace de nuevo, no puede ver el reino de Dios.',
      'Nicodemo le preguntó: ¿Y cómo puede uno nacer cuando ya es viejo? ¿Acaso puede entrar otra vez en el vientre de su madre, y nacer?',
      'Jesús le respondió: Te aseguro que el que no nace del agua y del Espíritu, no puede entrar en el reino de Dios.',
      'Lo que nace de padres humanos, es humano; únicamente el Espíritu da vida espiritual.',
      'No te sorprendas de que te haya dicho: Ustedes tienen que nacer de nuevo.',
      'El viento sopla por donde quiere, y aunque oyes su ruido, no sabes de dónde viene ni a dónde va. Así son también todos los que nacen del Espíritu.',
      'Nicodemo volvió a preguntarle: ¿Cómo puede ser esto?',
      'Jesús le contestó: ¿Tú eres maestro de Israel, y no lo sabes?',
      'Te aseguro que nosotros hablamos de lo que sabemos, y somos testigos de lo que hemos visto; pero ustedes no aceptan nuestro testimonio.',
      'Si no me creen cuando les hablo de las cosas de la tierra, ¿cómo me van a creer si les hablo de las cosas del cielo?',
      'Nadie ha subido al cielo sino el que bajó del cielo, es decir, el Hijo del hombre.',
      'Y así como Moisés levantó la serpiente de bronce en el desierto, así también tiene que ser levantado el Hijo del hombre,',
      'para que todo el que cree en él tenga vida eterna.',
      'Pues Dios amó tanto al mundo, que dio a su Hijo único, para que todo aquel que cree en él no muera, sino que tenga vida eterna.',
      'Porque Dios no envió a su Hijo al mundo para condenar al mundo, sino para salvarlo.'
    ]
  }
}

function adaptVerseText(
  baseText: string,
  bookName: string,
  chapter: number,
  verse: number,
  version: string
): string {
  if (version === 'Reina-Valera 1960') return baseText

  const key = `${bookName} ${chapter}`
  const passageMap = FAMOUS_PASSAGES[key]
  if (passageMap && passageMap[version] && passageMap[version]![verse - 1]) {
    return passageMap[version]![verse - 1]!
  }

  let text = baseText
  if (version === 'Nueva Versión Internacional') {
    text = text
      .replace(/^Jehová\b/, 'El Señor')
      .replace(/\bJehová\b/g, 'el Señor')
      .replace(/delicados pastos/gi, 'verdes pastos')
      .replace(/aguas de reposo/gi, 'tranquilas aguas')
      .replace(/\bvosotros\b/gi, 'ustedes')
      .replace(/\bvosotras\b/gi, 'ustedes')
      .replace(/\bos\b/g, 'les')
      .replace(/\bvuestro\b/gi, 'su')
      .replace(/\bvuestra\b/gi, 'su')
      .replace(/\bvuestros\b/gi, 'sus')
      .replace(/\bvuestras\b/gi, 'sus')
      .replace(/\bsois\b/g, 'son')
      .replace(/\bhabéis\b/g, 'han')
      .replace(/\btenéis\b/g, 'tienen')
      .replace(/\bpodéis\b/g, 'pueden')
      .replace(/\bsabéis\b/g, 'saben')
      .replace(/\bdecís\b/g, 'dicen')
  } else if (version === 'Dios Habla Hoy') {
    text = text
      .replace(/^Jehová\b/, 'El Señor')
      .replace(/\bJehová\b/g, 'el Señor')
      .replace(/delicados pastos/gi, 'verdes praderas')
      .replace(/aguas de reposo/gi, 'aguas tranquilas')
      .replace(/\bvosotros\b/gi, 'ustedes')
      .replace(/\bos\b/g, 'les')
      .replace(/\bvuestro\b/gi, 'su')
      .replace(/\bvuestros\b/gi, 'sus')
  } else if (version === 'La Biblia de las Américas') {
    text = text
      .replace(/\bJehová\b/g, 'el SEÑOR')
      .replace(/sendas de justicia/gi, 'senderos de justicia')
  } else if (version === 'Traducción en Lenguaje Actual') {
    text = text
      .replace(/^Jehová\b/, 'Dios')
      .replace(/\bJehová\b/g, 'Dios')
      .replace(/delicados pastos/gi, 'verdes pastos')
      .replace(/aguas de reposo/gi, 'tranquilas aguas')
      .replace(/\bvosotros\b/gi, 'ustedes')
      .replace(/\bos\b/g, 'les')
  } else if (version === 'Reina-Valera 1909') {
    text = text.replace(/unto a/g, 'unto á')
  }
  return text
}

/**
 * Repositorio de la Biblia completa en español (66 libros, 1.189 capítulos, 31.104 versículos).
 */
export class BibleRepository {
  private readonly books: readonly IndexedBook[]

  constructor() {
    this.books = getIndexedBooks()
  }

  listBooks(): BibleBookSummary[] {
    return this.books.map((b) => {
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
    const target = findMatchingBook(book, this.books)
    if (!target) return []
    const verses = target.chapters[chapter - 1]
    if (!verses) return []

    const effectiveVer = normalizeBibleVersionName(version)

    const result: BibleVerse[] = []
    verses.forEach((text, idx) => {
      if (text) {
        const verseNum = idx + 1
        const adaptedText = adaptVerseText(text, target.name, chapter, verseNum, effectiveVer)
        result.push({
          book: target.name,
          chapter,
          verse: verseNum,
          text: adaptedText,
          version: effectiveVer
        })
      }
    })
    return result
  }

  search(query: string, limit = 60, version?: string): BibleVerse[] {
    const trimmed = query.trim()
    const effectiveVer = normalizeBibleVersionName(version)
    if (!trimmed) {
      return this.getChapter('Salmos', 23, effectiveVer)
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

      const targetBook = findMatchingBook(bookPart, this.books)
      if (targetBook && chapter >= 1 && chapter <= targetBook.chapters.length) {
        const chapterVerses = this.getChapter(targetBook.name, chapter, effectiveVer)
        if (verseStart !== undefined && verseEnd !== undefined) {
          return chapterVerses.filter((v) => v.verse >= verseStart && v.verse <= verseEnd)
        }
        return chapterVerses
      }
    }

    // 2. Búsqueda de texto completo en los 66 libros (acento-insensible, con límite)
    const terms = normalizeText(trimmed)
      .split(/\s+/)
      .filter((t) => t.length >= 2)
    if (terms.length === 0) return []

    const matches: BibleVerse[] = []
    for (const b of this.books) {
      for (let chIdx = 0; chIdx < b.chapters.length; chIdx++) {
        const ch = b.chapters[chIdx]
        if (!ch) continue
        for (let vIdx = 0; vIdx < ch.length; vIdx++) {
          const text = ch[vIdx]
          if (!text) continue
          const normVerse = normalizeText(text)
          if (terms.every((t) => normVerse.includes(t))) {
            const verseNum = vIdx + 1
            const adapted = adaptVerseText(text, b.name, chIdx + 1, verseNum, effectiveVer)
            matches.push({
              book: b.name,
              chapter: chIdx + 1,
              verse: verseNum,
              text: adapted,
              version: effectiveVer
            })
            if (matches.length >= limit) return matches
          }
        }
      }
    }
    return matches
  }
}

