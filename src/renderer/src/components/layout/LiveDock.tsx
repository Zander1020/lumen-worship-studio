import { type ChangeEvent, type WheelEvent, useEffect, useMemo, useRef, useState } from 'react'
import type { MediaBackground } from '../../../../shared/ipc'
import { ProjectionControls } from '../../features/projection/ProjectionControls'
import type { UseAppStatus } from '../../hooks/useAppStatus'
import { describeProjection } from '../../lib/statusLabels'
import { isVideoUrl } from '../../../../shared/slideHelpers'
import { MotionVideoBackground, SlidePreviewStage } from '../SlidePreviewStage'

export interface LiveDockProps {
  app: UseAppStatus
}

type LiveLowerTab = 'backgrounds' | 'style' | 'pad'

const PAD_ROOT_FREQS: Record<string, readonly number[]> = {
  C: [130.81, 196.0, 246.94, 329.63],
  D: [146.83, 220.0, 277.18, 369.99],
  E: [164.81, 246.94, 311.13, 415.3],
  F: [174.61, 261.63, 329.63, 440.0],
  G: [196.0, 293.66, 369.99, 493.88],
  A: [220.0, 329.63, 415.3, 554.37],
  B: [246.94, 369.99, 466.16, 622.25]
}

function formatMediaTime(sec: number): string {
  if (isNaN(sec) || sec < 0) return '00:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/**
 * Columna derecha de cabina:
 * - Superior: Monitor de Previsualización en Vivo con controles de reproducción multimedia y modos rápidos.
 * - Inferior: Panel de control de [Fondos] | [Aa Estilo] | [Pad], con ajuste de fuente hasta 200%.
 */
export function LiveDock({ app }: LiveDockProps) {
  const live = app.status?.projection.live
  const projLabel = describeProjection(app.status)
  const isWindowOpen = app.status?.projection.windowOpen ?? false

  const [dualMonitor, setDualMonitor] = useState(false)
  const [lowerTab, setLowerTab] = useState<LiveLowerTab>('backgrounds')
  const [isReloading, setIsReloading] = useState(false)
  const fondosFileInputRef = useRef<HTMLInputElement | null>(null)

  // Filtrar estrictamente solo fondos y loops del sistema (excluir medios del culto y cualquier documento de diapositivas)
  const isDoc = (m: MediaBackground): boolean => {
    if ((m.slides && m.slides.length > 0) || (m as { slides?: unknown[] }).slides !== undefined) return true
    const lowerName = (m.name || '').toLowerCase()
    if (/\.(pdf|pptx|ppt|ppsx|pps|potx)($|[?#])/i.test(lowerName) || /^(pdf|powerpoint):/i.test(lowerName)) return true
    const lowerVal = typeof m.value === 'string' ? m.value.toLowerCase() : ''
    if (/\.(pdf|pptx|ppt|ppsx|pps|potx)($|[?#])/i.test(lowerVal)) return true
    if (m.category && ['diapositivas', 'presentaciones', 'documentos', 'pdf'].includes(m.category.toLowerCase())) return true
    return false
  }

  const fondosMedia = useMemo(() => {
    return app.media.filter((m) => m.category !== 'Culto' && !isDoc(m))
  }, [app.media])

  const handleUploadFondoFiles = (e: ChangeEvent<HTMLInputElement>): void => {
    const files = e.target.files
    if (!files || files.length === 0) return
    Array.from(files).forEach((file) => {
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
          category: 'Fondo'
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
            category: 'Fondo'
          })
        }
      }
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  // Línea de tiempo de vídeo interactiva
  const [videoTime, setVideoTime] = useState(0)
  const [videoDuration, setVideoDuration] = useState(0)
  const [isDraggingVideo, setIsDraggingVideo] = useState(false)

  // Tema de estilo
  const currentBgId = live?.theme.background.id ?? ''
  const fontScale = live?.theme.fontScale ?? 100
  const textAlign = live?.theme.textAlign ?? 'center'
  const verticalAlign = live?.theme.verticalAlign ?? 'center'
  const fontFamily = live?.theme.fontFamily ?? 'sans'
  const uppercase = live?.theme.uppercase ?? false
  const textStroke = live?.theme.textStroke ?? false
  const textBoxBg = live?.theme.textBoxBg ?? false
  const showOverlayClock = live?.theme.showOverlayClock ?? false
  const bgDimmer = live?.theme.bgDimmer ?? 0
  const bgBlur = live?.theme.bgBlur ?? 0

  // Pad musical de adoración
  const [padPlaying, setPadPlaying] = useState(false)
  const [padKey, setPadKey] = useState<string>('C')
  const audioCtxRef = useRef<AudioContext | null>(null)

  useEffect(() => {
    return () => {
      if (audioCtxRef.current) {
        void audioCtxRef.current.close()
      }
    }
  }, [])

  const startPadInKey = (keyName: string): void => {
    if (audioCtxRef.current) {
      void audioCtxRef.current.close()
      audioCtxRef.current = null
    }
    try {
      const ctx = new window.AudioContext()
      const masterGain = ctx.createGain()
      masterGain.gain.setValueAtTime(0.001, ctx.currentTime)
      masterGain.gain.exponentialRampToValueAtTime(0.055, ctx.currentTime + 1.2)
      masterGain.connect(ctx.destination)

      const freqs = PAD_ROOT_FREQS[keyName] ?? PAD_ROOT_FREQS['C'] ?? [130.81, 196.0]
      for (const freq of freqs) {
        const osc = ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, ctx.currentTime)
        osc.connect(masterGain)
        osc.start()
      }
      audioCtxRef.current = ctx
      setPadPlaying(true)
    } catch {
      setPadPlaying(false)
    }
  }

  const toggleAmbientPad = (): void => {
    if (padPlaying && audioCtxRef.current) {
      void audioCtxRef.current.close()
      audioCtxRef.current = null
      setPadPlaying(false)
      return
    }
    startPadInKey(padKey)
  }

  const changePadKey = (nextKey: string): void => {
    setPadKey(nextKey)
    if (padPlaying) {
      startPadInKey(nextKey)
    }
  }

  // Ajuste de escala de letra de 60% a 200%
  const adjustScale = (delta: number): void => {
    const next = Math.max(60, Math.min(200, Math.round(fontScale + delta)))
    void app.updateProjectionTheme({ fontScale: next })
  }

  const handleMonitorWheel = (e: WheelEvent<HTMLDivElement>): void => {
    if (!live || live.slides.length <= 1) return
    e.preventDefault()
    if (e.deltaY > 0) {
      void app.goToSlide({ direction: 'next' })
    } else if (e.deltaY < 0) {
      void app.goToSlide({ direction: 'prev' })
    }
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return
      }
      if (e.key === 'F5') {
        e.preventDefault()
        void app.openProjection({ target: 'auto' })
      } else if (e.key === 'F6') {
        e.preventDefault()
        void app.closeProjection()
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault()
        void app.goToSlide({ direction: 'next' })
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault()
        void app.goToSlide({ direction: 'prev' })
      } else if (e.key === 'b' || e.key === 'B') {
        void app.setProjectionMode('black')
      } else if (e.key === 'c' || e.key === 'C') {
        void app.setProjectionMode('clear')
      } else if (e.key === 'l' || e.key === 'L') {
        void app.setProjectionMode('logo')
      } else if (e.key === 'f' || e.key === 'F') {
        void app.updateProjectionTheme({ frozen: !(live?.theme.frozen ?? false) })
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [app, live])

  return (
    <aside className="livedock" aria-label="Control de proyección en vivo">
      {/* MITAD SUPERIOR: MONITOR EN VIVO Y CONTROLES MULTIMEDIA */}
      <div className="hly-panel livedock__monitor-panel">
        <div className="hly-panel__header">
          <span className="hly-panel__title">
            <span
              className={`status-pill${isWindowOpen ? ' status-pill--live' : ''}`}
              title={projLabel.text}
            >
              {isWindowOpen ? '● EN AIRE' : '○ CABINA'}
            </span>
          </span>

          <div className="btn-row">
            <button
              type="button"
              className={`hly-mini-btn${dualMonitor ? ' hly-mini-btn--active' : ''}`}
              title="Alternar entre Monitor Simple (Actual) y Monitor Doble (Previo + Vivo)"
              onClick={() => setDualMonitor((d) => !d)}
            >
              {dualMonitor ? 'Doble' : 'Simple'}
            </button>
            <button
              type="button"
              className={`hly-mini-btn${live?.theme.frozen ? ' hly-mini-btn--active' : ''}`}
              title="Congelar proyección actual (F)"
              onClick={() => void app.updateProjectionTheme({ frozen: !live?.theme.frozen })}
            >
              {live?.theme.frozen ? '❄ Descongelar' : '❄ Congelar'}
            </button>
          </div>
        </div>

        <div className="livedock__monitor-body">
          {dualMonitor && live ? (
            <div className="hly-dual-monitors__row">
              <div className="hly-dual-monitors__col">
                <div className="hly-dual-monitors__label">EN VIVO (#{live.currentIndex + 1})</div>
                <div className="mini-monitor">
                  <SlidePreviewStage
                    live={live}
                    compact
                    windowOpen={app.status?.projection.windowOpen}
                    onVideoProgress={(cur, dur) => {
                      if (!isDraggingVideo) {
                        setVideoTime(cur)
                      }
                      setVideoDuration(dur)
                    }}
                  />
                </div>
              </div>
              <div className="hly-dual-monitors__col">
                <div className="hly-dual-monitors__label">
                  SIGUIENTE (#{Math.min(live.currentIndex + 2, live.slides.length)})
                </div>
                <div className="mini-monitor">
                  <SlidePreviewStage
                    live={{
                      ...live,
                      currentIndex: Math.min(live.currentIndex + 1, Math.max(0, live.slides.length - 1))
                    }}
                    compact
                  />
                </div>
              </div>
            </div>
          ) : (
            <div
              className="mini-monitor"
              onWheel={handleMonitorWheel}
              title="Rueda del ratón: cambiar diapositiva"
            >
              {live ? (
                <SlidePreviewStage
                  live={live}
                  compact
                  windowOpen={app.status?.projection.windowOpen}
                  onVideoProgress={(cur, dur) => {
                    if (!isDraggingVideo) {
                      setVideoTime(cur)
                    }
                    setVideoDuration(dur)
                  }}
                />
              ) : (
                <div className="slide-stage" style={{ background: '#000' }}>
                  <span className="slide-stage__badge">SIN SEÑAL</span>
                </div>
              )}
            </div>
          )}

          {/* Barra de control multimedia de vídeo o imagen proyectada */}
          {(() => {
            const currentSlide = live ? live.slides[live.currentIndex] : undefined
            const isSlideImage = Boolean(currentSlide?.imageUrl && !isVideoUrl(currentSlide.imageUrl))
            const isSlideVideo =
              (currentSlide?.imageUrl && isVideoUrl(currentSlide.imageUrl)) ||
              live?.theme.background.kind === 'video'
            const isFill = live?.theme.mediaFit === 'fill' || live?.theme.mediaFit === 'cover'

            if (!isSlideImage && !isSlideVideo) return null

            return (
              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.95)',
                  border: '1px solid rgba(251, 146, 60, 0.4)',
                  borderRadius: 6,
                  padding: '6px 8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6
                }}
              >
                {/* LÍNEA DE TIEMPO INTERACTIVA DEL VÍDEO CON BUSCADOR SUAVE */}
                {isSlideVideo && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 10.5,
                        color: '#fed7aa',
                        fontWeight: 700,
                        fontVariantNumeric: 'tabular-nums'
                      }}
                    >
                      <span>⏱ {formatMediaTime(videoTime)}</span>
                      <span>{formatMediaTime(videoDuration)}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={videoDuration > 0 ? videoDuration : 100}
                      step={0.1}
                      value={videoTime}
                      aria-label="Línea de tiempo del vídeo"
                      title="Haz clic o arrastra con el ratón para adelantar o retroceder el vídeo al punto que desees"
                      onPointerDown={() => setIsDraggingVideo(true)}
                      onChange={(e) => {
                        const val = Number(e.target.value)
                        setVideoTime(val)
                      }}
                      onPointerUp={(e) => {
                        setIsDraggingVideo(false)
                        const val = Number((e.currentTarget).value)
                        setVideoTime(val)
                        void app.updateProjectionTheme({
                          videoSeekSeconds: val,
                          videoSeekTrigger: Date.now()
                        })
                      }}
                      onKeyUp={(e) => {
                        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Home' || e.key === 'End') {
                          const val = Number((e.currentTarget).value)
                          setVideoTime(val)
                          void app.updateProjectionTheme({
                            videoSeekSeconds: val,
                            videoSeekTrigger: Date.now()
                          })
                        }
                      }}
                      style={{
                        width: '100%',
                        height: 6,
                        accentColor: '#f97316',
                        cursor: 'pointer',
                        margin: 0
                      }}
                    />
                  </div>
                )}

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '2px 0'
                  }}
                >
                  {isSlideVideo && (
                    <>
                      <button
                        type="button"
                        className="btn btn--secondary"
                        style={{
                          flex: 1,
                          height: 28,
                          fontSize: 13,
                          padding: 0,
                          fontWeight: 700,
                          background: live?.theme.videoPlaying === false ? '#ea580c' : '#2563eb',
                          color: '#ffffff',
                          borderColor: live?.theme.videoPlaying === false ? '#c2410c' : '#1d4ed8'
                        }}
                        title={live?.theme.videoPlaying === false ? 'Reanudar reproducción (▶)' : 'Pausar vídeo (⏸)'}
                        onClick={() =>
                          void app.updateProjectionTheme({
                            videoPlaying: live?.theme.videoPlaying === false
                          })
                        }
                      >
                        {live?.theme.videoPlaying === false ? '▶' : '⏸'}
                      </button>

                      <button
                        type="button"
                        className="btn btn--secondary"
                        style={{ flex: 1, height: 28, fontSize: 13, padding: 0 }}
                        title="Reiniciar vídeo desde el segundo 0 (⏮)"
                        onClick={() => {
                          setVideoTime(0)
                          const now = Date.now()
                          void app.updateProjectionTheme({
                            videoRestartTime: now,
                            videoSeekSeconds: 0,
                            videoSeekTrigger: now
                          })
                        }}
                      >
                        ⏮
                      </button>

                      <button
                        type="button"
                        className="btn btn--secondary"
                        style={{
                          flex: 1,
                          height: 28,
                          fontSize: 13,
                          padding: 0,
                          background: live?.theme.videoMuted ? '#64748b' : '#10b981',
                          color: '#ffffff',
                          borderColor: live?.theme.videoMuted ? '#475569' : '#059669'
                        }}
                        title={live?.theme.videoMuted ? 'Activar audio del vídeo (🔊)' : 'Silenciar vídeo (🔇)'}
                        onClick={() =>
                          void app.updateProjectionTheme({
                            videoMuted: !live?.theme.videoMuted
                          })
                        }
                      >
                        {live?.theme.videoMuted ? '🔇' : '🔊'}
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    className="btn btn--secondary"
                    style={{
                      flex: 1,
                      height: 28,
                      fontSize: 13,
                      padding: 0,
                      fontWeight: 700,
                      background: isFill ? '#0284c7' : undefined,
                      color: isFill ? '#ffffff' : undefined,
                      borderColor: isFill ? '#0369a1' : undefined
                    }}
                    title={
                      isFill
                        ? 'Modo actual: Llenar pantalla. Clic para Ajustar a tamaño original (⊡)'
                        : 'Modo actual: Ajustado original. Clic para Llenar pantalla completa (⛶)'
                    }
                    onClick={() =>
                      void app.updateProjectionTheme({
                        mediaFit: isFill ? 'contain' : 'fill'
                      })
                    }
                  >
                    {isFill ? '⊡' : '⛶'}
                  </button>

                  <button
                    type="button"
                    className="btn btn--danger"
                    style={{ flex: 1, height: 28, fontSize: 13, padding: 0 }}
                    title="Quitar de la pantalla (⏹)"
                    onClick={() => {
                      void app.setProjectionMode('clear')
                    }}
                  >
                    ⏹
                  </button>
                </div>
              </div>
            )
          })()}

          <div className="livedock__win-controls">
            <ProjectionControls app={app} />
          </div>
        </div>
      </div>

      {/* MITAD INFERIOR (EN LUGAR DE IMÁGENES DEL CULTO): PESTAÑAS [FONDOS] | [AA ESTILO] | [PAD] */}
      <div className="hly-panel livedock__deck-panel" style={{ display: 'flex', flexDirection: 'column' }}>
        <div
          className="hly-panel__header"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 6
          }}
        >
          <div className="btn-row" role="tablist" aria-label="Herramientas inferiores de cabina">
            <button
              type="button"
              role="tab"
              aria-selected={lowerTab === 'backgrounds'}
              className={`hly-mini-btn${lowerTab === 'backgrounds' ? ' hly-mini-btn--active' : ''}`}
              onClick={() => setLowerTab('backgrounds')}
            >
              ◈ Fondos
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={lowerTab === 'style'}
              className={`hly-mini-btn${lowerTab === 'style' ? ' hly-mini-btn--active' : ''}`}
              onClick={() => setLowerTab('style')}
            >
              Aa Estilo
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={lowerTab === 'pad'}
              className={`hly-mini-btn${lowerTab === 'pad' ? ' hly-mini-btn--active' : ''}`}
              onClick={() => setLowerTab('pad')}
            >
              🎹 Pad {padPlaying ? `(${padKey})` : ''}
            </button>
          </div>

          {lowerTab === 'backgrounds' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input
                ref={fondosFileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                style={{ display: 'none' }}
                onChange={handleUploadFondoFiles}
              />
              <button
                type="button"
                className="hly-mini-btn"
                title="Abrir carpeta dedicada de fondos en el Explorador de Windows"
                onClick={() => void app.openBackgroundsFolder?.()}
              >
                📁
              </button>
              <button
                type="button"
                className="hly-mini-btn"
                title="Recargar fondos locales desde el disco"
                onClick={() => {
                  setIsReloading(true)
                  void (async (): Promise<void> => {
                    await app.reloadBackgrounds?.()
                    setTimeout(() => setIsReloading(false), 500)
                  })()
                }}
              >
                <span style={{ display: 'inline-block', transform: isReloading ? 'rotate(360deg)' : 'none', transition: 'transform 0.5s ease' }}>🔄</span>
              </button>
              <button
                type="button"
                className="hly-mini-btn"
                title="Subir fondos (imágenes o vídeos) directamente a la app"
                onClick={() => fondosFileInputRef.current?.click()}
              >
                ➕
              </button>
            </div>
          )}
        </div>

        <div className="hly-themes-body" style={{ flex: 1, overflowY: 'auto' }}>
          {lowerTab === 'backgrounds' && (
            <>
              <div className="hly-sliders-compact">
                <label className="hly-slider-row">
                  <span>Oscurecer ({bgDimmer}%)</span>
                  <input
                    type="range"
                    min={0}
                    max={85}
                    step={5}
                    value={bgDimmer}
                    onChange={(e) => void app.updateProjectionTheme({ bgDimmer: Number(e.target.value) })}
                  />
                </label>
                <label className="hly-slider-row">
                  <span>Desenfoque ({bgBlur}px)</span>
                  <input
                    type="range"
                    min={0}
                    max={16}
                    step={1}
                    value={bgBlur}
                    onChange={(e) => void app.updateProjectionTheme({ bgBlur: Number(e.target.value) })}
                  />
                </label>
              </div>

              <div className="hly-bg-grid">
                {fondosMedia.map((item) => {
                  const active = currentBgId === item.id
                  const style =
                    item.kind === 'image'
                      ? {
                          backgroundImage: `linear-gradient(rgba(5,10,20,0.35), rgba(5,10,20,0.65)), url("${item.value}")`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center'
                        }
                      : item.kind === 'video'
                        ? { background: '#070b16', position: 'relative' as const }
                        : { background: item.value }
                  return (
                    <button
                      key={item.id}
                      type="button"
                      style={style}
                      className={`hly-bg-swatch${active ? ' hly-bg-swatch--active' : ''}`}
                      onClick={() => {
                        void app.updateProjectionTheme({
                          background: item,
                          videoPlaying: true
                        })
                      }}
                      onDoubleClick={() => {
                        void app.updateProjectionTheme({
                          background: item,
                          videoPlaying: true
                        })
                        void app.openProjection({ target: 'auto' })
                      }}
                      title={`Fondo: ${item.name}`}
                    >
                      {item.kind === 'video' && <MotionVideoBackground value={item.value} />}
                      {item.kind === 'video' && (
                        <span
                          style={{
                            position: 'absolute',
                            top: 4,
                            right: 4,
                            background: 'rgba(234, 88, 12, 0.9)',
                            color: '#ffffff',
                            fontSize: 8.5,
                            fontWeight: 800,
                            padding: '1px 5px',
                            borderRadius: 4,
                            zIndex: 2,
                            letterSpacing: '0.04em'
                          }}
                        >
                          ▶ VÍDEO
                        </span>
                      )}
                      <span className="hly-bg-swatch__name" style={{ position: 'relative', zIndex: 1 }}>
                        {item.name}
                      </span>
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {lowerTab === 'style' && (
            <div style={{ padding: '6px 4px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {/* ESCALA DE LETRA: AUTO FIT / MANUAL, A- / A+ Y CONTROL DESLIZANTE HASTA 200% */}
              <div className="hly-format-bar" role="group" aria-label="Formato rápido de letra">
                <div className="hly-format-group">
                  <button
                    type="button"
                    className={`hly-mini-btn${live?.theme.autoFit !== false ? ' hly-mini-btn--active' : ''}`}
                    title="Auto Fit Inteligente: ajusta y maximiza automáticamente el tamaño del texto para llenar la pantalla sin cortarse"
                    onClick={() => void app.updateProjectionTheme({ autoFit: live?.theme.autoFit === false ? true : false })}
                  >
                    ⚡ Auto Fit {live?.theme.autoFit !== false ? 'ON' : 'OFF'}
                  </button>
                </div>

                <div className="hly-format-group">
                  <button type="button" className="hly-mini-btn" title="Reducir letra" onClick={() => adjustScale(-5)}>
                    A-
                  </button>
                  <span className="hly-format-val" style={{ minWidth: 44, textAlign: 'center', fontWeight: 800 }}>
                    {fontScale}%
                  </span>
                  <button type="button" className="hly-mini-btn" title="Aumentar letra (hasta 200%)" onClick={() => adjustScale(5)}>
                    A+
                  </button>
                </div>

                <div className="hly-format-group">
                  {(['sans', 'serif', 'mono'] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      className={`hly-mini-btn${fontFamily === f ? ' hly-mini-btn--active' : ''}`}
                      onClick={() => void app.updateProjectionTheme({ fontFamily: f })}
                    >
                      {f === 'sans' ? 'Sans' : f === 'serif' ? 'Serif' : 'Mono'}
                    </button>
                  ))}
                </div>

                <div className="hly-format-group">
                  {(['left', 'center'] as const).map((align) => (
                    <button
                      key={align}
                      type="button"
                      className={`hly-mini-btn${textAlign === align ? ' hly-mini-btn--active' : ''}`}
                      onClick={() => void app.updateProjectionTheme({ textAlign: align })}
                    >
                      {align === 'left' ? '≣ Izq' : '≡ Cen'}
                    </button>
                  ))}
                </div>
              </div>

              {/* BARRA DESLIZANTE DE ESCALA DE 60% A 200% */}
              <label className="hly-slider-row" style={{ marginTop: 2, padding: '2px 4px' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#cbd5e1' }}>Escala ({fontScale}% - máx 200%)</span>
                <input
                  type="range"
                  min={60}
                  max={200}
                  step={2}
                  value={fontScale}
                  title="Ajusta el tamaño del texto proyectado hasta el 200%"
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    void app.updateProjectionTheme({ fontScale: Number(e.target.value) })
                  }
                  style={{ accentColor: '#38bdf8' }}
                />
              </label>

              <div className="hly-format-bar" role="group" aria-label="Alineación vertical">
                {(['top', 'center', 'bottom'] as const).map((va) => (
                  <button
                    key={va}
                    type="button"
                    className={`hly-mini-btn${verticalAlign === va ? ' hly-mini-btn--active' : ''}`}
                    onClick={() => void app.updateProjectionTheme({ verticalAlign: va })}
                  >
                    {va === 'top' ? '⬆ Arriba' : va === 'center' ? '⬌ Centro' : '⬇ Abajo'}
                  </button>
                ))}
              </div>

              <div className="hly-format-bar" role="group" aria-label="Efectos rápidos de proyección">
                <button
                  type="button"
                  className={`hly-mini-btn${uppercase ? ' hly-mini-btn--active' : ''}`}
                  onClick={() => void app.updateProjectionTheme({ uppercase: !uppercase })}
                >
                  AA Mayús
                </button>
                <button
                  type="button"
                  className={`hly-mini-btn${textStroke ? ' hly-mini-btn--active' : ''}`}
                  onClick={() => void app.updateProjectionTheme({ textStroke: !textStroke })}
                >
                  Contorno
                </button>
                <button
                  type="button"
                  className={`hly-mini-btn${textBoxBg ? ' hly-mini-btn--active' : ''}`}
                  onClick={() => void app.updateProjectionTheme({ textBoxBg: !textBoxBg })}
                >
                  Caja
                </button>
                <button
                  type="button"
                  className={`hly-mini-btn${showOverlayClock ? ' hly-mini-btn--active' : ''}`}
                  onClick={() => void app.updateProjectionTheme({ showOverlayClock: !showOverlayClock })}
                >
                  🕒 Reloj
                </button>
              </div>
            </div>
          )}

          {lowerTab === 'pad' && (
            <div className="hly-pad-box" style={{ padding: 8 }}>
              <div className="hint" style={{ marginTop: 0, fontSize: 11 }}>
                Selecciona la tonalidad del Pad continuo de adoración:
              </div>
              <div className="btn-row" style={{ marginTop: 6 }}>
                {Object.keys(PAD_ROOT_FREQS).map((k) => (
                  <button
                    key={k}
                    type="button"
                    className={`hly-mini-btn${padKey === k ? ' hly-mini-btn--active' : ''}`}
                    onClick={() => changePadKey(k)}
                  >
                    {k}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className={`button${padPlaying ? ' button--primary' : ''}`}
                style={{ width: '100%', marginTop: 8 }}
                onClick={toggleAmbientPad}
              >
                {padPlaying ? `⏹ Detener Pad en ${padKey}` : `▶ Iniciar Pad Ambiental en ${padKey}`}
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
