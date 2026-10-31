import type { ProjectionDisplayMode } from '../../../../shared/ipc'
import type { UseAppStatus } from '../../hooks/useAppStatus'
import { describeProjection } from '../../lib/statusLabels'

export interface ProjectionPageProps {
  app: UseAppStatus
}

const MODES: readonly { id: ProjectionDisplayMode; label: string }[] = [
  { id: 'live', label: 'Modo En vivo' },
  { id: 'black', label: 'Pantalla negra (B)' },
  { id: 'clear', label: 'Sin texto (C)' },
  { id: 'logo', label: 'Logo del culto (L)' },
  { id: 'test-pattern', label: 'Patrón de prueba' }
]

export function ProjectionPage({ app }: ProjectionPageProps) {
  const projection = app.status?.projection
  const live = projection?.live

  return (
    <section className="page" aria-labelledby="page-title">
      <header className="page__header">
        <div className="card__header-row">
          <div>
            <h1 id="page-title">Proyección</h1>
            <p className="page__description">
              Consola de operación en vivo. Usa las flechas del teclado (<kbd>◀</kbd> <kbd>▶</kbd>) para cambiar de
              diapositiva y <kbd>B</kbd> / <kbd>C</kbd> / <kbd>L</kbd> para modos rápidos.
            </p>
          </div>
          <span className="badge" data-testid="projection-page-state">
            {describeProjection(app.status).text}
          </span>
        </div>
      </header>

      <div className="grid">
        <div className="card">
          <h2 className="card__title">Modos de salida de pantalla</h2>
          <div className="button-row">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`button${live?.mode === m.id ? ' button--primary' : ''}`}
                onClick={() => void app.setProjectionMode(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>

          <h3 className="card__title" style={{ marginTop: 18 }}>
            Estado de pantallas
          </h3>
          <dl className="details">
            <dt>Presentación activa</dt>
            <dd>{live?.deckTitle ?? '—'}</dd>
            <dt>Fondo activo</dt>
            <dd>{live?.theme.background.name ?? '—'}</dd>
            <dt>Monitores detectados</dt>
            <dd>{projection?.displayCount ?? '—'}</dd>
            <dt>Monitor actual</dt>
            <dd>{projection?.displayId ?? '—'}</dd>
          </dl>
        </div>

        <div className="card">
          <h2 className="card__title">Tipografía y estilo en vivo</h2>
          {live && (
            <div className="form-grid">
              <label className="field">
                <span>Tipografía</span>
                <select
                  aria-label="Tipografía de proyección"
                  value={live.theme.fontFamily}
                  onChange={(e) =>
                    void app.updateProjectionTheme({
                      fontFamily: e.target.value as 'sans' | 'serif' | 'mono'
                    })
                  }
                >
                  <option value="sans">Sans-serif (Moderna)</option>
                  <option value="serif">Serif (Clásica)</option>
                  <option value="mono">Monoespaciada</option>
                </select>
              </label>

              <label className="field">
                <span>Escala de letra ({live.theme.fontScale}%)</span>
                <input
                  type="range"
                  min={80}
                  max={140}
                  step={5}
                  value={live.theme.fontScale}
                  onChange={(e) => void app.updateProjectionTheme({ fontScale: Number(e.target.value) })}
                />
              </label>

              <label className="field">
                <span>Alineación</span>
                <select
                  aria-label="Alineación de texto"
                  value={live.theme.textAlign}
                  onChange={(e) =>
                    void app.updateProjectionTheme({
                      textAlign: e.target.value as 'center' | 'left'
                    })
                  }
                >
                  <option value="center">Centrado</option>
                  <option value="left">Izquierda</option>
                </select>
              </label>
            </div>
          )}
        </div>
      </div>

      {live && (
        <div className="card">
          <div className="card__header-row">
            <h2 className="card__title">
              Mosaico de diapositivas: {live.deckTitle} ({live.currentIndex + 1}/{live.slides.length})
            </h2>
          </div>

          <div className="slide-grid" role="list" aria-label="Diapositivas activas">
            {live.slides.map((slide, idx) => {
              const isCurrent = idx === live.currentIndex
              return (
                <button
                  key={slide.id}
                  type="button"
                  role="listitem"
                  className={`slide-tile${isCurrent ? ' slide-tile--active' : ''}`}
                  data-testid={`live-slide-${idx}`}
                  onClick={() => void app.goToSlide({ index: idx })}
                >
                  <div className="slide-tile__header">
                    <span className="slide-tile__label">{slide.label}</span>
                    <span className="slide-tile__num">#{idx + 1}</span>
                  </div>
                  <div className="slide-tile__body">{slide.lines.join('\n')}</div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}
