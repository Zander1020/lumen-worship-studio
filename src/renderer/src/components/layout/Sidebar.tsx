import { type SyntheticEvent, useEffect, useState } from 'react'
import { SECTIONS, type SectionId } from '../../../../shared/sections'
import { parseBibleCitation, resolveBibleCitationBook, versesToSlides } from '../../../../shared/slideHelpers'
import type { UseAppStatus } from '../../hooks/useAppStatus'

export interface SidebarProps {
  active: SectionId
  onSelect: (id: SectionId) => void
  app?: UseAppStatus
}

type UiTone = 'neutral-dark' | 'holyrics-gray' | 'neutral-light'

/**
 * Barra superior idéntica a Holyrics con menú de acciones rápido, pestañas operativas agrupadas,
 * cita bíblica directa sin espacios (ej. jn3:16) y persistencia de tono neutro en localStorage.
 */
export function Sidebar({ active, onSelect, app }: SidebarProps) {
  const [quickCitation, setQuickCitation] = useState('')
  const [uiTone, setUiTone] = useState<UiTone>(() => {
    try {
      const saved = window.localStorage.getItem('lumen.uiTone')
      if (saved === 'neutral-dark' || saved === 'holyrics-gray' || saved === 'neutral-light') {
        return saved
      }
    } catch {
      // Ignorar si localStorage no está disponible
    }
    return 'neutral-dark'
  })

  useEffect(() => {
    document.documentElement.dataset['uiTone'] = uiTone
    try {
      window.localStorage.setItem('lumen.uiTone', uiTone)
    } catch {
      // Ignorar errores de almacenamiento
    }
  }, [uiTone])

  // Ocultar accesos directos ya integrados en Inicio (Alabanzas, Biblia, Proyección)
  const HIDDEN_BAR_SECTIONS = new Set<SectionId>(['songs', 'bible', 'projection'])
  const primarySections = SECTIONS.filter((s) => s.group === 'primary' && !HIDDEN_BAR_SECTIONS.has(s.id))
  const utilitySections = SECTIONS.filter((s) => s.group === 'utility' && !HIDDEN_BAR_SECTIONS.has(s.id))

  const handleQuickBibleProject = async (e: SyntheticEvent): Promise<void> => {
    e.preventDefault()
    const query = quickCitation.trim()
    if (!query || !app) return
    const parsed = parseBibleCitation(query)
    if (parsed) {
      const bookName = resolveBibleCitationBook(parsed.rawBook, app.bibleBooks)
      if (bookName) {
        const chapterVerses = await app.getBibleChapter({ book: bookName, chapter: parsed.chapter })
        if (chapterVerses.length > 0) {
          const targetVerseNum = parsed.verseStart ?? 1
          const targetIdx = chapterVerses.findIndex((v) => v.verse === targetVerseNum)
          const effectiveIdx = targetIdx >= 0 ? targetIdx : 0
          const slides = versesToSlides(chapterVerses)
          await app.loadProjectionDeck({
            deckTitle: `${bookName} ${parsed.chapter}`,
            slides,
            startIndex: effectiveIdx,
            openWindow: true
          })
          await app.setProjectionMode('live')
          setQuickCitation('')
          return
        }
      }
    }
    const results = await app.searchBible(query)
    if (results.length > 0) {
      const first = results[0]
      const last = results[results.length - 1]
      const title =
        first && last
          ? first.book === last.book && first.chapter === last.chapter && first.verse !== last.verse
            ? `${first.book} ${first.chapter}:${first.verse}-${last.verse}`
            : `${first.book} ${first.chapter}:${first.verse}`
          : query
      await app.loadProjectionDeck({
        deckTitle: title,
        slides: versesToSlides(results),
        startIndex: 0,
        openWindow: true
      })
      await app.setProjectionMode('live')
      setQuickCitation('')
    }
  }

  return (
    <header className="hly-topbar">
      <div className="hly-topbar__main">
        <div className="sidebar__brand">
          <span className="sidebar__logo" aria-hidden="true">
            ✺
          </span>
          <span className="sidebar__title">LUMEN</span>
        </div>

        <nav className="sidebar" aria-label="Secciones principales">
          <ul className="sidebar__list sidebar__list--primary">
            {primarySections.map((section) => (
              <li key={section.id}>
                <button
                  type="button"
                  title={section.description}
                  className={`sidebar__item${section.id === active ? ' sidebar__item--active' : ''}`}
                  aria-current={section.id === active ? 'page' : undefined}
                  onClick={() => onSelect(section.id)}
                >
                  <span className="sidebar__icon" aria-hidden="true">
                    {section.icon}
                  </span>
                  <span>{section.label}</span>
                </button>
              </li>
            ))}
          </ul>

          <span className="sidebar__divider" aria-hidden="true" />

          <ul className="sidebar__list sidebar__list--utility">
            {utilitySections.map((section) => (
              <li key={section.id}>
                <button
                  type="button"
                  title={`${section.label}: ${section.description}`}
                  className={`sidebar__item sidebar__item--utility${
                    section.id === active ? ' sidebar__item--active' : ''
                  }`}
                  aria-current={section.id === active ? 'page' : undefined}
                  onClick={() => onSelect(section.id)}
                >
                  <span className="sidebar__icon" aria-hidden="true">
                    {section.icon}
                  </span>
                  <span className="sidebar__utility-label">{section.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {app && (
          <form className="hly-quick-bible" onSubmit={(e) => void handleQuickBibleProject(e)}>
            <input
              type="text"
              className="hly-quick-bible__input"
              value={quickCitation}
              onChange={(e) => setQuickCitation(e.target.value)}
              placeholder="Cita rápida (ej. jn3:16, sal 23 1)..."
              aria-label="Cita bíblica rápida"
            />
            <button type="submit" className="hly-quick-bible__btn" title="Proyectar cita bíblica al instante">
              ▶
            </button>
          </form>
        )}

        <div className="hly-tone-switch" role="group" aria-label="Tono visual de la interfaz">
          <button
            type="button"
            className={`hly-tone-btn${uiTone === 'neutral-dark' ? ' hly-tone-btn--active' : ''}`}
            title="Tono Grafito Neutro"
            onClick={() => setUiTone('neutral-dark')}
          >
            Grafito
          </button>
          <button
            type="button"
            className={`hly-tone-btn${uiTone === 'holyrics-gray' ? ' hly-tone-btn--active' : ''}`}
            title="Tono Gris Estudio Clásico"
            onClick={() => setUiTone('holyrics-gray')}
          >
            Gris Estudio
          </button>
          <button
            type="button"
            className={`hly-tone-btn${uiTone === 'neutral-light' ? ' hly-tone-btn--active' : ''}`}
            title="Tono Claro Neutro"
            onClick={() => setUiTone('neutral-light')}
          >
            Claro
          </button>
        </div>
      </div>
    </header>
  )
}
