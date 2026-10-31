import { useState } from 'react'
import { createAnnouncementSlide } from '../../../../shared/slideHelpers'
import type { UseAppStatus } from '../../hooks/useAppStatus'

export interface SchedulePageProps {
  app: UseAppStatus
}

export function SchedulePage({ app }: SchedulePageProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [annTitle, setAnnTitle] = useState('')
  const [annBody, setAnnBody] = useState('')

  const activeItem = app.schedule.find((i) => i.id === selectedId) ?? app.schedule[0]

  const handleAddAnnouncement = async (): Promise<void> => {
    if (!annTitle.trim() && !annBody.trim()) return
    const slide = createAnnouncementSlide(annTitle.trim() || 'Aviso', annBody.trim() || annTitle.trim())
    await app.addScheduleItem({
      kind: 'announcement',
      title: slide.sourceTitle,
      subtitle: 'Aviso / Diapositiva libre',
      slides: [slide]
    })
    setAnnTitle('')
    setAnnBody('')
  }

  return (
    <section className="page" aria-labelledby="page-title">
      <header className="page__header">
        <div className="card__header-row">
          <div>
            <h1 id="page-title">Programación</h1>
            <p className="page__description">
              Orden del servicio, bloques litúrgicos y listas de reproducción del culto.
            </p>
          </div>
          {app.schedule.length > 0 && (
            <button
              type="button"
              className="button button--danger"
              onClick={() => void app.clearSchedule()}
            >
              Vaciar programación
            </button>
          )}
        </div>
      </header>

      <div className="grid">
        <div className="card">
          <h2 className="card__title">Orden del culto ({app.schedule.length})</h2>
          {app.schedule.length === 0 ? (
            <p className="hint">
              La programación está vacía. Añade alabanzas desde «Alabanzas», pasajes desde «Biblia» o crea un aviso
              aquí abajo.
            </p>
          ) : (
            <ul className="item-list" aria-label="Elementos programados">
              {app.schedule.map((item, idx) => {
                const isSelected = item.id === activeItem?.id
                return (
                  <li key={item.id} className={`item-row${isSelected ? ' item-row--active' : ''}`}>
                    <button
                      type="button"
                      className="item-row__select"
                      onClick={() => setSelectedId(item.id)}
                    >
                      <div className="item-row__title">
                        {idx + 1}. {item.title}
                      </div>
                      <div className="item-row__sub">
                        {item.subtitle} · {item.slides.length} diapositivas
                      </div>
                    </button>
                    <div className="button-row">
                      <button
                        type="button"
                        className="button button--primary"
                        onClick={() =>
                          void app.loadProjectionDeck({
                            deckTitle: item.title,
                            slides: item.slides,
                            startIndex: 0
                          })
                        }
                      >
                        Proyectar
                      </button>
                      <button
                        type="button"
                        className="button"
                        aria-label={`Subir ${item.title}`}
                        disabled={idx === 0}
                        onClick={() => void app.moveScheduleItem({ id: item.id, direction: 'up' })}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="button"
                        aria-label={`Bajar ${item.title}`}
                        disabled={idx === app.schedule.length - 1}
                        onClick={() => void app.moveScheduleItem({ id: item.id, direction: 'down' })}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="button button--danger"
                        aria-label={`Quitar ${item.title}`}
                        onClick={() => void app.removeScheduleItem(item.id)}
                      >
                        ✕
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          <hr className="divider" />

          <h3 className="card__title">Añadir anuncio o nota libre</h3>
          <div className="form-grid">
            <label className="field" style={{ gridColumn: '1 / -1' }}>
              <span>Título del anuncio</span>
              <input
                type="text"
                placeholder="Ej. Anuncios de la semana / Ofrenda"
                value={annTitle}
                onChange={(e) => setAnnTitle(e.target.value)}
              />
            </label>
            <label className="field" style={{ gridColumn: '1 / -1' }}>
              <span>Texto a proyectar</span>
              <textarea
                rows={3}
                placeholder="Escribe las líneas del anuncio..."
                value={annBody}
                onChange={(e) => setAnnBody(e.target.value)}
              />
            </label>
          </div>
          <div className="button-row" style={{ marginTop: 10 }}>
            <button
              type="button"
              className="button button--primary"
              onClick={() => void handleAddAnnouncement()}
            >
              + Añadir anuncio al servicio
            </button>
          </div>
        </div>

        <div className="card">
          {activeItem ? (
            <>
              <h2 className="card__title">Diapositivas de «{activeItem.title}»</h2>
              <div className="slide-grid">
                {activeItem.slides.map((slide, idx) => (
                  <button
                    key={slide.id}
                    type="button"
                    className="slide-tile"
                    onClick={() =>
                      void app.loadProjectionDeck({
                        deckTitle: activeItem.title,
                        slides: activeItem.slides,
                        startIndex: idx
                      })
                    }
                  >
                    <div className="slide-tile__header">
                      <span className="slide-tile__label">{slide.label}</span>
                      <span className="slide-tile__num">#{idx + 1}</span>
                    </div>
                    <div className="slide-tile__body">{slide.lines.join('\n')}</div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="hint">Selecciona un elemento del orden del culto para previsualizar sus diapositivas.</p>
          )}
        </div>
      </div>
    </section>
  )
}
