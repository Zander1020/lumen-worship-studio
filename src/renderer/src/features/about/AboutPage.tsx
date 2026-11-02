import { useEffect, useState } from 'react'
import { APP_CHANGELOG } from '../../../../shared/changelog'
import lumenLogo from '../../assets/lumen.png'

export function AboutPage() {
  const [version, setVersion] = useState<string>('0.1.13')
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    if (window.lumen?.getAppInfo) {
      window.lumen.getAppInfo().then((info) => {
        if (info.version) {
          setVersion(info.version)
        }
      }).catch(() => undefined)
    }
  }, [])
  const handleOpenExternal = (url: string): void => {
    if (window.lumen?.openExternalUrl) {
      void window.lumen.openExternalUrl(url)
    } else {
      window.open(url, '_blank')
    }
  }

  return (
    <section className="page hly-page" aria-labelledby="page-title">
      <header className="hly-module-bar">
        <div className="hly-module-bar__left">
          <h1 id="page-title" className="hly-module-bar__title">
            Acerca de
          </h1>
        </div>
      </header>

      <div className="hly-scroll-area" style={{ padding: '24px 32px', maxWidth: 860, margin: '0 auto' }}>
        {/* Tarjeta Principal de la Aplicación */}
        <div
          style={{
            background: 'var(--bg-panel)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '28px 32px',
            marginBottom: 24,
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 16 }}>
            <img
              src={lumenLogo}
              alt="Logo Lumen Studio"
              style={{
                width: 58,
                height: 58,
                objectFit: 'contain',
                filter: 'drop-shadow(0 4px 12px rgba(37, 99, 235, 0.25))'
              }}
            />
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: 26,
                  fontWeight: 800,
                  color: 'var(--text)',
                  letterSpacing: '-0.02em'
                }}
              >
                Lumen Studio
              </h2>
              <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>
                Versión {version} · Edición para Iglesias y Ministerios
              </span>
            </div>
          </div>

          <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text)', margin: '0 0 20px 0' }}>
            Software profesional de proyección, alabanza, multimedia y producción para cultos, diseñado para
            brindar máxima estabilidad, rapidez y control total en la cabina de transmisión y pantallas de la
            congregación.
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 12,
              paddingTop: 14,
              borderTop: '1px solid var(--border)'
            }}
          >
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
              ✓ Compatibilidad con catálogos externos de alabanzas (.mufl, .hly, .json)
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
              ✓ Biblia completa de 66 libros y versiones Reina-Valera
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
              ✓ Editor Gráfico para frases de predicadores y anuncios
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
              ✓ Aceleración de vídeo por GPU y streaming sin cortes
            </div>
          </div>
        </div>

        {/* Tarjeta de Novedades y Registro de Cambios */}
        <div
          style={{
            background: 'var(--bg-panel)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '24px 28px',
            marginBottom: 24,
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 800,
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              🚀 Novedades y Registro de Cambios
            </h3>
            <button
              type="button"
              className="button button--secondary"
              onClick={() => window.dispatchEvent(new CustomEvent('lumen:show-whats-new'))}
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: '4px 12px',
                borderRadius: 6,
                cursor: 'pointer'
              }}
              title="Abrir la ventana de novedades de esta versión"
            >
              ✨ Ver ventana de novedades
            </button>
          </div>

          {/* Versión actual destacada */}
          {APP_CHANGELOG[0] && (
            <div
              style={{
                backgroundColor: 'rgba(37, 99, 235, 0.05)',
                border: '1px solid rgba(37, 99, 235, 0.2)',
                borderRadius: 8,
                padding: 16,
                marginBottom: 16
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>
                  v{APP_CHANGELOG[0].version} — {APP_CHANGELOG[0].title}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{APP_CHANGELOG[0].date}</span>
              </div>
              <p style={{ margin: '0 0 12px 0', fontSize: 13, color: 'var(--text-muted)' }}>
                {APP_CHANGELOG[0].tagline}
              </p>
              <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {APP_CHANGELOG[0].highlights.map((item, idx) => (
                  <li key={idx} style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.45 }}>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Historial de versiones anteriores */}
          {APP_CHANGELOG.length > 1 && (
            <div>
              <button
                type="button"
                onClick={() => setShowHistory(!showHistory)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#2563eb',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <span>{showHistory ? '▼ Ocultar versiones anteriores' : '▶ Ver historial de versiones anteriores'}</span>
              </button>

              {showHistory && (
                <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {APP_CHANGELOG.slice(1).map((release) => (
                    <div
                      key={release.version}
                      style={{
                        backgroundColor: 'var(--bg-hover)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        padding: 14
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>
                          v{release.version} — {release.title}
                        </span>
                        <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{release.date}</span>
                      </div>
                      <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {release.highlights.map((h, i) => (
                          <li key={i} style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                            {h}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tarjeta del Desarrollador y Creador */}
        <div
          style={{
            background: 'var(--bg-panel)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '24px 28px',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 800,
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              👤 Información del Creador y Desarrollador
            </h3>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                background: 'rgba(37, 99, 235, 0.1)',
                color: '#2563eb',
                padding: '3px 10px',
                borderRadius: 999,
                border: '1px solid rgba(37, 99, 235, 0.25)'
              }}
            >
              Autor Oficial
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            <div
              style={{
                background: 'var(--bg-hover)',
                padding: 14,
                borderRadius: 8,
                border: '1px solid var(--border)'
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  fontWeight: 800,
                  marginBottom: 4
                }}
              >
                Nombre del Creador
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                Alexander Yepez
              </div>
            </div>

            <div
              style={{
                background: 'var(--bg-hover)',
                padding: 14,
                borderRadius: 8,
                border: '1px solid var(--border)'
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  fontWeight: 800,
                  marginBottom: 4
                }}
              >
                Correo Electrónico
              </div>
              <button
                type="button"
                onClick={() => handleOpenExternal('mailto:yepezalexander1@gmail.com')}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#2563eb',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
                title="Hacer clic para enviar correo a Alexander Yepez"
              >
                yepezalexander1@gmail.com
              </button>
            </div>

            <div
              style={{
                background: 'var(--bg-hover)',
                padding: 14,
                borderRadius: 8,
                border: '1px solid var(--border)'
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  fontWeight: 800,
                  marginBottom: 4
                }}
              >
                Teléfono / WhatsApp
              </div>
              <button
                type="button"
                onClick={() => handleOpenExternal('https://wa.me/573006972967')}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#16a34a',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
                title="Hacer clic para abrir chat de WhatsApp con Alexander Yepez"
              >
                +573006972967
              </button>
            </div>
          </div>

          <div
            style={{
              marginTop: 20,
              paddingTop: 16,
              borderTop: '1px solid var(--border)',
              display: 'flex',
              gap: 12
            }}
          >
            <button
              type="button"
              className="button button--primary"
              onClick={() => handleOpenExternal('mailto:yepezalexander1@gmail.com')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 13,
                cursor: 'pointer',
                fontWeight: 700,
                padding: '8px 16px',
                borderRadius: 6
              }}
            >
              ✉ Enviar Mensaje
            </button>
            <button
              type="button"
              onClick={() => handleOpenExternal('https://wa.me/573006972967')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 13,
                cursor: 'pointer',
                fontWeight: 700,
                padding: '8px 16px',
                borderRadius: 6,
                background: '#16a34a',
                border: '1px solid #15803d',
                color: '#ffffff'
              }}
            >
              💬 Chat de WhatsApp
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
