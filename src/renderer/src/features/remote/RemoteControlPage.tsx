import { useState } from 'react'
import type { UseAppStatus } from '../../hooks/useAppStatus'
import { describeMobile } from '../../lib/statusLabels'

export interface RemoteControlPageProps {
 app: UseAppStatus
}

export function RemoteControlPage({ app }: RemoteControlPageProps) {
 const info = app.remoteInfo
 const isRunning = info?.running ?? false
 const [copiedUrl, setCopiedUrl] = useState<string | null>(null)

 const handleCopy = (url: string): void => {
 void navigator.clipboard.writeText(url)
 setCopiedUrl(url)
 setTimeout(() => setCopiedUrl(null), 2500)
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
 Avance , cambio de modos (Negro, Sin texto, Logo, Congelar) y salto directo a cualquier estrofa.
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
 {isRunning && info && info.urls.length > 0 ? (
 <>
 <p className="hint" style={{ marginTop: 0, marginBottom: 10 }}>
 Abre cualquiera de estos enlaces en el navegador de tu teléfono o tablet (conectado a la misma red Wi-Fi):
 </p>
 <ul className="item-list">
 {info.urls.map((url) => {
 const directUrl = `${url}?pin=${info.pin}`
 return (
 <li key={url} className="item-row" style={{ flexWrap: 'wrap', gap: 8 }}>
 <div style={{ flex: 1, minWidth: 200 }}>
 <strong style={{ color: '#fff' }}>{url}</strong>
 <div className="item-row__sub">
 PIN directo: <code>{directUrl}</code>
 </div>
 <div className="item-row__sub" style={{ marginTop: 2 }}>
 Escenario: <code>{url}/stage?pin={info.pin}</code> · OBS: <code>{url}/obs?pin={info.pin}</code>
 </div>
 </div>
 <div className="tag-row">
 <button
 type="button"
 className="hly-mini-btn hly-mini-btn--primary"
 title="Copiar dirección con PIN incluido para abrir en el móvil"
 onClick={() => handleCopy(directUrl)}
 >
 {copiedUrl === directUrl ? '✓ Copiado' : 'Copiar enlace directo (con PIN)'}
 </button>
 <button
 type="button"
 className="hly-mini-btn"
 onClick={() => handleCopy(`${url}/stage?pin=${info.pin}`)}
 >
 {copiedUrl === `${url}/stage?pin=${info.pin}` ? '✓ Copiado' : 'Copiar /stage'}
 </button>
 <button
 type="button"
 className="hly-mini-btn"
 onClick={() => handleCopy(`${url}/obs?pin=${info.pin}`)}
 >
 {copiedUrl === `${url}/obs?pin=${info.pin}` ? '✓ Copiado' : 'Copiar /obs'}
 </button>
 </div>
 </li>
 )
 })}
 </ul>
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
