import type { AppStatus, MobileConnectionState } from '../../../shared/ipc'

export type Tone = 'ok' | 'idle' | 'warn'

export interface StatusLabel {
  text: string
  tone: Tone
}

const MODE_LABELS: Record<string, string> = {
  live: 'en vivo',
  black: 'pantalla negra',
  clear: 'sin texto',
  logo: 'logo',
  'test-pattern': 'prueba'
}

export function describeProjection(status: AppStatus | null): StatusLabel {
  if (!status) return { text: 'Desconocido', tone: 'warn' }
  const { projection } = status
  if (!projection.windowOpen) return { text: 'Cerrada', tone: 'idle' }
  const winMode = projection.fullscreen ? 'pantalla completa' : 'en ventana'
  const contentMode = MODE_LABELS[projection.live.mode] ?? 'en vivo'
  return { text: `Abierta (${winMode}, ${contentMode})`, tone: 'ok' }
}

const MOBILE_LABELS: Record<MobileConnectionState, StatusLabel> = {
  'not-started': { text: 'Servicio no iniciado', tone: 'idle' },
  waiting: { text: 'Esperando dispositivos', tone: 'warn' },
  connected: { text: 'Conectado', tone: 'ok' }
}

export function describeMobile(status: AppStatus | null): StatusLabel {
  if (!status) return { text: 'Desconocido', tone: 'warn' }
  const base = MOBILE_LABELS[status.mobile.state]
  if (status.mobile.state === 'connected') {
    const n = status.mobile.connectedClients
    return { text: `${base.text} (${n} ${n === 1 ? 'dispositivo' : 'dispositivos'})`, tone: base.tone }
  }
  if (status.mobile.state === 'waiting' && status.mobile.port) {
    return { text: `${base.text} (puerto ${status.mobile.port})`, tone: base.tone }
  }
  return base
}
