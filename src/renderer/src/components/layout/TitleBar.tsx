import { useEffect, useState } from 'react'
import lumenLogo from '../../assets/lumen.png'

export interface TitleBarProps {
  title?: string
  subtitle?: string
}

export function TitleBar({ title = 'Lumen Studio', subtitle = 'Cabina Profesional' }: TitleBarProps) {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    let mounted = true
    if (window.lumen?.isWindowMaximized) {
      window.lumen.isWindowMaximized().then((max) => {
        if (mounted) setIsMaximized(max)
      }).catch(() => undefined)
    }
    return () => {
      mounted = false
    }
  }, [])

  const handleMinimize = (): void => {
    if (window.lumen?.minimizeWindow) {
      void window.lumen.minimizeWindow()
    }
  }

  const handleMaximize = async (): Promise<void> => {
    if (window.lumen?.maximizeWindow) {
      const next = await window.lumen.maximizeWindow()
      setIsMaximized(Boolean(next))
    }
  }

  const handleClose = (): void => {
    if (window.lumen?.closeWindow) {
      void window.lumen.closeWindow()
    }
  }

  return (
    <header className="lumen-titlebar" onDoubleClick={handleMaximize}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          pointerEvents: 'none'
        }}
      >
        <img
          src={lumenLogo}
          alt="Lumen Studio"
          style={{ width: 18, height: 18, objectFit: 'contain' }}
        />
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.04em',
            color: '#f8fafc'
          }}
        >
          {title}
        </span>
      </div>

      <div
        style={{
          flex: 1,
          height: '100%'
        }}
      />

      <div className="lumen-titlebar__controls">
        <button
          type="button"
          aria-label="Minimizar ventana"
          title="Minimizar"
          className="lumen-win-btn lumen-win-btn--min"
          onClick={handleMinimize}
        >
          <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M2 6h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>

        <button
          type="button"
          aria-label={isMaximized ? 'Restaurar ventana' : 'Maximizar ventana'}
          title={isMaximized ? 'Restaurar' : 'Maximizar'}
          className="lumen-win-btn lumen-win-btn--max"
          onClick={handleMaximize}
        >
          {isMaximized ? (
            <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true">
              <path d="M3.5 1.5h6v6h-1.5v1.5h-6v-6h1.5z" fill="none" stroke="currentColor" strokeWidth="1.3" />
              <path d="M4.5 3.5h5v5h-5z" fill="none" stroke="currentColor" strokeWidth="1.3" />
            </svg>
          ) : (
            <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true">
              <rect x="1.5" y="1.5" width="9" height="9" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
            </svg>
          )}
        </button>

        <button
          type="button"
          aria-label="Cerrar ventana"
          title="Cerrar"
          className="lumen-win-btn lumen-win-btn--close"
          onClick={handleClose}
        >
          <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </header>
  )
}
