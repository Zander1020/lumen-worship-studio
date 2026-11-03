import { useEffect, useState } from 'react'
import { SECTIONS, type SectionId } from '../../../../shared/sections'
import type { UseAppStatus } from '../../hooks/useAppStatus'

export interface SidebarProps {
  active: SectionId
  onSelect: (id: SectionId) => void
  app?: UseAppStatus
}

type UiTone = 'neutral-dark' | 'holyrics-gray' | 'neutral-light'

/**
 * Barra superior idéntica a Holyrics con menú de acciones rápido, pestañas operativas agrupadas,
 * y persistencia de tono neutro en localStorage.
 */
export function Sidebar({ active, onSelect }: SidebarProps) {
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

  return (
    <header className="hly-topbar">
      <div className="hly-topbar__main">
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
