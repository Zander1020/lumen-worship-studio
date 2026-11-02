import React, { useCallback, useEffect, useState } from 'react'
import { APP_CHANGELOG, type ChangelogRelease } from '../../../shared/changelog'

export interface WhatsNewModalProps {
  onNavigateToAbout?: () => void
}

const DEFAULT_RELEASE: ChangelogRelease = APP_CHANGELOG[0] ?? {
  version: '0.1.13',
  date: '1 de Noviembre de 2026',
  title: 'Novedades de la versión',
  tagline: 'Mejoras y optimizaciones del sistema.',
  highlights: []
}

export function WhatsNewModal({ onNavigateToAbout }: WhatsNewModalProps): React.JSX.Element | null {
  const [isOpen, setIsOpen] = useState(false)
  const [release, setRelease] = useState<ChangelogRelease>(DEFAULT_RELEASE)
  const [currentVersion, setCurrentVersion] = useState<string>('0.1.13')

  useEffect(() => {
    // 1. Obtener la versión actual de la app
    let isMounted = true

    const checkVersion = async (): Promise<void> => {
      try {
        let appVersion = '0.1.13'
        if (window.lumen?.getAppInfo) {
          const info = await window.lumen.getAppInfo()
          if (info.version) {
            appVersion = info.version
          }
        }
        if (!isMounted) return

        setCurrentVersion(appVersion)

        // Buscar el changelog correspondiente o tomar el más reciente
        const matchedRelease =
          APP_CHANGELOG.find((c) => c.version === appVersion) ?? DEFAULT_RELEASE
        setRelease(matchedRelease)

        // Comprobar si ya fue vista esta versión
        const seenVersion = localStorage.getItem('lumen_seen_version')
        if (seenVersion !== appVersion) {
          // Nueva versión instalada o primer arranque: abrir modal automáticamente
          setIsOpen(true)
        }
      } catch {
        // Fallback silencioso
      }
    }

    void checkVersion()

    // 2. Escuchar evento manual para abrir desde "Acerca de"
    const handleManualOpen = (): void => {
      setIsOpen(true)
    }

    window.addEventListener('lumen:show-whats-new', handleManualOpen)

    return () => {
      isMounted = false
      window.removeEventListener('lumen:show-whats-new', handleManualOpen)
    }
  }, [])

  const handleClose = useCallback((): void => {
    try {
      localStorage.setItem('lumen_seen_version', currentVersion)
    } catch {
      // ignore
    }
    setIsOpen(false)
  }, [currentVersion])

  const handleGoToAbout = (): void => {
    handleClose()
    onNavigateToAbout?.()
  }

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') handleClose()
      if (e.key === 'Enter') handleClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, handleClose])

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.78)',
        backdropFilter: 'blur(5px)',
        zIndex: 99998,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16
      }}
      onClick={handleClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 580,
          backgroundColor: '#161922',
          border: '1px solid rgba(59, 130, 246, 0.45)',
          borderRadius: 14,
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.85), 0 0 25px rgba(59, 130, 246, 0.15)',
          padding: '28px 30px',
          color: '#f3f4f6',
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="whats-new-title"
      >
        {/* Encabezado */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 12,
                backgroundColor: 'rgba(37, 99, 235, 0.18)',
                border: '1px solid rgba(59, 130, 246, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 24
              }}
            >
              ✨
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    padding: '2px 8px',
                    borderRadius: 999,
                    backgroundColor: 'rgba(37, 99, 235, 0.25)',
                    color: '#60a5fa',
                    border: '1px solid rgba(59, 130, 246, 0.4)'
                  }}
                >
                  Versión {release.version}
                </span>
                <span style={{ fontSize: 12, color: '#9ca3af' }}>{release.date}</span>
              </div>
              <h2
                id="whats-new-title"
                style={{
                  margin: 0,
                  fontSize: 20,
                  fontWeight: 800,
                  color: '#ffffff',
                  letterSpacing: '-0.01em'
                }}
              >
                ¡Novedades en Lumen Studio!
              </h2>
            </div>
          </div>

          <button
            onClick={handleClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#9ca3af',
              cursor: 'pointer',
              fontSize: 20,
              padding: '2px 6px',
              lineHeight: 1
            }}
            title="Cerrar ventana"
            aria-label="Cerrar ventana"
          >
            ✕
          </button>
        </div>

        {/* Subtítulo o tagline */}
        <div
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 18,
            fontSize: 13,
            color: '#cbd5e1',
            lineHeight: 1.45
          }}
        >
          <strong style={{ color: '#93c5fd' }}>{release.title}:</strong> {release.tagline}
        </div>

        {/* Lista de mejoras */}
        <div
          style={{
            maxHeight: 260,
            overflowY: 'auto',
            paddingRight: 6,
            marginBottom: 24
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
            Mejoras incluidas en esta actualización:
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {release.highlights.map((item, idx) => (
              <li
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: '#e2e8f0',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: '1px solid rgba(255, 255, 255, 0.04)'
                }}
              >
                <span style={{ color: '#38bdf8', fontSize: 14, flexShrink: 0, marginTop: 1 }}>✔</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Botones de acción */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: 16 }}>
          <button
            type="button"
            onClick={handleGoToAbout}
            style={{
              background: 'none',
              border: 'none',
              color: '#60a5fa',
              fontSize: 12.5,
              fontWeight: 600,
              cursor: 'pointer',
              padding: '6px 8px',
              textDecoration: 'underline'
            }}
          >
            ℹ Ver historial completo en Acerca de
          </button>

          <button
            type="button"
            className="button button--primary"
            onClick={handleClose}
            style={{
              padding: '9px 22px',
              fontSize: 13.5,
              fontWeight: 700,
              borderRadius: 8,
              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)'
            }}
          >
            ¡Entendido, continuar!
          </button>
        </div>
      </div>
    </div>
  )
}

