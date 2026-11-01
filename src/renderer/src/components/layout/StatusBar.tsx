import { useEffect, useState } from 'react'
import type { AppStatus } from '../../../../shared/ipc'
import { describeMobile, describeProjection, type StatusLabel } from '../../lib/statusLabels'

function Indicator({ label, value, testId }: { label: string; value: StatusLabel; testId: string }) {
 return (
 <div className="status-indicator" data-testid={testId} data-tone={value.tone}>
 <span className={`status-dot status-dot--${value.tone}`} aria-hidden="true" />
 <span className="status-indicator__label">{label}:</span>
 <span className="status-indicator__value">{value.text}</span>
 </div>
 )
}

export interface StatusBarProps {
 status: AppStatus | null
}

export function StatusBar({ status }: StatusBarProps) {
 const displays = status?.projection.displayCount
 const [clock, setClock] = useState<string>(() =>
 new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
 )

 useEffect(() => {
 const id = setInterval(() => {
 setClock(new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
 }, 1000)
 return () => clearInterval(id)
 }, [])

 return (
 <footer className="statusbar" role="status" aria-label="Estado del sistema">
 <Indicator label="Proyección" value={describeProjection(status)} testId="status-projection" />
 <Indicator label="Conexión móvil" value={describeMobile(status)} testId="status-mobile" />
 <span className="statusbar__shortcuts" aria-hidden="true">
 F5 Vivo · F6 Cerrar · 1-9 Salto · 0 Coro · Retroceso Previa · F Congelar · B Negro · C Limpiar · L Logo
 </span>
 <div className="statusbar__spacer" />
 {displays !== undefined && (
 <span className="statusbar__meta">
 {displays} {displays === 1 ? 'monitor detectado' : 'monitores detectados'}
 </span>
 )}
 <span className="statusbar__clock" aria-label="Hora del sistema">
 {clock}
 </span>
 </footer>
 )
}
