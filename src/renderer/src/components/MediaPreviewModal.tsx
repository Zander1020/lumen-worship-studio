import React, { useEffect } from 'react'
import type { MediaBackground } from '../../../shared/ipc'
import { isVideoUrl, resolveMediaVideoUrl } from '../../../shared/slideHelpers'

export interface MediaPreviewModalProps {
  media: MediaBackground | null
  onProject: (media: MediaBackground) => void
  onClose: () => void
}

/**
 * Modal de vista previa local: muestra la imagen o el vídeo en el propio escritorio
 * sin tocar la cabina ni la proyección. Desde aquí se puede proyectar a pantalla completa.
 */
export const MediaPreviewModal: React.FC<MediaPreviewModalProps> = ({ media, onProject, onClose }) => {
  useEffect(() => {
    if (!media) return
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [media, onClose])

  if (!media) return null

  const isVid = media.kind === 'video' || isVideoUrl(media.value)
  const src = isVid ? resolveMediaVideoUrl(media.value) : media.value
  const isMotion = media.value.startsWith('motion:')

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.78)',
        backdropFilter: 'blur(3px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 760,
          backgroundColor: '#181b24',
          border: '1px solid rgba(148, 163, 184, 0.28)',
          borderRadius: 12,
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.85)',
          padding: '16px 18px',
          color: '#f3f4f6',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Vista previa: ${media.name}`}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <span style={{ fontSize: 16 }}>{isVid ? '🎬' : '🖼'}</span>
            <span
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: '#fff',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              Vista previa: {media.name}
            </span>
          </div>
          <button
            type="button"
            className="hly-icon-btn"
            title="Cerrar vista previa"
            onClick={onClose}
            style={{ flexShrink: 0 }}
          >
            ✕
          </button>
        </div>

        <div
          style={{
            position: 'relative',
            width: '100%',
            maxHeight: '62vh',
            minHeight: 220,
            background: '#000',
            borderRadius: 8,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {isMotion ? (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: src,
                backgroundSize: 'cover'
              }}
            />
          ) : isVid ? (
            <video
              src={src}
              controls
              autoPlay
              playsInline
              style={{ width: '100%', maxHeight: '62vh', objectFit: 'contain', display: 'block' }}
            />
          ) : (
            <img
              src={src}
              alt={media.name}
              style={{ width: '100%', maxHeight: '62vh', objectFit: 'contain', display: 'block' }}
            />
          )}
          <span
            style={{
              position: 'absolute',
              top: 8,
              left: 8,
              fontSize: 11,
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: 5,
              background: 'rgba(0, 0, 0, 0.7)',
              color: '#facc15'
            }}
          >
            {isVid ? 'VÍDEO' : 'IMAGEN'} · SOLO VISTA PREVIA
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            type="button"
            className="hly-mini-btn"
            style={{
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 600,
              background: '#242936',
              border: '1px solid #374151',
              color: '#d1d5db',
              borderRadius: 6,
              cursor: 'pointer'
            }}
            onClick={onClose}
          >
            Cerrar
          </button>
          <button
            type="button"
            className="hly-mini-btn hly-mini-btn--primary"
            style={{
              padding: '8px 18px',
              fontSize: 13,
              fontWeight: 700,
              background: '#f59e0b',
              border: '1px solid #fbbf24',
              color: '#1c1917',
              borderRadius: 6,
              cursor: 'pointer',
              boxShadow: '0 2px 10px rgba(245, 158, 11, 0.35)'
            }}
            onClick={() => onProject(media)}
            autoFocus
          >
            ▶ Proyectar
          </button>
        </div>
      </div>
    </div>
  )
}
