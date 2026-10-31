import type {
  AppSettings,
  BackgroundKind,
  BibleChapterRequest,
  HolyricsImportItem,
  MediaBackgroundInput,
  PresentationSlide,
  ProjectionDisplayMode,
  ProjectionGoToSlideRequest,
  ProjectionLoadDeckRequest,
  ProjectionOpenRequest,
  ProjectionSetModeRequest,
  ProjectionTarget,
  ProjectionTheme,
  ScheduleItemInput,
  ScheduleItemKind,
  ScheduleMoveRequest,
  SlideSourceKind,
  SongInput,
  SongStanza,
  StanzaKind
} from './ipc'

/**
 * Validadores puros para las cargas útiles que llegan por IPC.
 * Nunca se confía en los datos enviados desde un renderer: todo se valida
 * en el proceso principal antes de usarse.
 */

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

const PROJECTION_TARGETS: readonly ProjectionTarget[] = ['auto', 'windowed']
const PROJECTION_MODES: readonly ProjectionDisplayMode[] = ['live', 'black', 'clear', 'logo', 'test-pattern']
const STANZA_KINDS: readonly StanzaKind[] = ['verse', 'chorus', 'bridge', 'intro', 'outro', 'custom']
const SLIDE_SOURCE_KINDS: readonly SlideSourceKind[] = ['song', 'bible', 'announcement', 'custom', 'separator']
const SCHEDULE_ITEM_KINDS: readonly ScheduleItemKind[] = ['song', 'bible', 'announcement']
const BACKGROUND_KINDS: readonly BackgroundKind[] = ['gradient', 'solid', 'image', 'video']

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const proto = Object.getPrototypeOf(value) as unknown
  return proto === Object.prototype || proto === null
}

function requireNonEmptyString(value: unknown, field: string, maxLen = 500): string {
  if (typeof value !== 'string') {
    throw new ValidationError(`El campo "${field}" debe ser una cadena de texto.`)
  }
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    throw new ValidationError(`El campo "${field}" no puede estar vacío.`)
  }
  if (trimmed.length > maxLen) {
    throw new ValidationError(`El campo "${field}" supera la longitud máxima (${maxLen}).`)
  }
  return trimmed
}

function optionalString(value: unknown, field: string, maxLen = 500): string {
  if (value === undefined || value === null) return ''
  if (typeof value !== 'string') {
    throw new ValidationError(`El campo "${field}" debe ser una cadena de texto.`)
  }
  const trimmed = value.trim()
  if (trimmed.length > maxLen) {
    throw new ValidationError(`El campo "${field}" supera la longitud máxima (${maxLen}).`)
  }
  return trimmed
}

/**
 * Valida la solicitud de apertura de la proyección.
 * `undefined` se acepta y equivale a `{ target: 'auto' }`.
 */
export function parseProjectionOpenRequest(input: unknown): ProjectionOpenRequest {
  if (input === undefined) return { target: 'auto' }
  if (!isPlainObject(input)) {
    throw new ValidationError('La solicitud de proyección debe ser un objeto.')
  }
  const keys = Object.keys(input)
  const unknownKeys = keys.filter((k) => k !== 'target')
  if (unknownKeys.length > 0) {
    throw new ValidationError(`Campos no permitidos: ${unknownKeys.join(', ')}`)
  }
  const target = input['target'] ?? 'auto'
  if (typeof target !== 'string' || !PROJECTION_TARGETS.includes(target as ProjectionTarget)) {
    throw new ValidationError('El campo "target" debe ser "auto" o "windowed".')
  }
  return { target: target as ProjectionTarget }
}

/** Valida que un canal sin parámetros no reciba datos. */
export function assertNoPayload(input: unknown): void {
  if (input !== undefined) {
    throw new ValidationError('Este canal no acepta parámetros.')
  }
}

export function parseNonEmptyId(input: unknown, field = 'id'): string {
  return requireNonEmptyString(input, field, 120)
}

export function parseRawString(input: unknown, field = 'texto', maxLen = 20_000): string {
  if (typeof input !== 'string') {
    throw new ValidationError(`El campo "${field}" debe ser una cadena de texto.`)
  }
  if (input.length > maxLen) {
    throw new ValidationError(`El campo "${field}" supera el límite de ${maxLen} caracteres.`)
  }
  return input
}

export function parsePresentationSlide(input: unknown): PresentationSlide {
  if (!isPlainObject(input)) {
    throw new ValidationError('La diapositiva debe ser un objeto.')
  }
  const id = requireNonEmptyString(input['id'], 'slide.id', 160)
  const sourceKind = input['sourceKind']
  if (typeof sourceKind !== 'string' || !SLIDE_SOURCE_KINDS.includes(sourceKind as SlideSourceKind)) {
    throw new ValidationError('El campo "slide.sourceKind" no es válido.')
  }
  const sourceTitle = requireNonEmptyString(input['sourceTitle'], 'slide.sourceTitle', 200)
  const label = requireNonEmptyString(input['label'], 'slide.label', 200)
  const footer = optionalString(input['footer'], 'slide.footer', 300)
  const imageUrl = optionalString(input['imageUrl'], 'slide.imageUrl', 150_000_000)
  const rawLines = input['lines']
  if (!Array.isArray(rawLines) || rawLines.length > 20) {
    throw new ValidationError('El campo "slide.lines" debe ser un array de hasta 20 líneas.')
  }
  if (!imageUrl && rawLines.length === 0) {
    throw new ValidationError('La diapositiva debe contener entre 1 y 20 líneas.')
  }
  const lines = rawLines.map((line, i) =>
    typeof line === 'string' && line.trim().length > 0
      ? requireNonEmptyString(line, `slide.lines[${i}]`, 600)
      : ''
  )
  const slide: PresentationSlide = {
    id,
    sourceKind: sourceKind as SlideSourceKind,
    sourceTitle,
    label,
    lines,
    footer
  }
  if (imageUrl) slide.imageUrl = imageUrl
  if (Array.isArray(input['parallelLines'])) {
    slide.parallelLines = (input['parallelLines'] as unknown[])
      .slice(0, 20)
      .map((l, i) => requireNonEmptyString(l, `slide.parallelLines[${i}]`, 600))
  }
  const parallelLabel = optionalString(input['parallelLabel'], 'slide.parallelLabel', 120)
  if (parallelLabel) slide.parallelLabel = parallelLabel
  return slide
}

export function parseProjectionLoadDeckRequest(input: unknown): ProjectionLoadDeckRequest {
  if (!isPlainObject(input)) {
    throw new ValidationError('La solicitud de carga de diapositivas debe ser un objeto.')
  }
  const deckTitle = requireNonEmptyString(input['deckTitle'], 'deckTitle', 200)
  const rawSlides = input['slides']
  if (!Array.isArray(rawSlides) || rawSlides.length === 0 || rawSlides.length > 300) {
    throw new ValidationError('Se requiere entre 1 y 300 diapositivas.')
  }
  const slides = rawSlides.map((s) => parsePresentationSlide(s))
  const startIndex = input['startIndex']
  if (startIndex !== undefined && (typeof startIndex !== 'number' || !Number.isInteger(startIndex) || startIndex < 0)) {
    throw new ValidationError('El índice inicial debe ser un entero mayor o igual a 0.')
  }
  const openWindow = input['openWindow']
  if (openWindow !== undefined && typeof openWindow !== 'boolean') {
    throw new ValidationError('El campo "openWindow" debe ser booleano.')
  }
  const result: ProjectionLoadDeckRequest = { deckTitle, slides }
  if (startIndex !== undefined) result.startIndex = startIndex
  if (openWindow !== undefined) result.openWindow = openWindow
  return result
}

export function parseProjectionGoToSlideRequest(input: unknown): ProjectionGoToSlideRequest {
  if (!isPlainObject(input)) {
    throw new ValidationError('La solicitud de cambio de diapositiva debe ser un objeto.')
  }
  const direction = input['direction']
  const index = input['index']
  if (direction !== undefined && direction !== 'next' && direction !== 'prev') {
    throw new ValidationError('El campo "direction" debe ser "next" o "prev".')
  }
  if (index !== undefined && (typeof index !== 'number' || !Number.isInteger(index) || index < 0)) {
    throw new ValidationError('El campo "index" debe ser un entero mayor o igual a 0.')
  }
  if (direction === undefined && index === undefined) {
    throw new ValidationError('Se debe indicar "direction" o "index".')
  }
  const result: ProjectionGoToSlideRequest = {}
  if (direction !== undefined) result.direction = direction
  if (index !== undefined) result.index = index
  return result
}

export function parseProjectionSetModeRequest(input: unknown): ProjectionSetModeRequest {
  if (!isPlainObject(input)) {
    throw new ValidationError('La solicitud de modo debe ser un objeto.')
  }
  const mode = input['mode']
  if (typeof mode !== 'string' || !PROJECTION_MODES.includes(mode as ProjectionDisplayMode)) {
    throw new ValidationError('Modo de proyección no válido.')
  }
  return { mode: mode as ProjectionDisplayMode }
}

export function parseProjectionThemePatch(input: unknown): Partial<ProjectionTheme> {
  if (!isPlainObject(input)) {
    throw new ValidationError('El parche de tema debe ser un objeto.')
  }
  const patch: Partial<ProjectionTheme> = {}
  if (input['fontFamily'] !== undefined) {
    const ff = input['fontFamily']
    if (ff !== 'sans' && ff !== 'serif' && ff !== 'mono') {
      throw new ValidationError('Fuente no válida.')
    }
    patch.fontFamily = ff
  }
  if (input['fontScale'] !== undefined) {
    const scale = input['fontScale']
    if (typeof scale !== 'number' || scale < 50 || scale > 200) {
      throw new ValidationError('La escala de fuente debe estar entre 50 y 200.')
    }
    patch.fontScale = Math.round(scale)
  }
  if (input['textAlign'] !== undefined) {
    const align = input['textAlign']
    if (align !== 'center' && align !== 'left') {
      throw new ValidationError('Alineación no válida.')
    }
    patch.textAlign = align
  }
  if (input['textShadow'] !== undefined) {
    if (typeof input['textShadow'] !== 'boolean') {
      throw new ValidationError('El campo "textShadow" debe ser booleano.')
    }
    patch.textShadow = input['textShadow']
  }
  if (input['showFooter'] !== undefined) {
    if (typeof input['showFooter'] !== 'boolean') {
      throw new ValidationError('El campo "showFooter" debe ser booleano.')
    }
    patch.showFooter = input['showFooter']
  }
  if (input['verticalAlign'] !== undefined) {
    const va = input['verticalAlign']
    if (va === 'top' || va === 'center' || va === 'bottom') patch.verticalAlign = va
  }
  if (typeof input['uppercase'] === 'boolean') patch.uppercase = input['uppercase']
  if (typeof input['autoFit'] === 'boolean') patch.autoFit = input['autoFit']
  if (typeof input['textStroke'] === 'boolean') patch.textStroke = input['textStroke']
  if (typeof input['textBoxBg'] === 'boolean') patch.textBoxBg = input['textBoxBg']
  if (typeof input['transitionMs'] === 'number' && Number.isFinite(input['transitionMs'])) {
    patch.transitionMs = Math.max(0, Math.min(1200, Math.round(input['transitionMs'])))
  }
  if (typeof input['lowerThirds'] === 'boolean') patch.lowerThirds = input['lowerThirds']
  if (typeof input['chromaKey'] === 'boolean') patch.chromaKey = input['chromaKey']
  if (typeof input['stageViewMode'] === 'boolean') patch.stageViewMode = input['stageViewMode']
  if (typeof input['paddingPct'] === 'number' && Number.isFinite(input['paddingPct'])) {
    patch.paddingPct = Math.max(1, Math.min(20, Math.round(input['paddingPct'])))
  }
  if (typeof input['bgDimmer'] === 'number' && Number.isFinite(input['bgDimmer'])) {
    patch.bgDimmer = Math.max(0, Math.min(90, Math.round(input['bgDimmer'])))
  }
  if (typeof input['bgBlur'] === 'number' && Number.isFinite(input['bgBlur'])) {
    patch.bgBlur = Math.max(0, Math.min(24, Math.round(input['bgBlur'])))
  }
  if (typeof input['showOverlayClock'] === 'boolean') patch.showOverlayClock = input['showOverlayClock']
  if (typeof input['frozen'] === 'boolean') patch.frozen = input['frozen']
  if (typeof input['tickerText'] === 'string') patch.tickerText = input['tickerText'].slice(0, 600)
  if (typeof input['tickerActive'] === 'boolean') patch.tickerActive = input['tickerActive']
  if (input['countdownEndIso'] === null || typeof input['countdownEndIso'] === 'string') {
    patch.countdownEndIso = input['countdownEndIso'] ? input['countdownEndIso'].slice(0, 60) : null
  }
  if (typeof input['countdownLabel'] === 'string') patch.countdownLabel = input['countdownLabel'].slice(0, 120)
  if (typeof input['stageMessage'] === 'string') patch.stageMessage = input['stageMessage'].slice(0, 400)
  if (typeof input['highlightWord'] === 'string') patch.highlightWord = input['highlightWord'].slice(0, 100)
  if (typeof input['videoPlaying'] === 'boolean') patch.videoPlaying = input['videoPlaying']
  if (typeof input['videoMuted'] === 'boolean') patch.videoMuted = input['videoMuted']
  if (typeof input['videoLoop'] === 'boolean') patch.videoLoop = input['videoLoop']
  if (typeof input['videoRestartTime'] === 'number' && Number.isFinite(input['videoRestartTime'])) {
    patch.videoRestartTime = input['videoRestartTime']
  }
  if (typeof input['videoSeekSeconds'] === 'number' && Number.isFinite(input['videoSeekSeconds'])) {
    patch.videoSeekSeconds = Math.max(0, input['videoSeekSeconds'])
  }
  if (typeof input['videoSeekTrigger'] === 'number' && Number.isFinite(input['videoSeekTrigger'])) {
    patch.videoSeekTrigger = input['videoSeekTrigger']
  }
  if (input['mediaFit'] === 'contain' || input['mediaFit'] === 'fill' || input['mediaFit'] === 'cover') {
    patch.mediaFit = input['mediaFit']
  }
  if (input['background'] !== undefined) {
    const bg = input['background']
    if (!isPlainObject(bg)) {
      throw new ValidationError('El fondo debe ser un objeto.')
    }
    const kind = bg['kind']
    if (typeof kind !== 'string' || !BACKGROUND_KINDS.includes(kind as BackgroundKind)) {
      throw new ValidationError('Tipo de fondo no válido.')
    }
    patch.background = {
      id: requireNonEmptyString(bg['id'], 'background.id', 120),
      name: requireNonEmptyString(bg['name'], 'background.name', 120),
      kind: kind as BackgroundKind,
      value: requireNonEmptyString(bg['value'], 'background.value', 150_000_000),
      accentColor: optionalString(bg['accentColor'], 'background.accentColor', 40) || '#f2b84b'
    }
  }
  return patch
}

function parseSongStanza(input: unknown, index: number): SongStanza {
  if (!isPlainObject(input)) {
    throw new ValidationError(`La estrofa ${index + 1} debe ser un objeto.`)
  }
  const id = optionalString(input['id'], 'stanza.id', 120) || `stanza-${index + 1}`
  const label = requireNonEmptyString(input['label'], 'stanza.label', 120)
  const kind = input['kind'] ?? 'verse'
  if (typeof kind !== 'string' || !STANZA_KINDS.includes(kind as StanzaKind)) {
    throw new ValidationError(`Tipo de estrofa no válido en "${label}".`)
  }
  const rawLines = input['lines']
  if (!Array.isArray(rawLines) || rawLines.length === 0 || rawLines.length > 20) {
    throw new ValidationError(`La estrofa "${label}" debe tener entre 1 y 20 líneas.`)
  }
  const lines = rawLines.map((l, i) => requireNonEmptyString(l, `stanza.lines[${i}]`, 500))
  return { id, label, kind: kind as StanzaKind, lines }
}

export function parseSongInput(input: unknown): SongInput {
  if (!isPlainObject(input)) {
    throw new ValidationError('Los datos de la canción deben ser un objeto.')
  }
  const title = requireNonEmptyString(input['title'], 'title', 160)
  const author = optionalString(input['author'], 'author', 160)
  const musicalKey = optionalString(input['musicalKey'], 'musicalKey', 20)
  const rawBpm = input['bpm']
  let bpm: number | null = null
  if (rawBpm !== null && rawBpm !== undefined) {
    if (typeof rawBpm !== 'number' || !Number.isFinite(rawBpm) || rawBpm < 30 || rawBpm > 260) {
      throw new ValidationError('El BPM debe ser un número entre 30 y 260.')
    }
    bpm = Math.round(rawBpm)
  }
  const rawTags = input['tags'] ?? []
  if (!Array.isArray(rawTags) || rawTags.length > 20) {
    throw new ValidationError('Las etiquetas deben ser una lista de hasta 20 elementos.')
  }
  const tags = rawTags
    .map((t, i) => requireNonEmptyString(t, `tags[${i}]`, 40))
    .filter((t, idx, arr) => arr.indexOf(t) === idx)

  const rawStanzas = input['stanzas']
  if (!Array.isArray(rawStanzas) || rawStanzas.length === 0 || rawStanzas.length > 60) {
    throw new ValidationError('La canción debe tener entre 1 y 60 estrofas.')
  }
  const stanzas = rawStanzas.map((s, i) => parseSongStanza(s, i))
  const id = optionalString(input['id'], 'id', 120)

  const result: SongInput = { title, author, musicalKey, bpm, tags, stanzas }
  if (id) result.id = id
  const verseOrder = optionalString(input['verseOrder'], 'verseOrder', 200)
  if (verseOrder) result.verseOrder = verseOrder
  const chords = optionalString(input['chords'], 'chords', 8000)
  if (chords) result.chords = chords
  const categoryColor = optionalString(input['categoryColor'], 'categoryColor', 40)
  if (categoryColor) result.categoryColor = categoryColor
  const defaultBackgroundId = optionalString(input['defaultBackgroundId'], 'defaultBackgroundId', 120)
  if (defaultBackgroundId) result.defaultBackgroundId = defaultBackgroundId
  return result
}

export function parseBibleChapterRequest(input: unknown): BibleChapterRequest {
  if (!isPlainObject(input)) {
    throw new ValidationError('La consulta bíblica debe ser un objeto.')
  }
  const book = requireNonEmptyString(input['book'], 'book', 80)
  const chapter = input['chapter']
  if (typeof chapter !== 'number' || !Number.isInteger(chapter) || chapter < 1 || chapter > 150) {
    throw new ValidationError('El capítulo debe ser un entero válido.')
  }
  const version = typeof input['version'] === 'string' && input['version'].trim() ? input['version'].trim().slice(0, 80) : undefined
  return { book, chapter, ...(version ? { version } : {}) }
}

export function parseHolyricsImportPayload(input: unknown): HolyricsImportItem[] {
  if (!Array.isArray(input) || input.length === 0 || input.length > 500) {
    throw new ValidationError('Se requiere una lista de entre 1 y 500 archivos o textos de Holyrics.')
  }
  return input.map((item, idx) => {
    if (!isPlainObject(item)) {
      throw new ValidationError(`El elemento ${idx + 1} del catálogo debe ser un objeto.`)
    }
    const content = parseRawString(item['content'], `items[${idx}].content`, 2_000_000)
    const fileName = optionalString(item['fileName'], `items[${idx}].fileName`, 260)
    const entry: HolyricsImportItem = { content }
    if (fileName) entry.fileName = fileName
    return entry
  })
}

export function parseScheduleItemInput(input: unknown): ScheduleItemInput {
  if (!isPlainObject(input)) {
    throw new ValidationError('El elemento de programación debe ser un objeto.')
  }
  const kind = input['kind']
  if (typeof kind !== 'string' || !SCHEDULE_ITEM_KINDS.includes(kind as ScheduleItemKind)) {
    throw new ValidationError('Tipo de elemento de programación no válido.')
  }
  const title = requireNonEmptyString(input['title'], 'title', 200)
  const subtitle = optionalString(input['subtitle'], 'subtitle', 240)
  const refId = optionalString(input['refId'], 'refId', 120)
  const rawSlides = input['slides']
  if (!Array.isArray(rawSlides) || rawSlides.length === 0 || rawSlides.length > 200) {
    throw new ValidationError('El elemento de programación debe contener diapositivas.')
  }
  const slides = rawSlides.map((s) => parsePresentationSlide(s))
  const result: ScheduleItemInput = { kind: kind as ScheduleItemKind, title, subtitle, slides }
  if (refId) result.refId = refId
  const operatorNote = optionalString(input['operatorNote'], 'operatorNote', 300)
  if (operatorNote) result.operatorNote = operatorNote
  return result
}

export function parseScheduleMoveRequest(input: unknown): ScheduleMoveRequest {
  if (!isPlainObject(input)) {
    throw new ValidationError('La solicitud de reordenación debe ser un objeto.')
  }
  const id = requireNonEmptyString(input['id'], 'id', 120)
  const direction = input['direction']
  if (direction !== 'up' && direction !== 'down') {
    throw new ValidationError('La dirección debe ser "up" o "down".')
  }
  return { id, direction }
}

export function parseMediaBackgroundInput(input: unknown): MediaBackgroundInput {
  if (!isPlainObject(input)) {
    throw new ValidationError('El fondo multimedia debe ser un objeto.')
  }
  const name = requireNonEmptyString(input['name'], 'name', 100)
  const kind = input['kind']
  if (typeof kind !== 'string' || !BACKGROUND_KINDS.includes(kind as BackgroundKind)) {
    throw new ValidationError('Tipo de fondo no válido.')
  }
  const value = requireNonEmptyString(input['value'], 'value', 150_000_000)
  const accentColor = optionalString(input['accentColor'], 'accentColor', 40)
  const category = optionalString(input['category'], 'category', 60)
  const result: MediaBackgroundInput = { name, kind: kind as BackgroundKind, value }
  if (accentColor) result.accentColor = accentColor
  if (category) result.category = category
  return result
}

export function parseSettingsPatch(input: unknown): Partial<AppSettings> {
  if (!isPlainObject(input)) {
    throw new ValidationError('La actualización de configuración debe ser un objeto.')
  }
  const patch: Partial<AppSettings> = {}
  if (input['churchName'] !== undefined) {
    patch.churchName = requireNonEmptyString(input['churchName'], 'churchName', 120)
  }
  if (input['welcomeSubtitle'] !== undefined) {
    patch.welcomeSubtitle = optionalString(input['welcomeSubtitle'], 'welcomeSubtitle', 180)
  }
  if (input['defaultProjectionTarget'] !== undefined) {
    const target = input['defaultProjectionTarget']
    if (target !== 'auto' && target !== 'windowed') {
      throw new ValidationError('Destino de proyección predeterminado no válido.')
    }
    patch.defaultProjectionTarget = target
  }
  if (input['showClockOnLogo'] !== undefined) {
    if (typeof input['showClockOnLogo'] !== 'boolean') {
      throw new ValidationError('El campo "showClockOnLogo" debe ser booleano.')
    }
    patch.showClockOnLogo = input['showClockOnLogo']
  }
  if (input['remotePort'] !== undefined) {
    const port = input['remotePort']
    if (typeof port !== 'number' || !Number.isInteger(port) || port < 1024 || port > 65535) {
      throw new ValidationError('El puerto remoto debe estar entre 1024 y 65535.')
    }
    patch.remotePort = port
  }
  if (input['theme'] !== undefined) {
    const current = input['theme']
    if (!isPlainObject(current)) {
      throw new ValidationError('El campo "theme" debe ser un objeto.')
    }
    const validatedTheme = parseProjectionThemePatch(current)
    if (
      validatedTheme.background &&
      validatedTheme.fontFamily &&
      validatedTheme.fontScale !== undefined &&
      validatedTheme.textAlign &&
      validatedTheme.textShadow !== undefined &&
      validatedTheme.showFooter !== undefined
    ) {
      patch.theme = validatedTheme as ProjectionTheme
    }
  }
  return patch
}

/**
 * Comprueba si una URL pertenece a la aplicación (y no a un origen remoto).
 *
 * @param url URL del frame que envía el mensaje o al que se intenta navegar.
 * @param devServerUrl URL del servidor de desarrollo de Vite, solo en desarrollo.
 */
export function isTrustedAppUrl(url: string, devServerUrl?: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (parsed.protocol === 'file:') return true
  if (parsed.protocol === 'lumen-media:') return true
  if (devServerUrl) {
    let dev: URL
    try {
      dev = new URL(devServerUrl)
    } catch {
      return false
    }
    const isLocalHost = ['localhost', '127.0.0.1', '[::1]'].includes(dev.hostname)
    return isLocalHost && parsed.origin === dev.origin
  }
  return false
}
