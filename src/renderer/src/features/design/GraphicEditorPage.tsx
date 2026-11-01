import {
 type ChangeEvent,
 type MouseEvent as ReactMouseEvent,
 useCallback,
 useEffect,
 useMemo,
 useRef,
 useState
} from 'react'
import type { UseAppStatus } from '../../hooks/useAppStatus'
import { DEFAULT_TEMPLATES } from './defaultTemplates'
import {
 downloadDataUrl,
 exportProjectFile,
 exportProjectToDataUrl,
 parseProjectFile
} from './exportUtils'
import './graphicEditor.css'
import {
 AVAILABLE_FONTS,
 CANVAS_PRESETS,
 type CanvasPreset,
 type GraphicDesignProject,
 type GraphicImageProperties,
 type GraphicLayer,
 type GraphicShapeProperties,
 type GraphicTextProperties
} from './types'

export interface GraphicEditorPageProps {
 app: UseAppStatus
}

type LeftTab = 'layers' | 'templates' | 'elements'

const firstTemplate = DEFAULT_TEMPLATES[0]
const DEFAULT_PROJECT: GraphicDesignProject = firstTemplate
 ? structuredClone(firstTemplate.project)
 : {
 version: 1,
 id: 'default',
 name: 'Nuevo Diseño',
 createdAt: new Date().toISOString(),
 updatedAt: new Date().toISOString(),
 width: 1080,
 height: 1080,
 backgroundColor: '#090d16',
 layers: []
 }

export function GraphicEditorPage({ app }: GraphicEditorPageProps) {
 // Estado del proyecto de diseño
 const [project, setProject] = useState<GraphicDesignProject>(() => structuredClone(DEFAULT_PROJECT))
 const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null)
 const [editingTextId, setEditingTextId] = useState<string | null>(null)
 const [leftTab, setLeftTab] = useState<LeftTab>('layers')

 // Historial Deshacer / Rehacer
 const [history, setHistory] = useState<GraphicDesignProject[]>(() => [structuredClone(DEFAULT_PROJECT)])
 const [historyIndex, setHistoryIndex] = useState<number>(0)

 // Zoom del lienzo
 const [zoom, setZoom] = useState<number>(0.5)

 // Modales
 const [exportModalOpen, setExportModalOpen] = useState(false)
 const [exportFormat, setExportFormat] = useState<'png' | 'jpeg' | 'webp' | 'lumen'>('png')
 const [exportQuality, setExportQuality] = useState<number>(0.95)
 const [exportingBusy, setExportingBusy] = useState(false)
 const [exportSuccessMsg, setExportSuccessMsg] = useState<string | null>(null)

 // Referencias a inputs de archivos
 const imageInputRef = useRef<HTMLInputElement>(null)
 const replaceImageInputRef = useRef<HTMLInputElement>(null)
 const bgImageInputRef = useRef<HTMLInputElement>(null)
 const projectFileInputRef = useRef<HTMLInputElement>(null)
 const canvasAreaRef = useRef<HTMLDivElement>(null)

 // Referencias para arrastre y transformación
 const dragRef = useRef<{
 isDragging: boolean
 isResizing: boolean
 isRotating: boolean
 handle?: string
 startX: number
 startY: number
 initX: number
 initY: number
 initW: number
 initH: number
 initRot: number
 centerX: number
 centerY: number
 isImage?: boolean
 maintainAspectRatio?: boolean
 imgOrigWidth?: number
 imgOrigHeight?: number
 initTransform?: GraphicLayer['transform']
 }>({
 isDragging: false,
 isResizing: false,
 isRotating: false,
 startX: 0,
 startY: 0,
 initX: 0,
 initY: 0,
 initW: 0,
 initH: 0,
 initRot: 0,
 centerX: 0,
 centerY: 0
 })

 // Capa actualmente seleccionada
 const selectedLayer = useMemo(() => {
 return project.layers.find((l) => l.id === selectedLayerId) ?? null
 }, [project.layers, selectedLayerId])

 // Guardar estado en el historial (Undo/Redo)
 const pushHistory = useCallback((newProject: GraphicDesignProject) => {
 setHistory((prev) => {
 const upToCurrent = prev.slice(0, historyIndex + 1)
 const next = [...upToCurrent, structuredClone(newProject)]
 return next.slice(-30) // hasta 30 pasos
 })
 setHistoryIndex((prev) => Math.min(prev + 1, 29))
 }, [historyIndex])

 // Deshacer
 const handleUndo = useCallback(() => {
 if (historyIndex > 0) {
 const targetState = history[historyIndex - 1]
 if (targetState) {
 setProject(structuredClone(targetState))
 setHistoryIndex((i) => i - 1)
 }
 }
 }, [history, historyIndex])

 // Rehacer
 const handleRedo = useCallback(() => {
 if (historyIndex < history.length - 1) {
 const targetState = history[historyIndex + 1]
 if (targetState) {
 setProject(structuredClone(targetState))
 setHistoryIndex((i) => i + 1)
 }
 }
 }, [history, historyIndex])

 // Actualizar el proyecto aplicando una mutación y registrando en historial
 const updateProject = useCallback(
 (updater: (prev: GraphicDesignProject) => GraphicDesignProject, recordHistory = true) => {
 setProject((prev) => {
 const next = updater(prev)
 if (recordHistory) {
 pushHistory(next)
 }
 return next
 })
 },
 [pushHistory]
 )

 // Actualizar una capa específica
 const updateLayer = useCallback(
 (layerId: string, partial: Partial<GraphicLayer>, recordHistory = true) => {
 updateProject((prev) => {
 return {
 ...prev,
 updatedAt: new Date().toISOString(),
 layers: prev.layers.map((l) => (l.id === layerId ? { ...l, ...partial } : l))
 }
 }, recordHistory)
 },
 [updateProject]
 )

 // Eliminación de capa con useCallback
 const deleteLayer = useCallback(
 (layerId: string): void => {
 updateProject((prev) => ({
 ...prev,
 layers: prev.layers.filter((l) => l.id !== layerId)
 }))
 setSelectedLayerId((cur) => (cur === layerId ? null : cur))
 },
 [updateProject]
 )

 // Duplicación de capa con useCallback
 const duplicateLayer = useCallback(
 (layerId: string): void => {
 updateProject((prev) => {
 const source = prev.layers.find((l) => l.id === layerId)
 if (!source) return prev
 const clone: GraphicLayer = {
 ...structuredClone(source),
 id: `layer-${source.kind}-${Date.now()}`,
 name: `${source.name} (Copia)`,
 transform: {
 ...source.transform,
 x: source.transform.x + 30,
 y: source.transform.y + 30
 }
 }
 return {
 ...prev,
 layers: [...prev.layers, clone]
 }
 })
 },
 [updateProject]
 )

 // Helpers seguros para modificar propiedades de la capa seleccionada
 const updateSelectedTextProps = useCallback(
 (partial: Partial<GraphicTextProperties>) => {
 if (!selectedLayerId) return
 updateProject((prev) => ({
 ...prev,
 layers: prev.layers.map((l) => {
 if (l.id !== selectedLayerId || !l.textProps) return l
 return {
 ...l,
 textProps: { ...l.textProps, ...partial }
 }
 })
 }))
 },
 [selectedLayerId, updateProject]
 )

 const updateSelectedImageProps = useCallback(
 (partial: Partial<GraphicImageProperties>) => {
 if (!selectedLayerId) return
 updateProject((prev) => ({
 ...prev,
 layers: prev.layers.map((l) => {
 if (l.id !== selectedLayerId || !l.imageProps) return l
 return {
 ...l,
 imageProps: { ...l.imageProps, ...partial }
 }
 })
 }))
 },
 [selectedLayerId, updateProject]
 )

 const updateSelectedShapeProps = useCallback(
 (partial: Partial<GraphicShapeProperties>) => {
 if (!selectedLayerId) return
 updateProject((prev) => ({
 ...prev,
 layers: prev.layers.map((l) => {
 if (l.id !== selectedLayerId || !l.shapeProps) return l
 return {
 ...l,
 shapeProps: { ...l.shapeProps, ...partial }
 }
 })
 }))
 },
 [selectedLayerId, updateProject]
 )

 // Ajustar el zoom automáticamente según el contenedor
 const handleFitToScreen = useCallback(() => {
 if (!canvasAreaRef.current) return
 const containerW = canvasAreaRef.current.clientWidth - 80
 const containerH = canvasAreaRef.current.clientHeight - 80
 if (containerW <= 0 || containerH <= 0) return
 const scaleW = containerW / project.width
 const scaleH = containerH / project.height
 const optimalScale = Math.max(0.15, Math.min(1.2, Math.min(scaleW, scaleH)))
 setZoom(Number(optimalScale.toFixed(2)))
 }, [project.height, project.width])

 // Ajuste inicial de zoom al cambiar dimensiones de lienzo
 useEffect(() => {
 handleFitToScreen()
 }, [project.width, project.height, handleFitToScreen])

 // Zoom interactivo con Ctrl + Rueda del ratón
 useEffect(() => {
 const el = canvasAreaRef.current
 if (!el) return
 const handleWheel = (e: WheelEvent): void => {
 if (e.ctrlKey || e.metaKey) {
 e.preventDefault()
 const zoomDelta = e.deltaY < 0 ? 0.05 : -0.05
 setZoom((prev) => Math.max(0.1, Math.min(3.0, Number((prev + zoomDelta).toFixed(2)))))
 }
 }
 el.addEventListener('wheel', handleWheel, { passive: false })
 return () => {
 el.removeEventListener('wheel', handleWheel)
 }
 }, [])

 // Atajos de teclado (Ctrl+Z, Ctrl+Y, Ctrl+S, Supr, Ctrl+D, Escape)
 useEffect(() => {
 const handleKeyDown = (e: KeyboardEvent): void => {
 const targetEl = e.target as HTMLElement | null
 const targetTag = targetEl?.tagName.toLowerCase() ?? ''
 if (targetTag === 'input' || targetTag === 'textarea' || targetTag === 'select') {
 return
 }

 if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
 e.preventDefault()
 if (e.shiftKey) {
 handleRedo()
 } else {
 handleUndo()
 }
 } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
 e.preventDefault()
 handleRedo()
 } else if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
 e.preventDefault()
 exportProjectFile(project)
 } else if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) {
 e.preventDefault()
 if (selectedLayerId) duplicateLayer(selectedLayerId)
 } else if (e.key === 'Delete' || e.key === 'Backspace') {
 e.preventDefault()
 if (selectedLayerId) deleteLayer(selectedLayerId)
 } else if (e.key === 'Escape') {
 setSelectedLayerId(null)
 } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && selectedLayerId) {
 e.preventDefault()
 const step = e.shiftKey ? 10 : 1
 const deltaX = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
 const deltaY = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
 updateProject((prev) => ({
 ...prev,
 layers: prev.layers.map((l) =>
 l.id === selectedLayerId
 ? {
 ...l,
 transform: {
 ...l.transform,
 x: l.transform.x + deltaX,
 y: l.transform.y + deltaY
 }
 }
 : l
 )
 }))
 }
 }

 window.addEventListener('keydown', handleKeyDown)
 return () => window.removeEventListener('keydown', handleKeyDown)
 }, [deleteLayer, duplicateLayer, handleRedo, handleUndo, project, selectedLayerId, updateProject])

 // --- OPERACIONES DE CAPAS ---

 const addTextLayer = (customText = 'Escribe tu frase aquí...'): void => {
 const newId = `layer-text-${Date.now()}`
 const defaultTextProps: GraphicTextProperties = {
 text: customText,
 fontFamily: 'Montserrat, system-ui, sans-serif',
 fontSize: 48,
 fontWeight: '700',
 fontStyle: 'normal',
 textDecoration: 'none',
 color: '#ffffff',
 textAlign: 'center',
 lineHeight: 1.25,
 letterSpacing: 0,
 uppercase: false,
 shadowEnabled: true,
 shadowColor: 'rgba(0,0,0,0.85)',
 shadowBlur: 12,
 shadowOffsetX: 2,
 shadowOffsetY: 4,
 strokeEnabled: false,
 strokeColor: '#000000',
 strokeWidth: 2,
 bgBoxEnabled: false,
 bgBoxColor: 'rgba(15, 23, 42, 0.75)',
 bgBoxOpacity: 0.75,
 bgBoxPadding: 16,
 bgBoxRadius: 8
 }

 const newLayer: GraphicLayer = {
 id: newId,
 name: `Texto ${project.layers.filter((l) => l.kind === 'text').length + 1}`,
 kind: 'text',
 visible: true,
 locked: false,
 transform: {
 x: Math.round(project.width * 0.15),
 y: Math.round(project.height * 0.35),
 width: Math.round(project.width * 0.7),
 height: 180,
 rotation: 0,
 opacity: 1
 },
 textProps: defaultTextProps
 }

 updateProject((prev) => ({
 ...prev,
 layers: [...prev.layers, newLayer]
 }))
 setSelectedLayerId(newId)
 }

 const addImageLayerFromDataUrl = (src: string, filename = 'Imagen'): void => {
 const img = new Image()
 img.onload = () => {
 const origW = img.naturalWidth || 600
 const origH = img.naturalHeight || 600
 const maxW = Math.round(project.width * 0.6)
 const ratio = origH / origW
 const w = Math.min(origW, maxW)
 const h = Math.round(w * ratio)

 const newId = `layer-img-${Date.now()}`
 const newLayer: GraphicLayer = {
 id: newId,
 name: filename.replace(/\.[^.]+$/, ''),
 kind: 'image',
 visible: true,
 locked: false,
 transform: {
 x: Math.round((project.width - w) / 2),
 y: Math.round((project.height - h) / 2),
 width: w,
 height: h,
 rotation: 0,
 opacity: 1
 },
 imageProps: {
 src,
 name: filename,
 originalWidth: origW,
 originalHeight: origH,
 maintainAspectRatio: true,
 borderRadius: 8,
 shadowEnabled: true,
 shadowColor: 'rgba(0,0,0,0.6)',
 shadowBlur: 16
 }
 }

 updateProject((prev) => ({
 ...prev,
 layers: [...prev.layers, newLayer]
 }))
 setSelectedLayerId(newId)
 }
 img.src = src
 }

 const handleImageFileSelect = (e: ChangeEvent<HTMLInputElement>): void => {
 const file = e.target.files?.[0]
 if (!file) return
 const reader = new FileReader()
 reader.onload = () => {
 const dataUrl = typeof reader.result === 'string' ? reader.result : ''
 if (dataUrl) {
 addImageLayerFromDataUrl(dataUrl, file.name)
 }
 }
 reader.readAsDataURL(file)
 e.target.value = ''
 }

 const handleBgImageFileSelect = (e: ChangeEvent<HTMLInputElement>): void => {
 const file = e.target.files?.[0]
 if (!file) return
 const reader = new FileReader()
 reader.onload = () => {
 const dataUrl = typeof reader.result === 'string' ? reader.result : ''
 if (dataUrl) {
 updateProject((prev) => ({
 ...prev,
 backgroundImage: dataUrl,
 backgroundImageFit: prev.backgroundImageFit || 'cover'
 }))
 }
 }
 reader.readAsDataURL(file)
 e.target.value = ''
 }

 const handleReplaceImageFileSelect = (e: ChangeEvent<HTMLInputElement>): void => {
 const file = e.target.files?.[0]
 if (!file || !selectedLayerId) return
 const reader = new FileReader()
 reader.onload = () => {
 const dataUrl = typeof reader.result === 'string' ? reader.result : ''
 if (dataUrl) {
 updateLayer(selectedLayerId, {
 name: file.name.replace(/\.[^.]+$/, ''),
 imageProps: {
 ...(selectedLayer?.imageProps ?? {
 originalWidth: 600,
 originalHeight: 600,
 maintainAspectRatio: true,
 borderRadius: 0,
 shadowEnabled: false,
 shadowColor: '#000',
 shadowBlur: 0
 }),
 src: dataUrl,
 name: file.name
 }
 })
 }
 }
 reader.readAsDataURL(file)
 e.target.value = ''
 }

 const addShapeLayer = (kind: 'rect' | 'circle'): void => {
 const newId = `layer-${kind}-${Date.now()}`
 const newLayer: GraphicLayer = {
 id: newId,
 name: kind === 'rect' ? 'Rectángulo' : 'Círculo',
 kind,
 visible: true,
 locked: false,
 transform: {
 x: Math.round(project.width * 0.25),
 y: Math.round(project.height * 0.25),
 width: 300,
 height: 200,
 rotation: 0,
 opacity: 0.9
 },
 shapeProps: {
 fillColor: 'rgba(30, 41, 59, 0.8)',
 strokeColor: '#f59e0b',
 strokeWidth: 2,
 borderRadius: kind === 'rect' ? 12 : 0
 }
 }

 updateProject((prev) => ({
 ...prev,
 layers: [...prev.layers, newLayer]
 }))
 setSelectedLayerId(newId)
 }

 const moveLayerOrder = (layerId: string, direction: 'up' | 'down'): void => {
 updateProject((prev) => {
 const idx = prev.layers.findIndex((l) => l.id === layerId)
 if (idx === -1) return prev
 const layers = [...prev.layers]
 const [item] = layers.splice(idx, 1)
 if (!item) return prev

 if (direction === 'up') {
 const nextIdx = Math.min(layers.length, idx + 1)
 layers.splice(nextIdx, 0, item)
 } else {
 const nextIdx = Math.max(0, idx - 1)
 layers.splice(nextIdx, 0, item)
 }

 return { ...prev, layers }
 })
 }

 const applyPreset = (preset: CanvasPreset): void => {
 updateProject((prev) => ({
 ...prev,
 width: preset.width,
 height: preset.height
 }))
 }

 const applyTemplate = useCallback(
 (templateProject: GraphicDesignProject): void => {
 if (
 project.layers.length > 0 &&
 !window.confirm('¿Deseas reemplazar el diseño actual con esta plantilla?')
 ) {
 return
 }
 const cloned = structuredClone(templateProject)
 setProject(cloned)
 pushHistory(cloned)
 setSelectedLayerId(null)
 },
 [project.layers.length, pushHistory]
 )

 // Cargar proyecto desde archivo .lumen (antes .lumen-design)
 const handleOpenProjectFile = (e: ChangeEvent<HTMLInputElement>): void => {
 const file = e.target.files?.[0]
 if (!file) return
 const reader = new FileReader()
 reader.onload = () => {
 try {
 const content = typeof reader.result === 'string' ? reader.result : ''
 const loaded = parseProjectFile(content)
 setProject(loaded)
 pushHistory(loaded)
 setSelectedLayerId(null)
 } catch (err) {
 alert('No se pudo cargar el archivo de proyecto: ' + String(err))
 }
 }
 reader.readAsText(file)
 e.target.value = ''
 }

 // --- INTERACCIÓN Y ARRASTRE EN EL LIENZO ---

 const handlePointerDownLayer = (e: ReactMouseEvent, layer: GraphicLayer): void => {
 if (e.button !== 0) return
 if (layer.locked) return
 e.stopPropagation()
 setSelectedLayerId(layer.id)

 dragRef.current = {
 isDragging: true,
 isResizing: false,
 isRotating: false,
 startX: e.clientX,
 startY: e.clientY,
 initX: layer.transform.x,
 initY: layer.transform.y,
 initW: layer.transform.width,
 initH: layer.transform.height,
 initRot: layer.transform.rotation,
 centerX: layer.transform.x + layer.transform.width / 2,
 centerY: layer.transform.y + layer.transform.height / 2,
 initTransform: { ...layer.transform }
 }
 }

 const handlePointerDownHandle = (e: ReactMouseEvent, handleType: string): void => {
 if (e.button !== 0) return
 e.stopPropagation()
 if (!selectedLayer || selectedLayer.locked) return

 const isRot = handleType === 'rot'
 dragRef.current = {
 isDragging: false,
 isResizing: !isRot,
 isRotating: isRot,
 handle: handleType,
 startX: e.clientX,
 startY: e.clientY,
 initX: selectedLayer.transform.x,
 initY: selectedLayer.transform.y,
 initW: selectedLayer.transform.width,
 initH: selectedLayer.transform.height,
 initRot: selectedLayer.transform.rotation,
 centerX: selectedLayer.transform.x + selectedLayer.transform.width / 2,
 centerY: selectedLayer.transform.y + selectedLayer.transform.height / 2,
 isImage: selectedLayer.kind === 'image',
 maintainAspectRatio: selectedLayer.imageProps?.maintainAspectRatio ?? false,
 imgOrigWidth: selectedLayer.imageProps?.originalWidth ?? selectedLayer.transform.width,
 imgOrigHeight: selectedLayer.imageProps?.originalHeight ?? selectedLayer.transform.height,
 initTransform: { ...selectedLayer.transform }
 }
 }

 // Listener global para arrastre y transformación continua en toda la ventana
 useEffect(() => {
 const handleWindowMouseMove = (e: MouseEvent): void => {
 const d = dragRef.current
 if (!selectedLayerId || (!d.isDragging && !d.isResizing && !d.isRotating)) return

 const deltaX = (e.clientX - d.startX) / zoom
 const deltaY = (e.clientY - d.startY) / zoom

 if (d.isDragging) {
 updateLayer(
 selectedLayerId,
 {
 transform: {
 ...(d.initTransform ?? { x: d.initX, y: d.initY, width: d.initW, height: d.initH, rotation: d.initRot, opacity: 1 }),
 x: Math.round(d.initX + deltaX),
 y: Math.round(d.initY + deltaY)
 }
 },
 false
 )
 } else if (d.isResizing && d.handle) {
 let newW = d.initW
 let newH = d.initH
 let newX = d.initX
 let newY = d.initY

 if (d.handle.includes('e')) newW = Math.max(20, Math.round(d.initW + deltaX))
 if (d.handle.includes('s')) newH = Math.max(20, Math.round(d.initH + deltaY))
 if (d.handle.includes('w')) {
 const proposedW = Math.max(20, Math.round(d.initW - deltaX))
 newX = d.initX + (d.initW - proposedW)
 newW = proposedW
 }
 if (d.handle.includes('n')) {
 const proposedH = Math.max(20, Math.round(d.initH - deltaY))
 newY = d.initY + (d.initH - proposedH)
 newH = proposedH
 }

 // Si es manivela de esquina en imagen con bloqueo de proporción activo
 const isCorner = ['nw', 'ne', 'se', 'sw'].includes(d.handle)
 if (isCorner && d.isImage && d.maintainAspectRatio) {
 const ratio = (d.imgOrigHeight || 1) / (d.imgOrigWidth || 1)
 newH = Math.round(newW * ratio)
 }

 updateLayer(
 selectedLayerId,
 {
 transform: {
 ...(d.initTransform ?? { x: d.initX, y: d.initY, width: d.initW, height: d.initH, rotation: d.initRot, opacity: 1 }),
 x: newX,
 y: newY,
 width: newW,
 height: newH
 }
 },
 false
 )
 } else if (d.isRotating) {
 const stageEl = canvasAreaRef.current?.querySelector('.ge-canvas-stage')
 const canvasRect = stageEl?.getBoundingClientRect()
 if (canvasRect) {
 const mouseXInCanvas = (e.clientX - canvasRect.left) / zoom
 const mouseYInCanvas = (e.clientY - canvasRect.top) / zoom
 const rad = Math.atan2(mouseYInCanvas - d.centerY, mouseXInCanvas - d.centerX)
 let deg = Math.round((rad * 180) / Math.PI) - 90
 if (deg < 0) deg += 360
 updateLayer(
 selectedLayerId,
 {
 transform: {
 ...(d.initTransform ?? { x: d.initX, y: d.initY, width: d.initW, height: d.initH, rotation: d.initRot, opacity: 1 }),
 rotation: deg
 }
 },
 false
 )
 }
 }
 }

 const handleWindowMouseUp = (): void => {
 if (dragRef.current.isDragging || dragRef.current.isResizing || dragRef.current.isRotating) {
 dragRef.current.isDragging = false
 dragRef.current.isResizing = false
 dragRef.current.isRotating = false
 setProject((cur) => {
 pushHistory(cur)
 return cur
 })
 }
 }

 window.addEventListener('mousemove', handleWindowMouseMove)
 window.addEventListener('mouseup', handleWindowMouseUp)
 return () => {
 window.removeEventListener('mousemove', handleWindowMouseMove)
 window.removeEventListener('mouseup', handleWindowMouseUp)
 }
 }, [selectedLayerId, updateLayer, zoom, pushHistory])

 // --- EXPORTACIÓN Y PROYECCIÓN ---

 const handleExportDownload = async (): Promise<void> => {
 setExportingBusy(true)
 try {
 if (exportFormat === 'lumen') {
 exportProjectFile(project)
 setExportSuccessMsg('¡Diseño guardado como archivo .lumen editable!')
 } else {
 const dataUrl = await exportProjectToDataUrl(project, exportFormat, exportQuality)
 const ext = exportFormat === 'jpeg' ? 'jpg' : exportFormat
 const filename = `${project.name.toLowerCase().replace(/[^a-z0-9_-]/g, '_') || 'diseno'}.${ext}`
 downloadDataUrl(dataUrl, filename)
 setExportSuccessMsg('¡Diseño exportado con éxito en su resolución nativa!')
 }
 setTimeout(() => setExportSuccessMsg(null), 3000)
 } catch (err) {
 alert('Error al exportar: ' + String(err))
 } finally {
 setExportingBusy(false)
 }
 }

 const handleSaveToWorshipMedia = async (): Promise<void> => {
 setExportingBusy(true)
 try {
 const dataUrl = await exportProjectToDataUrl(project, 'png', 0.95)
 await app.addMedia({
 name: project.name || 'Diseño Gráfico',
 kind: 'image',
 value: dataUrl,
 accentColor: '#f59e0b',
 category: 'Sermón'
 })
 setExportSuccessMsg('¡Diseño guardado en la galería de Imágenes del Culto!')
 setTimeout(() => setExportSuccessMsg(null), 3000)
 } catch (err) {
 alert('Error al guardar en Imágenes: ' + String(err))
 } finally {
 setExportingBusy(false)
 }
 }

 const handleDirectProjectNow = async (): Promise<void> => {
 setExportingBusy(true)
 try {
 const dataUrl = await exportProjectToDataUrl(project, 'png', 0.95)
 await app.loadProjectionDeck({
 deckTitle: `Diseño: ${project.name}`,
 slides: [
 {
 id: `design-slide-${Date.now()}`,
 sourceKind: 'custom',
 sourceTitle: project.name,
 label: project.name,
 lines: [],
 footer: '',
 imageUrl: dataUrl
 }
 ],
 startIndex: 0,
 openWindow: true
 })
 await app.setProjectionMode('live')
 if (!app.status?.projection.windowOpen) {
 await app.openProjection({ target: 'auto' })
 }
 setExportSuccessMsg('¡Diseño enviado inmediatamente a la pantalla de proyección!')
 setTimeout(() => setExportSuccessMsg(null), 3000)
 } catch (err) {
 alert('Error al proyectar: ' + String(err))
 } finally {
 setExportingBusy(false)
 }
 }

 return (
 <section className="ge-root" aria-labelledby="page-title">
 {/* 1. BARRA SUPERIOR PROFESIONAL */}
 <header className="ge-topbar">
 <div className="ge-topbar__group">
 <h1 id="page-title" className="hly-module-bar__title" style={{ margin: 0, fontSize: 16 }}>
 Editor Gráfico
 </h1>
 <input
 type="text"
 className="ge-input"
 style={{ width: 180, fontWeight: 700 }}
 value={project.name}
 onChange={(e) => updateProject((prev) => ({ ...prev, name: e.target.value }))}
 title="Nombre del diseño"
 />
 </div>

 {/* Acciones de lienzo y elementos */}
 <div className="ge-topbar__group">
 <button
 type="button"
 className="ge-topbar__btn"
 title="Nuevo lienzo en blanco"
 onClick={() => {
 if (window.confirm('¿Deseas crear un nuevo diseño en blanco?')) {
 const blank: GraphicDesignProject = {
 version: 1,
 id: `proj-${Date.now()}`,
 name: 'Nuevo Diseño',
 createdAt: new Date().toISOString(),
 updatedAt: new Date().toISOString(),
 width: 1080,
 height: 1080,
 backgroundColor: '#090d16',
 layers: []
 }
 setProject(blank)
 pushHistory(blank)
 setSelectedLayerId(null)
 }
 }}
 >
 📄 Nuevo
 </button>

 <input
 ref={projectFileInputRef}
 type="file"
 accept=".lumen,.lumen-design,.json"
 style={{ display: 'none' }}
 onChange={handleOpenProjectFile}
 />
 <button
 type="button"
 className="ge-topbar__btn"
 title="Abrir proyecto editable (.lumen)"
 onClick={() => projectFileInputRef.current?.click()}
 >
 📂 Abrir
 </button>

 <button
 type="button"
 className="ge-topbar__btn"
 title="Guardar archivo de proyecto editable (Ctrl+S)"
 onClick={() => exportProjectFile(project)}
 >
 💾 Guardar
 </button>

 <div className="ge-topbar__divider" />

 <button
 type="button"
 className="ge-topbar__btn"
 title="Deshacer (Ctrl+Z)"
 disabled={historyIndex <= 0}
 onClick={handleUndo}
 >
 
 </button>
 <button
 type="button"
 className="ge-topbar__btn"
 title="Rehacer (Ctrl+Y)"
 disabled={historyIndex >= history.length - 1}
 onClick={handleRedo}
 >
 
 </button>

 <div className="ge-topbar__divider" />

 {/* Importar imagen de predicador o fondo */}
 <input
 ref={imageInputRef}
 type="file"
 accept="image/png,image/jpeg,image/webp,image/svg+xml"
 style={{ display: 'none' }}
 onChange={handleImageFileSelect}
 />
 <button
 type="button"
 className="ge-topbar__btn ge-topbar__btn--primary"
 onClick={() => imageInputRef.current?.click()}
 title="Importar fotografía de predicador, pastor o fondo desde tu computador"
 >
 🖼 Importar Imagen
 </button>

 <button
 type="button"
 className="ge-topbar__btn"
 onClick={() => addTextLayer('Escribe tu frase aquí...')}
 title="Añadir un bloque de texto independiente"
 >
 🗚 Agregar Texto
 </button>

 {/* Selector de tamaño de lienzo */}
 <select
 className="ge-select"
 style={{ width: 170 }}
 value={`${project.width}x${project.height}`}
 onChange={(e) => {
 const [w, h] = e.target.value.split('x').map(Number)
 if (w && h) {
 const found = CANVAS_PRESETS.find((p) => p.width === w && p.height === h)
 if (found) applyPreset(found)
 else updateProject((prev) => ({ ...prev, width: w, height: h }))
 }
 }}
 title="Seleccionar proporción y tamaño del lienzo"
 >
 {CANVAS_PRESETS.map((p) => (
 <option key={p.id} value={`${p.width}x${p.height}`}>
 {p.icon} {p.label} ({p.width} {p.height})
 </option>
 ))}
 </select>
 </div>

 {/* Acciones de salida: Exportar, Proyectar */}
 <div className="ge-topbar__group">
 <button
 type="button"
 className="ge-topbar__btn ge-topbar__btn--gold"
 onClick={() => void handleDirectProjectNow()}
 title="Proyectar este diseño inmediatamente en vivo en la pantalla del templo"
 >
 Proyectar
 </button>

 <button
 type="button"
 className="ge-topbar__btn"
 onClick={() => setExportModalOpen(true)}
 title="Exportar imagen en PNG, JPG o WebP a tamaño real"
 >
 📤 Exportar
 </button>
 </div>
 </header>

 {/* 2. ESPACIO DE TRABAJO PRINCIPAL */}
 <div className="ge-workbench">
 {/* PANEL IZQUIERDO: CAPAS / PLANTILLAS / AGREGAR */}
 <aside className="ge-panel-left">
 <div className="ge-tab-strip">
 <button
 type="button"
 className={`ge-tab-item${leftTab === 'layers' ? ' ge-tab-item--active' : ''}`}
 onClick={() => setLeftTab('layers')}
 >
 🗂 Capas ({project.layers.length})
 </button>
 <button
 type="button"
 className={`ge-tab-item${leftTab === 'templates' ? ' ge-tab-item--active' : ''}`}
 onClick={() => setLeftTab('templates')}
 >
 📚 Plantillas
 </button>
 <button
 type="button"
 className={`ge-tab-item${leftTab === 'elements' ? ' ge-tab-item--active' : ''}`}
 onClick={() => setLeftTab('elements')}
 >
 + Formas
 </button>
 </div>

 <div className="ge-panel-body">
 {leftTab === 'layers' && (
 <>
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
 <span className="ge-section-title" style={{ margin: 0 }}>
 Orden de Capas
 </span>
 <div style={{ display: 'flex', gap: 4 }}>
 <button
 type="button"
 className="ge-icon-action"
 disabled={!selectedLayerId}
 title="Subir capa (hacia el frente)"
 onClick={() => selectedLayerId && moveLayerOrder(selectedLayerId, 'up')}
 >
 
 </button>
 <button
 type="button"
 className="ge-icon-action"
 disabled={!selectedLayerId}
 title="Bajar capa (hacia el fondo)"
 onClick={() => selectedLayerId && moveLayerOrder(selectedLayerId, 'down')}
 >
 
 </button>
 </div>
 </div>

 <div className="ge-layers-list">
 {project.layers.length === 0 ? (
 <div style={{ textAlign: 'center', color: '#71717a', padding: '24px 0', fontSize: 12 }}>
 No hay elementos. Haz clic en "Importar Imagen" o "Agregar Texto".
 </div>
 ) : (
 [...project.layers].reverse().map((layer) => {
 const isSelected = layer.id === selectedLayerId
 return (
 <div
 key={layer.id}
 className={`ge-layer-row${isSelected ? ' ge-layer-row--active' : ''}`}
 onClick={() => setSelectedLayerId(layer.id)}
 >
 <span className="ge-layer-icon">
  {layer.kind === 'text' && '📝'}
  {layer.kind === 'image' && '🖼'}
  {layer.kind === 'rect' && '⬜'}
  {layer.kind === 'circle' && '⭕'}
 </span>
 <span className="ge-layer-name">{layer.name}</span>
 <div className="ge-layer-actions">
 <button
 type="button"
 className="ge-icon-action"
 title={layer.visible ? 'Ocultar capa' : 'Mostrar capa'}
 onClick={(e) => {
 e.stopPropagation()
 updateLayer(layer.id, { visible: !layer.visible })
 }}
 >
 {layer.visible ? '👁' : '🚫'}
 </button>
 <button
 type="button"
 className="ge-icon-action"
 title={layer.locked ? 'Desbloquear' : 'Bloquear posición'}
 onClick={(e) => {
 e.stopPropagation()
 updateLayer(layer.id, { locked: !layer.locked })
 }}
 >
 {layer.locked ? '🔒' : '🔓'}
 </button>
 <button
 type="button"
 className="ge-icon-action"
 title="Duplicar capa"
 onClick={(e) => {
 e.stopPropagation()
 duplicateLayer(layer.id)
 }}
 >
 
 </button>
 <button
 type="button"
 className="ge-icon-action"
 title="Eliminar capa"
 onClick={(e) => {
 e.stopPropagation()
 deleteLayer(layer.id)
 }}
 >
 🗑
 </button>
 </div>
 </div>
 )
 })
 )}
 </div>
 </>
 )}

 {leftTab === 'templates' && (
 <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
 <span className="ge-section-title">Plantillas para la Iglesia</span>
 {DEFAULT_TEMPLATES.map((tmpl) => (
 <div
 key={tmpl.id}
 className="ge-template-card"
 onClick={() => applyTemplate(tmpl.project)}
 >
 <div className="ge-template-swatch" style={{ background: tmpl.thumbnailColor }}>
 {tmpl.category}
 </div>
 <div style={{ fontWeight: 700, fontSize: 13, color: '#fff', marginBottom: 2 }}>
 {tmpl.name}
 </div>
 <div style={{ fontSize: 11, color: '#a1a1aa' }}>{tmpl.description}</div>
 </div>
 ))}
 </div>
 )}

 {leftTab === 'elements' && (
 <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
 <span className="ge-section-title">Formas Geométricas</span>
 <button
 type="button"
 className="ge-topbar__btn"
 onClick={() => addShapeLayer('rect')}
 >
 Rectángulo / Tarjeta de fondo
 </button>
 <button
 type="button"
 className="ge-topbar__btn"
 onClick={() => addShapeLayer('circle')}
 >
 Círculo decorativo
 </button>
 <button
 type="button"
 className="ge-topbar__btn"
 onClick={() => addTextLayer('“Frase Bíblica”')}
 >
 🗚 Cita con Comillas
 </button>
 </div>
 )}
 </div>
 </aside>

 {/* ÁREA CENTRAL: LIENZO INTERACTIVO */}
 <main
 ref={canvasAreaRef}
 className="ge-canvas-viewport"
 onClick={(e) => {
 const target = e.target as HTMLElement | null
 if (target?.closest('.ge-canvas-stage') || target?.closest('.ge-zoom-controls')) return
 setSelectedLayerId(null)
 setEditingTextId(null)
 }}
 >
 {/* Controles de Zoom flotantes */}
 <div className="ge-zoom-controls">
 <button
 type="button"
 className="ge-zoom-btn"
 onClick={() => setZoom((z) => Math.max(0.1, Number((z - 0.1).toFixed(2))))}
 >
 
 </button>
 <span style={{ fontSize: 11, fontWeight: 700, padding: '0 4px', minWidth: 44, textAlign: 'center' }}>
 {Math.round(zoom * 100)}%
 </span>
 <button
 type="button"
 className="ge-zoom-btn"
 onClick={() => setZoom((z) => Math.min(3.0, Number((z + 0.1).toFixed(2))))}
 >
 +
 </button>
 <button type="button" className="ge-zoom-btn" onClick={handleFitToScreen} title="Ajustar lienzo al monitor">
 Ajustar
 </button>
 <button type="button" className="ge-zoom-btn" onClick={() => setZoom(1)} title="Tamaño real 100%">
 1:1
 </button>
 </div>

 {/* Contenedor físico escalado para flexbox sin compresión */}
 <div
 className="ge-canvas-container"
 style={{
 width: Math.round(project.width * zoom),
 height: Math.round(project.height * zoom),
 position: 'relative',
 flexShrink: 0,
 margin: 'auto'
 }}
 >
 {/* Lienzo con escalado CSS y dimensiones nativas */}
 <div
 className="ge-canvas-stage"
 style={{
 width: project.width,
 height: project.height,
 transform: `scale(${zoom})`,
 transformOrigin: '0 0',
 position: 'absolute',
 top: 0,
 left: 0,
 flexShrink: 0,
 backgroundColor: project.backgroundColor,
 backgroundImage: project.backgroundImage
 ? `url(${project.backgroundImage})`
 : project.backgroundGradient,
 backgroundSize: project.backgroundImageFit || 'cover',
 backgroundPosition: 'center',
 backgroundRepeat: 'no-repeat'
 }}
 onClick={(e) => {
 if (e.target === e.currentTarget) {
 setSelectedLayerId(null)
 setEditingTextId(null)
 }
 }}
 onContextMenu={(e) => e.preventDefault()}
 >
 {project.layers.map((layer) => {
 if (!layer.visible) return null
 const isSelected = layer.id === selectedLayerId
 const isEditingThisText = editingTextId === layer.id
 const { x, y, width, height, rotation, opacity } = layer.transform

 return (
 <div
 key={layer.id}
 className={`ge-layer-element${isSelected ? ' ge-layer-element--selected' : ''}`}
 style={{
 left: x,
 top: y,
 width,
 height,
 transform: rotation ? `rotate(${rotation}deg)` : undefined,
 opacity
 }}
 onMouseDown={(e) => {
 if (!isEditingThisText) {
 handlePointerDownLayer(e, layer)
 }
 }}
 >
 {/* Contenido según tipo */}
 {layer.kind === 'rect' && layer.shapeProps && (
 <div
 style={{
 width: '100%',
 height: '100%',
 backgroundColor: layer.shapeProps.fillColor,
 border: `${layer.shapeProps.strokeWidth}px solid ${layer.shapeProps.strokeColor}`,
 borderRadius: layer.shapeProps.borderRadius,
 boxSizing: 'border-box'
 }}
 />
 )}

 {layer.kind === 'circle' && layer.shapeProps && (
 <div
 style={{
 width: '100%',
 height: '100%',
 backgroundColor: layer.shapeProps.fillColor,
 border: `${layer.shapeProps.strokeWidth}px solid ${layer.shapeProps.strokeColor}`,
 borderRadius: '50%',
 boxSizing: 'border-box'
 }}
 />
 )}

 {layer.kind === 'image' && layer.imageProps && (
 <img
 src={layer.imageProps.src}
 alt={layer.name}
 draggable={false}
 onDragStart={(e) => e.preventDefault()}
 style={{
 width: '100%',
 height: '100%',
 objectFit: layer.imageProps.maintainAspectRatio ? 'contain' : 'fill',
 borderRadius: layer.imageProps.borderRadius,
 filter: layer.imageProps.shadowEnabled
 ? `drop-shadow(0px 8px ${layer.imageProps.shadowBlur}px ${layer.imageProps.shadowColor})`
 : undefined,
 display: 'block',
 userSelect: 'none',
 pointerEvents: 'none'
 }}
 />
 )}

 {layer.kind === 'text' && layer.textProps && (
 isEditingThisText ? (
 <textarea
 autoFocus
 className="ge-inline-text-editor"
 value={layer.textProps.text}
 onChange={(e) => updateSelectedTextProps({ text: e.target.value })}
 onBlur={() => setEditingTextId(null)}
 onKeyDown={(e) => {
 if (e.key === 'Escape') {
 setEditingTextId(null)
 }
 }}
 onMouseDown={(e) => e.stopPropagation()}
 style={{
 width: '100%',
 height: '100%',
 fontFamily: layer.textProps.fontFamily,
 fontSize: `${layer.textProps.fontSize}px`,
 fontWeight: layer.textProps.fontWeight,
 fontStyle: layer.textProps.fontStyle,
 textDecoration: layer.textProps.textDecoration,
 color: layer.textProps.color,
 textAlign: layer.textProps.textAlign,
 lineHeight: layer.textProps.lineHeight,
 letterSpacing: `${layer.textProps.letterSpacing}px`,
 textTransform: layer.textProps.uppercase ? 'uppercase' : 'none',
 background: layer.textProps.bgBoxEnabled ? layer.textProps.bgBoxColor : 'rgba(0, 0, 0, 0.45)',
 border: '2px dashed var(--ok)',
 borderRadius: layer.textProps.bgBoxEnabled ? layer.textProps.bgBoxRadius : 4,
 outline: 'none',
 resize: 'none',
 boxSizing: 'border-box',
 padding: layer.textProps.bgBoxEnabled ? `${layer.textProps.bgBoxPadding}px` : '4px',
 whiteSpace: 'pre-wrap',
 wordBreak: 'break-word',
 overflow: 'hidden',
 cursor: 'text'
 }}
 />
 ) : (
 <div
 onDoubleClick={(e) => {
 e.stopPropagation()
 setEditingTextId(layer.id)
 }}
 title="Doble clic para editar el texto en el lienzo"
 style={{
 width: '100%',
 height: '100%',
 fontFamily: layer.textProps.fontFamily,
 fontSize: `${layer.textProps.fontSize}px`,
 fontWeight: layer.textProps.fontWeight,
 fontStyle: layer.textProps.fontStyle,
 textDecoration: layer.textProps.textDecoration,
 color: layer.textProps.color,
 textAlign: layer.textProps.textAlign,
 lineHeight: layer.textProps.lineHeight,
 letterSpacing: `${layer.textProps.letterSpacing}px`,
 textTransform: layer.textProps.uppercase ? 'uppercase' : 'none',
 textShadow: layer.textProps.shadowEnabled
 ? `${layer.textProps.shadowOffsetX}px ${layer.textProps.shadowOffsetY}px ${layer.textProps.shadowBlur}px ${layer.textProps.shadowColor}`
 : undefined,
 WebkitTextStroke:
 layer.textProps.strokeEnabled && layer.textProps.strokeWidth > 0
 ? `${layer.textProps.strokeWidth}px ${layer.textProps.strokeColor}`
 : undefined,
 backgroundColor: layer.textProps.bgBoxEnabled ? layer.textProps.bgBoxColor : undefined,
 borderRadius: layer.textProps.bgBoxEnabled ? layer.textProps.bgBoxRadius : undefined,
 padding: layer.textProps.bgBoxEnabled ? `${layer.textProps.bgBoxPadding}px` : undefined,
 boxSizing: 'border-box',
 whiteSpace: 'pre-wrap',
 wordBreak: 'break-word',
 overflow: 'visible',
 cursor: 'move'
 }}
 >
 {layer.textProps.text}
 </div>
 )
 )}

 {/* Manivelas de selección y redimensionamiento (8 manivelas para libertad total) */}
 {isSelected && !layer.locked && !isEditingThisText && (
 <>
 {/* 4 Esquinas */}
 <div className="ge-handle ge-handle--nw" onMouseDown={(e) => handlePointerDownHandle(e, 'nw')} />
 <div className="ge-handle ge-handle--ne" onMouseDown={(e) => handlePointerDownHandle(e, 'ne')} />
 <div className="ge-handle ge-handle--se" onMouseDown={(e) => handlePointerDownHandle(e, 'se')} />
 <div className="ge-handle ge-handle--sw" onMouseDown={(e) => handlePointerDownHandle(e, 'sw')} />

 {/* 4 Bordes (para estirar y cambiar dimensiones libremente) */}
 <div className="ge-handle ge-handle--n" onMouseDown={(e) => handlePointerDownHandle(e, 'n')} />
 <div className="ge-handle ge-handle--s" onMouseDown={(e) => handlePointerDownHandle(e, 's')} />
 <div className="ge-handle ge-handle--e" onMouseDown={(e) => handlePointerDownHandle(e, 'e')} />
 <div className="ge-handle ge-handle--w" onMouseDown={(e) => handlePointerDownHandle(e, 'w')} />

 {/* Manivela de rotación */}
 <div className="ge-handle--rot-line" />
 <div className="ge-handle ge-handle--rot" onMouseDown={(e) => handlePointerDownHandle(e, 'rot')} title="Rotar elemento" />
 </>
 )}
 </div>
 )
 })}
 </div>
 </div>
 </main>

 {/* PANEL DERECHO: INSPECTOR DE PROPIEDADES */}
 <aside className="ge-inspector">
 {selectedLayer ? (
 <>
 <div>
 <span className="ge-section-title">Propiedades de Capa</span>
 <div className="ge-form-group">
 <label className="ge-form-label">Nombre</label>
 <input
 type="text"
 className="ge-input"
 value={selectedLayer.name}
 onChange={(e) => updateLayer(selectedLayer.id, { name: e.target.value })}
 />
 </div>
 </div>

 {/* Posición y Dimensiones */}
 <div>
 <span className="ge-section-title">Posición y Tamaño</span>
 <div className="ge-row-2">
 <div className="ge-form-group">
 <label className="ge-form-label">X (px)</label>
 <input
 type="number"
 className="ge-input"
 value={selectedLayer.transform.x}
 onChange={(e) =>
 updateLayer(selectedLayer.id, {
 transform: { ...selectedLayer.transform, x: Number(e.target.value) }
 })
 }
 />
 </div>
 <div className="ge-form-group">
 <label className="ge-form-label">Y (px)</label>
 <input
 type="number"
 className="ge-input"
 value={selectedLayer.transform.y}
 onChange={(e) =>
 updateLayer(selectedLayer.id, {
 transform: { ...selectedLayer.transform, y: Number(e.target.value) }
 })
 }
 />
 </div>
 <div className="ge-form-group">
 <label className="ge-form-label">Ancho</label>
 <input
 type="number"
 className="ge-input"
 value={selectedLayer.transform.width}
 onChange={(e) =>
 updateLayer(selectedLayer.id, {
 transform: { ...selectedLayer.transform, width: Math.max(20, Number(e.target.value)) }
 })
 }
 />
 </div>
 <div className="ge-form-group">
 <label className="ge-form-label">Alto</label>
 <input
 type="number"
 className="ge-input"
 value={selectedLayer.transform.height}
 onChange={(e) =>
 updateLayer(selectedLayer.id, {
 transform: { ...selectedLayer.transform, height: Math.max(20, Number(e.target.value)) }
 })
 }
 />
 </div>
 </div>

 <div className="ge-row-2" style={{ marginTop: 8 }}>
 <div className="ge-form-group">
 <label className="ge-form-label">Rotación ( )</label>
 <input
 type="number"
 min={0}
 max={360}
 className="ge-input"
 value={selectedLayer.transform.rotation}
 onChange={(e) =>
 updateLayer(selectedLayer.id, {
 transform: { ...selectedLayer.transform, rotation: Number(e.target.value) }
 })
 }
 />
 </div>
 <div className="ge-form-group">
 <label className="ge-form-label">Opacidad ({Math.round(selectedLayer.transform.opacity * 100)}%)</label>
 <input
 type="range"
 min={0}
 max={1}
 step={0.05}
 value={selectedLayer.transform.opacity}
 onChange={(e) =>
 updateLayer(selectedLayer.id, {
 transform: { ...selectedLayer.transform, opacity: Number(e.target.value) }
 })
 }
 />
 </div>
 </div>
 </div>

 {/* PROPIEDADES DE TEXTO */}
 {selectedLayer.kind === 'text' && selectedLayer.textProps && (
 <>
 <div>
 <span className="ge-section-title">Contenido del Texto</span>
 <textarea
 rows={4}
 className="ge-textarea"
 value={selectedLayer.textProps.text}
 onChange={(e) => updateSelectedTextProps({ text: e.target.value })}
 />
 </div>

 <div>
 <span className="ge-section-title">Tipografía</span>
 <div className="ge-form-group">
 <label className="ge-form-label">Fuente</label>
 <select
 className="ge-select"
 value={selectedLayer.textProps.fontFamily}
 onChange={(e) => updateSelectedTextProps({ fontFamily: e.target.value })}
 >
 {AVAILABLE_FONTS.map((f) => (
 <option key={f.value} value={f.value}>
 {f.label}
 </option>
 ))}
 </select>
 </div>

 <div className="ge-row-2" style={{ marginTop: 8 }}>
 <div className="ge-form-group">
 <label className="ge-form-label">Tamaño ({selectedLayer.textProps.fontSize}px)</label>
 <input
 type="number"
 min={10}
 max={260}
 className="ge-input"
 value={selectedLayer.textProps.fontSize}
 onChange={(e) => updateSelectedTextProps({ fontSize: Number(e.target.value) })}
 />
 </div>
 <div className="ge-form-group">
 <label className="ge-form-label">Peso</label>
 <select
 className="ge-select"
 value={selectedLayer.textProps.fontWeight}
 onChange={(e) =>
 updateSelectedTextProps({
 fontWeight: e.target.value as GraphicTextProperties['fontWeight']
 })
 }
 >
 <option value="300">Delgada (300)</option>
 <option value="400">Regular (400)</option>
 <option value="600">Seminegrita (600)</option>
 <option value="700">Negrita (700)</option>
 <option value="800">Extra Negrita (800)</option>
 <option value="900">Black (900)</option>
 </select>
 </div>
 </div>

 {/* Color y Estilos de Fuente */}
 <div className="ge-row-2" style={{ marginTop: 8 }}>
 <div className="ge-form-group">
 <label className="ge-form-label">Color de Texto</label>
 <div className="ge-color-field">
 <input
 type="color"
 className="ge-color-input"
 value={selectedLayer.textProps.color}
 onChange={(e) => updateSelectedTextProps({ color: e.target.value })}
 />
 <input
 type="text"
 className="ge-input"
 value={selectedLayer.textProps.color}
 onChange={(e) => updateSelectedTextProps({ color: e.target.value })}
 />
 </div>
 </div>

 <div className="ge-form-group">
 <label className="ge-form-label">Alineación</label>
 <div className="ge-btn-group">
 <button
 type="button"
 className={`ge-btn-group__item${selectedLayer.textProps.textAlign === 'left' ? ' ge-btn-group__item--active' : ''}`}
 onClick={() => updateSelectedTextProps({ textAlign: 'left' })}
 >
 Izq
 </button>
 <button
 type="button"
 className={`ge-btn-group__item${selectedLayer.textProps.textAlign === 'center' ? ' ge-btn-group__item--active' : ''}`}
 onClick={() => updateSelectedTextProps({ textAlign: 'center' })}
 >
 Cen
 </button>
 <button
 type="button"
 className={`ge-btn-group__item${selectedLayer.textProps.textAlign === 'right' ? ' ge-btn-group__item--active' : ''}`}
 onClick={() => updateSelectedTextProps({ textAlign: 'right' })}
 >
 Der
 </button>
 </div>
 </div>
 </div>

 <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
 <label className="ge-checkbox-label">
 <input
 type="checkbox"
 checked={selectedLayer.textProps.fontStyle === 'italic'}
 onChange={(e) =>
 updateSelectedTextProps({
 fontStyle: e.target.checked ? 'italic' : 'normal'
 })
 }
 />
 <span>Cursiva (I)</span>
 </label>
 <label className="ge-checkbox-label">
 <input
 type="checkbox"
 checked={selectedLayer.textProps.uppercase}
 onChange={(e) => updateSelectedTextProps({ uppercase: e.target.checked })}
 />
 <span>MAYÚSCULAS</span>
 </label>
 </div>
 </div>

 {/* Sombra de Texto */}
 <div>
 <span className="ge-section-title">Sombra de Texto</span>
 <label className="ge-checkbox-label" style={{ marginBottom: 8 }}>
 <input
 type="checkbox"
 checked={selectedLayer.textProps.shadowEnabled}
 onChange={(e) => updateSelectedTextProps({ shadowEnabled: e.target.checked })}
 />
 <span>Activar sombra (mejora legibilidad sobre fotos)</span>
 </label>

 {selectedLayer.textProps.shadowEnabled && (
 <div className="ge-row-2">
 <div className="ge-form-group">
 <label className="ge-form-label">Desenfoque ({selectedLayer.textProps.shadowBlur}px)</label>
 <input
 type="range"
 min={0}
 max={32}
 value={selectedLayer.textProps.shadowBlur}
 onChange={(e) => updateSelectedTextProps({ shadowBlur: Number(e.target.value) })}
 />
 </div>
 <div className="ge-form-group">
 <label className="ge-form-label">Color de Sombra</label>
 <input
 type="color"
 className="ge-color-input"
 value={selectedLayer.textProps.shadowColor.startsWith('#') ? selectedLayer.textProps.shadowColor : '#000000'}
 onChange={(e) => updateSelectedTextProps({ shadowColor: e.target.value })}
 />
 </div>
 </div>
 )}
 </div>

 {/* Caja de Fondo Decorativa */}
 <div>
 <span className="ge-section-title">Caja de Fondo de Texto</span>
 <label className="ge-checkbox-label" style={{ marginBottom: 8 }}>
 <input
 type="checkbox"
 checked={selectedLayer.textProps.bgBoxEnabled}
 onChange={(e) => updateSelectedTextProps({ bgBoxEnabled: e.target.checked })}
 />
 <span>Activar caja de realce detrás del texto</span>
 </label>

 {selectedLayer.textProps.bgBoxEnabled && (
 <div className="ge-row-2">
 <div className="ge-form-group">
 <label className="ge-form-label">Color de Caja</label>
 <input
 type="color"
 className="ge-color-input"
 value={selectedLayer.textProps.bgBoxColor.startsWith('#') ? selectedLayer.textProps.bgBoxColor : '#0f172a'}
 onChange={(e) => updateSelectedTextProps({ bgBoxColor: e.target.value })}
 />
 </div>
 <div className="ge-form-group">
 <label className="ge-form-label">Relleno / Padding</label>
 <input
 type="number"
 min={4}
 max={50}
 className="ge-input"
 value={selectedLayer.textProps.bgBoxPadding}
 onChange={(e) => updateSelectedTextProps({ bgBoxPadding: Number(e.target.value) })}
 />
 </div>
 </div>
 )}
 </div>
 </>
 )}

 {/* PROPIEDADES DE IMAGEN */}
 {selectedLayer.kind === 'image' && selectedLayer.imageProps && (
 <div>
 <span className="ge-section-title">Opciones de Fotografía</span>
 <input
 ref={replaceImageInputRef}
 type="file"
 accept="image/*"
 style={{ display: 'none' }}
 onChange={handleReplaceImageFileSelect}
 />
 <button
 type="button"
 className="ge-topbar__btn"
 style={{ width: '100%', marginBottom: 10 }}
 onClick={() => replaceImageInputRef.current?.click()}
 >
 🔄 Reemplazar Fotografía
 </button>

 <div className="ge-form-group">
 <label className="ge-form-label">Redondeo de Esquinas ({selectedLayer.imageProps.borderRadius}px)</label>
 <input
 type="range"
 min={0}
 max={120}
 value={selectedLayer.imageProps.borderRadius}
 onChange={(e) => updateSelectedImageProps({ borderRadius: Number(e.target.value) })}
 />
 </div>

 <label className="ge-checkbox-label" style={{ marginTop: 8 }}>
 <input
 type="checkbox"
 checked={selectedLayer.imageProps.maintainAspectRatio}
 onChange={(e) => updateSelectedImageProps({ maintainAspectRatio: e.target.checked })}
 />
 <span>Bloquear proporción original</span>
 </label>

 <label className="ge-checkbox-label" style={{ marginTop: 8 }}>
 <input
 type="checkbox"
 checked={selectedLayer.imageProps.shadowEnabled}
 onChange={(e) => updateSelectedImageProps({ shadowEnabled: e.target.checked })}
 />
 <span>Sombra suave en la foto</span>
 </label>
 </div>
 )}

 {/* PROPIEDADES DE FORMA */}
 {(selectedLayer.kind === 'rect' || selectedLayer.kind === 'circle') && selectedLayer.shapeProps && (
 <div>
 <span className="ge-section-title">Colores de Forma</span>
 <div className="ge-row-2">
 <div className="ge-form-group">
 <label className="ge-form-label">Relleno</label>
 <input
 type="color"
 className="ge-color-input"
 value={selectedLayer.shapeProps.fillColor.startsWith('#') ? selectedLayer.shapeProps.fillColor : '#1e293b'}
 onChange={(e) => updateSelectedShapeProps({ fillColor: e.target.value })}
 />
 </div>
 <div className="ge-form-group">
 <label className="ge-form-label">Borde</label>
 <input
 type="color"
 className="ge-color-input"
 value={selectedLayer.shapeProps.strokeColor.startsWith('#') ? selectedLayer.shapeProps.strokeColor : '#f59e0b'}
 onChange={(e) => updateSelectedShapeProps({ strokeColor: e.target.value })}
 />
 </div>
 </div>
 </div>
 )}
 </>
 ) : (
 <div>
 <span className="ge-section-title">Ajustes del Lienzo</span>
 <div className="ge-form-group">
 <label className="ge-form-label">Formato del Diseño</label>
 <select
 className="ge-select"
 value={
 CANVAS_PRESETS.find(
 (p) => p.width === project.width && p.height === project.height
 )?.id ?? 'custom'
 }
 onChange={(e) => {
 const found = CANVAS_PRESETS.find((p) => p.id === e.target.value)
 if (found) {
 updateProject((prev) => ({
 ...prev,
 width: found.width,
 height: found.height
 }))
 }
 }}
 >
 {CANVAS_PRESETS.map((preset) => (
 <option key={preset.id} value={preset.id}>
 {preset.aspectRatio} — {preset.label} ({preset.width} {preset.height})
 </option>
 ))}
 {!CANVAS_PRESETS.some(
 (p) => p.width === project.width && p.height === project.height
 ) && (
 <option value="custom">
 Personalizado ({project.width} {project.height})
 </option>
 )}
 </select>
 </div>

 <div className="ge-form-group" style={{ marginTop: 12 }}>
 <label className="ge-form-label">Color de Fondo</label>
 <div className="ge-color-field">
 <input
 type="color"
 className="ge-color-input"
 value={project.backgroundColor}
 onChange={(e) =>
 updateProject((prev) => {
 const next: GraphicDesignProject = {
 ...prev,
 backgroundColor: e.target.value
 }
 delete next.backgroundGradient
 return next
 })
 }
 />
 <input
 type="text"
 className="ge-input"
 value={project.backgroundColor}
 onChange={(e) => updateProject((prev) => ({ ...prev, backgroundColor: e.target.value }))}
 />
 </div>
 </div>

 <div className="ge-form-group" style={{ marginTop: 12 }}>
 <label className="ge-form-label">Imagen de Fondo del Lienzo</label>
 <input
 ref={bgImageInputRef}
 type="file"
 accept="image/png,image/jpeg,image/webp,image/svg+xml"
 style={{ display: 'none' }}
 onChange={handleBgImageFileSelect}
 />
 <button
 type="button"
 className="ge-topbar__btn"
 style={{ width: '100%', marginBottom: 8, justifyContent: 'center' }}
 onClick={() => bgImageInputRef.current?.click()}
 title="Seleccionar una imagen o foto desde tu computador para el fondo"
 >
 🖼 Elegir Imagen de Fondo
 </button>

 {project.backgroundImage && (
 <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
 <div
 style={{
 display: 'flex',
 alignItems: 'center',
 gap: 8,
 background: 'rgba(255,255,255,0.04)',
 padding: 6,
 borderRadius: 6,
 border: '1px solid rgba(255,255,255,0.08)'
 }}
 >
 <img
 src={project.backgroundImage}
 alt="Miniatura fondo"
 style={{
 width: 44,
 height: 44,
 objectFit: 'cover',
 borderRadius: 4,
 border: '1px solid rgba(255,255,255,0.15)'
 }}
 />
 <div style={{ flex: 1, minWidth: 0 }}>
 <span
 style={{
 fontSize: 11,
 color: '#e2e8f0',
 display: 'block',
 fontWeight: 600,
 overflow: 'hidden',
 textOverflow: 'ellipsis',
 whiteSpace: 'nowrap'
 }}
 >
 Fondo Activo
 </span>
 <span style={{ fontSize: 10, color: '#94a3b8' }}>
 Ajuste: {project.backgroundImageFit || 'cover'}
 </span>
 </div>
 <button
 type="button"
 className="ge-icon-action"
 style={{ color: '#ef4444' }}
 title="Quitar imagen de fondo"
 onClick={() =>
 updateProject((prev) => {
 const next = { ...prev }
 delete next.backgroundImage
 return next
 })
 }
 >
 ✕
 </button>
 </div>

 <div className="ge-form-group">
 <label className="ge-form-label" style={{ fontSize: 11 }}>Ajuste de la Imagen</label>
 <select
 className="ge-select"
 value={project.backgroundImageFit || 'cover'}
 onChange={(e) =>
 updateProject((prev) => ({
 ...prev,
 backgroundImageFit: e.target.value as 'cover' | 'contain' | 'fill'
 }))
 }
 >
 <option value="cover">Llenar / Cubrir lienzo (Cover)</option>
 <option value="contain">Ajustar completa (Contain)</option>
 <option value="fill">Estirar a los bordes (Fill)</option>
 </select>
 </div>
 </div>
 )}
 </div>

 <div className="ge-form-group" style={{ marginTop: 12 }}>
 <label className="ge-form-label">Degradados Predeterminados</label>
 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginTop: 4 }}>
 <button
 type="button"
 className="ge-topbar__btn"
 style={{ fontSize: 11 }}
 onClick={() =>
 updateProject((prev) => ({
 ...prev,
 backgroundColor: '#090d16',
 backgroundGradient: 'radial-gradient(circle at 80% 20%, #1e293b 0%, #090d16 85%)'
 }))
 }
 >
 🌌 Noche Azul
 </button>
 <button
 type="button"
 className="ge-topbar__btn"
 style={{ fontSize: 11 }}
 onClick={() =>
 updateProject((prev) => ({
 ...prev,
 backgroundColor: '#021a14',
 backgroundGradient: 'radial-gradient(circle at 50% 50%, #064e3b 0%, #021a14 100%)'
 }))
 }
 >
 🌲 Esmeralda
 </button>
 <button
 type="button"
 className="ge-topbar__btn"
 style={{ fontSize: 11 }}
 onClick={() =>
 updateProject((prev) => ({
 ...prev,
 backgroundColor: '#18181b',
 backgroundGradient: 'linear-gradient(135deg, #27272a 0%, #09090b 100%)'
 }))
 }
 >
 🌑 Carbón
 </button>
 <button
 type="button"
 className="ge-topbar__btn"
 style={{ fontSize: 11 }}
 onClick={() =>
 updateProject((prev) => ({
 ...prev,
 backgroundColor: '#1e1b4b',
 backgroundGradient: 'linear-gradient(135deg, #312e81 0%, #0f172a 100%)'
 }))
 }
 >
 ✨ Púrpura
 </button>
 </div>
 </div>

 <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, marginTop: 16 }}>
 <p style={{ margin: 0, fontSize: 11.5, color: '#a1a1aa', lineHeight: 1.4 }}>
 💡 <strong>Consejo:</strong> Haz clic en cualquier elemento del lienzo para editar su posición, tipografía, sombra o color. Puedes moverlo arrastrándolo libremente con el ratón.
 </p>
 </div>
 </div>
 )}
 </aside>
 </div>

 {/* MODAL DE EXPORTACIÓN */}
 {exportModalOpen && (
 <div className="ge-modal-overlay" onClick={() => setExportModalOpen(false)}>
 <div className="ge-modal-box" onClick={(e) => e.stopPropagation()}>
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
 <h3 style={{ margin: 0, fontSize: 17, color: '#fff' }}>Exportar Diseño Final</h3>
 <button
 type="button"
 className="ge-icon-action"
 style={{ fontSize: 18 }}
 onClick={() => setExportModalOpen(false)}
 >
 ✕
 </button>
 </div>

 <div style={{ fontSize: 13, color: '#cbd5e1' }}>
 {exportFormat === 'lumen' ? (
 <>
 Archivo editable <strong style={{ color: '#f59e0b' }}>.lumen</strong> (JSON) — puedes
 reabrirlo en el editor más adelante.
 </>
 ) : (
 <>
 Resolución real de salida:{' '}
 <strong style={{ color: '#f59e0b' }}>
 {project.width} {project.height} px
 </strong>{' '}
 (Calidad 100% sin controles ni guías)
 </>
 )}
 </div>

 <div className="ge-form-group">
 <label className="ge-form-label">Formato de salida</label>
 <div className="ge-btn-group">
 <button
 type="button"
 className={`ge-btn-group__item${exportFormat === 'png' ? ' ge-btn-group__item--active' : ''}`}
 onClick={() => setExportFormat('png')}
 >
 PNG (Máxima calidad)
 </button>
 <button
 type="button"
 className={`ge-btn-group__item${exportFormat === 'jpeg' ? ' ge-btn-group__item--active' : ''}`}
 onClick={() => setExportFormat('jpeg')}
 >
 JPG / JPEG
 </button>
 <button
 type="button"
 className={`ge-btn-group__item${exportFormat === 'webp' ? ' ge-btn-group__item--active' : ''}`}
 onClick={() => setExportFormat('webp')}
 >
 WebP (Ligero)
 </button>
 <button
 type="button"
 className={`ge-btn-group__item${exportFormat === 'lumen' ? ' ge-btn-group__item--active' : ''}`}
 onClick={() => setExportFormat('lumen')}
 title="Proyecto editable para reabrir en el editor"
 >
 LUMEN (Editable)
 </button>
 </div>
 </div>

 {exportFormat !== 'png' && exportFormat !== 'lumen' && (
 <div className="ge-form-group">
 <label className="ge-form-label">Calidad de compresión ({Math.round(exportQuality * 100)}%)</label>
 <input
 type="range"
 min={0.6}
 max={1}
 step={0.05}
 value={exportQuality}
 onChange={(e) => setExportQuality(Number(e.target.value))}
 />
 </div>
 )}

 {exportSuccessMsg && (
 <div style={{ padding: '8px 12px', background: '#064e3b', color: '#6ee7b7', borderRadius: 6, fontSize: 12 }}>
 ✓ {exportSuccessMsg}
 </div>
 )}

 <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
 <button
 type="button"
 className="ge-topbar__btn ge-topbar__btn--primary"
 style={{ padding: '10px 14px', justifyContent: 'center' }}
 disabled={exportingBusy}
 onClick={() => void handleExportDownload()}
 >
 📥 Descargar Archivo ({exportFormat === 'lumen' ? 'LUMEN' : exportFormat.toUpperCase()})
 </button>

 <button
 type="button"
 className="ge-topbar__btn"
 style={{ padding: '10px 14px', justifyContent: 'center' }}
 disabled={exportingBusy}
 onClick={() => void handleSaveToWorshipMedia()}
 >
 🖼 Guardar en Galería "Imágenes del Culto"
 </button>
 </div>
 </div>
 </div>
 )}
 </section>
 )
}
