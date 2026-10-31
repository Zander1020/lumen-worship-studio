import { useState } from 'react'
import type { AiSuggestionResult } from '../../../../shared/ipc'
import { songToSlides, versesToSlides } from '../../../../shared/slideHelpers'
import type { UseAppStatus } from '../../hooks/useAppStatus'

export interface AiAssistantPageProps {
  app: UseAppStatus
}

const QUICK_THEMES = [
  'Gracia y Salvación',
  'Santidad y Adoración',
  'Fe y Fortaleza',
  'Alabanza y Gratitud',
  'Paz y Refugio'
]

export function AiAssistantPage({ app }: AiAssistantPageProps) {
  const [themeQuery, setThemeQuery] = useState('Gracia y Salvación')
  const [result, setResult] = useState<AiSuggestionResult | null>(null)
  const [rawTextToFormat, setRawTextToFormat] = useState('')
  const [formattedPreview, setFormattedPreview] = useState<string>('')

  const handleGenerate = async (topic?: string): Promise<void> => {
    const target = topic ?? themeQuery
    setThemeQuery(target)
    const res = await app.suggestForTheme(target)
    if (res) setResult(res)
  }

  const handleAddCompleteService = async (): Promise<void> => {
    if (!result) return
    await app.addScheduleItem({
      kind: 'announcement',
      title: result.suggestedAnnouncement.sourceTitle,
      subtitle: 'Bienvenida temática sugerida',
      slides: [result.suggestedAnnouncement]
    })
    for (const song of result.suggestedSongs.slice(0, 2)) {
      await app.addScheduleItem({
        kind: 'song',
        title: song.title,
        subtitle: `${song.author} · Tono ${song.musicalKey}`,
        refId: song.id,
        slides: songToSlides(song)
      })
    }
    const firstVerse = result.suggestedVerses[0]
    if (firstVerse) {
      await app.addScheduleItem({
        kind: 'bible',
        title: `Lectura sobre ${result.theme} (${firstVerse.book} ${firstVerse.chapter}:${firstVerse.verse})`,
        subtitle: 'Pasaje sugerido · Reina-Valera 1909',
        slides: versesToSlides(result.suggestedVerses)
      })
    }
  }

  const handleFormatLyrics = async (): Promise<void> => {
    if (!rawTextToFormat.trim()) return
    const stanzas = await app.parseRawLyrics(rawTextToFormat)
    const formatted = stanzas
      .map((s) => `[${s.label}]\n${s.lines.join('\n')}`)
      .join('\n\n')
    setFormattedPreview(formatted)
  }

  return (
    <section className="page" aria-labelledby="page-title">
      <header className="page__header">
        <h1 id="page-title">Inteligencia artificial</h1>
        <p className="page__description">
          Asistente inteligente local (100 % sin conexión externa) para armar el orden del culto por tema y estructurar
          letras automáticamente.
        </p>
      </header>

      <div className="card">
        <h2 className="card__title">Generador temático de culto (Motor Semántico Local)</h2>
        <div className="form-grid">
          <label className="field" style={{ gridColumn: '1 / -1' }}>
            <span>Tema de la predicación o servicio</span>
            <div className="button-row">
              <input
                type="text"
                aria-label="Tema del culto"
                style={{ flex: 1 }}
                placeholder="Ej. Gracia, Fe en la prueba, Santidad..."
                value={themeQuery}
                onChange={(e) => setThemeQuery(e.target.value)}
              />
              <button
                type="button"
                className="button button--primary"
                onClick={() => void handleGenerate()}
              >
                Sugerir alabanzas y pasajes
              </button>
            </div>
          </label>
        </div>

        <div className="button-row" style={{ marginTop: 10 }}>
          {QUICK_THEMES.map((t) => (
            <button
              key={t}
              type="button"
              className="button"
              onClick={() => void handleGenerate(t)}
            >
              ✦ {t}
            </button>
          ))}
        </div>

        {result && (
          <div style={{ marginTop: 16 }} data-testid="ai-suggestion-results">
            <div className="card__header-row" style={{ marginBottom: 12 }}>
              <h3 className="card__title" style={{ margin: 0 }}>
                Propuesta para «{result.theme}»
              </h3>
              <button
                type="button"
                className="button button--primary"
                onClick={() => void handleAddCompleteService()}
              >
                + Añadir servicio sugerido a Programación
              </button>
            </div>

            <div className="grid">
              <div>
                <h4 className="card__title">Alabanzas recomendadas</h4>
                <ul className="item-list">
                  {result.suggestedSongs.map((song) => (
                    <li key={song.id} className="item-row">
                      <div>
                        <div className="item-row__title">{song.title}</div>
                        <div className="item-row__sub">
                          Tono {song.musicalKey} · {song.tags.join(', ')}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="button"
                        onClick={() =>
                          void app.loadProjectionDeck({
                            deckTitle: song.title,
                            slides: songToSlides(song),
                            startIndex: 0
                          })
                        }
                      >
                        Proyectar
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="card__title">Versículos sugeridos</h4>
                <ul className="item-list">
                  {result.suggestedVerses.map((v) => (
                    <li key={`${v.book}-${v.chapter}-${v.verse}`} className="item-row">
                      <div>
                        <div className="item-row__title">
                          {v.book} {v.chapter}:{v.verse}
                        </div>
                        <div className="item-row__sub">{v.text}</div>
                      </div>
                      <button
                        type="button"
                        className="button"
                        onClick={() =>
                          void app.loadProjectionDeck({
                            deckTitle: `${v.book} ${v.chapter}:${v.verse}`,
                            slides: versesToSlides([v]),
                            startIndex: 0
                          })
                        }
                      >
                        Proyectar
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="card__title">Estructurador automático de estrofas</h2>
        <p className="hint" style={{ marginTop: 0, marginBottom: 10 }}>
          Pega una letra sin formato y el asistente separará y etiquetará las estrofas automáticamente.
        </p>
        <div className="grid">
          <label className="field">
            <span>Texto sin formato</span>
            <textarea
              rows={5}
              placeholder="Pega aquí los párrafos de la canción..."
              value={rawTextToFormat}
              onChange={(e) => setRawTextToFormat(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Resultado estructurado</span>
            <textarea rows={5} readOnly value={formattedPreview} />
          </label>
        </div>
        <div className="button-row" style={{ marginTop: 10 }}>
          <button
            type="button"
            className="button button--primary"
            onClick={() => void handleFormatLyrics()}
          >
            Estructurar estrofas
          </button>
        </div>
      </div>
    </section>
  )
}
