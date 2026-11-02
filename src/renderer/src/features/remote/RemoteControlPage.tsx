import { useState } from 'react'
import type { UseAppStatus } from '../../hooks/useAppStatus'
import { describeMobile } from '../../lib/statusLabels'

export interface RemoteControlPageProps {
  app: UseAppStatus
}

function isLoopbackUrl(url: string): boolean {
  return /^https?:\/\/(localhost|127(\.\d{1,3}){3}|\[::1\])(:\d+)?(\/|$)/i.test(url)
}

export function RemoteControlPage({ app }: RemoteControlPageProps) {
  const info = app.remoteInfo
  const isRunning = info?.running ?? false
  const lanUrls = (info?.urls ?? []).filter((url) => !isLoopbackUrl(url))
  const localUrls = (info?.urls ?? []).filter(isLoopbackUrl)
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)

  const handleCopy = (url: string): void => {
    void navigator.clipboard.writeText(url)
    setCopiedUrl(url)
    setTimeout(() => setCopiedUrl(null), 2500)
  }

  const renderUrlRow = (url: string, forPhone: boolean) => {
    const pin = info?.pin ?? ''
    const directUrl = `${url}?pin=${pin}`
    const stageUrl = `${url}/stage?pin=${pin}`
    const obsUrl = `${url}/obs?pin=${pin}`
    return (
      <li key={url} className="item-row" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <strong style={{ color: '#fff' }}>{url}</strong>
          <div className="item-row__sub">
            PIN directo: <code>{directUrl}</code>
          </div>
          <div className="item-row__sub" style={{ marginTop: 2 }}>
            Escenario: <code>{stageUrl}</code> · OBS: <code>{obsUrl}</code>
          </div>
        </div>
        <div className="tag-row">
          <button
            type="button"
            className="hly-mini-btn hly-mini-btn--primary"
            title={
              forPhone
                ? 'Copiar dirección con PIN incluido para abrir en el móvil'
                : 'Copiar dirección local con PIN para abrir en este equipo'
            }
            onClick={() => handleCopy(directUrl)}
          >
            {copiedUrl === directUrl ? '✓ Copiado' : forPhone ? 'Copiar enlace directo (con PIN)' : 'Copiar enlace local (con PIN)'}
          </button>
          <button type="button" className="hly-mini-btn" onClick={() => handleCopy(stageUrl)}>
            {copiedUrl === stageUrl ? '✓ Copiado' : 'Copiar /stage'}
          </button>
          <button type="button" className="hly-mini-btn" onClick={() => handleCopy(obsUrl)}>
            {copiedUrl === obsUrl ? '✓ Copiado' : 'Copiar /obs'}
          </button>
        </div>
      </li>
    )
  }

  return (
    <section className="page" aria-labelledby="page-title">
      <header className="page__header">
        <h1 id="page-title">Control remoto</h1>
        <p className="page__description">
          Servidor Web LAN: Controla la proyección, busca letras de canciones y proyecta versículos bíblicos
          desde tu smartphone o tablet en tiempo real sin cables.
        </p>
      </header>

      {/* Tarjeta informativa de nuevas capacidades del control remoto */}
      <div className="card" style={{ borderLeft: '4px solid var(--ok)' }}>
        <h2 className="card__title" style={{ color: 'var(--accent-strong)' }}>
          ✦ Capacidades del Control Remoto Móvil
        </h2>
        <div className="stats-row" style={{ marginTop: 8 }}>
          <div className="stat-box">
            <span className="stat-box__label">📱 Control en Vivo</span>
            <span className="stat-box__value" style={{ fontSize: '12px' }}>
              Avance ◀ ▶, cambio de modos (Negro, Sin texto, Logo, Congelar) y salto directo a cualquier estrofa.
            </span>
          </div>
          <div className="stat-box">
            <span className="stat-box__label">🎵 Letras de Canciones</span>
            <span className="stat-box__value" style={{ fontSize: '12px' }}>
              Buscador en tiempo real por título o letra. Toca cualquier estrofa para proyectarla inmediatamente.
            </span>
          </div>
          <div className="stat-box">
            <span className="stat-box__label">📖 Búsqueda Bíblica</span>
            <span className="stat-box__value" style={{ fontSize: '12px' }}>
              Busca por cita bíblica (ej. <em>Jn 3:16, Sal 23</em>) o por palabra en los 66 libros y proyéctalo al instante.
            </span>
          </div>
          <div className="stat-box">
            <span className="stat-box__label">📋 Lista del Culto</span>
            <span className="stat-box__value" style={{ fontSize: '12px' }}>
              Accede a la programación preparada y carga cualquier alabanza o pasaje con un solo toque.
            </span>
          </div>
        </div>
      </div>

      <div className="grid">
        <div className="card">
          <h2 className="card__title">Estado del servidor local</h2>
          <p className="card__value" data-testid="remote-page-mobile-state">
            {describeMobile(app.status).text}
          </p>

          <dl className="details">
            <dt>Servidor LAN</dt>
            <dd>{isRunning ? `Activo en puerto ${info?.port ?? '—'}` : 'Detenido'}</dd>
            <dt>PIN de seguridad</dt>
            <dd>
              <strong data-testid="remote-pin">{info?.pin ?? app.settings?.remotePin ?? '2468'}</strong>
            </dd>
            <dt>Dispositivos conectados</dt>
            <dd>{info?.connectedClients ?? app.status?.mobile.connectedClients ?? 0}</dd>
          </dl>

          <div className="button-row">
            {!isRunning ? (
              <button
                type="button"
                className="button button--primary"
                disabled={app.busy}
                onClick={() => void app.startRemoteServer()}
              >
                Iniciar servidor local
              </button>
            ) : (
              <button
                type="button"
                className="button button--danger"
                disabled={app.busy}
                onClick={() => void app.stopRemoteServer()}
              >
                Detener servidor local
              </button>
            )}
            <button
              type="button"
              className="button"
              disabled={app.busy}
              onClick={() => void app.regenerateRemotePin()}
            >
              Cambiar PIN
            </button>
          </div>
        </div>

        <div className="card">
          <h2 className="card__title">Direcciones de acceso en la red Wi-Fi</h2>
          {isRunning && info && (lanUrls.length > 0 || localUrls.length > 0) ? (
            <>
              {lanUrls.length > 0 && (
                <>
                  <p className="hint" style={{ marginTop: 0, marginBottom: 10 }}>
                    Abre cualquiera de estos enlaces en el navegador de tu teléfono o tablet (conectado a la misma red
                    Wi-Fi):
                  </p>
                  <ul className="item-list">{lanUrls.map((url) => renderUrlRow(url, true))}</ul>
                </>
              )}

              {localUrls.length > 0 && (
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px dashed var(--border)' }}>
                  <p className="hint" style={{ marginTop: 0, marginBottom: 8 }}>
                    <strong style={{ color: 'var(--accent-strong)' }}>💻 Solo en este equipo (PC):</strong> úsalo para
                    probar Lumen aquí mismo o como fuente de navegador en OBS.{' '}
                    <strong style={{ color: 'var(--warn)' }}>No lo abras en el teléfono:</strong> 127.0.0.1 apunta al
                    propio dispositivo y nunca llegará a Lumen. Desde el móvil usa la IP de la red Wi-Fi de arriba.
                  </p>
                  <ul className="item-list">{localUrls.map((url) => renderUrlRow(url, false))}</ul>
                </div>
              )}
            </>
          ) : (
            <p className="hint">
              Inicia el servidor local para obtener las direcciones IP de tu red y conectar smartphones, tablets de
              púlpito o fuentes de navegador en OBS Studio.
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
