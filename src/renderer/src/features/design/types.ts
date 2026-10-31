export type GraphicLayerKind = 'text' | 'image' | 'rect' | 'circle' | 'line'

export interface GraphicTransform {
  x: number // Posición horizontal en píxeles del lienzo real
  y: number // Posición vertical en píxeles del lienzo real
  width: number
  height: number
  rotation: number // Grados (0 - 360)
  opacity: number // 0 a 1
}

export interface GraphicTextProperties {
  text: string
  fontFamily: string
  fontSize: number
  fontWeight: '300' | '400' | '600' | '700' | '800' | '900'
  fontStyle: 'normal' | 'italic'
  textDecoration: 'none' | 'underline'
  color: string
  textAlign: 'left' | 'center' | 'right' | 'justify'
  lineHeight: number // 0.9 a 2.5
  letterSpacing: number // -2 a 20 px
  uppercase: boolean

  // Sombra de texto para alta legibilidad sobre fotos
  shadowEnabled: boolean
  shadowColor: string
  shadowBlur: number
  shadowOffsetX: number
  shadowOffsetY: number

  // Contorno reforzado
  strokeEnabled: boolean
  strokeColor: string
  strokeWidth: number

  // Caja de fondo decorativa de realce para predicadores / citas
  bgBoxEnabled: boolean
  bgBoxColor: string
  bgBoxOpacity: number
  bgBoxPadding: number
  bgBoxRadius: number
}

export interface GraphicImageProperties {
  src: string // Data URL / base64
  name?: string | undefined
  originalWidth: number
  originalHeight: number
  maintainAspectRatio: boolean
  borderRadius: number
  shadowEnabled: boolean
  shadowColor: string
  shadowBlur: number
}

export interface GraphicShapeProperties {
  fillColor: string
  strokeColor: string
  strokeWidth: number
  borderRadius: number // para rectángulos
}

export interface GraphicLayer {
  id: string
  name: string
  kind: GraphicLayerKind
  visible: boolean
  locked: boolean
  transform: GraphicTransform
  textProps?: GraphicTextProperties | undefined
  imageProps?: GraphicImageProperties | undefined
  shapeProps?: GraphicShapeProperties | undefined
}

export interface CanvasPreset {
  id: string
  label: string
  width: number
  height: number
  aspectRatio: string
  description: string
  icon: string
}

export interface GraphicDesignProject {
  version: 1
  id: string
  name: string
  createdAt: string
  updatedAt: string
  width: number
  height: number
  backgroundColor: string
  backgroundGradient?: string | undefined
  backgroundImage?: string | undefined
  backgroundImageFit?: 'cover' | 'contain' | 'fill' | undefined
  layers: GraphicLayer[]
}

export const CANVAS_PRESETS: readonly CanvasPreset[] = [
  {
    id: 'post-square',
    label: 'Publicación Cuadrada',
    width: 1080,
    height: 1080,
    aspectRatio: '1:1',
    description: 'Instagram y Facebook Feed',
    icon: '⏹'
  },
  {
    id: 'post-portrait',
    label: 'Publicación Vertical (4:5)',
    width: 1080,
    height: 1350,
    aspectRatio: '4:5',
    description: 'Feed vertical con máxima visibilidad',
    icon: '▯'
  },
  {
    id: 'story-vertical',
    label: 'Historia / Estado (9:16)',
    width: 1080,
    height: 1920,
    aspectRatio: '9:16',
    description: 'WhatsApp Status, Instagram Stories, Reels',
    icon: '📱'
  },
  {
    id: 'presentation-hdtv',
    label: 'Presentación Culto (16:9)',
    width: 1920,
    height: 1080,
    aspectRatio: '16:9',
    description: 'Proyector del templo, Pantallas LED y TV',
    icon: '📺'
  },
  {
    id: 'broadcast-hd',
    label: 'Miniatura / OBS (16:9)',
    width: 1280,
    height: 720,
    aspectRatio: '16:9',
    description: 'YouTube y streaming',
    icon: '🖥'
  }
] as const

export const AVAILABLE_FONTS = [
  { label: 'Montserrat (Moderna y Clara)', value: 'Montserrat, system-ui, sans-serif' },
  { label: 'Playfair Display (Elegante Clásica)', value: '"Playfair Display", Georgia, serif' },
  { label: 'Cinzel (Solemne / Bíblica)', value: 'Cinzel, Georgia, serif' },
  { label: 'Impact (Contundente / Titulares)', value: 'Impact, "Arial Black", sans-serif' },
  { label: 'Oswald (Condensada Fuerte)', value: 'Oswald, "Arial Narrow", sans-serif' },
  { label: 'Georgia (Editorial Tradicional)', value: 'Georgia, serif' },
  { label: 'Segoe UI (Sistema Windows)', value: '"Segoe UI", system-ui, sans-serif' },
  { label: 'Arial (Neutro Universal)', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Times New Roman (Formal)', value: '"Times New Roman", serif' }
] as const
