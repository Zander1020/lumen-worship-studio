import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import type { MediaBackground } from '../../../../shared/ipc'
import { isVideoUrl } from '../../../../shared/slideHelpers'
import { convertPdfToSlides, convertPptxToSlides } from '../../features/home/presentationDocHelpers'
import type { UseAppStatus } from '../../hooks/useAppStatus'

export interface HolyricsLeftDockProps {
  app: UseAppStatus
}

/**
 * Columna izquierda de cabina: Panel de MEDIOS del culto.
 * Muestra exclusivamente imágenes y vídeos subidos por el usuario (WhatsApp, anuncios, etc.),
 * manteniendo los fondos y loops internos en su panel dedicado de Fondos.
 */
export function HolyricsLeftDock({ app }: HolyricsLeftDockProps) {
  const live = app.status?.projection.live
  const [mediaSearch, setMediaSearch] = useState('')
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: MediaBackground } | null>(null)
  const [previewModalItem, setPreviewModalItem] = useState<MediaBackground | null>(null)
  const mediaFileInputRef = useRef<HTMLInputElement | null>(null)

  // Cerrar menú contextual al hacer clic en cualquier parte
  useEffect(() => {
    if (!contextMenu) return
    const handleClick = () => setContextMenu(null)
    window.addEventListener('click', handleClick)
    return () => window.removeEventListener('click', handleClick)
  }, [contextMenu])

  // Filtrar estrictamente solo vídeos e imágenes del culto (no fondos de sistema ni de la carpeta de fondos)
  const userMedia = useMemo(() => {
    return app.media.filter((m) => m.category === 'Culto')
  }, [app.media])

  const filteredMedia = useMemo(() => {
    const q = mediaSearch.trim().toLowerCase()
    if (!q) return userMedia
    return userMedia.filter((m) => m.name.toLowerCase().includes(q))
  }, [userMedia, mediaSearch])

  const handleUploadMediaFiles = (e: ChangeEvent<HTMLInputElement>): void => {
    const files = e.target.files
    if (!files || files.length === 0) return
    Array.from(files).forEach(async (file) => {
      const lowerName = file.name.toLowerCase()
      if (lowerName.endsWith('.pdf')) {
        try {
          const deck = await convertPdfToSlides(file, file.name)
          if (deck.slides.length > 0) {
            void app.addMedia({
              name: deck.title,
              kind: 'image',
              value: deck.slides[0]?.imageUrl || '',
              category: 'Culto'
            })
            void app.addScheduleItem({
              kind: 'announcement',
              title: `PDF: ${deck.title}`,
              subtitle: `${deck.slides.length} páginas`,
              slides: deck.slides
            })
            void app.loadProjectionDeck({
              deckTitle: deck.title,
              slides: deck.slides,
              startIndex: 0,
              openWindow: false
            })
            return
          }
        } catch (err) {
          console.error('Error al importar PDF:', err)
        }
      } else if (lowerName.endsWith('.pptx')) {
        try {
          const deck = await convertPptxToSlides(file, file.name)
          if (deck.slides.length > 0) {
            void app.addMedia({
              name: deck.title,
              kind: 'image',
              value: deck.slides[0]?.imageUrl || '',
              category: 'Culto'
            })
            void app.addScheduleItem({
              kind: 'announcement',
              title: `PowerPoint: ${deck.title}`,
              subtitle: `${deck.slides.length} diapositivas`,
              slides: deck.slides
            })
            void app.loadProjectionDeck({
              deckTitle: deck.title,
              slides: deck.slides,
              startIndex: 0,
              openWindow: false
            })
            return
          }
        } catch (err) {
          console.error('Error al importar PPTX:', err)
        }
      }

      const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mkv|mov|avi|ogv|m4v)$/i.test(file.name)
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

  const projectMedia = (item: MediaBackground, openWindow = true): void => {
    const isVideo = item.kind === 'video' || isVideoUrl(item.value)
    let mediaVal = item.value
    if (isVideo && mediaVal.startsWith('data:') && !mediaVal.startsWith('data:video/')) {
      const comma = mediaVal.indexOf(',')
      if (comma !== -1) {
        mediaVal = `data:video/mp4;base64,${mediaVal.slice(comma + 1)}`
      }
    }
    void app.loadProjectionDeck({
      deckTitle: item.name,
      slides: [
        {
          id: `slide-media-${item.id}`,
          sourceKind: 'custom',
          sourceTitle: item.name,
          label: item.name,
          lines: [],
          footer: '',
          imageUrl: mediaVal,
          mediaKind: item.kind === 'video' ? 'video' : 'image'
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

  return (
    <aside className="hly-leftdock" aria-label="Medios preparados para el culto">
      <div className="hly-panel hly-panel--playlist" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div
          className="hly-panel__header"
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'nowrap',
            gap: 6,
            padding: '6px 8px'
          }}
        >
          <span
            className="hly-panel__title"
            style={{
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              fontSize: 11,
              fontWeight: 800
            }}
            title="Vídeos e imágenes subidas por el usuario"
          >
            🎬 MEDIOS ({filteredMedia.length})
          </span>
          <div
            className="btn-row"
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              flexWrap: 'nowrap',
              flexShrink: 0
            }}
          >
            <input
              ref={mediaFileInputRef}
              type="file"
              accept="image/*,video/*,.pdf,.pptx"
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
              onClick={() => mediaFileInputRef.current?.click()}
            >
              ➕
            </button>
          </div>
        </div>

        <div className="hly-SubToolbar" style={{ padding: '4px 6px' }}>
          <input
            type="text"
            className="input"
            value={mediaSearch}
            onChange={(e) => setMediaSearch(e.target.value)}
            placeholder="Filtrar imagen por nombre..."
            aria-label="Filtrar imágenes del culto"
            style={{ fontSize: 11, padding: '3px 6px', width: '100%' }}
          />
        </div>

        <div className="hly-playlist-body" style={{ flex: 1, overflowY: 'auto' }}>
          {filteredMedia.length === 0 ? (
            <div className="hly-empty-box" style={{ padding: 14 }}>
              No hay medios subidos aún. Usa el botón <strong>➕</strong> o <strong>📁</strong> para cargar tus imágenes y vídeos para el culto.
            </div>
          ) : (
            <div className="hly-table-list" role="list">
              {filteredMedia.map((item, idx) => {
                const isActive = live?.deckTitle === item.name
                const isSelected = selectedMediaId === item.id
                return (
                  <div
                    key={item.id}
                    role="listitem"
                    className={`hly-playlist-row${isActive ? ' hly-playlist-row--active' : ''}${isSelected ? ' hly-playlist-row--selected' : ''}`}
                    style={{ cursor: 'pointer' }}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      setSelectedMediaId(item.id)
                      setContextMenu({ x: e.clientX, y: e.clientY, item })
                    }}
                  >
                    <button
                      type="button"
                      className="hly-playlist-row__main"
                      title="1 clic: Proyectar | Clic derecho: Vista previa sin proyectar"
                      onClick={() => {
                        setSelectedMediaId(item.id)
                        projectMedia(item, true)
                      }}
                      onDoubleClick={() => projectMedia(item, true)}
                    >
                      <span className="hly-playlist-row__idx">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <span
                        style={{
                          width: 28,
                          height: 20,
                          borderRadius: 3,
                          overflow: 'hidden',
                          background: '#111',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          border: '1px solid var(--border)'
                        }}
                      >
                        {item.kind === 'video' ? (
                          <span style={{ fontSize: 10 }}>🎬</span>
                        ) : item.value.startsWith('data:image') || item.value.startsWith('http') || item.value.startsWith('lumen-media:') ? (
                          <img
                            src={item.value}
                            alt=""
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <span style={{ fontSize: 10 }}>🖼</span>
                        )}
                      </span>
                      <span className="hly-playlist-row__info">
                        <span className="hly-playlist-row__title">{item.name}</span>
                        <span className="hly-playlist-row__sub">
                          {item.kind === 'video' ? 'Vídeo' : 'Imagen'} {item.category ? `· ${item.category}` : ''}
                        </span>
                      </span>
                    </button>
                    <div className="hly-playlist-row__actions">
                      <button
                        type="button"
                        className="hly-icon-btn"
                        title="Vista previa sin proyectar"
                        onClick={(e) => {
                          e.stopPropagation()
                          setPreviewModalItem(item)
                        }}
                      >
                        👁
                      </button>
                      <button
                        type="button"
                        className="hly-icon-btn"
                        title="Proyectar en vivo (doble clic)"
                        onClick={() => projectMedia(item, true)}
                      >
                        ▶
                      </button>
                      <button
                        type="button"
                        className="hly-icon-btn hly-icon-btn--danger"
                        title="Eliminar imagen"
                        onClick={() => void app.deleteMedia(item.id)}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* MENÚ CONTEXTUAL AL HACER CLIC DERECHO */}
      {contextMenu && (
        <div
          style={{
            position: 'fixed',
            left: Math.min(contextMenu.x, window.innerWidth - 180),
            top: Math.min(contextMenu.y, window.innerHeight - 120),
            zIndex: 9999,
            background: 'var(--bg-panel)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            padding: 4,
            minWidth: 160,
            display: 'flex',
            flexDirection: 'column',
            gap: 2
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="hly-mini-btn"
            style={{ textAlign: 'left', padding: '6px 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}
            onClick={() => {
              setPreviewModalItem(contextMenu.item)
              setContextMenu(null)
            }}
          >
            👁 Vista previa
          </button>
          <button
            type="button"
            className="hly-mini-btn"
            style={{ textAlign: 'left', padding: '6px 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}
            onClick={() => {
              projectMedia(contextMenu.item, true)
              setContextMenu(null)
            }}
          >
            ▶ Proyectar en vivo
          </button>
          <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />
          <button
            type="button"
            className="hly-mini-btn"
            style={{ textAlign: 'left', padding: '6px 10px', fontSize: 12, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}
            onClick={() => {
              void app.deleteMedia(contextMenu.item.id)
              setContextMenu(null)
            }}
          >
            ✕ Eliminar
          </button>
        </div>
      )}

      {/* MODAL DE VISTA PREVIA (SIN AFECTAR LA PROYECCIÓN EN VIVO) */}
      {previewModalItem && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            background: 'rgba(0, 0, 0, 0.78)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24
          }}
          onClick={() => setPreviewModalItem(null)}
        >
          <div
            style={{
              background: 'var(--bg-panel)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: '20px 24px',
              maxWidth: 760,
              width: '100%',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              boxShadow: '0 12px 36px rgba(0,0,0,0.5)',
              boxSizing: 'border-box'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18 }}>{previewModalItem.kind === 'video' ? '🎬' : '🖼'}</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                  Vista previa: {previewModalItem.name}
                </span>
              </div>
              <button
                type="button"
                className="hly-mini-btn"
                style={{ padding: '4px 8px', fontSize: 13 }}
                onClick={() => setPreviewModalItem(null)}
                title="Cerrar vista previa"
              >
                ✕
              </button>
            </div>

            <div
              style={{
                flex: 1,
                minHeight: 280,
                maxHeight: '55vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#070b16',
                borderRadius: 8,
                overflow: 'hidden'
              }}
            >
              {previewModalItem.kind === 'video' || isVideoUrl(previewModalItem.value) ? (
                <video
                  src={previewModalItem.value}
                  controls
                  autoPlay
                  loop
                  style={{ maxWidth: '100%', maxHeight: '55vh', objectFit: 'contain' }}
                />
              ) : (
                <img
                  src={previewModalItem.value}
                  alt={previewModalItem.name}
                  style={{ maxWidth: '100%', maxHeight: '55vh', objectFit: 'contain' }}
                />
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {previewModalItem.kind === 'video' ? 'Vídeo del culto' : 'Imagen del culto'} (no afecta la pantalla en vivo)
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="button"
                  onClick={() => setPreviewModalItem(null)}
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  className="button button--primary"
                  onClick={() => {
                    projectMedia(previewModalItem, true)
                    setPreviewModalItem(null)
                  }}
                >
                  ▶ Proyectar en pantalla
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
