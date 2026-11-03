export interface ChangelogRelease {
  version: string
  date: string
  title: string
  tagline: string
  highlights: string[]
}

export const APP_CHANGELOG: ChangelogRelease[] = [
  {
    version: '0.1.17',
    date: '3 de Noviembre de 2026',
    title: 'IA Pastoral 100% Gratuita e Integrada Out-of-the-Box',
    tagline: 'Inteligencia artificial lista para usar desde el primer segundo: sin cuentas, sin claves, sin Ollama y con triple capa de respaldo.',
    highlights: [
      '🟢 IA 100% Gratuita y Automática: completamente integrada de fábrica. No requiere registro, ni claves API, ni instalar Ollama, ni configurar nada.',
      '⚡ Velocidad Extrema (<1.5s): motor primario con LLM7 optimizado para respuestas en tiempo real con streaming fluido y sin bloqueos de tiempo.',
      '🛡️ Arquitectura Multi-Capa con Auto-Failover: si la conexión principal tiene demoras, conmuta automáticamente a Pollinations.ai sin interrumpir la experiencia.',
      '📖 Garantía 100% Offline: generador pastoral y teológico local de 0ms con bosquejos homiléticos (RVR1960), orden de culto, oraciones y alabanzas que funciona incluso sin internet.',
      '🧹 Barra Superior Despejada: interfaz limpia y estilizada sin buscador bíblico en la cabecera, enfocada en la adoración y la liturgia.',
      '⚙️ Opciones Avanzadas Opcionales: los usuarios avanzados pueden conectar sus propias claves (Gemini, Groq, OpenAI) si lo desean, pero nunca es obligatorio.'
    ]
  },
  {
    version: '0.1.16',
    date: '3 de Noviembre de 2026',
    title: 'Potenciación Extrema de Inteligencia Artificial y Limpieza de Barra Superior',
    tagline: 'Motor de IA multimodelo ultrarrápido con soporte para Google Gemini y Groq, prompt pastoral experto, proyección con un clic y barra superior limpia.',
    highlights: [
      '🧹 Barra Superior Limpia: Retiro completo del buscador rápido bíblico en la barra superior para una interfaz más despejada, elegante y enfocada.',
      '⚡ Motor de IA Multimodelo Ultrarrápido: Soporte completo para Google Gemini Flash (<0.4s) y Groq Cloud (500 tokens/seg con Llama 3.3 70B) con claves API 100% gratuitas.',
      '✝️ Prompt Teológico y Pastoral Experto: Respuestas de alta calidad basadas en la Biblia (Reina-Valera 1960), cálidas, estructuradas y directas para pastores, líderes de alabanza y predicadores.',
      '🎯 Acciones Rápidas con 1 Clic: Chips para generar al instante versículos por tema, bosquejos homiléticos de 3 puntos, cronograma y orden de culto, repertorios de alabanza y oraciones pastorales.',
      '📺 Proyección Directa a Pantalla: Botón para enviar diapositivas generadas por la IA directamente a la pantalla de proyección en vivo con un solo clic.',
      '📋 Copiado Rápido al Portapapeles: Copia instantánea de cualquier respuesta o versículo de la IA con confirmación visual.',
      '⚙️ Modal de Configuración de IA: Ajusta fácilmente tu proveedor favorito (Gratuito, Gemini, Groq, OpenAI, DeepSeek, OpenRouter u Ollama local offline) y tus claves.'
    ]
  },
  {
    version: '0.1.15',
    date: '3 de Noviembre de 2026',
    title: 'Optimización de Descarga de YouTube, Rendimiento y Control Remoto Ultrarrápido',
    tagline: 'Corrección de pegado y miniaturas de YouTube, bypass de verificación de bot y respuesta instantánea del control remoto móvil.',
    highlights: [
      '📋 Pegado Seguro y Menú Contextual: menú contextual nativo con clic derecho (Deshacer, Cortar, Copiar, Pegar, Seleccionar todo) y botón Pegar 100% funcional con portapapeles de Windows.',
      '🖼️ Miniaturas de YouTube Visibles: corrección completa de Content Security Policy (CSP) para renderizar carátulas oficiales de YouTube de inmediato al pegar cualquier enlace.',
      '🛡️ Bypass de Detección de Bot en YouTube: integración de clientes móviles y resolución automática de retos de JavaScript para descargar vídeos sin bloqueos ni requerir inicio de sesión.',
      '⚡ Control Remoto Ultrarrápido: desactivación del algoritmo de Nagle (TCP_NODELAY) y reconexión inmediata al reanudar el teléfono móvil, eliminando cualquier retraso en la proyección.',
      '🚀 Alto Rendimiento en PCs de Bajos Recursos: rasterización por GPU, copia cero de memoria y prevención de congelamientos en segundo plano para una reproducción fluida.',
      '🔍 Mensajes de Error Claros y Amigables: avisos claros cuando un vídeo es privado, eliminado o inexistente en YouTube.'
    ]
  },
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

