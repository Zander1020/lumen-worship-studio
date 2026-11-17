import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { BibleBookSummary, BibleVerse } from '../../../../shared/ipc'
import { filterBibleBooksByQuery } from '../../../../shared/slideHelpers'

export interface QuickBibleResult {
  book: string
  chapter: number
  verse: number
  projectNow: boolean
}

export interface QuickBibleModalProps {
  isOpen: boolean
  initialBookQuery: string
  books: readonly BibleBookSummary[]
  activeVersion: string
  activeVersionLabel: string
  getBibleChapter: (request: {
    book: string
    chapter: number
    version?: string
  }) => Promise<BibleVerse[]>
  onSelect: (result: QuickBibleResult) => void
  onClose: () => void
}

type ActiveField = 'book' | 'chapter' | 'verse'

/**
 * Modal de búsqueda y autocompletado rápido de citas bíblicas estilo Holyrics:
 * Libro (Tab / clic) -> Capítulo (Tab / : / Espacio / clic) -> Versículo (Enter proyecta).
 */
export function QuickBibleModal({
  isOpen,
  initialBookQuery,
  books,
  activeVersion,
  activeVersionLabel,
  getBibleChapter,
  onSelect,
  onClose
}: QuickBibleModalProps) {
  const [bookInput, setBookInput] = useState(initialBookQuery)
  const [selectedBook, setSelectedBook] = useState<BibleBookSummary | null>(null)
  const [highlightedIdx, setHighlightedIdx] = useState(0)
  const [chapterInput, setChapterInput] = useState('')
  const [verseInput, setVerseInput] = useState('')
  const [activeField, setActiveField] = useState<ActiveField>('book')
  const [loadedVerses, setLoadedVerses] = useState<BibleVerse[]>([])
  const [loadingVerses, setLoadingVerses] = useState(false)

  const bookInputRef = useRef<HTMLInputElement | null>(null)
  const chapterInputRef = useRef<HTMLInputElement | null>(null)
  const verseInputRef = useRef<HTMLInputElement | null>(null)

  // Inicializar estado cada vez que se abre la modal
  useEffect(() => {
    if (!isOpen) return
    queueMicrotask(() => {
      setBookInput(initialBookQuery)
      setSelectedBook(null)
      setHighlightedIdx(0)
      setChapterInput('')
      setVerseInput('')
      setActiveField('book')
      setLoadedVerses([])
    })
    const raf = window.requestAnimationFrame(() => {
      const input = bookInputRef.current
      if (input) {
        input.focus()
        const len = input.value.length
        input.setSelectionRange(len, len)
      }
    })
    return () => window.cancelAnimationFrame(raf)
  }, [isOpen, initialBookQuery])

  // Cerrar solo esta modal con Escape (fase de captura para no cerrar la proyección en vivo en App.tsx)
  useEffect(() => {
    if (!isOpen) return
    const handleCaptureEscape = (e: globalThis.KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', handleCaptureEscape, true)
    return () => window.removeEventListener('keydown', handleCaptureEscape, true)
  }, [isOpen, onClose])

  const filteredBooks = useMemo(
    () => filterBibleBooksByQuery(bookInput, books),
    [bookInput, books]
  )

  const clampedHighlightIdx =
    filteredBooks.length > 0 ? Math.min(highlightedIdx, filteredBooks.length - 1) : 0

  const effectiveBook: BibleBookSummary | null =
    selectedBook ?? filteredBooks[clampedHighlightIdx] ?? filteredBooks[0] ?? null

  const availableChapters = useMemo(
    () => effectiveBook?.chapters ?? [],
    [effectiveBook]
  )
  const maxChapter = availableChapters[availableChapters.length - 1] ?? 1
  const parsedChapter = chapterInput.trim() ? Number(chapterInput.trim()) : null
  const isChapterValid =
    parsedChapter !== null &&
    Number.isInteger(parsedChapter) &&
    parsedChapter >= 1 &&
    availableChapters.includes(parsedChapter)

  // Cargar versículos del capítulo seleccionado para cuadrícula rápida y vista previa en vivo
  useEffect(() => {
    if (!isOpen || !effectiveBook || !isChapterValid) {
      queueMicrotask(() => {
        setLoadedVerses([])
        setLoadingVerses(false)
      })
      return
    }
    let active = true
    queueMicrotask(() => {
      if (active) setLoadingVerses(true)
    })
    void getBibleChapter({
      book: effectiveBook.book,
      chapter: parsedChapter,
      version: activeVersion
    })
      .then((res) => {
        if (active) {
          setLoadedVerses(res)
          setLoadingVerses(false)
        }
      })
      .catch(() => {
        if (active) {
          setLoadedVerses([])
          setLoadingVerses(false)
        }
      })
    return () => {
      active = false
    }
  }, [isOpen, effectiveBook, isChapterValid, parsedChapter, activeVersion, getBibleChapter])

  if (!isOpen) return null

  const maxVerse = loadedVerses[loadedVerses.length - 1]?.verse ?? 0
  const parsedVerse = verseInput.trim() ? Number(verseInput.trim()) : null
  const previewVerseNum =
    parsedVerse !== null && Number.isInteger(parsedVerse) && parsedVerse >= 1
      ? parsedVerse
      : 1
  const previewVerse =
    loadedVerses.find((v) => v.verse === previewVerseNum) ??
    (parsedVerse === null ? loadedVerses[0] : undefined)

  const commitBookAndAdvance = (chosen: BibleBookSummary | undefined): void => {
    if (!chosen) return
    setSelectedBook(chosen)
    setBookInput(chosen.book)
    setHighlightedIdx(0)
    setChapterInput('')
    setVerseInput('')
    setActiveField('chapter')
    window.requestAnimationFrame(() => {
      chapterInputRef.current?.focus()
      chapterInputRef.current?.select()
    })
  }

  const commitChapterAndAdvance = (chapterNum: number): void => {
    const targetChap = availableChapters.includes(chapterNum)
      ? chapterNum
      : (availableChapters[0] ?? 1)
    setChapterInput(String(targetChap))
    setVerseInput('')
    setActiveField('verse')
    window.requestAnimationFrame(() => {
      verseInputRef.current?.focus()
      verseInputRef.current?.select()
    })
  }

  const submitSelection = (projectNow: boolean, overrideVerse?: number): void => {
    const book = effectiveBook
    if (!book) return
    const chapCandidate = parsedChapter ?? (book.chapters[0] ?? 1)
    const finalChapter = book.chapters.includes(chapCandidate)
      ? chapCandidate
      : Math.max(1, Math.min(chapCandidate, maxChapter))
    const verseCandidate = overrideVerse ?? parsedVerse ?? 1
    const finalVerse =
      maxVerse > 0
        ? Math.max(1, Math.min(verseCandidate, maxVerse))
        : Math.max(1, verseCandidate)

    onSelect({
      book: book.book,
      chapter: finalChapter,
      verse: finalVerse,
      projectNow
    })
  }

  const handleBookKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (filteredBooks.length > 0) {
        setHighlightedIdx((prev) => (prev + 1) % filteredBooks.length)
      }
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (filteredBooks.length > 0) {
        setHighlightedIdx((prev) => (prev - 1 + filteredBooks.length) % filteredBooks.length)
      }
      return
    }
    if ((e.key === 'Tab' && !e.shiftKey) || e.key === 'Enter' || e.key === ':') {
      const candidate = filteredBooks[clampedHighlightIdx] ?? filteredBooks[0]
      if (candidate) {
        e.preventDefault()
        commitBookAndAdvance(candidate)
      }
    }
  }

  const handleChapterKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault()
      setActiveField('book')
      bookInputRef.current?.focus()
      bookInputRef.current?.select()
      return
    }
    if ((e.key === 'Tab' && !e.shiftKey) || e.key === ':' || e.key === ' ') {
      e.preventDefault()
      const num = chapterInput.trim() ? Number(chapterInput.trim()) : (availableChapters[0] ?? 1)
      const validNum =
        Number.isInteger(num) && num >= 1
          ? Math.min(num, maxChapter)
          : (availableChapters[0] ?? 1)
      commitChapterAndAdvance(validNum)
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      submitSelection(!e.ctrlKey)
    }
  }

  const handleVerseKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault()
      setActiveField('chapter')
      chapterInputRef.current?.focus()
      chapterInputRef.current?.select()
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      submitSelection(!e.ctrlKey)
    }
  }

  const canSubmit = Boolean(effectiveBook)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-bible-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(6, 8, 14, 0.78)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '7vh',
        zIndex: 9600
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          width: 660,
          maxWidth: '94vw',
          maxHeight: '84vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 12,
          padding: '18px 20px',
          backgroundColor: '#161b26',
          border: '1px solid #2e384d',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.72)',
          color: '#f3f4f6'
        }}
      >
        {/* Cabecera */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 14,
            gap: 10
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>⚡</span>
            <h2
              id="quick-bible-title"
              style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#ffffff' }}
            >
              Ir a cita bíblica
            </h2>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 999,
                background: 'rgba(56, 189, 248, 0.14)',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                color: '#7dd3fc'
              }}
            >
              {activeVersionLabel}
            </span>
          </div>
          <button
            type="button"
            aria-label="Cerrar búsqueda rápida de cita"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '1px solid #334155',
              color: '#cbd5e1',
              borderRadius: 6,
              padding: '3px 9px',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600
            }}
          >
            Esc ✕
          </button>
        </div>

        {/* 3 campos encadenados estilo Holyrics: Libro -> Capítulo -> Versículo */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2.2fr 1fr 1fr',
            gap: 10,
            marginBottom: 12
          }}
        >
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: activeField === 'book' ? '#60a5fa' : '#94a3b8' }}>
              1. LIBRO <span style={{ fontWeight: 400, opacity: 0.75 }}>(Tab)</span>
            </span>
            <input
              ref={bookInputRef}
              type="text"
              aria-label="Libro bíblico"
              placeholder="Ej. jn, sal, 1co, gn..."
              value={bookInput}
              onFocus={() => setActiveField('book')}
              onChange={(e) => {
                setBookInput(e.target.value)
                setSelectedBook(null)
                setHighlightedIdx(0)
                setActiveField('book')
              }}
              onKeyDown={handleBookKeyDown}
              style={{
                width: '100%',
                padding: '9px 12px',
                fontSize: 15,
                fontWeight: 600,
                borderRadius: 8,
                border: `1.5px solid ${activeField === 'book' ? '#3b82f6' : '#334155'}`,
                backgroundColor: '#0d111a',
                color: '#f8fafc',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: activeField === 'chapter' ? '#60a5fa' : '#94a3b8' }}>
              2. CAPÍTULO {effectiveBook ? `(1–${maxChapter})` : ''}
            </span>
            <input
              ref={chapterInputRef}
              type="text"
              inputMode="numeric"
              aria-label="Capítulo bíblico"
              placeholder={effectiveBook ? `1-${maxChapter}` : 'Cap.'}
              value={chapterInput}
              onFocus={() => setActiveField('chapter')}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D+/g, '')
                setChapterInput(digits)
                setActiveField('chapter')
              }}
              onKeyDown={handleChapterKeyDown}
              style={{
                width: '100%',
                padding: '9px 12px',
                fontSize: 15,
                fontWeight: 700,
                borderRadius: 8,
                border: `1.5px solid ${activeField === 'chapter' ? '#3b82f6' : '#334155'}`,
                backgroundColor: '#0d111a',
                color: '#f8fafc',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: activeField === 'verse' ? '#60a5fa' : '#94a3b8' }}>
              3. VERSÍCULO {maxVerse > 0 ? `(1–${maxVerse})` : ''}
            </span>
            <input
              ref={verseInputRef}
              type="text"
              inputMode="numeric"
              aria-label="Versículo bíblico"
              placeholder={maxVerse > 0 ? `1-${maxVerse}` : 'Verso'}
              value={verseInput}
              onFocus={() => setActiveField('verse')}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D+/g, '')
                setVerseInput(digits)
                setActiveField('verse')
              }}
              onKeyDown={handleVerseKeyDown}
              style={{
                width: '100%',
                padding: '9px 12px',
                fontSize: 15,
                fontWeight: 700,
                borderRadius: 8,
                border: `1.5px solid ${activeField === 'verse' ? '#3b82f6' : '#334155'}`,
                backgroundColor: '#0d111a',
                color: '#f8fafc',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </label>
        </div>

        {/* Panel dinámico según el paso activo: Libros / Capítulos / Versículos */}
        <div
          style={{
            flex: 1,
            minHeight: 170,
            maxHeight: 280,
            overflowY: 'auto',
            borderRadius: 8,
            border: '1px solid #263042',
            backgroundColor: '#0e131d',
            padding: 10
          }}
        >
          {activeField === 'book' && (
            <>
              {filteredBooks.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '28px 12px', color: '#94a3b8', fontSize: 13 }}>
                  No se encontró ningún libro para «{bookInput}». Prueba con abreviaturas como{' '}
                  <strong>jn</strong>, <strong>sal</strong>, <strong>1co</strong> o <strong>ap</strong>.
                </div>
              ) : (
                <div
                  role="listbox"
                  aria-label="Sugerencias de libros bíblicos"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(145px, 1fr))',
                    gap: 6
                  }}
                >
                  {filteredBooks.slice(0, 24).map((b, idx) => {
                    const isHighlighted = idx === clampedHighlightIdx
                    return (
                      <button
                        key={b.book}
                        type="button"
                        role="option"
                        aria-selected={isHighlighted}
                        onClick={() => commitBookAndAdvance(b)}
                        onMouseEnter={() => setHighlightedIdx(idx)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 6,
                          padding: '7px 10px',
                          borderRadius: 6,
                          border: `1px solid ${isHighlighted ? '#3b82f6' : '#253045'}`,
                          backgroundColor: isHighlighted ? 'rgba(37, 99, 235, 0.24)' : '#151c29',
                          color: isHighlighted ? '#ffffff' : '#e2e8f0',
                          cursor: 'pointer',
                          textAlign: 'left',
                          fontSize: 13,
                          fontWeight: isHighlighted ? 700 : 500
                        }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {b.book}
                        </span>
                        <span style={{ fontSize: 10, color: isHighlighted ? '#93c5fd' : '#64748b', flexShrink: 0 }}>
                          {b.chapters.length}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </>
          )}

          {activeField === 'chapter' && effectiveBook && (
            <div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span>
                  Capítulos de <strong style={{ color: '#facc15' }}>{effectiveBook.book}</strong> (clic o escribe el número y pulsa <strong>Tab</strong>)
                </span>
                {parsedChapter !== null && !isChapterValid && (
                  <span style={{ color: '#fca5a5', fontWeight: 600 }}>
                    Rango válido: 1–{maxChapter}
                  </span>
                )}
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(42px, 1fr))',
                  gap: 5
                }}
              >
                {availableChapters.map((chap) => {
                  const isCurrent = parsedChapter === chap
                  return (
                    <button
                      key={chap}
                      type="button"
                      onClick={() => commitChapterAndAdvance(chap)}
                      style={{
                        padding: '6px 4px',
                        borderRadius: 6,
                        border: `1px solid ${isCurrent ? '#3b82f6' : '#253045'}`,
                        backgroundColor: isCurrent ? '#2563eb' : '#151c29',
                        color: isCurrent ? '#ffffff' : '#e2e8f0',
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      {chap}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {activeField === 'verse' && effectiveBook && (
            <div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span>
                  Versículos de{' '}
                  <strong style={{ color: '#facc15' }}>
                    {effectiveBook.book} {parsedChapter ?? 1}
                  </strong>{' '}
                  (clic selecciona · doble clic proyecta)
                </span>
                {parsedVerse !== null && maxVerse > 0 && parsedVerse > maxVerse && (
                  <span style={{ color: '#fca5a5', fontWeight: 600 }}>
                    Máximo {maxVerse} versículos
                  </span>
                )}
              </div>
              {loadingVerses ? (
                <div style={{ padding: '18px 8px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                  Cargando versículos…
                </div>
              ) : loadedVerses.length === 0 ? (
                <div style={{ padding: '18px 8px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                  Escribe un capítulo válido para ver los versículos disponibles.
                </div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(42px, 1fr))',
                    gap: 5
                  }}
                >
                  {loadedVerses.map((v) => {
                    const isCurrent = previewVerse?.verse === v.verse
                    return (
                      <button
                        key={v.verse}
                        type="button"
                        onClick={() => {
                          setVerseInput(String(v.verse))
                          verseInputRef.current?.focus()
                        }}
                        onDoubleClick={() => submitSelection(true, v.verse)}
                        style={{
                          padding: '6px 4px',
                          borderRadius: 6,
                          border: `1px solid ${isCurrent ? '#facc15' : '#253045'}`,
                          backgroundColor: isCurrent ? 'rgba(250, 204, 21, 0.2)' : '#151c29',
                          color: isCurrent ? '#fef08a' : '#e2e8f0',
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        {v.verse}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Vista previa instantánea del versículo antes de proyectar */}
        {previewVerse && (
          <div
            style={{
              marginTop: 10,
              padding: '10px 12px',
              borderRadius: 8,
              backgroundColor: 'rgba(250, 204, 21, 0.08)',
              border: '1px solid rgba(250, 204, 21, 0.3)',
              fontSize: 13,
              lineHeight: 1.45
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 800, color: '#facc15', marginBottom: 3, textTransform: 'uppercase' }}>
              📖 {previewVerse.book} {previewVerse.chapter}:{previewVerse.verse}
            </div>
            <div style={{ color: '#f1f5f9' }}>{previewVerse.text}</div>
          </div>
        )}

        {/* Pie de acciones y atajos */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
            marginTop: 14
          }}
        >
          <span style={{ fontSize: 11, color: '#94a3b8' }}>
            <strong>Tab</strong> siguiente campo · <strong>Shift+Tab</strong> volver · <strong>Enter</strong> proyectar ·{' '}
            <strong>Ctrl+Enter</strong> solo ver
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              disabled={!canSubmit}
              onClick={() => submitSelection(false)}
              style={{
                padding: '7px 14px',
                fontSize: 13,
                fontWeight: 600,
                background: '#242b3a',
                border: '1px solid #374151',
                color: '#e2e8f0',
                borderRadius: 6,
                cursor: canSubmit ? 'pointer' : 'not-allowed',
                opacity: canSubmit ? 1 : 0.5
              }}
            >
              👁 Solo ver en Biblia
            </button>
            <button
              type="button"
              disabled={!canSubmit}
              onClick={() => submitSelection(true)}
              style={{
                padding: '7px 16px',
                fontSize: 13,
                fontWeight: 700,
                background: '#2563eb',
                border: '1px solid #3b82f6',
                color: '#ffffff',
                borderRadius: 6,
                cursor: canSubmit ? 'pointer' : 'not-allowed',
                opacity: canSubmit ? 1 : 0.5,
                boxShadow: '0 2px 10px rgba(37, 99, 235, 0.35)'
              }}
            >
              ▶ Proyectar ahora (Enter)
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
