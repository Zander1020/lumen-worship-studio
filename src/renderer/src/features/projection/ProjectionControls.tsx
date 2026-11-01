import type { UseAppStatus } from '../../hooks/useAppStatus'

export interface ProjectionControlsProps {
 app: UseAppStatus
}

/** Botones para abrir y cerrar la ventana de proyección de prueba. */
export function ProjectionControls({ app }: ProjectionControlsProps) {
 const isOpen = app.status?.projection.windowOpen ?? false
 const disabled = app.busy || !app.bridgeAvailable
 return (
 <div className="button-row">
 <button
 type="button"
 className="button button--primary"
 disabled={disabled}
 onClick={() => void app.openProjection({ target: 'auto' })}
 >
 Abrir proyección
 </button>
 <button
 type="button"
 className="button"
 disabled={disabled}
 onClick={() => void app.openProjection({ target: 'windowed' })}
 >
 Abrir en ventana
 </button>
 <button
 type="button"
 className="button button--danger"
 disabled={disabled || !isOpen}
 onClick={() => void app.closeProjection()}
 >
 Cerrar proyección
 </button>
 </div>
 )
}

