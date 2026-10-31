import lumenLogo from '../../assets/lumen.png'

export function AboutPage() {
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
                Versión 1.0.0 Pro · Edición para Iglesias y Ministerios
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
