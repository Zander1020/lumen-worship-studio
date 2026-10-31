import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import type { MediaBackground } from '../../../../shared/ipc'
import type { PresentationSlide, ScheduleItem } from '../../../../shared/models'
import { isVideoUrl } from '../../../../shared/slideHelpers'
import { ConfirmDeleteModal } from '../ConfirmDeleteModal'
import type { UseAppStatus } from '../../hooks/useAppStatus'

export interface HolyricsLeftDockProps {
  app: UseAppStatus
}

type LeftDockTab = 'culto' | 'medios'

/**
 * Columna izquierda de cabina: Panel de MEDIOS del culto.
 * Muestra exclusivamente imágenes y vídeos subidos por el usuario (WhatsApp, anuncios, etc.),
 * manteniendo los fondos y loops internos en su panel dedicado de Fondos.
 */
export function HolyricsLeftDock({ app }: HolyricsLeftDockProps) {
  const live = app.status?.projection.live
  const [leftTab, setLeftTab] = useState<LeftDockTab>('culto')
  const [scheduleSearch, setScheduleSearch] = useState('')
  const [mediaSearch, setMediaSearch] = useState('')
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(null)
  const [isReloading, setIsReloading] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: MediaBackground } | null>(null)
  const [previewModalItem, setPreviewModalItem] = useState<MediaBackground | null>(null)
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
  const mediaFileInputRef = useRef<HTMLInputElement | null>(null)

  const filteredSchedule = useMemo(() => {
    const q = scheduleSearch.trim().toLowerCase()
    if (!q) return app.schedule
    return app.schedule.filter(
      (item) => item.title.toLowerCase().includes(q) || item.subtitle.toLowerCase().includes(q)
    )
  }, [app.schedule, scheduleSearch])

  const projectScheduleItem = (item: ScheduleItem, openWindow = true): void => {
    if (item.slides.length === 0) return
    void app.loadProjectionDeck({
      deckTitle: item.title,
      slides: item.slides,
      startIndex: 0,
      openWindow
    })
    void app.setProjectionMode('live')
    if (openWindow && !app.status?.projection.windowOpen) {
      void app.openProjection({ target: 'auto' })
    }
  }

  const addMediaToSchedule = (item: MediaBackground): void => {
    const isVideo = item.kind === 'video' || isVideoUrl(item.value)
    let mediaVal = item.value
    if (isVideo && mediaVal.startsWith('data:') && !mediaVal.startsWith('data:video/')) {
      const comma = mediaVal.indexOf(',')
      if (comma !== -1) {
        mediaVal = `data:video/mp4;base64,${mediaVal.slice(comma + 1)}`
      }
    }

    const scheduleMatch = app.schedule.find(
      (s) =>
        s.title.toLowerCase().includes(item.name.toLowerCase()) ||
        item.name.toLowerCase().includes(s.title.toLowerCase().replace(/^(pdf|powerpoint):\s*/i, ''))
    )
    const deckSlides: PresentationSlide[] =
      item.slides && item.slides.length > 0
        ? item.slides
        : scheduleMatch && scheduleMatch.slides && scheduleMatch.slides.length > 0
          ? scheduleMatch.slides
          : [
              {
                id: `slide-media-${item.id}`,
                sourceKind: 'custom',
                sourceTitle: item.name,
                label: item.name,
                lines: [],
                footer: '',
                imageUrl: mediaVal,
                mediaKind: isVideo ? 'video' : 'image'
              }
            ]

    const isPres =
      item.name.toLowerCase().includes('pdf') ||
      item.name.toLowerCase().includes('powerpoint') ||
      deckSlides.length > 1
    const title = isPres
      ? item.name.toLowerCase().includes('pdf')
        ? `PDF: ${item.name}`
        : `PowerPoint: ${item.name}`
      : `${isVideo ? 'Vídeo' : 'Imagen'}: ${item.name}`
    const subtitle = deckSlides.length > 1 ? `${deckSlides.length} diapositivas` : isVideo ? 'Vídeo del culto' : 'Imagen del culto'

    void app.addScheduleItem({
      kind: 'announcement',
      title,
      subtitle,
      slides: deckSlides
    })
  }

  // Cerrar menú contextual al hacer clic en cualquier parte
  useEffect(() => {
    if (!contextMenu) return
    const handleClick = () => setContextMenu(null)
    window.addEventListener('click', handleClick)
    return () => window.removeEventListener('click', handleClick)
  }, [contextMenu])

  const isDoc = (m: MediaBackground): boolean => {
    if ((m.slides && m.slides.length > 0) || (m as { slides?: unknown[] }).slides !== undefined) return true
    const lowerName = (m.name || '').toLowerCase()
    if (/\.(pdf|pptx|ppt|ppsx|pps|potx)($|[?#])/i.test(lowerName) || /^(pdf|powerpoint):/i.test(lowerName)) return true
    const lowerVal = typeof m.value === 'string' ? m.value.toLowerCase() : ''
    if (/\.(pdf|pptx|ppt|ppsx|pps|potx)($|[?#])/i.test(lowerVal)) return true
    if (m.category && ['diapositivas', 'presentaciones', 'documentos', 'pdf'].includes(m.category.toLowerCase())) return true
    return false
  }

  // Filtrar estrictamente solo vídeos e imágenes del culto (excluyendo fondos y presentaciones)
  const userMedia = useMemo(() => {
    return app.media.filter(
      (m) => m.category === 'Culto' && !isDoc(m)
    )
  }, [app.media])

  const filteredMedia = useMemo(() => {
    const q = mediaSearch.trim().toLowerCase()
    if (!q) return userMedia
    return userMedia.filter((m) => m.name.toLowerCase().includes(q))
  }, [userMedia, mediaSearch])

  const handleUploadMediaFiles = (e: ChangeEvent<HTMLInputElement>): void => {
    const files = e.target.files
    if (!files || files.length === 0) return
    Array.from(files).forEach((file) => {
      // Bloqueo total: Si es PDF o PowerPoint, jamás se añade a Medios (solo a Diapositivas)
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

    // Si tiene diapositivas asociadas (PDF / PPTX) o existe en el cronograma
    const scheduleMatch = app.schedule.find(
      (s) =>
        s.title.toLowerCase().includes(item.name.toLowerCase()) ||
        item.name.toLowerCase().includes(s.title.toLowerCase().replace(/^(pdf|powerpoint):\s*/i, ''))
    )
    const deckSlides: PresentationSlide[] =
      item.slides && item.slides.length > 0
        ? item.slides
        : scheduleMatch && scheduleMatch.slides && scheduleMatch.slides.length > 0
          ? scheduleMatch.slides
          : [
              {
                id: `slide-media-${item.id}`,
                sourceKind: 'custom',
                sourceTitle: item.name,
                label: item.name,
                lines: [],
                footer: '',
                imageUrl: mediaVal,
                mediaKind: isVideo ? 'video' : 'image'
              }
            ]

    void app.loadProjectionDeck({
      deckTitle: item.name,
      slides: deckSlides,
      startIndex: 0,
      openWindow
    })
    if (isVideo) {
      void app.updateProjectionTheme({
        videoPlaying: true,
        videoMuted: false
      })
    }
    void app.setProjectionMode('live')
    if (openWindow && !app.status?.projection.windowOpen) {
      void app.openProjection({ target: 'auto' })
    }
  }

  return (
    <aside className="hly-leftdock" aria-label="Medios preparados para el culto">
      <div className="hly-panel hly-panel--playlist" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* FILA 1: PESTAÑAS CULTO Y MEDIOS */}
        <div
          className="hly-panel__header"
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            padding: '6px 6px'
          }}
        >
          <button
            type="button"
            className={`hly-mini-btn${leftTab === 'culto' ? ' hly-mini-btn--active' : ''}`}
            style={{ flex: 1, fontSize: 11, fontWeight: 700, padding: '4px 6px', textAlign: 'center' }}
            onClick={() => setLeftTab('culto')}
            title="Cronograma del culto (canciones, biblia, diapositivas)"
          >
            📋 CULTO ({app.schedule.length})
          </button>
          <button
            type="button"
            className={`hly-mini-btn${leftTab === 'medios' ? ' hly-mini-btn--active' : ''}`}
            style={{ flex: 1, fontSize: 11, fontWeight: 700, padding: '4px 6px', textAlign: 'center' }}
            onClick={() => setLeftTab('medios')}
            title="Vídeos e imágenes subidas por el usuario"
          >
            🎬 MEDIOS ({filteredMedia.length})
          </button>
        </div>

        {/* FILA 2: BARRA DE BÚSQUEDA + BOTONES DE ACCIÓN (CARPETA, RECARGAR, AÑADIR) */}
        <div
          className="hly-SubToolbar"
          style={{
            padding: '4px 6px',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4
          }}
        >
          <input
            type="text"
            className="input"
            value={leftTab === 'culto' ? scheduleSearch : mediaSearch}
            onChange={(e) => (leftTab === 'culto' ? setScheduleSearch(e.target.value) : setMediaSearch(e.target.value))}
            placeholder={leftTab === 'culto' ? 'Filtrar orden del culto...' : 'Filtrar imagen o vídeo...'}
            aria-label={leftTab === 'culto' ? 'Filtrar orden del culto' : 'Filtrar imágenes del culto'}
            style={{ fontSize: 11, padding: '3px 6px', flex: 1, minWidth: 60 }}
          />
          <input
            ref={mediaFileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            style={{ display: 'none' }}
            onChange={handleUploadMediaFiles}
          />
          {/* Botones de acción dinámicos según pestaña activa */}
          {leftTab === 'culto' ? (
            <>
              <button
                type="button"
                className="hly-mini-btn"
                style={{ width: 26, height: 26, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                title="Recargar cronograma del culto"
                onClick={async () => {
                  setIsReloading(true)
                  await app.reloadMedia()
                  setTimeout(() => setIsReloading(false), 500)
                }}
              >
                <span style={{ display: 'inline-block', transform: isReloading ? 'rotate(360deg)' : 'none', transition: 'transform 0.5s ease' }}>🔄</span>
              </button>
              <button
                type="button"
                className="hly-mini-btn hly-mini-btn--primary"
                style={{ width: 26, height: 26, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 900 }}
                title="Añadir anuncio / elemento al orden del culto"
                onClick={() => {
                  const num = app.schedule.length + 1
                  void app.addScheduleItem({
                    kind: 'announcement',
                    title: `Anuncio del Culto #${num}`,
                    subtitle: 'Elemento añadido al servicio',
                    slides: [
                      {
                        id: `ann-${Date.now()}`,
                        sourceKind: 'custom',
                        sourceTitle: `Anuncio #${num}`,
                        label: 'Anuncio',
                        lines: [`Anuncio del Culto #${num}`],
                        footer: 'Orden del Culto'
                      }
                    ]
                  })
                }}
              >
                ➕
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="hly-mini-btn"
                style={{ width: 26, height: 26, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                title="Abrir carpeta dedicada de imágenes y vídeos de la app"
                onClick={() => void app.openMediaFolder()}
              >
                📁
              </button>
              <button
                type="button"
                className="hly-mini-btn"
                style={{ width: 26, height: 26, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                title="Recargar medios desde el almacenamiento local"
                onClick={async () => {
                  setIsReloading(true)
                  await app.reloadMedia()
                  setTimeout(() => setIsReloading(false), 500)
                }}
              >
                <span style={{ display: 'inline-block', transform: isReloading ? 'rotate(360deg)' : 'none', transition: 'transform 0.5s ease' }}>🔄</span>
              </button>
              <button
                type="button"
                className="hly-mini-btn hly-mini-btn--primary"
                style={{ width: 26, height: 26, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 900 }}
                title="Añadir imágenes o vídeos"
                onClick={() => mediaFileInputRef.current?.click()}
              >
                ➕
              </button>
            </>
          )}
        </div>

        {leftTab === 'culto' ? (
          <div className="hly-playlist-body" style={{ flex: 1, overflowY: 'auto' }}>
            {filteredSchedule.length === 0 ? (
                <div className="hly-empty-box" style={{ padding: 14 }}>
                  El cronograma está vacío. Carga tus alabanzas, lecturas o diapositivas.
                </div>
              ) : (
                <div className="hly-table-list" role="list">
                  {filteredSchedule.map((item, idx) => {
                    const isActive = live?.deckTitle === item.title
                    const isPresentation =
                      item.title.toLowerCase().includes('pdf') ||
                      item.title.toLowerCase().includes('powerpoint') ||
                      item.slides.some((s) => s.label.toLowerCase().includes('página') || s.label.toLowerCase().includes('diapositiva'))
                    return (
                      <div
                        key={item.id}
                        role="listitem"
                        className={`hly-playlist-row${isActive ? ' hly-playlist-row--active' : ''}`}
                        style={{ cursor: 'pointer' }}
                      >
                        <button
                          type="button"
                          className="hly-playlist-row__main"
                          title="1 clic: Proyectar todas las diapositivas · Teclas flecha para cambiar"
                          onClick={() => projectScheduleItem(item, true)}
                          onDoubleClick={() => projectScheduleItem(item, true)}
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
                              background: '#1a2234',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              border: '1px solid var(--border)',
                              fontSize: 11
                            }}
                          >
                            {isPresentation ? (item.title.toLowerCase().includes('pdf') ? '📄' : '📊') : item.kind === 'song' ? '♪' : item.kind === 'bible' ? '📖' : '📢'}
                          </span>
                          <span className="hly-playlist-row__info">
                            <span className="hly-playlist-row__title">{item.title}</span>
                            <span className="hly-playlist-row__sub">
                              {item.subtitle || `${item.slides.length} diapositivas`}
                            </span>
                          </span>
                        </button>
                        <div className="hly-playlist-row__actions">
                          <button
                            type="button"
                            className="hly-icon-btn"
                            title="Proyectar en vivo (doble clic)"
                            onClick={() => projectScheduleItem(item, true)}
                          >
                            ▶
                          </button>
                          <button
                            type="button"
                            className="hly-icon-btn hly-icon-btn--danger"
                            title="Quitar del cronograma"
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleteConfirm({
                                isOpen: true,
                                title: '¿Quitar del orden del culto?',
                                itemName: item.title,
                                itemType: 'elemento',
                                onConfirm: () => {
                                  void app.removeScheduleItem(item.id)
                                  setDeleteConfirm((prev) => ({ ...prev, isOpen: false }))
                                }
                              })
                            }}
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
        ) : (
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
                        title="1 clic: Proyectar | Clic derecho: Menú de opciones"
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
                          title="Añadir al orden del culto"
                          onClick={(e) => {
                            e.stopPropagation()
                            addMediaToSchedule(item)
                          }}
                        >
                          ➕
                        </button>
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
                          title="Eliminar medio"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeleteConfirm({
                              isOpen: true,
                              title: '¿Eliminar archivo multimedia?',
                              itemName: item.name,
                              itemType: item.kind === 'video' ? 'vídeo' : 'imagen',
                              onConfirm: () => {
                                void app.deleteMedia(item.id)
                                setDeleteConfirm((prev) => ({ ...prev, isOpen: false }))
                              }
                            })
                          }}
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
        )}
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
              addMediaToSchedule(contextMenu.item)
              setContextMenu(null)
            }}
          >
            ➕ Añadir al culto
          </button>
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
              const target = contextMenu.item
              setContextMenu(null)
              setDeleteConfirm({
                isOpen: true,
                title: '¿Eliminar archivo multimedia?',
                itemName: target.name,
                itemType: target.kind === 'video' ? 'vídeo' : 'imagen',
                onConfirm: () => {
                  void app.deleteMedia(target.id)
                  setDeleteConfirm((prev) => ({ ...prev, isOpen: false }))
                }
              })
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
                  playsInline
                  style={{ maxWidth: '100%', maxHeight: '55vh', objectFit: 'contain' }}
                  onCanPlay={(e) => {
                    const v = e.currentTarget
                    v.muted = false
                    v.volume = 1.0
                  }}
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

      {/* MODAL DE CONFIRMACIÓN DE ELIMINACIÓN CON ESTILOS DE LA APP */}
      <ConfirmDeleteModal
        isOpen={deleteConfirm.isOpen}
        title={deleteConfirm.title}
        itemName={deleteConfirm.itemName}
        itemType={deleteConfirm.itemType}
        onConfirm={deleteConfirm.onConfirm}
        onCancel={() => setDeleteConfirm((prev) => ({ ...prev, isOpen: false }))}
      />
    </aside>
  )
}
