import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { YoutubeProgressPayload, YoutubeVideoInfo } from '../../../shared/ipc'
import type { UseAppStatus } from '../hooks/useAppStatus'

export interface YoutubeDownloadModalProps {
  isOpen: boolean
  onClose: () => void
  app: UseAppStatus
}

const CATEGORIES = ['Culto', 'Fondo', 'Anuncios', 'Bienvenida', 'Sermón', 'General'] as const

export function YoutubeDownloadModal({
  isOpen,
  onClose,
  app
}: YoutubeDownloadModalProps): React.JSX.Element | null {
  const [url, setUrl] = useState('')
  const [isLoadingInfo, setIsLoadingInfo] = useState(false)
  const [info, setInfo] = useState<YoutubeVideoInfo | null>(null)
  const [customTitle, setCustomTitle] = useState('')
  const [category, setCategory] = useState<string>('Culto')
  const [isDownloading, setIsDownloading] = useState(false)
  const [progress, setProgress] = useState<YoutubeProgressPayload | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleClose = useCallback((): void => {
    setUrl('')
    setInfo(null)
    setCustomTitle('')
    setCategory('Culto')
    setIsLoadingInfo(false)
    setIsDownloading(false)
    setProgress(null)
    setErrorMessage(null)
    setIsSuccess(false)
    onClose()
  }, [onClose])

  const handleCancel = useCallback(async (): Promise<void> => {
    if (isDownloading) {
      await app.cancelYoutubeDownload()
      setIsDownloading(false)
      setProgress(null)
    } else {
      handleClose()
    }
  }, [app, handleClose, isDownloading])

  // Enfocar input al abrir
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus()
    }
  }, [isOpen])

  // Escuchar eventos de progreso en tiempo real
  useEffect(() => {
    if (!isOpen || !window.lumen?.onYoutubeDownloadProgress) return
    const unsubscribe = window.lumen.onYoutubeDownloadProgress((payload) => {
      setProgress(payload)
      if (payload.status === 'completed') {
        setIsDownloading(false)
        setIsSuccess(true)
        setTimeout(() => {
          handleClose()
        }, 1200)
      } else if (payload.status === 'error') {
        setIsDownloading(false)
        setErrorMessage(payload.message || 'Error durante la descarga.')
      } else if (payload.status === 'cancelled') {
        setIsDownloading(false)
      }
    })
    return () => unsubscribe()
  }, [isOpen, handleClose])

  // Cerrar con Escape
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        if (isDownloading) {
          void handleCancel()
        } else {
          handleClose()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isDownloading, handleCancel, handleClose])

  const fetchVideoInfo = useCallback(
    async (inputUrl: string): Promise<void> => {
      const cleanUrl = inputUrl.trim()
      if (!cleanUrl) return

      setIsLoadingInfo(true)
      setErrorMessage(null)
      try {
        const videoInfo = await app.getYoutubeInfo(cleanUrl)
        setInfo(videoInfo)
        setCustomTitle(videoInfo.title)
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'No se pudo obtener información del vídeo.')
        setInfo(null)
      } finally {
        setIsLoadingInfo(false)
      }
    },
    [app]
  )

  const handlePaste = async (): Promise<void> => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) {
        setUrl(text)
        void fetchVideoInfo(text)
      }
    } catch {
      // Si el navegador bloquea clipboard, el usuario puede pegar manualmente
    }
  }

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const val = e.target.value
    setUrl(val)
    setErrorMessage(null)
    if (val.includes('youtu.be/') || val.includes('youtube.com/')) {
      void fetchVideoInfo(val)
    }
  }

  const handleStartDownload = async (): Promise<void> => {
    if (!url.trim()) return
    setIsDownloading(true)
    setErrorMessage(null)
    setIsSuccess(false)
    setProgress({
      url: url.trim(),
      percent: 5,
      status: 'initializing',
      message: 'Iniciando descarga...'
    })

    try {
      await app.downloadYoutubeVideo({
        url: url.trim(),
        category,
        ...(customTitle.trim() ? { customTitle: customTitle.trim() } : {})
      })
    } catch (err) {
      setIsDownloading(false)
      const msg = err instanceof Error ? err.message : 'Fallo en la descarga.'
      if (!msg.toLowerCase().includes('cancelad')) {
        setErrorMessage(msg)
      }
    }
  }

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16
      }}
      onClick={() => !isDownloading && handleClose()}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 540,
          backgroundColor: '#131722',
          border: '1px solid rgba(239, 68, 68, 0.35)',
          borderRadius: 12,
          boxShadow: '0 24px 55px rgba(0, 0, 0, 0.85)',
          padding: '24px',
          color: '#f3f4f6',
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          display: 'flex',
          flexDirection: 'column',
          gap: 18
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="yt-download-title"
      >
        {/* Cabecera */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                backgroundColor: 'rgba(239, 68, 68, 0.18)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                color: '#ef4444'
              }}
            >
              ▶
            </div>
            <div>
              <h2 id="yt-download-title" style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#fff' }}>
                Descargar Vídeo de YouTube
              </h2>
              <span style={{ fontSize: 12, color: '#9ca3af' }}>
                El vídeo se descargará en MP4 y se agregará directamente a Medios
              </span>
            </div>
          </div>
          {!isDownloading && (
            <button
              type="button"
              onClick={handleClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#9ca3af',
                cursor: 'pointer',
                fontSize: 18,
                padding: 4,
                borderRadius: 4
              }}
              title="Cerrar"
            >
              ✕
            </button>
          )}
        </div>

        {/* Input de URL */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label htmlFor="yt-url-input" style={{ fontSize: 12, fontWeight: 600, color: '#d1d5db' }}>
            Enlace del vídeo (YouTube, Shorts o Compartir)
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              id="yt-url-input"
              ref={inputRef}
              type="text"
              value={url}
              onChange={handleUrlChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && url.trim()) {
                  void fetchVideoInfo(url)
                }
              }}
              disabled={isDownloading}
              placeholder="https://www.youtube.com/watch?v=... o https://youtu.be/..."
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 6,
                backgroundColor: '#1f2430',
                border: '1px solid #374151',
                color: '#fff',
                fontSize: 13,
                outline: 'none'
              }}
            />
            <button
              type="button"
              onClick={() => void handlePaste()}
              disabled={isDownloading}
              className="hly-mini-btn"
              style={{ padding: '0 12px', height: 35, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              title="Pegar enlace del portapapeles"
            >
              📋 Pegar
            </button>
            <button
              type="button"
              onClick={() => void fetchVideoInfo(url)}
              disabled={isDownloading || !url.trim() || isLoadingInfo}
              className="hly-mini-btn"
              style={{ padding: '0 12px', height: 35 }}
              title="Buscar información del vídeo"
            >
              {isLoadingInfo ? '⌛' : '🔍'}
            </button>
          </div>
        </div>

        {/* Estado de carga de info */}
        {isLoadingInfo && (
          <div style={{ fontSize: 12, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⌛</span>
            Consultando información del vídeo en YouTube...
          </div>
        )}

        {/* Tarjeta de información del vídeo encontrado */}
        {info && (
          <div
            style={{
              display: 'flex',
              gap: 12,
              padding: 12,
              backgroundColor: '#1a1f2c',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              borderRadius: 8
            }}
          >
            {info.thumbnailUrl && (
              <img
                src={info.thumbnailUrl}
                alt={info.title}
                style={{
                  width: 110,
                  height: 68,
                  objectFit: 'cover',
                  borderRadius: 6,
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  flexShrink: 0
                }}
              />
            )}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div>
                <label style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>Título para Medios:</label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  disabled={isDownloading}
                  style={{
                    width: '100%',
                    padding: '4px 8px',
                    borderRadius: 4,
                    backgroundColor: '#131722',
                    border: '1px solid #374151',
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 600,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#9ca3af' }}>
                <span>Canal: <strong style={{ color: '#e5e7eb' }}>{info.author}</strong></span>
              </div>
            </div>
          </div>
        )}

        {/* Selector de Categoría */}
        {info && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#d1d5db' }}>Categoría en Medios:</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  disabled={isDownloading}
                  className={`stanza-chip${category === cat ? ' active' : ''}`}
                  style={{
                    cursor: isDownloading ? 'not-allowed' : 'pointer',
                    padding: '4px 10px',
                    fontSize: 11
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Sección de progreso de descarga */}
        {isDownloading && progress && (
          <div
            style={{
              padding: 12,
              backgroundColor: '#1a1f2c',
              borderRadius: 8,
              border: '1px solid rgba(239, 68, 68, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
              <span style={{ fontWeight: 600, color: '#f3f4f6' }}>
                {progress.message || 'Descargando...'}
              </span>
              <span style={{ fontWeight: 700, color: '#38bdf8' }}>{progress.percent}%</span>
            </div>

            <div
              style={{
                width: '100%',
                height: 8,
                backgroundColor: '#2d3748',
                borderRadius: 4,
                overflow: 'hidden'
              }}
            >
              <div
                style={{
                  width: `${progress.percent}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #ef4444 0%, #38bdf8 100%)',
                  borderRadius: 4,
                  transition: 'width 0.25s ease'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9ca3af' }}>
              <span>{progress.speed ? `Velocidad: ${progress.speed}` : 'Iniciando descarga...'}</span>
              <span>{progress.eta ? `Tiempo restante: ${progress.eta}` : ''}</span>
            </div>
          </div>
        )}

        {/* Pantalla de Éxito */}
        {isSuccess && (
          <div
            style={{
              padding: '12px 14px',
              backgroundColor: 'rgba(34, 197, 94, 0.15)',
              border: '1px solid rgba(34, 197, 94, 0.4)',
              borderRadius: 8,
              color: '#4ade80',
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            <span>✓</span>
            <strong>¡Vídeo descargado con éxito y añadido a Medios!</strong>
          </div>
        )}

        {/* Mensaje de Error */}
        {errorMessage && (
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: 8,
              color: '#f87171',
              fontSize: 12,
              lineHeight: 1.4
            }}
          >
            <strong>Error:</strong> {errorMessage}
          </div>
        )}

        {/* Botones de acción */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
          <button
            type="button"
            onClick={() => void handleCancel()}
            className="hly-mini-btn"
            style={{ padding: '6px 14px', fontSize: 13 }}
          >
            {isDownloading ? 'Cancelar Descarga' : 'Cerrar'}
          </button>
          <button
            type="button"
            onClick={() => void handleStartDownload()}
            disabled={isDownloading || !url.trim() || isSuccess}
            className="hly-mini-btn hly-mini-btn--primary"
            style={{
              padding: '6px 18px',
              fontSize: 13,
              fontWeight: 700,
              backgroundColor: isDownloading || !url.trim() ? '#4b5563' : '#ef4444',
              borderColor: isDownloading || !url.trim() ? '#4b5563' : '#dc2626'
            }}
          >
            {isDownloading ? 'Descargando...' : '⬇ Descargar a Medios'}
          </button>
        </div>
      </div>
    </div>
  )
}
