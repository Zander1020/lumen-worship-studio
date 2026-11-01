import React, { useEffect } from 'react'

export interface ConfirmDeleteModalProps {
 isOpen: boolean
 title?: string
 itemName: string
 itemType?: string // Ej: 'canción', 'medio', 'presentación', 'elemento del culto'
 onConfirm: () => void
 onCancel: () => void
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
 isOpen,
 title = '¿Deseas eliminar este elemento?',
 itemName,
 itemType,
 onConfirm,
 onCancel
}) => {
 useEffect(() => {
 if (!isOpen) return
 const handleKeyDown = (e: KeyboardEvent): void => {
 if (e.key === 'Escape') onCancel()
 if (e.key === 'Enter') onConfirm()
 }
 window.addEventListener('keydown', handleKeyDown)
 return () => window.removeEventListener('keydown', handleKeyDown)
 }, [isOpen, onCancel, onConfirm])

 if (!isOpen) return null

 return (
 <div
 style={{
 position: 'fixed',
 inset: 0,
 backgroundColor: 'rgba(0, 0, 0, 0.72)',
 backdropFilter: 'blur(3px)',
 zIndex: 99999,
 display: 'flex',
 alignItems: 'center',
 justifyContent: 'center',
 padding: 16
 }}
 onClick={onCancel}
 >
 <div
 style={{
 width: '100%',
 maxWidth: 430,
 backgroundColor: '#181b24',
 border: '1px solid rgba(239, 68, 68, 0.4)',
 borderRadius: 12,
 boxShadow: '0 20px 45px rgba(0, 0, 0, 0.8)',
 padding: '22px 24px',
 color: '#f3f4f6',
 fontFamily: 'system-ui, -apple-system, sans-serif'
 }}
 onClick={(e) => e.stopPropagation()}
 role="alertdialog"
 aria-modal="true"
 aria-labelledby="confirm-delete-title"
 >
 <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
 <div
 style={{
 width: 44,
 height: 44,
 borderRadius: 10,
 backgroundColor: 'rgba(239, 68, 68, 0.15)',
 border: '1px solid rgba(239, 68, 68, 0.35)',
 display: 'flex',
 alignItems: 'center',
 justifyContent: 'center',
 fontSize: 22,
 flexShrink: 0
 }}
 >
 🗑
 </div>
 <div style={{ flex: 1, minWidth: 0 }}>
 <h3
 id="confirm-delete-title"
 style={{
 margin: '0 0 6px 0',
 fontSize: 16,
 fontWeight: 700,
 color: '#fff'
 }}
 >
 {title}
 </h3>
 <p
 style={{
 margin: 0,
 fontSize: 13,
 lineHeight: 1.5,
 color: '#9ca3af',
 wordBreak: 'break-word'
 }}
 >
 ¿Estás seguro de que deseas eliminar{' '}
 {itemType ? <span>este {itemType} </span> : null}
 <strong style={{ color: '#f9fafb' }}>«{itemName}»</strong>? Esta acción no se puede deshacer.
 </p>
 </div>
 </div>

 <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
 <button
 type="button"
 className="hly-mini-btn"
 style={{
 padding: '7px 16px',
 fontSize: 13,
 fontWeight: 600,
 background: '#242936',
 border: '1px solid #374151',
 color: '#d1d5db',
 borderRadius: 6,
 cursor: 'pointer'
 }}
 onClick={onCancel}
 >
 Cancelar
 </button>
 <button
 type="button"
 className="hly-mini-btn hly-mini-btn--danger"
 style={{
 padding: '7px 18px',
 fontSize: 13,
 fontWeight: 700,
 background: '#dc2626',
 border: '1px solid #ef4444',
 color: '#ffffff',
 borderRadius: 6,
 cursor: 'pointer',
 boxShadow: '0 2px 8px rgba(220, 38, 38, 0.35)'
 }}
 onClick={onConfirm}
 autoFocus
 >
 Eliminar
 </button>
 </div>
 </div>
 </div>
 )
}

