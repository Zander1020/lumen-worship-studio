import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import type { BibleVerse } from '../../../../shared/ipc'
import { parseBibleCitation, resolveBibleCitationBook, versesToSlides } from '../../../../shared/slideHelpers'
import type { UseAppStatus } from '../../hooks/useAppStatus'

export interface BiblePageProps {
  app: UseAppStatus
}

type TestamentFilter = 'ALL' | 'AT' | 'NT'

const PENTATEUCH = new Set(['Génesis', 'Éxodo', 'Levítico', 'Números', 'Deuteronomio'])
const POETIC = new Set(['Job', 'Salmos', 'Proverbios', 'Eclesiastés', 'Cantares'])
const GOSPELS = new Set(['Mateo', 'Marcos', 'Lucas', 'Juan', 'Hechos'])

function getBookDivisionColor(bookName: string, testament?: 'AT' | 'NT'): string {
  if (PENTATEUCH.has(bookName)) return '#d97706'
  if (POETIC.has(bookName)) return '#10b981'
  if (GOSPELS.has(bookName)) return '#38bdf8'
  if (testament === 'NT') return '#a78bfa'
  return '#71717a'
}

/** Normaliza citas escritas con espacios o sin espacios tipo `jn 3 16` o `jn3:16` (Mejoras 22, 36). */
function normalizePredictiveCitation(raw: string): string {
  return raw
    .trim()
    .replace(/^([1-3]?\s*[a-zA-ZáéíóúñÁÉÍÓÚÑ]+)\s+(\d+)\s+(\d+(?:-\d+)?)$/, '$1 $2:$3')
}

export function BiblePage({ app }: BiblePageProps) {
  const [testament] = useState<TestamentFilter>('ALL')
  const [bookSearch, setBookSearch] = useState('')
  const [selectedBook, setSelectedBook] = useState('Salmos')
  const [selectedChapter, setSelectedChapter] = useState(23)
  const [query, setQuery] = useState('')
  const [verses, setVerses] = useState<BibleVerse[]>([])
  const [activeVerseNum, setActiveVerseNum] = useState<number | null>(null)
  const splitLongVerses = false
  const parallelMode = false
  const [highlightWord, setHighlightWord] = useState('')
  const [bibleVersion, setBibleVersion] = useState('Reina-Valera 1960')
  const [recentPassages, setRecentPassages] = useState<string[]>([])

  const [chapterVerses, setChapterVerses] = useState<BibleVerse[]>([])

  const filteredBooks = useMemo(() => {
    const q = bookSearch.trim().toLowerCase()
    return app.bibleBooks.filter((b) => {
      if (testament !== 'ALL' && b.testament && b.testament !== testament) return false
      if (!q) return true
      return (
        b.book.toLowerCase().includes(q) ||
        (b.abbrev ? b.abbrev.toLowerCase().includes(q) : false)
      )
    })
  }, [app.bibleBooks, testament, bookSearch])

  const currentBookSummary =
    app.bibleBooks.find((b) => b.book === selectedBook) ?? app.bibleBooks[0]

  // Siempre mantener cargados los versículos del capítulo actualmente seleccionado
  useEffect(() => {
    let active = true
    void app.getBibleChapter({ book: selectedBook, chapter: selectedChapter, version: bibleVersion }).then((res) => {
      if (active) {
        setChapterVerses(res)
        if (!query.trim()) {
          setVerses(res)
          setActiveVerseNum(null)
        }
      }
    })
    return () => {
      active = false
    }
  }, [app, selectedBook, selectedChapter, bibleVersion])

  const handleVersionChange = async (newVer: string): Promise<void> => {
    setBibleVersion(newVer)
    const chapRes = await app.getBibleChapter({ book: selectedBook, chapter: selectedChapter, version: newVer })
    setChapterVerses(chapRes)
    if (query.trim().length > 0) {
      const results = await app.searchBible(query.trim())
      setVerses(results)
      return
    }
    setVerses(chapRes)
    if (isChapterLive && chapRes.length > 0) {
      const currentIdx = live.currentIndex >= 0 && live.currentIndex < chapRes.length ? live.currentIndex : 0
      void app.loadProjectionDeck({
        deckTitle: currentDeckTitle,
        slides: versesToSlides(chapRes, splitLongVerses, newVer),
        startIndex: currentIdx
      })
    }
  }

  const handleSearch = async (text: string): Promise<void> => {
    setQuery(text)
    if (!text.trim()) return
    const normalized = normalizePredictiveCitation(text)
    const results = await app.searchBible(normalized)
    setVerses(results)
  }

  const handleKeyDownSearch = async (e: KeyboardEvent<HTMLInputElement>): Promise<void> => {
    if (e.key !== 'Enter') return
    const text = query.trim()
    if (!text) return
    const parsed = parseBibleCitation(text)
    if (parsed) {
      const bookName = resolveBibleCitationBook(parsed.rawBook, app.bibleBooks)
      if (bookName) {
        setSelectedBook(bookName)
        setSelectedChapter(parsed.chapter)
        const chapterVerses = await app.getBibleChapter({ book: bookName, chapter: parsed.chapter, version: bibleVersion })
        setVerses(chapterVerses)
        const targetVerseNum = parsed.verseStart ?? 1
        setActiveVerseNum(targetVerseNum)
        const targetIdx = chapterVerses.findIndex((v) => v.verse === targetVerseNum)
        const effectiveIdx = targetIdx >= 0 ? targetIdx : 0
        const slides = buildBibleSlides(chapterVerses)
        void app.loadProjectionDeck({
          deckTitle: `${bookName} ${parsed.chapter}`,
          slides,
          startIndex: effectiveIdx,
          openWindow: true
        })
        void app.setProjectionMode('live')
        if (!app.status?.projection.windowOpen) {
          void app.openProjection({ target: 'auto' })
        }
        return
      }
    }
    const results = await app.searchBible(text)
    setVerses(results)
    if (results.length > 0) {
      const first = results[0]
      if (first) {
        setActiveVerseNum(first.verse)
        const slides = buildBibleSlides(results)
        void app.loadProjectionDeck({
          deckTitle: `Búsqueda: ${text}`,
          slides,
          startIndex: 0,
          openWindow: true
        })
        void app.setProjectionMode('live')
        if (!app.status?.projection.windowOpen) {
          void app.openProjection({ target: 'auto' })
        }
      }
    }
  }

  const buildBibleSlides = (list: readonly BibleVerse[]) => {
    const baseSlides = versesToSlides(list, splitLongVerses, bibleVersion)
    if (!parallelMode) return baseSlides
    return baseSlides.map((sl, idx) => {
      const nextV = list[idx + 1]
      return {
        ...sl,
        parallelLines: nextV ? [`[${nextV.book} ${nextV.chapter}:${nextV.verse}] ${nextV.text}`] : ['—']
      }
    })
  }

  const live = app.status?.projection.live
  const currentDeckTitle = query.trim()
    ? `Búsqueda: ${query.trim()}`
    : `${selectedBook} ${selectedChapter}`
  const isChapterLive = live?.deckTitle === currentDeckTitle
  const displayedActiveVerse = isChapterLive
    ? (verses[live.currentIndex]?.verse ?? activeVerseNum)
    : activeVerseNum

  const projectFromVerse = async (index: number, openWindow = false): Promise<void> => {
    const targetVerse = verses[index] ?? verses[0]
    if (!targetVerse) return

    // Si estábamos en modo búsqueda (hay una consulta de texto) y se hace doble clic para proyectar,
    // ubicamos automáticamente la vista en el libro, capítulo y versículo encontrado para continuar
    // proyectando el resto del pasaje de ese capítulo.
    if (query.trim() && openWindow) {
      setSelectedBook(targetVerse.book)
      setSelectedChapter(targetVerse.chapter)
      setQuery('')
      const fullChapVerses = await app.getBibleChapter({
        book: targetVerse.book,
        chapter: targetVerse.chapter,
        version: bibleVersion
      })
      setChapterVerses(fullChapVerses)
      setVerses(fullChapVerses)
      setActiveVerseNum(targetVerse.verse)
      const targetIdx = fullChapVerses.findIndex((v) => v.verse === targetVerse.verse)
      const effectiveIdx = targetIdx >= 0 ? targetIdx : 0
      const refLabel = `${targetVerse.book} ${targetVerse.chapter}:${targetVerse.verse}`
      setRecentPassages((prev) => [refLabel, ...prev.filter((r) => r !== refLabel)].slice(0, 8))
      void app.loadProjectionDeck({
        deckTitle: `${targetVerse.book} ${targetVerse.chapter}`,
        slides: buildBibleSlides(fullChapVerses),
        startIndex: effectiveIdx,
        openWindow: true
      })
      if (!app.status?.projection.windowOpen) {
        void app.openProjection({ target: 'auto' })
      }
      return
    }

    setActiveVerseNum(targetVerse.verse)
    const refLabel = `${targetVerse.book} ${targetVerse.chapter}:${targetVerse.verse}`
    setRecentPassages((prev) => [refLabel, ...prev.filter((r) => r !== refLabel)].slice(0, 8))
    void app.loadProjectionDeck({
      deckTitle: currentDeckTitle,
      slides: buildBibleSlides(verses),
      startIndex: index,
      ...(openWindow ? { openWindow: true } : {})
    })
    if (openWindow && !app.status?.projection.windowOpen) {
      void app.openProjection({ target: 'auto' })
    }
  }

  const selectBook = (bookName: string): void => {
    setSelectedBook(bookName)
    setQuery('')
    const summary = app.bibleBooks.find((b) => b.book === bookName)
    if (summary?.chapters[0]) setSelectedChapter(summary.chapters[0])
  }

  const applyHighlightWord = (word: string): void => {
    setHighlightWord(word)
    void app.updateProjectionTheme({ highlightWord: word.trim() })
  }

  return (
    <section className="page hly-page" aria-labelledby="page-title">
      {/* Barra superior compacta de 1 sola fila para dejar toda la altura a los versículos */}
      <header className="hly-module-bar hly-module-bar--compact">
        <div className="hly-module-bar__left" style={{ flex: 1, alignItems: 'center', gap: 8 }}>
          <h1 id="page-title" className="hly-module-bar__title">
            Biblia
          </h1>
          <input
            type="search"
            aria-label="Buscar en la Biblia"
            placeholder="Cita o palabra (ej. jn3:16, jn 3 16, Salmos 23:1-6)... (Enter proyecta directo)"
            value={query}
            onChange={(e) => void handleSearch(e.target.value)}
            onKeyDown={(e) => void handleKeyDownSearch(e)}
            style={{ maxWidth: 420, flex: 1 }}
          />
          <select
            aria-label="Versión bíblica"
            value={bibleVersion}
            onChange={(e) => void handleVersionChange(e.target.value)}
            style={{ width: 140, fontWeight: 700 }}
            title="Seleccionar versión bíblica para la proyección"
          >
            <option value="Reina-Valera 1960">RVR 1960</option>
            <option value="Reina-Valera 1909">RVR 1909</option>
            <option value="Nueva Versión Internacional">NVI</option>
            <option value="Dios Habla Hoy">DHH</option>
            <option value="La Biblia de las Américas">LBLA</option>
            <option value="Traducción en Lenguaje Actual">TLA</option>
          </select>
          <input
            type="text"
            placeholder="Resaltar palabra..."
            value={highlightWord}
            onChange={(e) => applyHighlightWord(e.target.value)}
            style={{ width: 130 }}
          />
        </div>
      </header>

      {/* Disposición de 3 columnas a altura completa estilo Holyrics: [Libros] | [Capítulos + Versos] | [Versículos arriba] */}
      <div className="hly-bible-workbench">
        {/* COLUMNA 1: LIBROS (66) */}
        <div className="hly-panel hly-panel--flex">
          <div className="hly-panel__header">
            <span className="hly-panel__title">LIBROS ({app.bibleBooks.length || 66})</span>
          </div>

          <div className="hly-SubToolbar">
            <input
              type="search"
              aria-label="Filtrar libros"
              placeholder="Filtrar libro (ej. Sal, Jn, Gn)..."
              value={bookSearch}
              onChange={(e) => setBookSearch(e.target.value)}
            />
          </div>

          <div className="bible-book-list" role="list" aria-label="Libros de la Biblia" style={{ padding: 4 }}>
            {filteredBooks.map((b) => {
              const active = b.book === selectedBook && !query.trim()
              const divColor = getBookDivisionColor(b.book, b.testament)
              return (
                <button
                  key={b.book}
                  type="button"
                  role="listitem"
                  style={{ borderLeft: `3px solid ${divColor}` }}
                  className={`bible-book-btn${active ? ' bible-book-btn--active' : ''}`}
                  onClick={() => selectBook(b.book)}
                >
                  <span className="bible-book-btn__name">{b.book}</span>
                  <span className="bible-book-btn__meta">
                    {b.abbrev?.toUpperCase() ?? ''} · {b.chapters.length}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* COLUMNA 2: CUADRÍCULA DE CAPÍTULOS (ARRIBA) + SALTO A VERSÍCULO (ABAJO) */}
        <div className="hly-bible-keypads-col">
          <div className="hly-panel hly-panel--flex">
            <div className="hly-panel__header">
              <span className="hly-panel__title">CAPÍTULOS ({currentBookSummary?.chapters.length ?? 1})</span>
            </div>
            <div className="hly-keypad-scroll" role="list" aria-label="Capítulos disponibles">
              {(currentBookSummary?.chapters ?? [1]).map((ch) => {
                const active = ch === selectedChapter && !query.trim()
                return (
                  <button
                    key={ch}
                    type="button"
                    role="listitem"
                    className={`chapter-chip${active ? ' chapter-chip--active' : ''}`}
                    onClick={() => {
                      setSelectedChapter(ch)
                      setQuery('')
                    }}
                  >
                    {ch}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="hly-panel hly-panel--flex">
            <div className="hly-panel__header">
              <span className="hly-panel__title">VERSÍCULOS ({chapterVerses.length || verses.length})</span>
            </div>
            <div className="hly-keypad-scroll" role="list" aria-label="Salto rápido a versículos">
              {(chapterVerses.length > 0 ? chapterVerses : verses).map((v, idx) => {
                const active = displayedActiveVerse === v.verse
                return (
                  <button
                    key={v.verse}
                    type="button"
                    role="listitem"
                    title="1 clic: Previa · Doble clic: Activar proyección y enviar versículo"
                    className={`chapter-chip${active ? ' chapter-chip--active' : ''}`}
                    onClick={() => {
                      if (query.trim()) {
                        // Si el usuario toca el teclado numérico mientras busca, cambiar directamente al capítulo actual
                        setQuery('')
                        setVerses(chapterVerses)
                      }
                      void projectFromVerse(idx, false)
                    }}
                    onDoubleClick={() => {
                      if (query.trim()) {
                        setQuery('')
                        setVerses(chapterVerses)
                      }
                      void projectFromVerse(idx, true)
                    }}
                  >
                    {v.verse}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* COLUMNA 3: VERSÍCULOS EN LA PARTE SUPERIOR Y A ALTURA COMPLETA */}
        <div className="hly-panel hly-panel--flex">
          <div className="hly-panel__header">
            <span className="hly-panel__title">
              📖{' '}
              {query.trim()
                ? `RESULTADOS PARA «${query.toUpperCase()}» (${verses.length}) · ${bibleVersion}`
                : `${selectedBook.toUpperCase()} ${selectedChapter} (${verses.length} VERSÍCULOS) · ${bibleVersion}`}
            </span>
          </div>

          {recentPassages.length > 0 && (
            <div className="hly-SubToolbar" style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {recentPassages.slice(0, 4).map((ref) => (
                <button
                  key={ref}
                  type="button"
                  className="hly-mini-btn"
                  onClick={() => void handleSearch(ref)}
                >
                  ↺ {ref}
                </button>
              ))}
            </div>
          )}

          {verses.length === 0 ? (
            <div className="hly-empty-box" style={{ margin: 10 }}>
              No se encontraron versículos para esa consulta.
            </div>
          ) : (
            <ul className="verse-list verse-list--fullheight" aria-label="Versículos bíblicos">
              {verses.map((v, idx) => {
                const isProjected = displayedActiveVerse === v.verse
                return (
                  <li
                    key={`${v.book}-${v.chapter}-${v.verse}`}
                    className={`verse-row${isProjected ? ' verse-row--active' : ''}`}
                    title="1 clic: Cargar en monitor · Doble clic: Activar proyección y enviar versículo"
                    onClick={() => projectFromVerse(idx, false)}
                    onDoubleClick={() => projectFromVerse(idx, true)}
                  >
                    <div className="verse-row__num">{v.verse}</div>
                    <div className="verse-row__content">
                      {query.trim() && (
                        <div className="verse-row__ref">
                          {v.book} {v.chapter}:{v.verse}
                        </div>
                      )}
                      <div className="verse-row__text">{v.text}</div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
