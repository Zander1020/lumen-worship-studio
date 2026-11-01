import { useMemo, useState } from 'react'
import type { ScheduleItem } from '../../../../shared/models'
import { ConfirmDeleteModal } from '../ConfirmDeleteModal'
import type { UseAppStatus } from '../../hooks/useAppStatus'

export interface HolyricsLeftDockProps {
 app: UseAppStatus
}

/**
 * Columna izquierda de cabina: cronograma del culto (canciones, lecturas,
 * anuncios y diapositivas preparados para el servicio).
 */
export function HolyricsLeftDock({ app }: HolyricsLeftDockProps) {
 const live = app.status?.projection.live
 const [scheduleSearch, setScheduleSearch] = useState('')
 const [isReloading, setIsReloading] = useState(false)
 const [deleteConfirm, setDeleteConfirm] = useState<{
 isOpen: boolean
 title: string
 itemName: string
 itemType: string
 onConfirm: () => void
 }>({
 isOpen: false,
 title: '',
 itemName: '',
 itemType: '',
 onConfirm: () => {}
 })

 const filteredSchedule = useMemo(() => {
 const q = scheduleSearch.trim().toLowerCase()
 if (!q) return app.schedule
 return app.schedule.filter(
 (item) => item.title.toLowerCase().includes(q) || item.subtitle.toLowerCase().includes(q)
 )
 }, [app.schedule, scheduleSearch])

 const projectScheduleItem = (item: ScheduleItem, openWindow = true): void => {
 if (item.slides.length === 0) return
 void app.loadProjectionDeck({
 deckTitle: item.title,
 slides: item.slides,
 startIndex: 0,
 openWindow
 })
 void app.setProjectionMode('live')
 if (openWindow && !app.status?.projection.windowOpen) {
 void app.openProjection({ target: 'auto' })
 }
 }

 return (
 <aside className="hly-leftdock" aria-label="Cronograma del culto">
 <div className="hly-panel hly-panel--playlist" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
 {/* FILA 1: TÍTULO DEL PANEL */}
 <div
 className="hly-panel__header"
 style={{
 display: 'flex',
 flexDirection: 'row',
 alignItems: 'center',
 gap: 4,
 padding: '6px 6px'
 }}
 >
 <span
 className="hly-mini-btn hly-mini-btn--active"
 style={{ flex: 1, fontSize: 11, fontWeight: 700, padding: '4px 6px', textAlign: 'center', cursor: 'default' }}
 title="Cronograma del culto (canciones, biblia, diapositivas)"
 >
 📋 CULTO ({app.schedule.length})
 </span>
 </div>

 {/* FILA 2: BARRA DE BÚSQUEDA + BOTONES DE ACCIÓN (RECARGAR, AÑADIR) */}
 <div
 className="hly-SubToolbar"
 style={{
 padding: '4px 6px',
 display: 'flex',
 flexDirection: 'row',
 alignItems: 'center',
 gap: 4
 }}
 >
 <input
 type="text"
 className="input"
 value={scheduleSearch}
 onChange={(e) => setScheduleSearch(e.target.value)}
 placeholder="Filtrar orden del culto..."
 aria-label="Filtrar orden del culto"
 style={{ fontSize: 11, padding: '3px 6px', flex: 1, minWidth: 60 }}
 />
 <button
 type="button"
 className="hly-mini-btn"
 style={{ width: 26, height: 26, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
 title="Recargar cronograma del culto"
 onClick={() => {
 setIsReloading(true)
 void app
 .reloadMedia()
 .then(() => setTimeout(() => setIsReloading(false), 500))
 .catch(() => setIsReloading(false))
 }}
 >
 <span style={{ display: 'inline-block', transform: isReloading ? 'rotate(360deg)' : 'none', transition: 'transform 0.5s ease' }}>🔄</span>
 </button>
 <button
 type="button"
 className="hly-mini-btn hly-mini-btn--primary"
 style={{ width: 26, height: 26, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 900 }}
 title="Añadir anuncio / elemento al orden del culto"
 onClick={() => {
 const num = app.schedule.length + 1
 void app.addScheduleItem({
 kind: 'announcement',
 title: `Anuncio del Culto #${num}`,
 subtitle: 'Elemento añadido al servicio',
 slides: [
 {
 id: `ann-${Date.now()}`,
 sourceKind: 'custom',
 sourceTitle: `Anuncio #${num}`,
 label: 'Anuncio',
 lines: [`Anuncio del Culto #${num}`],
 footer: 'Orden del Culto'
 }
 ]
 })
 }}
 >
 ➕
 </button>
 </div>

 <div className="hly-playlist-body" style={{ flex: 1, overflowY: 'auto' }}>
 {filteredSchedule.length === 0 ? (
 <div className="hly-empty-box" style={{ padding: 14 }}>
 El cronograma está vacío. Carga tus alabanzas, lecturas o diapositivas.
 </div>
 ) : (
 <div className="hly-table-list" role="list">
 {filteredSchedule.map((item) => {
 const isActive = live?.deckTitle === item.title
 const isPresentation =
 item.title.toLowerCase().includes('pdf') ||
 item.title.toLowerCase().includes('powerpoint') ||
 item.slides.some((s) => s.label.toLowerCase().includes('página') || s.label.toLowerCase().includes('diapositiva'))
 return (
 <div
 key={item.id}
 role="listitem"
 className={`hly-playlist-row${isActive ? ' hly-playlist-row--active' : ''}`}
 style={{ cursor: 'pointer' }}
 title={item.title}
 onClick={() => projectScheduleItem(item, true)}
 >
 <div
 style={{
 width: 40,
 height: 28,
 borderRadius: 4,
 overflow: 'hidden',
 background: '#0a0e17',
 display: 'inline-flex',
 alignItems: 'center',
 justifyContent: 'center',
 flexShrink: 0,
 border: '1px solid var(--border)',
 position: 'relative'
 }}
 >
 {(() => {
 const thumb = item.slides[0]?.imageUrl
 if (thumb && (thumb.startsWith('data:image') || thumb.startsWith('http') || thumb.startsWith('lumen-media:'))) {
 return (
 <img
 src={thumb}
 alt=""
 style={{ width: '100%', height: '100%', objectFit: 'cover' }}
 onError={(e) => { e.currentTarget.style.display = 'none' }}
 />
 )
 }
 return <span style={{ fontSize: 12 }}>{isPresentation ? (item.title.toLowerCase().includes('pdf') ? '📄' : '📊') : item.kind === 'song' ? '🎵' : item.kind === 'bible' ? '📖' : '🖼'}</span>
 })()}
 </div>
 <span className="hly-playlist-row__title" style={{ fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
 {item.title}
 </span>
 <button
 type="button"
 className="hly-icon-btn hly-icon-btn--danger"
 title="Quitar del cronograma"
 onClick={(e) => {
 e.stopPropagation()
 setDeleteConfirm({
 isOpen: true,
 title: '¿Quitar del orden del culto?',
 itemName: item.title,
 itemType: 'elemento',
 onConfirm: () => {
 void app.removeScheduleItem(item.id)
 setDeleteConfirm((prev) => ({ ...prev, isOpen: false }))
 }
 })
 }}
 >
 ✕
 </button>
 </div>
 )
 })}
 </div>
 )}
 </div>
 </div>

 {/* MODAL DE CONFIRMACIÓN DE ELIMINACIÓN CON ESTILOS DE LA APP */}
 <ConfirmDeleteModal
 isOpen={deleteConfirm.isOpen}
 title={deleteConfirm.title}
 itemName={deleteConfirm.itemName}
 itemType={deleteConfirm.itemType}
 onConfirm={deleteConfirm.onConfirm}
 onCancel={() => setDeleteConfirm((prev) => ({ ...prev, isOpen: false }))}
 />
 </aside>
 )
}
