import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import type { MediaBackground, PresentationSlide, Song } from '../../../../shared/ipc'
import {
  autoSplitLongStanzas,
  cleanInternetLyrics,
  createAnnouncementSlide,
  isVideoUrl,
  parseRawLyricsToStanzas,
  resolveMediaVideoUrl,
  songToSlides,
  transposeChordText
} from '../../../../shared/slideHelpers'
import type { UseAppStatus } from '../../hooks/useAppStatus'
import { BiblePage } from '../bible/BiblePage'

export interface HomePageProps {
  app: UseAppStatus
}

type QuickTab = 'music' | 'bible' | 'images' | 'text'

function stanzaTagClass(label: string): string {
  const l = label.toLowerCase()
  if (l.includes('coro')) return 'hly-slide-row__tag hly-slide-row__tag--chorus'
  if (l.includes('puente')) return 'hly-slide-row__tag hly-slide-row__tag--bridge'
  if (l.includes('intro')) return 'hly-slide-row__tag hly-slide-row__tag--intro'
  return 'hly-slide-row__tag'
}

/**
 * Mesa Principal de Operación idéntica a la ventana central de Holyrics:
 * - Izquierda: Catálogo rápido con pestañas (Música, Biblia 66 libros, Imágenes del Culto, Texto/Alerta rápida).
 * - Derecha: Barra de pestañas de documentos abiertos + Tabla numerada de Párrafos / Versículos en Previsualización.
 */
export function HomePage({ app }: HomePageProps) {
  const [activeTab, setActiveTab] = useState<QuickTab>('music')
  const [songQuery, setSongQuery] = useState('')
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null)
  const [openSongTabIds, setOpenSongTabIds] = useState<string[]>([])
  const [imageSearch, setImageSearch] = useState('')
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null)
  const homeMediaInputRef = useRef<HTMLInputElement | null>(null)

  const handleUploadMediaFiles = (e: ChangeEvent<HTMLInputElement>): void => {
    const files = Array.from(e.target.files ?? [])
    files.forEach((file) => {
      const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mov|mkv|avi|ogv|m4v)$/i.test(file.name)
      const nativePath =
        (file as unknown as { path?: string }).path ||
        (typeof window !== 'undefined' &&
          (window as unknown as { lumen?: { getPathForFile?: (f: File) => string } }).lumen?.getPathForFile?.(file))
      if (nativePath) {
        const fileUrl = `lumen-media://local/${encodeURIComponent(nativePath.replace(/\\/g, '/'))}`
        void app.addMedia({
          name: file.name.replace(/\.[^/.]+$/, ''),
          kind: isVideo ? 'video' : 'image',
          value: fileUrl,
          category: 'Culto'
        })
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        let dataUrl = typeof reader.result === 'string' ? reader.result : ''
        if (dataUrl) {
          if (isVideo && !dataUrl.startsWith('data:video/')) {
            const comma = dataUrl.indexOf(',')
            if (comma !== -1) {
              const ext = file.name.split('.').pop()?.toLowerCase()
              const mime = ext === 'webm' ? 'video/webm' : 'video/mp4'
              dataUrl = `data:${mime};base64,${dataUrl.slice(comma + 1)}`
            }
          }
          void app.addMedia({
            name: file.name.replace(/\.[^/.]+$/, ''),
            kind: isVideo ? 'video' : 'image',
            value: dataUrl,
            category: 'Culto'
          })
        }
      }
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  // Menú contextual clic derecho en canciones
  const [contextMenu, setContextMenu] = useState<{ song: Song; x: number; y: number } | null>(null)

  // Estado de edición rápida de alabanza (clic derecho -> Editar alabanza)
  const [editingSong, setEditingSong] = useState<Song | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editAuthor, setEditAuthor] = useState('')
  const [editKey, setEditKey] = useState('')
  const [editBpm, setEditBpm] = useState<number | null>(null)
  const [editRawLyrics, setEditRawLyrics] = useState('')

  const openSongEditor = (song: Song): void => {
    setEditingSong(song)
    setEditTitle(song.title)
    setEditAuthor(song.author || '')
    setEditKey(song.musicalKey || '')
    setEditBpm(song.bpm ?? null)
    const raw = song.stanzas.map((st) => `[${st.label}]\n${st.lines.join('\n')}`).join('\n\n')
    setEditRawLyrics(raw)
  }

  const handleSaveEditedSong = async (): Promise<void> => {
    if (!editingSong || !editTitle.trim()) return
    const stanzas = parseRawLyricsToStanzas(editRawLyrics.trim() || 'Letra')
    await app.upsertSong({
      id: editingSong.id,
      title: editTitle.trim(),
      author: editAuthor.trim(),
      musicalKey: editKey.trim() || '—',
      bpm: editBpm ?? null,
      tags: editingSong.tags,
      stanzas
    })
    setEditingSong(null)
  }

  // Opción para mostrar u ocultar la columna de etiquetas en la tabla de diapositivas
  const [showTagsColumn, setShowTagsColumn] = useState(false)

  // Estado de Texto / Alerta rápida estilo Holyrics
  const [quickTitle, setQuickTitle] = useState('Bienvenidos al Servicio de Adoración')
  const [quickBody, setQuickBody] = useState('Dios bendiga tu vida y tu familia en este día.')
  const [quickFooter, setQuickFooter] = useState('Lumen Worship Studio')

  useEffect(() => {
    const handleGlobalClick = (): void => setContextMenu(null)
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setContextMenu(null)
    }
    window.addEventListener('click', handleGlobalClick)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('click', handleGlobalClick)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const filteredSongs = useMemo(() => {
    const q = songQuery.trim().toLowerCase()
    if (!q) return app.songs
    return app.songs.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.author.toLowerCase().includes(q) ||
        s.musicalKey.toLowerCase().includes(q) ||
        s.stanzas.some((st) => st.lines.some((line) => line.toLowerCase().includes(q)))
    )
  }, [app.songs, songQuery])

  const selectedSong: Song | undefined = useMemo(
    () => app.songs.find((s) => s.id === selectedSongId) ?? filteredSongs[0] ?? app.songs[0],
    [app.songs, filteredSongs, selectedSongId]
  )

  const churchMedia = useMemo(() => {
    // En la vista Medios sólo deben salir los medios que el usuario suba para el culto,
    // excluyendo los fondos predeterminados o fondos del sistema (categoría !== 'Fondo' y sin id de plantilla bg-)
    return app.media.filter((m) => m.category === 'Culto' || (!m.id.startsWith('bg-video-') && !m.id.startsWith('bg-aurora-') && !m.id.startsWith('bg-starlight-') && !m.id.startsWith('bg-worship-') && !m.id.startsWith('bg-emerald-') && !m.id.startsWith('bg-royal-') && !m.id.startsWith('bg-pure-') && m.category !== 'Fondo'))
  }, [app.media])

  const filteredMedia = useMemo(() => {
    const q = imageSearch.trim().toLowerCase()
    if (!q) return churchMedia
    return churchMedia.filter(
      (m) => m.name.toLowerCase().includes(q) || (m.category && m.category.toLowerCase().includes(q))
    )
  }, [churchMedia, imageSearch])

  const selectedMedia = useMemo(() => {
    return churchMedia.find((m) => m.id === selectedImageId) ?? churchMedia[0]
  }, [churchMedia, selectedImageId])

  const selectSongAndPinTab = (songId: string): void => {
    setSelectedSongId(songId)
    setActiveTab('music')
    setOpenSongTabIds((prev) => (prev.includes(songId) ? prev : [...prev, songId].slice(-6)))
  }

  const closeSongTab = (songId: string): void => {
    setOpenSongTabIds((prev) => prev.filter((id) => id !== songId))
  }

  const previewTitle =
    activeTab === 'music'
      ? selectedSong?.title ?? 'Sin canción seleccionada'
      : activeTab === 'images'
        ? (selectedMedia ? `${selectedMedia.kind === 'video' || isVideoUrl(selectedMedia.value) ? 'Vídeo' : 'Imagen'}: ${selectedMedia.name}` : 'Sin medio seleccionado')
        : quickTitle || 'Anuncio rápido'

  const previewSub =
    activeTab === 'music'
      ? `${selectedSong?.author || 'Autor desconocido'} · Tono: ${selectedSong?.musicalKey || '—'}`
      : activeTab === 'images'
        ? (selectedMedia?.category || (selectedMedia?.kind === 'video' || isVideoUrl(selectedMedia?.value) ? 'Vídeo a Pantalla Completa' : 'Imagen a Pantalla Completa'))
        : 'Texto / Alerta en vivo'

  const previewSlides: PresentationSlide[] = useMemo(() => {
    if (activeTab === 'music') {
      return selectedSong ? songToSlides(selectedSong) : []
    }
    if (activeTab === 'images') {
      if (!selectedMedia) return []
      const isVid = selectedMedia.kind === 'video' || isVideoUrl(selectedMedia.value)
      return [
        {
          id: `media-preview-${selectedMedia.id}`,
          sourceKind: 'custom',
          sourceTitle: selectedMedia.name,
          label: selectedMedia.name,
          lines: [],
          footer: '',
          imageUrl: isVideoUrl(selectedMedia.value) ? resolveMediaVideoUrl(selectedMedia.value) : selectedMedia.value,
          mediaKind: isVid ? 'video' : 'image'
        }
      ]
    }
    return [createAnnouncementSlide(quickTitle.trim() || 'Anuncio', quickBody, quickFooter.trim())]
  }, [activeTab, quickBody, quickFooter, quickTitle, selectedMedia, selectedSong])

  const projectPreviewSlide = (index: number, openWindow = false): void => {
    if (previewSlides.length === 0) return
    void app.loadProjectionDeck({
      deckTitle: previewTitle,
      slides: previewSlides,
      startIndex: index,
      ...(openWindow ? { openWindow: true } : {})
    })
    if (openWindow && !app.status?.projection.windowOpen) {
      void app.openProjection({ target: 'auto' })
    }
  }

  const projectSongImmediately = (song: Song, openWindow = true): void => {
    selectSongAndPinTab(song.id)
    if (song.defaultBackgroundId) {
      const bg = app.media.find((m) => m.id === song.defaultBackgroundId)
      if (bg) void app.updateProjectionTheme({ background: bg })
    }
    void app.loadProjectionDeck({
      deckTitle: song.title,
      slides: songToSlides(song),
      startIndex: 0,
      ...(openWindow ? { openWindow: true } : {})
    })
    if (openWindow && !app.status?.projection.windowOpen) {
      void app.openProjection({ target: 'auto' })
    }
  }

  const projectMediaImmediately = (img: MediaBackground, openWindow = true): void => {
    setSelectedImageId(img.id)
    const mediaVal = isVideoUrl(img.value) ? resolveMediaVideoUrl(img.value) : img.value
    const isVid = img.kind === 'video' || isVideoUrl(img.value)
    void app.loadProjectionDeck({
      deckTitle: `${isVid ? 'Vídeo' : 'Imagen'}: ${img.name}`,
      slides: [
        {
          id: `media-deck-${img.id}`,
          sourceKind: 'custom',
          sourceTitle: img.name,
          label: img.name,
          lines: [],
          footer: '',
          imageUrl: mediaVal,
          mediaKind: isVid ? 'video' : 'image'
        }
      ],
      startIndex: 0,
      openWindow
    })
    void app.updateProjectionTheme({
      videoPlaying: true
    })
    void app.setProjectionMode('live')
    if (openWindow && !app.status?.projection.windowOpen) {
      void app.openProjection({ target: 'auto' })
    }
  }

  const live = app.status?.projection.live

  return (
    <section className="page hly-page" aria-labelledby="page-title">
      <header className="hly-module-bar hly-module-bar--compact">
        <div className="hly-module-bar__left">
          <h1 id="page-title" className="hly-module-bar__title">
            Inicio
          </h1>
          <div className="hly-tab-strip" role="tablist" aria-label="Modo de consola central">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'music'}
              className={`hly-tab-btn${activeTab === 'music' ? ' hly-tab-btn--active' : ''}`}
              onClick={() => setActiveTab('music')}
            >
              ♪ Música (<span data-testid="home-song-count">{app.songs.length}</span>)
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'bible'}
              className={`hly-tab-btn${activeTab === 'bible' ? ' hly-tab-btn--active' : ''}`}
              onClick={() => setActiveTab('bible')}
            >
              📖 Biblia ({app.bibleBooks.length || 66})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'images'}
              className={`hly-tab-btn${activeTab === 'images' ? ' hly-tab-btn--active' : ''}`}
              onClick={() => setActiveTab('images')}
            >
              🎬 Medios ({churchMedia.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'text'}
              className={`hly-tab-btn${activeTab === 'text' ? ' hly-tab-btn--active' : ''}`}
              onClick={() => setActiveTab('text')}
            >
              📢 Texto Rápido
            </button>
          </div>
        </div>
      </header>

      {!app.bridgeAvailable && (
        <div className="card card--warn" role="alert">
          No se detectó la conexión con el proceso principal. Ejecuta la aplicación con Electron.
        </div>
      )}

      {activeTab === 'bible' ? (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <BiblePage app={app} />
        </div>
      ) : (
        <div className="hly-center-split">
          {/* PANEL CENTRAL IZQUIERDO: CATÁLOGO / SELECTOR */}
          <div className="hly-panel hly-panel--flex">
          {activeTab === 'music' && (
            <>
              <div className="hly-panel__header">
                <span className="hly-panel__title">♪ LISTA DE ALABANZAS ({filteredSongs.length})</span>
              </div>
              <div className="hly-SubToolbar">
                <input
                  type="text"
                  className="input"
                  value={songQuery}
                  onChange={(e) => setSongQuery(e.target.value)}
                  placeholder="Filtrar por título, letra, artista o tonalidad..."
                  aria-label="Filtrar alabanzas en consola"
                />
              </div>
              <div className="hly-grid-header hly-grid-header--songs" aria-hidden="true">
                <span>Título</span>
                <span>Autor / Artista</span>
                <span>Tono</span>
                <span>Acción</span>
              </div>
              <div className="hly-scroll-area" role="list">
                {filteredSongs.map((song) => {
                  const isSelected = selectedSong?.id === song.id
                  const isLive = live?.deckTitle === song.title
                  return (
                    <div
                      key={song.id}
                      role="listitem"
                      className={`hly-song-grid-row${isSelected ? ' hly-song-grid-row--selected' : ''}${
                        isLive ? ' hly-song-grid-row--live' : ''
                      }`}
                      onDoubleClick={() => projectSongImmediately(song, true)}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setSelectedSongId(song.id)
                        setContextMenu({ song, x: e.clientX, y: e.clientY })
                      }}
                    >
                      <button
                        type="button"
                        className="hly-song-grid-row__main"
                        onClick={() => selectSongAndPinTab(song.id)}
                        onDoubleClick={(e) => {
                          e.stopPropagation()
                          projectSongImmediately(song, true)
                        }}
                      >
                        <span className="hly-song-grid-row__title">{song.title}</span>
                        <span className="hly-song-grid-row__author">{song.author || '—'}</span>
                        <span className="hly-song-grid-row__key">{song.musicalKey || '—'}</span>
                      </button>
                      <div className="hly-song-grid-row__actions">
                        <button
                          type="button"
                          className="hly-icon-btn"
                          title="Enviar directo a proyección en vivo"
                          onClick={() => projectSongImmediately(song, true)}
                        >
                          ▶
                        </button>
                        <button
                          type="button"
                          className="hly-icon-btn"
                          title="Añadir a la Lista de Reproducción"
                          onClick={() =>
                            void app.addScheduleItem({
                              kind: 'song',
                              title: song.title,
                              subtitle: `${song.author || 'Alabanza'} (${song.stanzas.length} estrofas)`,
                              slides: songToSlides(song)
                            })
                          }
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}



          {activeTab === 'images' && (
            <>
              <div
                className="hly-panel__header"
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 8px'
                }}
              >
                <span className="hly-panel__title">🎬 MEDIOS ({filteredMedia.length})</span>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <input
                    ref={homeMediaInputRef}
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    style={{ display: 'none' }}
                    onChange={handleUploadMediaFiles}
                  />
                  <button
                    type="button"
                    className="hly-mini-btn"
                    title="Abrir carpeta dedicada de imágenes y vídeos de la app"
                    onClick={() => void app.openMediaFolder()}
                  >
                    📁
                  </button>
                  <button
                    type="button"
                    className="hly-mini-btn"
                    title="Recargar medios desde el almacenamiento local"
                    onClick={() => void app.reloadMedia()}
                  >
                    🔄
                  </button>
                  <button
                    type="button"
                    className="hly-mini-btn"
                    title="Añadir imágenes o vídeos desde el equipo"
                    onClick={() => homeMediaInputRef.current?.click()}
                  >
                    ➕
                  </button>
                </div>
              </div>
              <div className="hly-SubToolbar">
                <input
                  type="text"
                  className="input"
                  value={imageSearch}
                  onChange={(e) => setImageSearch(e.target.value)}
                  placeholder="Filtrar por nombre de imagen o vídeo..."
                  aria-label="Filtrar medios del culto"
                />
              </div>
              <div className="hly-scroll-area" role="list">
                {filteredMedia.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)' }}>
                    No hay medios registrados. Usa <strong>📁</strong> para abrir la carpeta o <strong>➕</strong> para subirlos.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8, padding: 8 }}>
                    {filteredMedia.map((m) => {
                      const isSelected = selectedMedia?.id === m.id
                      const isVid = m.kind === 'video' || isVideoUrl(m.value)
                      const isLive = live?.deckTitle === `${isVid ? 'Vídeo' : 'Imagen'}: ${m.name}` || live?.deckTitle === m.name
                      return (
                        <div
                          key={m.id}
                          style={{
                            background: isSelected ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-card)',
                            border: isLive ? '2px solid #10b981' : isSelected ? '1px solid #10b981' : '1px solid var(--border)',
                            borderRadius: 6,
                            overflow: 'hidden',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column'
                          }}
                          onClick={() => {
                            setSelectedImageId(m.id)
                          }}
                          onDoubleClick={() => projectMediaImmediately(m, true)}
                        >
                          <div style={{ height: 85, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                            {isVid ? (
                              <div style={{ textAlign: 'center' }}>
                                <span style={{ fontSize: 28 }}>🎬</span>
                              </div>
                            ) : (
                              <img src={m.value} alt={m.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                            )}
                            {isVid && (
                              <span
                                style={{
                                  position: 'absolute',
                                  bottom: 4,
                                  right: 4,
                                  fontSize: 9,
                                  fontWeight: 800,
                                  padding: '1px 4px',
                                  borderRadius: 3,
                                  background: 'rgba(234, 88, 12, 0.85)',
                                  color: '#fff'
                                }}
                              >
                                VÍDEO
                              </span>
                            )}
                          </div>
                          <div style={{ padding: '4px 6px', fontSize: 11, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={m.name}>
                            {m.name}
                          </div>
                          <div style={{ padding: '0 6px 6px', display: 'flex', gap: 4 }}>
                            <button
                              type="button"
                              className="hly-mini-btn hly-mini-btn--primary"
                              style={{ flex: 1, padding: '2px 4px', fontSize: 10 }}
                              onClick={(e) => {
                                e.stopPropagation()
                                projectMediaImmediately(m, true)
                              }}
                            >
                              ▶ Vivo
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'text' && (
            <>
              <div className="hly-panel__header">
                <span className="hly-panel__title">📢 GENERADOR DE TEXTO / ALERTA EN VIVO</span>
              </div>
              <div className="hly-quick-text-form">
                <div className="form-group">
                  <label className="label" htmlFor="hly-qt-title">
                    Encabezado / Título
                  </label>
                  <input
                    id="hly-qt-title"
                    className="input"
                    value={quickTitle}
                    onChange={(e) => setQuickTitle(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="label" htmlFor="hly-qt-body">
                    Texto para proyectar en pantalla
                  </label>
                  <textarea
                    id="hly-qt-body"
                    className="textarea"
                    style={{ minHeight: 110 }}
                    value={quickBody}
                    onChange={(e) => setQuickBody(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="label" htmlFor="hly-qt-footer">
                    Pie de página
                  </label>
                  <input
                    id="hly-qt-footer"
                    className="input"
                    value={quickFooter}
                    onChange={(e) => setQuickFooter(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* PANEL CENTRAL DERECHO: PESTAÑAS ABIERTAS + PÁRRAFOS EN PREVISUALIZACIÓN */}
        <div className="hly-panel hly-panel--flex">
          {openSongTabIds.length > 0 && (
            <div className="hly-open-docs-bar" role="tablist" aria-label="Canciones abiertas en previsualización">
              {openSongTabIds.map((id) => {
                const s = app.songs.find((item) => item.id === id)
                if (!s) return null
                const isSelected = activeTab === 'music' && selectedSong?.id === id
                return (
                  <div key={id} className={`hly-doc-tab${isSelected ? ' hly-doc-tab--active' : ''}`}>
                    <button
                      type="button"
                      className="hly-doc-tab__btn"
                      onClick={() => {
                        setSelectedSongId(id)
                        setActiveTab('music')
                      }}
                    >
                      ♪ {s.title}
                    </button>
                    <button
                      type="button"
                      className="hly-doc-tab__close"
                      title="Cerrar pestaña"
                      onClick={() => closeSongTab(id)}
                    >
                      ×
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          <div className="hly-panel__header">
            <div>
              <span className="hly-panel__title">▣ PREVISUALIZACIÓN: {previewTitle.toUpperCase()}</span>
              <div className="hly-panel__subtitle">{previewSub}</div>
            </div>
            <div className="btn-row" style={{ alignItems: 'center' }}>
              <button
                type="button"
                className={`hly-mini-btn${showTagsColumn ? ' hly-mini-btn--primary' : ''}`}
                style={{ fontSize: 10.5 }}
                title={showTagsColumn ? 'Ocultar columna de etiquetas' : 'Mostrar columna de etiquetas'}
                onClick={() => setShowTagsColumn((prev) => !prev)}
              >
                🏷 {showTagsColumn ? 'Ocultar etiqueta' : 'Ver etiqueta'}
              </button>
            </div>
          </div>

          <div
            className={`hly-slide-table-header${!showTagsColumn ? ' hly-slide-table-header--no-tag' : ''}`}
            aria-hidden="true"
          >
            <span>#</span>
            {showTagsColumn && <span>Etiqueta</span>}
            <span>Letra / Contenido (1 clic previa · Doble clic proyecta en vivo)</span>
          </div>

          <div className="hly-scroll-area" role="list" aria-label="Párrafos en previsualización">
            {previewSlides.map((slide, idx) => {
              const isLiveSlide = live?.deckTitle === previewTitle && live.currentIndex === idx
              return (
                <button
                  key={slide.id}
                  type="button"
                  role="listitem"
                  className={`hly-slide-row hly-slide-row--preview${
                    !showTagsColumn ? ' hly-slide-row--no-tag' : ''
                  }${isLiveSlide ? ' hly-slide-row--active' : ''}`}
                  onClick={() => projectPreviewSlide(idx, false)}
                  onDoubleClick={() => projectPreviewSlide(idx, true)}
                >
                  <span className="hly-slide-row__num">{String(idx + 1).padStart(2, '0')}</span>
                  {showTagsColumn && <span className={stanzaTagClass(slide.label)}>{slide.label}</span>}
                  <span className="hly-slide-row__text">
                    {slide.imageUrl ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        {slide.mediaKind === 'video' || isVideoUrl(slide.imageUrl) ? (
                          <video
                            src={resolveMediaVideoUrl(slide.imageUrl)}
                            muted
                            playsInline
                            preload="metadata"
                            style={{ width: 48, height: 32, objectFit: 'cover', borderRadius: 3, border: '1px solid #444', background: '#000' }}
                          />
                        ) : (
                          <img src={slide.imageUrl} alt={slide.label} style={{ height: 32, borderRadius: 3, border: '1px solid #444' }} />
                        )}
                        <span>[{slide.mediaKind === 'video' || isVideoUrl(slide.imageUrl) ? 'Vídeo' : 'Imagen'} a pantalla completa: {slide.label}]</span>
                      </span>
                    ) : (
                      slide.lines.map((line, lineIdx) => (
                        <span key={lineIdx} className="hly-slide-row__line">
                          {line}
                        </span>
                      ))
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
      )}

      {/* Menú contextual flotante al hacer clic derecho sobre una alabanza */}
      {contextMenu && (
        <div
          className="hly-context-menu"
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            zIndex: 9999
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="hly-context-menu__header">{contextMenu.song.title}</div>
          <button
            type="button"
            className="hly-context-menu__item"
            onClick={() => {
              projectSongImmediately(contextMenu.song, true)
              setContextMenu(null)
            }}
          >
            ▶ Proyectar alabanza en vivo
          </button>
          <button
            type="button"
            className="hly-context-menu__item"
            onClick={() => {
              openSongEditor(contextMenu.song)
              setContextMenu(null)
            }}
          >
            ✏ Editar alabanza
          </button>
          <button
            type="button"
            className="hly-context-menu__item"
            onClick={() => {
              void app.addScheduleItem({
                kind: 'song',
                title: contextMenu.song.title,
                subtitle: `${contextMenu.song.author || 'Alabanza'} (${contextMenu.song.stanzas.length} estrofas)`,
                slides: songToSlides(contextMenu.song)
              })
              setContextMenu(null)
            }}
          >
            + Añadir a la Lista del culto
          </button>
          <div className="hly-context-menu__divider" />
          <button
            type="button"
            className="hly-context-menu__item hly-context-menu__item--danger"
            onClick={() => {
              const toDelete = contextMenu.song
              setContextMenu(null)
              if (window.confirm(`¿Seguro que deseas eliminar la alabanza "${toDelete.title}"?`)) {
                void app.deleteSong(toDelete.id)
              }
            }}
          >
            🗑 Eliminar alabanza
          </button>
        </div>
      )}

      {/* Modal flotante de edición rápida de alabanza */}
      {editingSong && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20
          }}
          onClick={() => setEditingSong(null)}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: 720,
              maxHeight: '90vh',
              overflowY: 'auto',
              background: 'var(--bg-panel)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: 20,
              boxShadow: '0 10px 40px rgba(0,0,0,0.6)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
                borderBottom: '1px solid var(--border)',
                paddingBottom: 10
              }}
            >
              <h2 style={{ margin: 0, fontSize: 18, color: '#f8fafc' }}>
                ✏ Editar alabanza: {editingSong.title}
              </h2>
              <button
                type="button"
                className="hly-icon-btn"
                style={{ fontSize: 16, cursor: 'pointer' }}
                onClick={() => setEditingSong(null)}
              >
                ✕
              </button>
            </div>

            <div
              className="form-grid"
              style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr', gap: 10, marginBottom: 14 }}
            >
              <label className="field">
                <span style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8' }}>Título</span>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px' }}
                />
              </label>
              <label className="field">
                <span style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8' }}>Autor / Artista</span>
                <input
                  type="text"
                  value={editAuthor}
                  onChange={(e) => setEditAuthor(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px' }}
                />
              </label>
              <label className="field">
                <span style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8' }}>Tonalidad</span>
                <input
                  type="text"
                  value={editKey}
                  placeholder="Ej. G, C, Em"
                  onChange={(e) => setEditKey(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px' }}
                />
              </label>
              <label className="field">
                <span style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8' }}>BPM</span>
                <input
                  type="number"
                  value={editBpm ?? ''}
                  placeholder="72"
                  onChange={(e) => setEditBpm(e.target.value ? Number(e.target.value) : null)}
                  style={{ width: '100%', padding: '6px 8px' }}
                />
              </label>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="hly-mini-btn"
                title="Elimina etiquetas web, acordes desalineados y caracteres raros"
                onClick={() => setEditRawLyrics((prev) => cleanInternetLyrics(prev))}
              >
                ✨ Limpiar letra
              </button>
              <button
                type="button"
                className="hly-mini-btn"
                title="Divide estrofas largas de más de 4 líneas para lectura clara en pantalla"
                onClick={() => {
                  const parsed = parseRawLyricsToStanzas(editRawLyrics)
                  const split = autoSplitLongStanzas(parsed, 4)
                  setEditRawLyrics(split.map((st) => `[${st.label}]\n${st.lines.join('\n')}`).join('\n\n'))
                }}
              >
                ✂ Dividir estrofas &gt;4 líneas
              </button>
              <button
                type="button"
                className="hly-mini-btn"
                onClick={() => setEditRawLyrics((prev) => transposeChordText(prev, -1))}
              >
                ♭ -1 Semitono
              </button>
              <button
                type="button"
                className="hly-mini-btn"
                onClick={() => setEditRawLyrics((prev) => transposeChordText(prev, 1))}
              >
                ♯ +1 Semitono
              </button>
            </div>

            <label className="field" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8' }}>
                Letra de la alabanza (Estrofas separadas por línea en blanco o etiquetas [Verso 1], [Coro])
              </span>
              <textarea
                rows={12}
                value={editRawLyrics}
                onChange={(e) => setEditRawLyrics(e.target.value)}
                style={{
                  width: '100%',
                  fontFamily: 'monospace',
                  fontSize: 13,
                  lineHeight: 1.4,
                  padding: 10,
                  borderRadius: 6,
                  background: '#090d16',
                  color: '#f8fafc',
                  border: '1px solid var(--border)'
                }}
              />
            </label>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
                marginTop: 16,
                paddingTop: 12,
                borderTop: '1px solid var(--border)'
              }}
            >
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => setEditingSong(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => void handleSaveEditedSong()}
              >
                💾 Guardar cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
