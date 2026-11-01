import { useEffect, useMemo, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import type { BibleVersionInfo, BibleVerse } from '../../../../shared/ipc'
import { suggestVersionName } from '../../../../shared/bibleImport'
import { parseBibleCitation, resolveBibleCitationBook, versesToSlides } from '../../../../shared/slideHelpers'
import { ConfirmDeleteModal } from '../../components/ConfirmDeleteModal'
import type { UseAppStatus } from '../../hooks/useAppStatus'

export interface BiblePageProps {
  app: UseAppStatus
}

type TestamentFilter = 'ALL' | 'AT' | 'NT'

const PENTATEUCH = new Set(['Génesis', 'Éxodo', 'Levítico', 'Números', 'Deuteronomio'])
const POETIC = new Set(['Job', 'Salmos', 'Proverbios', 'Eclesiastés', 'Cantares'])
const GOSPELS = new Set(['Mateo', 'Marcos', 'Lucas', 'Juan', 'Hechos'])

const BUILTIN_VERSION_OPTIONS: BibleVersionInfo[] = [
  { id: 'rvr1960', name: 'RVR 1960', builtIn: true },
  { id: 'rvr1909', name: 'RVR 1909', builtIn: true },
  { id: 'nvi', name: 'NVI', builtIn: true },
  { id: 'dhh', name: 'DHH', builtIn: true },
  { id: 'lbla', name: 'LBLA', builtIn: true },
  { id: 'tla', name: 'TLA', builtIn: true },
  { id: 'ntv', name: 'NTV', builtIn: true },
  { id: 'pdt', name: 'PDT', builtIn: true }
]

const BUILTIN_FULL_NAMES: Record<string, string> = {
  rvr1960: 'Reina-Valera 1960',
  rvr1909: 'Reina-Valera 1909',
  nvi: 'Nueva Versión Internacional',
  dhh: 'Dios Habla Hoy',
  lbla: 'La Biblia de las Américas',
  tla: 'Traducción en Lenguaje Actual',
  ntv: 'Nueva Traducción Viviente',
  pdt: 'Palabra de Dios para Todos'
}

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
  const parallelMode = false as boolean
  const [highlightWord, setHighlightWord] = useState('')
  const [bibleVersion, setBibleVersion] = useState('rvr1960')
  const [recentPassages, setRecentPassages] = useState<string[]>([])

  const [showImportModal, setShowImportModal] = useState(false)
  const [importName, setImportName] = useState('')
  const [importAbbrev, setImportAbbrev] = useState('')
  const [importContent, setImportContent] = useState('')
  const [importFileName, setImportFileName] = useState('')
  const [importAttempted, setImportAttempted] = useState(false)
  const [versionToDelete, setVersionToDelete] = useState<BibleVersionInfo | null>(null)

  const [chapterVerses, setChapterVerses] = useState<BibleVerse[]>([])

  const builtinVersions = useMemo(() => {
    const fromApi = app.bibleVersions.filter((v) => v.builtIn)
    return fromApi.length > 0 ? fromApi : BUILTIN_VERSION_OPTIONS
  }, [app.bibleVersions])
  const importedVersions = useMemo(
    () => app.bibleVersions.filter((v) => !v.builtIn),
    [app.bibleVersions]
  )
  const activeVersionInfo = useMemo(
    () => app.bibleVersions.find((v) => v.id === bibleVersion),
    [app.bibleVersions, bibleVersion]
  )
  const activeVersionLabel =
    activeVersionInfo?.name ?? BUILTIN_FULL_NAMES[bibleVersion] ?? 'Reina-Valera 1960'

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
    setImportAttempted(false)
    // Las versiones importadas traen su propio catálogo de libros: recargarlo
    const books = await app.loadBibleBooks(newVer)
    const targetBook = books.find((b) => b.book === selectedBook) ?? books[0]
    if (targetBook && targetBook.book !== selectedBook) {
      setSelectedBook(targetBook.book)
      setSelectedChapter(targetBook.chapters[0] ?? 1)
      return // el efecto superior recarga el capítulo con la nueva versión
    }
    const versionLabel =
      app.bibleVersions.find((v) => v.id === newVer)?.name ??
      BUILTIN_FULL_NAMES[newVer] ??
      'Reina-Valera 1960'
    const chapRes = await app.getBibleChapter({ book: selectedBook, chapter: selectedChapter, version: newVer })
    setChapterVerses(chapRes)
    if (query.trim().length > 0) {
      const results = await app.searchBible(query.trim(), newVer)
      setVerses(results)
      return
    }
    setVerses(chapRes)
    if (isChapterLive && chapRes.length > 0) {
      const currentIdx = live.currentIndex >= 0 && live.currentIndex < chapRes.length ? live.currentIndex : 0
      void app.loadProjectionDeck({
        deckTitle: currentDeckTitle,
        slides: versesToSlides(chapRes, splitLongVerses, versionLabel),
        startIndex: currentIdx
      })
    }
  }

  const handleSearch = async (text: string): Promise<void> => {
    setQuery(text)
    if (!text.trim()) return
    const normalized = normalizePredictiveCitation(text)
    const results = await app.searchBible(normalized, bibleVersion)
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
    const results = await app.searchBible(text, bibleVersion)
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
    const baseSlides = versesToSlides(list, splitLongVerses, activeVersionLabel)
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

  const closeImportModal = (): void => {
    setShowImportModal(false)
    setImportName('')
    setImportAbbrev('')
    setImportContent('')
    setImportFileName('')
    setImportAttempted(false)
  }

  const handleImportFile = (e: ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportFileName(file.name)
    setImportAttempted(false)
    const reader = new FileReader()
    reader.onload = () => {
      setImportContent(typeof reader.result === 'string' ? reader.result : '')
      setImportName((prev) => (prev.trim() ? prev : suggestVersionName(file.name)))
    }
    reader.onerror = () => {
      setImportContent('')
      setImportAttempted(true)
    }
    reader.readAsText(file)
  }

  const submitImportVersion = async (): Promise<void> => {
    if (!importName.trim() || !importContent) {
      setImportAttempted(true)
      return
    }
    const res = await app.importBibleVersion({
      name: importName.trim(),
      content: importContent,
      ...(importAbbrev.trim() ? { abbrev: importAbbrev.trim() } : {}),
      ...(importFileName ? { fileName: importFileName } : {})
    })
    if (res) {
      const imported = res.find((v) => v.name === importName.trim()) ?? res.find((v) => v.id === importName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'))
      closeImportModal()
      if (imported) {
        setBibleVersion(imported.id)
        await app.loadBibleBooks(imported.id)
      }
    } else setImportAttempted(true)
  }

  const confirmDeleteVersion = async (): Promise<void> => {
    const target = versionToDelete
    if (!target) return
    const res = await app.deleteBibleVersion(target.id)
    if (!res) return
    setVersionToDelete(null)
    if (bibleVersion === target.id) {
      setBibleVersion('rvr1960')
      await app.loadBibleBooks('rvr1960')
    }
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
            style={{ width: 150, fontWeight: 700 }}
            title="Seleccionar versión bíblica para la proyección"
          >
            <optgroup label="Clásicas">
              {builtinVersions.map((v) => {
                const available = v.available !== false
                return (
                  <option key={v.id} value={v.id} disabled={!available}>
                    {(BUILTIN_VERSION_OPTIONS.find((o) => o.id === v.id)?.name ?? v.name) +
                      (available ? '' : ' (sin datos)')}
                  </option>
                )
              })}
            </optgroup>
            {importedVersions.length > 0 && (
              <optgroup label="Mis versiones">
                {importedVersions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          <button
            type="button"
            className="hly-mini-btn"
            aria-label="Importar versión bíblica"
            title="Importar versión propia (XML Zefania, el formato de Holyrics)"
            onClick={() => setShowImportModal(true)}
          >
            ➕
          </button>
          {activeVersionInfo && !activeVersionInfo.builtIn && (
            <button
              type="button"
              className="hly-mini-btn"
              aria-label="Eliminar versión bíblica"
              title={`Eliminar la versión «${activeVersionInfo.name}»`}
              onClick={() => setVersionToDelete(activeVersionInfo)}
            >
              🗑
            </button>
          )}
          <input
            type="text"
            placeholder="Resaltar palabra..."
            value={highlightWord}
            onChange={(e) => applyHighlightWord(e.target.value)}
            style={{ width: 130 }}
          />
        </div>
      </header>

      {activeVersionInfo?.builtIn && activeVersionInfo.available === false && (
        <div
          style={{
            margin: '6px 8px',
            padding: '8px 10px',
            borderRadius: 6,
            background: 'rgba(234, 88, 12, 0.12)',
            border: '1px solid rgba(234, 88, 12, 0.4)',
            color: 'var(--text)',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap'
          }}
        >
          <span>
            La versión <strong>{activeVersionInfo.name}</strong> no incluye texto en esta instalación.
            Importa su XML (formato Zefania/Holyrics) para activarla y convertirla en el texto real de esa versión.
          </span>
          <button
            type="button"
            className="hly-mini-btn hly-mini-btn--primary"
            onClick={() => {
              setImportName(activeVersionInfo.name)
              setImportAbbrev(activeVersionInfo.id.toUpperCase())
              setShowImportModal(true)
            }}
          >
            Importar XML
          </button>
        </div>
      )}

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
                ? `RESULTADOS PARA «${query.toUpperCase()}» (${verses.length}) · ${activeVersionLabel}`
                : `${selectedBook.toUpperCase()} ${selectedChapter} (${verses.length} VERSÍCULOS) · ${activeVersionLabel}`}
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
                    onClick={() => void projectFromVerse(idx, false)}
                    onDoubleClick={() => void projectFromVerse(idx, true)}
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

      {showImportModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.72)',
            backdropFilter: 'blur(3px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16
          }}
          onClick={closeImportModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="bible-import-title"
            style={{
              width: '100%',
              maxWidth: 470,
              backgroundColor: '#181b24',
              border: '1px solid rgba(59, 130, 246, 0.4)',
              borderRadius: 12,
              boxShadow: '0 20px 45px rgba(0, 0, 0, 0.8)',
              padding: '22px 24px',
              color: '#f3f4f6',
              fontFamily: 'system-ui, -apple-system, sans-serif'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="bible-import-title" style={{ margin: '0 0 6px 0', fontSize: 16, fontWeight: 700, color: '#fff' }}>
              Importar versión bíblica
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: 13, lineHeight: 1.5, color: '#9ca3af' }}>
              Formato XML Zefania (el mismo que usa Holyrics). El archivo se guarda en tu carpeta de datos y
              aparecerá en el selector como versión propia.
            </p>

            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#d1d5db', marginBottom: 4 }}>
              Nombre de la versión
              <input
                type="text"
                value={importName}
                onChange={(e) => setImportName(e.target.value)}
                placeholder="Ej. Reina-Valera 1960"
                maxLength={80}
                style={{
                  display: 'block',
                  width: '100%',
                  marginTop: 4,
                  padding: '8px 10px',
                  fontSize: 14,
                  borderRadius: 6,
                  border: '1px solid #374151',
                  backgroundColor: '#0f1117',
                  color: '#f3f4f6',
                  boxSizing: 'border-box'
                }}
              />
            </label>

            <label
              style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 600,
                color: '#d1d5db',
                marginBottom: 4,
                marginTop: 12
              }}
            >
              Abrid (opcional)
              <input
                type="text"
                value={importAbbrev}
                onChange={(e) => setImportAbbrev(e.target.value)}
                placeholder="Ej. RVR60"
                maxLength={16}
                style={{
                  display: 'block',
                  width: '100%',
                  marginTop: 4,
                  padding: '8px 10px',
                  fontSize: 14,
                  borderRadius: 6,
                  border: '1px solid #374151',
                  backgroundColor: '#0f1117',
                  color: '#f3f4f6',
                  boxSizing: 'border-box'
                }}
              />
            </label>

            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#d1d5db', marginTop: 12 }}>
              Archivo (XML / XMM)
              <input
                type="file"
                accept=".xml,.xmm,.bib,.txt,text/xml"
                onChange={handleImportFile}
                style={{
                  display: 'block',
                  width: '100%',
                  marginTop: 6,
                  fontSize: 13,
                  color: '#9ca3af'
                }}
              />
            </label>
            {importFileName && (
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
                Archivo seleccionado: {importFileName}
                {importContent ? ` (${Math.max(1, Math.round(importContent.length / 1024))} KB)` : ''}
              </div>
            )}

            {importAttempted && (!importName.trim() || !importContent) && (
              <div
                role="alert"
                style={{
                  marginTop: 12,
                  padding: '8px 10px',
                  fontSize: 13,
                  borderRadius: 6,
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: '#fca5a5'
                }}
              >
                Selecciona un archivo XML válido y escribe un nombre para la versión.
              </div>
            )}
            {importAttempted && importName.trim() && importContent && app.error && (
              <div
                role="alert"
                style={{
                  marginTop: 12,
                  padding: '8px 10px',
                  fontSize: 13,
                  borderRadius: 6,
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: '#fca5a5',
                  wordBreak: 'break-word'
                }}
              >
                {app.error}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
              <button
                type="button"
                className="hly-mini-btn"
                style={{
                  padding: '7px 16px',
                  fontSize: 13,
                  fontWeight: 600,
                  background: '#242936',
                  border: '1px solid #374151',
                  color: '#d1d5db',
                  borderRadius: 6,
                  cursor: 'pointer'
                }}
                onClick={closeImportModal}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="hly-mini-btn"
                disabled={app.busy}
                style={{
                  padding: '7px 18px',
                  fontSize: 13,
                  fontWeight: 700,
                  background: app.busy ? '#374151' : '#2563eb',
                  border: `1px solid ${app.busy ? '#4b5563' : '#3b82f6'}`,
                  color: '#ffffff',
                  borderRadius: 6,
                  cursor: app.busy ? 'wait' : 'pointer',
                  boxShadow: app.busy ? 'none' : '0 2px 8px rgba(37, 99, 235, 0.35)'
                }}
                onClick={() => void submitImportVersion()}
              >
                {app.busy ? 'Importando…' : 'Importar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDeleteModal
        isOpen={versionToDelete !== null}
        title="¿Eliminar esta versión bíblica?"
        itemName={versionToDelete?.name ?? ''}
        itemType="archivo de versión"
        onConfirm={() => void confirmDeleteVersion()}
        onCancel={() => setVersionToDelete(null)}
      />
    </section>
  )
}
