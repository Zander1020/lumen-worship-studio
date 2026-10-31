/**
 * Secciones del menú lateral de la ventana principal.
 */

export type SectionId =
  | 'home'
  | 'songs'
  | 'bible'
  | 'media'
  | 'design'
  | 'projection'
  | 'remote'
  | 'ai'
  | 'settings'
  | 'about'

export interface SectionDefinition {
  id: SectionId
  label: string
  /** Símbolo corto usado como icono (sin dependencias de iconos externas). */
  icon: string
  description: string
  /** Agrupación visual estilo Holyrics: pestaña principal de operación vs herramienta compacta de sistema. */
  group: 'primary' | 'utility'
}

export const SECTIONS: readonly SectionDefinition[] = [
  { id: 'home', label: 'Inicio', icon: '⌂', description: 'Mesa central de operación todo-en-uno.', group: 'primary' },
  { id: 'songs', label: 'Alabanzas', icon: '♪', description: 'Biblioteca de canciones y catálogo de alabanzas.', group: 'primary' },
  { id: 'bible', label: 'Biblia', icon: '✝', description: 'Búsqueda y proyección de los 66 libros bíblicos.', group: 'primary' },
  { id: 'media', label: 'Imágenes', icon: '🖼', description: 'Imágenes del culto, proyección a pantalla completa y fondos.', group: 'primary' },
  { id: 'design', label: 'Editor Gráfico', icon: '🎨', description: 'Creación visual de frases, predicadores y anuncios.', group: 'primary' },
  { id: 'projection', label: 'Proyección', icon: '▣', description: 'Ajustes avanzados de pantalla y calibración.', group: 'utility' },
  { id: 'remote', label: 'Control remoto', icon: '📱', description: 'Control móvil en red local LAN.', group: 'utility' },
  { id: 'ai', label: 'Inteligencia artificial', icon: '✦', description: 'Sugeridor temático local de culto.', group: 'utility' },
  { id: 'settings', label: 'Configuración', icon: '⚙', description: 'Preferencias generales del sistema.', group: 'utility' },
  { id: 'about', label: 'Acerca de', icon: 'ℹ', description: 'Información de la aplicación y su creador Alexander Yepez.', group: 'utility' }
] as const

export const DEFAULT_SECTION: SectionId = 'home'

export function isSectionId(value: unknown): value is SectionId {
  return typeof value === 'string' && SECTIONS.some((s) => s.id === value)
}
