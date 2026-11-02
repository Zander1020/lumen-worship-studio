import { type ChangeEvent, type DragEvent, useMemo, useRef, useState } from 'react'
import type { BackgroundKind, MediaBackground } from '../../../../shared/ipc'
import { isVideoUrl } from '../../../../shared/slideHelpers'
import { MotionVideoBackground } from '../../components/SlidePreviewStage'
import type { UseAppStatus } from '../../hooks/useAppStatus'
import { ConfirmDeleteModal } from '../../components/ConfirmDeleteModal'

export interface MediaPageProps {
  app: UseAppStatus
}

const CATEGORIES = ['Todas', 'Anuncios', 'Sermón', 'Bienvenida', 'Ofrenda', 'General'] as const
type CategoryFilter = (typeof CATEGORIES)[number]

export function MediaPage({ app }: MediaPageProps) {
  const [activeTab, setActiveTab] = useState<'images' | 'backgrounds'>('images')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('Todas')
  const [searchQuery, setSearchQuery] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean
    title: string
    itemName: string
    itemType: string
    onConfirm: () => void
  }>({
    isOpen: false,
    title: '',
    itemName: '',
    itemType: '',
    onConfirm: () => {}
  })
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Estados para añadir fondo personalizado
  const [name, setName] = useState('')
  const [kind, setKind] = useState<BackgroundKind>('gradient')
  const [value, setValue] = useState('linear-gradient(135deg, #1b2a4a 0%, #090d16 100%)')
  const [accentColor, setAccentColor] = useState('#f2b84b')

  const activeBgId = app.status?.projection.live.theme.background.id
  const currentTheme = app.status?.projection.live.theme
  const live = app.status?.projection.live

  const isDoc = (m: MediaBackground): boolean => {
    if ((m.slides && m.slides.length > 0) || (m as { slides?: unknown[] }).slides !== undefined) return true
    const lowerName = (m.name || '').toLowerCase()
    if (/\.(pdf|pptx|ppt|ppsx|pps|potx)($|[?#])/i.test(lowerName) || /^(pdf|powerpoint):/i.test(lowerName)) return true
    const lowerVal = typeof m.value === 'string' ? m.value.toLowerCase() : ''
    if (/\.(pdf|pptx|ppt|ppsx|pps|potx)($|[?#])/i.test(lowerVal)) return true
    if (m.category && ['diapositivas', 'presentaciones', 'documentos', 'pdf'].includes(m.category.toLowerCase())) return true
    return false
  }

  // Filtrar estrictamente solo imágenes reales del culto (sin diapositivas de presentaciones)
  const churchImages = useMemo(() => {
    return app.media.filter((m) => m.kind === 'image' && !isDoc(m))
  }, [app.media])

  const filteredImages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return churchImages.filter((img) => {
      if (categoryFilter !== 'Todas' && (img.category || 'General') !== categoryFilter) return false
      if (q && !img.name.toLowerCase().includes(q)) return false
      return true
    })
  }, [churchImages, categoryFilter, searchQuery])

  // Fondos (degradados, sólidos y videos de fondo — sin ningún documento)
  const backgroundItems = useMemo(() => {
    return app.media.filter((m) => m.kind !== 'image' && !isDoc(m))
  }, [app.media])

  const applyBackground = (bg: MediaBackground): void => {
    void app.updateProjectionTheme({ background: bg, videoPlaying: true })
  }

  const projectImageImmediately = (img: MediaBackground, openWindow = true): void => {
    const isVid = img.kind === 'video' || isVideoUrl(img.value)
    void app.loadProjectionDeck({
      deckTitle: img.name,
      slides: [
        {
          id: `img-${img.id}`,
          sourceKind: 'custom',
          sourceTitle: img.name,
          label: img.name,
          lines: [],
          footer: '',
          imageUrl: img.value,
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

  const addImageToSchedule = (img: MediaBackground): void => {
    const isVid = img.kind === 'video' || isVideoUrl(img.value)
    void app.addScheduleItem({
      kind: 'announcement',
      title: `${isVid ? 'Vídeo' : 'Imagen'}: ${img.name}`,
      subtitle: img.category || (isVid ? 'Vídeo del Culto' : 'Imagen del Culto'),
      slides: [
        {
          id: `sched-img-${img.id}`,
          sourceKind: 'custom',
          sourceTitle: img.name,
          label: img.name,
          lines: [],
          footer: '',
          imageUrl: img.value,
          mediaKind: isVid ? 'video' : 'image'
        }
      ]
    })
  }

  const handleUploadFiles = (files: FileList | File[]): void => {
    Array.from(files).forEach((file) => {
      // Bloqueo total: Si es PDF o PowerPoint, jamás se añade a Medios (solo van a Diapositivas)
      if (
        /\.(pdf|pptx|ppt|ppsx|pps|potx)$/i.test(file.name) ||
        file.type.includes('pdf') ||
        file.type.includes('presentation')
      ) {
        return
      }
      const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mkv|mov|avi|ogv|m4v)$/i.test(file.name)
      const nativePath =
        (file as unknown as { path?: string }).path ||
        (typeof window !== 'undefined' &&
          (window as unknown as { lumen?: { getPathForFile?: (f: File) => string } }).lumen?.getPathForFile?.(file))
      if (nativePath) {
        const fileUrl = `lumen-media://local/${encodeURIComponent(nativePath.replace(/\\/g, '/'))}`
        void app.addMedia({
          name: file.name.replace(/\.[^.]+$/, ''),
          kind: isVideo ? 'video' : 'image',
          value: fileUrl,
          accentColor: isVideo ? '#38bdf8' : '#f59e0b',
          category: categoryFilter !== 'Todas' ? categoryFilter : 'General'
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
            name: file.name.replace(/\.[^.]+$/, ''),
            kind: isVideo ? 'video' : 'image',
            value: dataUrl,
            accentColor: isVideo ? '#38bdf8' : '#f59e0b',
            category: categoryFilter !== 'Todas' ? categoryFilter : 'General'
          })
        }
      }
      reader.readAsDataURL(file)
    })
  }

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>): void => {
    if (e.target.files && e.target.files.length > 0) {
      handleUploadFiles(e.target.files)
    }
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault()
    if (e.dataTransfer.files.length > 0) {
      handleUploadFiles(e.dataTransfer.files)
    }
  }

  const handleCreateCustom = async (): Promise<void> => {
    if (!name.trim() || !value.trim()) return
    await app.addMedia({
      name: name.trim(),
      kind,
      value: value.trim(),
      accentColor
    })
    setName('')
  }

  return (
    <section
      className="page hly-page"
      aria-labelledby="page-title"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <header className="hly-module-bar hly-module-bar--compact">
        <div className="hly-module-bar__left">
          <h1 id="page-title" className="hly-module-bar__title">
            Imágenes
          </h1>
          <div className="hly-tab-strip" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'images'}
              className={`hly-tab-btn${activeTab === 'images' ? ' hly-tab-btn--active' : ''}`}
              onClick={() => setActiveTab('images')}
            >
              🖼 Imágenes del Culto ({churchImages.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'backgrounds'}
              className={`hly-tab-btn${activeTab === 'backgrounds' ? ' hly-tab-btn--active' : ''}`}
              onClick={() => setActiveTab('backgrounds')}
            >
              ◈ Fondos y Vídeos ({backgroundItems.length})
            </button>
          </div>
        </div>

        <div className="button-row" style={{ alignItems: 'center' }}>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/mp4,video/webm"
            style={{ display: 'none' }}
            aria-label="Subir imágenes del culto"
            onChange={handleFileInputChange}
          />
          <button
            type="button"
            className="hly-mini-btn hly-mini-btn--primary"
            onClick={() => fileInputRef.current?.click()}
          >
            + Importar
          </button>
        </div>
      </header>

      {activeTab === 'images' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Barra de filtros de categoría idéntica a Holyrics */}
          <div className="hly-SubToolbar" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="search"
              aria-label="Buscar imagen"
              placeholder="Buscar imagen por nombre..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ minWidth: 200, maxWidth: 320 }}
            />
            <div className="tag-row" style={{ marginLeft: 'auto' }}>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`stanza-chip${categoryFilter === cat ? ' active' : ''}`}
                  onClick={() => setCategoryFilter(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div
            className="card"
            style={{
              padding: '10px 14px',
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '12px'
            }}
          >
            <span>
              💡 <strong>Proyección directa:</strong> Haz <strong>doble clic</strong> sobre cualquier imagen para proyectarla a pantalla completa inmediatamente. Arrastra archivos aquí para subirlos.
            </span>
            <span style={{ color: 'var(--text-muted)' }}>{filteredImages.length} imagen(es)</span>
          </div>

          {filteredImages.length === 0 ? (
            <div
              className="card"
              style={{
                textAlign: 'center',
                padding: '48px 20px',
                border: '2px dashed var(--border)',
                background: 'transparent'
              }}
            >
              <div style={{ fontSize: '36px', marginBottom: 10 }}>🖼</div>
              <h2 className="card__title" style={{ marginBottom: 6 }}>
                No hay imágenes en esta categoría
              </h2>
              <p className="hint" style={{ maxWidth: 440, margin: '0 auto 16px' }}>
                Arrastra y suelta imágenes de anuncios, sermones, ofrendas o eventos de tu iglesia aquí, o pulsa el botón superior para seleccionarlas.
              </p>
              <button
                type="button"
                className="button button--primary"
                onClick={() => fileInputRef.current?.click()}
              >
                Subir imágenes ahora
              </button>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                gap: 14
              }}
            >
              {filteredImages.map((img) => {
                const isProjected = live?.deckTitle === `Imagen: ${img.name}`
                return (
                  <div
                    key={img.id}
                    className={`media-card${isProjected ? ' media-card--active' : ''}`}
                    style={{
                      background: 'var(--bg-card)',
                      border: isProjected ? '2px solid #10b981' : '1px solid var(--border)',
                      borderRadius: 8,
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column'
                    }}
                    onDoubleClick={() => projectImageImmediately(img, true)}
                  >
                    <div
                      style={{
                        height: 150,
                        background: '#09090b',
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        cursor: 'pointer'
                      }}
                      title="Doble clic para proyectar a pantalla completa"
                    >
                      <img
                        src={img.value}
                        alt={img.name}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'contain'
                        }}
                      />
                      {isProjected && (
                        <span
                          className="badge"
                          style={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            background: '#059669',
                            color: '#fff',
                            fontWeight: 800
                          }}
                        >
                          ● EN PANTALLA
                        </span>
                      )}
                      {img.category && (
                        <span
                          className="badge"
                          style={{
                            position: 'absolute',
                            bottom: 8,
                            left: 8,
                            background: 'rgba(0,0,0,0.75)',
                            color: '#facc15'
                          }}
                        >
                          {img.category}
                        </span>
                      )}
                    </div>

                    <div style={{ padding: '10px 12px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: '13px',
                          color: '#fff',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          marginBottom: 8
                        }}
                        title={img.name}
                      >
                        {img.name}
                      </div>

                      <div className="button-row" style={{ marginTop: 'auto', gap: 6 }}>
                        <button
                          type="button"
                          className="hly-mini-btn hly-mini-btn--primary"
                          style={{ flex: 1 }}
                          onClick={() => projectImageImmediately(img, true)}
                        >
                          ▶ Proyectar
                        </button>
                        <button
                          type="button"
                          className="hly-mini-btn"
                          title="Añadir a la lista del culto"
                          onClick={() => addImageToSchedule(img)}
                        >
                          + Lista
                        </button>
                        <button
                          type="button"
                          className="hly-mini-btn hly-mini-btn--danger"
                          title="Eliminar imagen"
                          onClick={() => {
                            setDeleteConfirm({
                              isOpen: true,
                              title: '¿Eliminar imagen?',
                              itemName: img.name,
                              itemType: 'imagen del culto',
                              onConfirm: () => {
                                void app.deleteMedia(img.id)
                                setDeleteConfirm((prev) => ({ ...prev, isOpen: false }))
                              }
                            })
                          }}
                        >
                          🗑
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'backgrounds' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card">
            <div className="card__header-row">
              <h2 className="card__title" style={{ marginBottom: 0 }}>
                Fondos y Vídeos de Proyección ({backgroundItems.length})
              </h2>
              {currentTheme && (
                <div className="tag-row" style={{ alignItems: 'center' }}>
                  <label style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span>Oscurecer ({currentTheme.bgDimmer ?? 0}%):</span>
                    <input
                      type="range"
                      min={0}
                      max={85}
                      step={5}
                      value={currentTheme.bgDimmer ?? 0}
                      onChange={(e) =>
                        void app.updateProjectionTheme({ bgDimmer: Number(e.target.value) })
                      }
                    />
                  </label>
                  <label style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span>Desenfoque ({currentTheme.bgBlur ?? 0}px):</span>
                    <input
                      type="range"
                      min={0}
                      max={16}
                      step={1}
                      value={currentTheme.bgBlur ?? 0}
                      onChange={(e) =>
                        void app.updateProjectionTheme({ bgBlur: Number(e.target.value) })
                      }
                    />
                  </label>
                </div>
              )}
            </div>
            <div className="media-grid" role="list" aria-label="Galería de fondos">
              {backgroundItems.map((bg) => {
                const isActive = bg.id === activeBgId
                const swatchStyle =
                  bg.kind === 'video'
                    ? { background: '#111827' }
                    : { background: bg.value }
                return (
                  <div
                    key={bg.id}
                    role="listitem"
                    className={`media-card${isActive ? ' media-card--active' : ''}`}
                    onDoubleClick={() => applyBackground(bg)}
                  >
                    <div className="media-card__swatch" style={{ ...swatchStyle, position: 'relative', overflow: 'hidden' }}>
                      {bg.kind === 'video' && <MotionVideoBackground value={bg.value} playing={isActive} />}
                      {bg.kind === 'video' && (
                        <span className="badge" style={{ position: 'relative', zIndex: 1 }}>
                          🎬 VIDEO
                        </span>
                      )}
                      {isActive && (
                        <span className="badge" style={{ position: 'relative', zIndex: 1 }}>
                          ACTIVO
                        </span>
                      )}
                    </div>
                    <div className="media-card__body">
                      <div className="media-card__title">{bg.name}</div>
                      <div className="button-row" style={{ marginTop: 8 }}>
                        <button
                          type="button"
                          className="button button--primary"
                          onClick={() => applyBackground(bg)}
                        >
                          Aplicar
                        </button>
                        {app.media.length > 1 && (
                          <button
                            type="button"
                            className="button button--danger"
                            aria-label={`Eliminar ${bg.name}`}
                            onClick={() => {
                              setDeleteConfirm({
                                isOpen: true,
                                title: '¿Eliminar fondo de proyección?',
                                itemName: bg.name,
                                itemType: 'fondo multimedia',
                                onConfirm: () => {
                                  void app.deleteMedia(bg.id)
                                  setDeleteConfirm((prev) => ({ ...prev, isOpen: false }))
                                }
                              })
                            }}
                          >
                            Eliminar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="grid">
            <div className="card">
              <h2 className="card__title">Añadir fondo personalizado</h2>
              <div className="form-grid">
                <label className="field">
                  <span>Nombre del fondo</span>
                  <input
                    type="text"
                    placeholder="Ej. Azul Profundo"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Tipo</span>
                  <select
                    aria-label="Tipo de fondo"
                    value={kind}
                    onChange={(e) => {
                      const nextKind = e.target.value as BackgroundKind
                      setKind(nextKind)
                      if (nextKind === 'solid') setValue('#101828')
                      if (nextKind === 'gradient') setValue('linear-gradient(135deg, #1b2a4a 0%, #090d16 100%)')
                    }}
                  >
                    <option value="gradient">Degradado CSS</option>
                    <option value="solid">Color sólido</option>
                    <option value="video">URL de Video (.mp4 / .webm)</option>
                  </select>
                </label>
                <label className="field" style={{ gridColumn: '1 / -1' }}>
                  <span>Valor CSS (color hex o linear/radial-gradient)</span>
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Color de acento</span>
                  <input
                    type="text"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                  />
                </label>
              </div>
              <div className="button-row" style={{ marginTop: 12 }}>
                <button
                  type="button"
                  className="button button--primary"
                  onClick={() => void handleCreateCustom()}
                >
                  + Guardar fondo
                </button>
              </div>
            </div>

            <div className="card">
              <h2 className="card__title">Importar imagen o video desde este equipo</h2>
              <p className="hint" style={{ marginTop: 0, marginBottom: 12 }}>
                Selecciona una imagen (<code>.jpg</code>, <code>.png</code>, <code>.webp</code>) o video en bucle (
                <code>.mp4</code>, <code>.webm</code>) para usarlo como fondo de proyección sin conexión a Internet.
              </p>
              <input
                type="file"
                aria-label="Seleccionar archivo de imagen"
                accept="image/*,video/mp4,video/webm"
                onChange={(e) => {
                  if (e.target.files) handleUploadFiles(e.target.files)
                }}
              />
            </div>
          </div>
        </div>
      )}
      {/* Modal elegante de confirmación de eliminación */}
      <ConfirmDeleteModal
        isOpen={deleteConfirm.isOpen}
        title={deleteConfirm.title}
        itemName={deleteConfirm.itemName}
        itemType={deleteConfirm.itemType}
        onConfirm={deleteConfirm.onConfirm}
        onCancel={() => setDeleteConfirm((prev) => ({ ...prev, isOpen: false }))}
      />
    </section>
  )
}
