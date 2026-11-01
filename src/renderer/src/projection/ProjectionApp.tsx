import { useEffect, useState } from 'react'
import lumenLogo from '../assets/lumen.png'
import type { AppStatus } from '../../../shared/ipc'
import { SlidePreviewStage } from '../components/SlidePreviewStage'

function useClock(): string {
 const [now, setNow] = useState(() => new Date())
 useEffect(() => {
 const id = window.setInterval(() => setNow(new Date()), 1000)
 return () => window.clearInterval(id)
 }, [])
 return now.toLocaleTimeString('es-ES')
}

const BARS = ['#c0c0c0', '#c0c000', '#00c0c0', '#00c000', '#c000c0', '#c00000', '#0000c0']

/**
 * Aplicación de la ventana de proyección independiente.
 * Se actualiza en tiempo real al cambiar la diapositiva o el modo desde la ventana principal
 * o desde el control remoto móvil.
 */
export function ProjectionApp() {
 const api = window.lumenProjection
 const clock = useClock()
 const [status, setStatus] = useState<AppStatus | null>(null)

 useEffect(() => {
 if (!api) return
 let active = true
 api
 .getStatus()
 .then((initial) => {
 if (active) setStatus(initial)
 })
 .catch(() => {
 if (active) setStatus(null)
 })

 const unsubscribe =
 typeof api.onStatusChanged === 'function'
 ? api.onStatusChanged((next) => {
 if (active) setStatus(next)
 })
 : () => undefined

 return () => {
 active = false
 unsubscribe()
 }
 }, [api])

 useEffect(() => {
 const onKey = (event: KeyboardEvent): void => {
 if (event.key === 'Escape') void api?.close()
 }
 window.addEventListener('keydown', onKey)
 return () => window.removeEventListener('keydown', onKey)
 }, [api])

 const live = status?.projection.live
 if (live && status.projection.content === 'live' && live.mode !== 'test-pattern') {
 return (
 <SlidePreviewStage
 live={live}
 clock={clock}
 displayCount={status.projection.displayCount}
 />
 )
 }

 return (
 <div className="projection" data-testid="projection-test-pattern">
 <div className="projection__bars" aria-hidden="true">
 {BARS.map((color) => (
 <span key={color} style={{ background: color }} />
 ))}
 </div>
 <div className="projection__center">
 <img src={lumenLogo} alt="Lumen Studio" style={{ width: 56, height: 56, objectFit: 'contain', marginBottom: 10 }} />
 <div className="projection__badge">CONTENIDO DE PRUEBA</div>
 <h1 className="projection__title">{live?.churchName ?? 'Lumen Studio'}</h1>
 <p className="projection__subtitle">Ventana de proyección — pantalla de prueba</p>
 <p className="projection__clock">{clock}</p>
 <p className="projection__meta">
 {status ? `Monitores detectados: ${status.projection.displayCount}` : 'Estado no disponible'}
 </p>
 </div>
 <div className="projection__footer">Patrón de calibración · Pulsa Esc para cerrar</div>
 </div>
 )
}
