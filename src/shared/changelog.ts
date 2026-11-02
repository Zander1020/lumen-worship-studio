export interface ChangelogRelease {
  version: string
  date: string
  title: string
  tagline: string
  highlights: string[]
}

export const APP_CHANGELOG: ChangelogRelease[] = [
  {
    version: '0.1.14',
    date: '2 de Noviembre de 2026',
    title: 'Descarga Directa de Vídeos de YouTube en Medios',
    tagline: 'Agrega cualquier vídeo o fondo desde YouTube pegando el enlace directamente en la aplicación.',
    highlights: [
      '▶ Descarga Directa de YouTube: pega un enlace de YouTube, Shorts o Compartir y descárgalo directamente a la carpeta de Medios.',
      '⚡ Detección Instantánea de Título y Miniatura: vista previa automática con nombre, canal y carátula del vídeo.',
      '✏ Título y Categoría Personalizables: edita el nombre antes de guardar y selecciona la categoría (Culto, Fondo, Anuncios, etc.).',
      '📊 Progreso en Tiempo Real: barra de descarga con porcentaje, velocidad de transferencia y tiempo estimado.',
      '🛡 Aislamiento Seguro: los vídeos de YouTube van estrictamente a Medios sin interferir con presentaciones o diapositivas.',
      '🎯 Botón Rápido en Inicio y Medios: acceso con un clic a "▶ YouTube" junto al botón de importar.'
    ]
  },
  {
    version: '0.1.13',
    date: '1 de Noviembre de 2026',
    title: 'Ventana de Novedades y Auto-Actualizador Directo',
    tagline: 'Publicación directa de actualizaciones en GitHub Releases y ventana de mejoras post-instalación.',
    highlights: [
      '✨ Ventana de Novedades: ahora al instalar una actualización verás de inmediato las mejoras añadidas al abrir la app.',
      'ℹ Historial en Acerca de: consulta el registro completo de cambios de todas las versiones cuando lo desees.',
      '🚀 Rendimiento GPU y CPU: el motor gráfico entra en reposo automático cuando no hay reproducción activa.',
      '🎬 Miniaturas y Previsualización: soporte completo para ver miniaturas de vídeos y nuevo modal para previsualizar medios.',
      '📱 Control Remoto Inteligente: separación visual de direcciones LAN para conectar teléfonos móviles sin confusiones.',
      '📖 Persistencia Bíblica: la pestaña de la Biblia recuerda tu libro, capítulo, versículo y búsqueda aunque cambies de sección.',
      '💾 Guardado Coalescido: escritura ultrarrápida en segundo plano para evitar micro-pausas durante el culto.'
    ]
  },
  {
    version: '0.1.12',
    date: '1 de Noviembre de 2026',
    title: 'Rendimiento Extremo, Previsualización de Vídeos y Control Remoto Mejorado',
    tagline: 'Optimizaciones de alta eficiencia para cultos y transmisiones en vivo sin interrupciones.',
    highlights: [
      '🚀 Rendimiento GPU y CPU: el motor gráfico entra en reposo automático cuando no hay reproducción activa, ahorrando recursos de tu computador.',
      '🎬 Miniaturas y Previsualización: soporte completo para ver miniaturas de vídeos y un nuevo modal para revisar imágenes y vídeos antes de proyectar.',
      '📱 Control Remoto Inteligente: separación visual de direcciones LAN para conectar teléfonos móviles sin confusiones con localhost.',
      '📖 Persistencia Bíblica: la pestaña de la Biblia ahora recuerda tu libro, capítulo, versículo y búsqueda aunque cambies de sección.',
      '💾 Guardado Coalescido: escritura ultrarrápida en segundo plano para evitar micro-pausas durante el culto.'
    ]
  },
  {
    version: '0.1.11',
    date: '31 de Octubre de 2026',
    title: 'Biblia Multi-Versión e Importación Zefania XML',
    tagline: 'Expansión del catálogo de escrituras y soporte para formatos estándar de la iglesia.',
    highlights: [
      '📖 8 versiones bíblicas clásicas con texto completo incluido (RVR1960, RVR1909, NVI, DHH, LBLA, TLA, NTV, PDT).',
      '📥 Importador de biblias en formato XML Zefania y .xmm de Holyrics.',
      '🎨 Nuevo formato .lumen para proyectos de diseño gráfico editable.'
    ]
  },
  {
    version: '0.1.9',
    date: '31 de Octubre de 2026',
    title: 'Sincronización Física de Diapositivas y Purga de Huérfanos',
    tagline: 'Gestión fiel del almacenamiento de documentos PDF y PowerPoint.',
    highlights: [
      '🔄 Botón Actualizar sincroniza directamente con la carpeta física de diapositivas y purga archivos eliminados.',
      '📁 Copia automática de archivos PowerPoint y PDF al almacenamiento local al importarlos.',
      '🛡️ Aislamiento total: las diapositivas nunca se mezclan con la carpeta de medios.'
    ]
  },
  {
    version: '0.1.8',
    date: '31 de Octubre de 2026',
    title: 'Aislamiento Estricto de Medios y Renderizado HD',
    tagline: 'Separación estricta de documentos y renderizado nítido en Full HD.',
    highlights: [
      '📄 Renderizado HD para presentaciones PowerPoint y documentos PDF.',
      '🗑️ Modal de confirmación estilizado antes de eliminar cualquier elemento.',
      '🔇 Audio silenciado en la previsualización del operador y 100% activo en la pantalla de proyección.'
    ]
  }
]

