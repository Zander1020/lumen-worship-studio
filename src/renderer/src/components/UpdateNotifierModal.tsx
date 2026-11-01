import React, { useEffect, useState } from 'react'

export interface UpdateInfoState {
  status: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
  version?: string
  releaseNotes?: string
  progressPercent?: number
  error?: string
}

export function UpdateNotifierModal(): React.JSX.Element | null {
  const [updateState, setUpdateState] = useState<UpdateInfoState | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!window.lumen?.onUpdateStatusChanged) return

    // Consultar estado inicial
    window.lumen.getUpdateStatus?.().then((res) => {
      if (res.status === 'available' || res.status === 'downloading' || res.status === 'downloaded') {
        setUpdateState(res)
      }
    }).catch(() => {})

    // Escuchar eventos
    const unsubscribe = window.lumen.onUpdateStatusChanged((state: UpdateInfoState) => {
      if (state.status === 'available' || state.status === 'downloading' || state.status === 'downloaded') {
        setUpdateState(state)
        setDismissed(false)
      }
      // Los errores de red/404 se silencian: no mostrar popup de error al usuario
    })

    return () => unsubscribe()
  }, [])

  if (!updateState || dismissed) return null

  // Solo mostramos modal si hay actualización disponible, descargando, descargada o error
  if (updateState.status === 'not-available' || updateState.status === 'checking') {
    return null
  }

  const handleDownload = () => {
    window.lumen?.downloadUpdate?.().catch(() => {})
  }

  const handleInstall = () => {
    void window.lumen?.installUpdate?.()
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 99999,
        maxWidth: 400,
        width: '90%',
        backgroundColor: '#181b24',
        border: '1px solid #3b82f6',
        borderRadius: 12,
        boxShadow: '0 12px 30px rgba(0,0,0,0.65)',
        padding: '18px 20px',
        color: '#f3f4f6',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 20 }}>🚀</span>
          <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#60a5fa' }}>
            {updateState.status === 'downloaded'
              ? 'Actualización lista'
              : updateState.status === 'downloading'
              ? 'Descargando actualización...'
              : 'Nueva versión disponible'}
          </h4>
        </div>
        {updateState.status !== 'downloading' && (
          <button
            onClick={() => setDismissed(true)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#9ca3af',
              cursor: 'pointer',
              fontSize: 18,
              padding: '0 4px',
              lineHeight: 1
            }}
            title="Cerrar aviso"
          >
            ✕
          </button>
        )}
      </div>

      <p style={{ margin: '0 0 12px 0', fontSize: 13, color: '#d1d5db', lineHeight: 1.4 }}>
        {updateState.status === 'downloaded'
          ? `Lumen Studio v${updateState.version ?? ''} ya se descargó. Reinicia ahora para aplicar los cambios.`
          : updateState.status === 'downloading'
          ? `Descargando v${updateState.version ?? ''} en segundo plano...`
          : `Hay una nueva versión disponible (v${updateState.version ?? ''}). ¿Deseas descargarla e instalarla ahora?`}
      </p>

      {updateState.status === 'downloading' && (
        <div style={{ marginBottom: 12 }}>
          <div
            style={{
              height: 8,
              width: '100%',
              backgroundColor: '#374151',
              borderRadius: 4,
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${updateState.progressPercent || 0}%`,
                backgroundColor: '#3b82f6',
                transition: 'width 0.3s ease'
              }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
            <span>Descargando...</span>
            <span>{updateState.progressPercent || 0}%</span>
          </div>
        </div>
      )}

      {updateState.status === 'error' && (
        <div style={{ margin: '0 0 12px 0', fontSize: 12, color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: 8, borderRadius: 6 }}>
          <span>Hubo un detalle al conectar con la actualización automática. Puedes pulsar reintentar o actualizar manualmente.</span>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        {updateState.status === 'available' && (
          <>
            <button
              onClick={() => setDismissed(true)}
              style={{
                background: '#374151',
                border: 'none',
                color: '#e5e7eb',
                padding: '7px 14px',
                borderRadius: 6,
                fontSize: 13,
                cursor: 'pointer'
              }}
            >
              Más tarde
            </button>
            <button
              onClick={handleDownload}
              style={{
                background: '#2563eb',
                border: 'none',
                color: '#ffffff',
                padding: '7px 16px',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Descargar ahora
            </button>
          </>
        )}

        {updateState.status === 'downloaded' && (
          <button
            onClick={handleInstall}
            style={{
              background: '#10b981',
              border: 'none',
              color: '#ffffff',
              padding: '8px 18px',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              width: '100%'
            }}
          >
            Reiniciar y Actualizar
          </button>
        )}
      </div>
    </div>
  )
}

