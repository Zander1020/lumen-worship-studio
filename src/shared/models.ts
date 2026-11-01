/**
 * Modelos de dominio compartidos entre el proceso principal, los preloads y el renderer.
 */

export type StanzaKind = 'verse' | 'chorus' | 'bridge' | 'intro' | 'outro' | 'custom'

export interface SongStanza {
 id: string
 label: string
 kind: StanzaKind
 lines: string[]
}

export interface Song {
 id: string
 title: string
 author: string
 musicalKey: string
 bpm: number | null
 tags: string[]
 stanzas: SongStanza[]
 updatedAt: string
 /** Secuencia opcional de ejecución de estrofas (ej. "V1 C V2 C"). */
 verseOrder?: string
 /** Cifrado o acordes opcionales para vista de músicos. */
 chords?: string
 /** Color de categoría litúrgica opcional. */
 categoryColor?: string
 /** ID de fondo predeterminado para esta canción. */
 defaultBackgroundId?: string
 /** Contador de veces proyectada. */
 usageCount?: number
 /** Fecha ISO de última proyección. */
 lastUsedAt?: string
}

export interface SongInput {
 id?: string
 title: string
 author: string
 musicalKey: string
 bpm: number | null
 tags: string[]
 stanzas: SongStanza[]
 verseOrder?: string
 chords?: string
 categoryColor?: string
 defaultBackgroundId?: string
}

export interface HolyricsImportItem {
 content: string
 fileName?: string
}

export interface BibleVerse {
 book: string
 chapter: number
 verse: number
 text: string
 version?: string
}

export interface BibleBookSummary {
 book: string
 abbrev?: string
 testament?: 'AT' | 'NT'
 chapters: number[]
}

export interface BibleVersionInfo {
 id: string
 name: string
 builtIn: boolean
 /** false = versión built-in sin texto incluido (debe importarse su XML) */
 available?: boolean
}

export interface BibleVersionImportRequest {
 name: string
 abbrev?: string
 content: string
 fileName?: string
}

export type BackgroundKind = 'gradient' | 'solid' | 'image' | 'video'

export interface MediaBackground {
 id: string
 name: string
 kind: BackgroundKind
 /** CSS gradient, color hex o data URL de imagen/vídeo local. */
 value: string
 accentColor: string
 category?: string
 slides?: PresentationSlide[]
}

export interface PresentationDeck {
 id: string
 title: string
 subtitle: string
 kind: 'pdf' | 'pptx'
 filePath?: string | undefined
 fileData?: string | undefined
 slides: PresentationSlide[]
 createdAt?: number | undefined
}

export interface MediaBackgroundInput {
 name: string
 kind: BackgroundKind
 value: string
 accentColor?: string
 category?: string
 slides?: PresentationSlide[]
}

export type SlideSourceKind = 'song' | 'bible' | 'announcement' | 'custom' | 'separator'

export interface PresentationSlide {
 id: string
 sourceKind: SlideSourceKind
 sourceTitle: string
 label: string
 lines: string[]
 footer: string
 /** Segunda columna opcional para comparación bilingüe / paralela. */
 parallelLines?: string[]
 parallelLabel?: string
 /** Imagen o vídeo a pantalla completa para anuncios/flyers/videos del culto. */
 imageUrl?: string
 /** Tipo de medio ('image' | 'video') cuando imageUrl está presente. */
 mediaKind?: 'image' | 'video'
}

export type ScheduleItemKind = 'song' | 'bible' | 'announcement'

export interface ScheduleItem {
 id: string
 kind: ScheduleItemKind
 title: string
 subtitle: string
 /** Si es una canción, referencia opcional al id de la canción. */
 refId?: string
 slides: PresentationSlide[]
 operatorNote?: string
 projected?: boolean
}

export interface ScheduleItemInput {
 kind: ScheduleItemKind
 title: string
 subtitle: string
 refId?: string
 slides: PresentationSlide[]
 operatorNote?: string
}

export type ProjectionDisplayMode = 'live' | 'black' | 'clear' | 'logo' | 'test-pattern'

export interface ProjectionTheme {
 background: MediaBackground
 fontFamily: 'sans' | 'serif' | 'mono'
 /** Escala porcentual del texto proyectado (50 a 200). */
 fontScale: number
 /** Auto-Ajuste inteligente de texto al espacio disponible de proyección (por defecto true). */
 autoFit?: boolean
 textAlign: 'center' | 'left'
 textShadow: boolean
 showFooter: boolean
 /** Alineación vertical del bloque de texto (arriba, centro, abajo). */
 verticalAlign?: 'top' | 'center' | 'bottom'
 /** Forzar mayúsculas en proyección. */
 uppercase?: boolean
 /** Contorno negro reforzado para máxima legibilidad. */
 textStroke?: boolean
 /** Franja semitransparente detrás del texto. */
 textBoxBg?: boolean
 /** Duración de transición entre diapositivas en ms (0 a 800). */
 transitionMs?: number
 /** Modo tercio inferior (Lower-Thirds) para OBS/streaming. */
 lowerThirds?: boolean
 /** Fondo verde croma (#00FF00) para clave de color. */
 chromaKey?: boolean
 /** Modo monitor de escenario / retorno para púlpito y músicos. */
 stageViewMode?: boolean
 /** Margen porcentual de seguridad (Overscan, 2 a 14). */
 paddingPct?: number
 /** Oscurecimiento adicional del fondo (0 a 85%). */
 bgDimmer?: number
 /** Desenfoque del fondo en píxeles (0 a 16px). */
 bgBlur?: number
 /** Mostrar reloj digital superpuesto en esquina. */
 showOverlayClock?: boolean
 /** Congelar la salida en vivo actual (Freeze). */
 frozen?: boolean
 /** Texto de marquesina / alerta flotante en vivo. */
 tickerText?: string
 /** Si la cinta de alerta inferior está activa. */
 tickerActive?: boolean
 /** Marca ISO de finalización de cuenta regresiva en vivo. */
 countdownEndIso?: string | null
 /** Etiqueta de la cuenta regresiva. */
 countdownLabel?: string
 /** Mensaje privado visible únicamente en el monitor de escenario/retorno. */
 stageMessage?: string
 /** Palabra o frase a resaltar en color destacado dentro de la diapositiva. */
 highlightWord?: string
 /** Control de reproducción de vídeo en proyección (reproducir/pausar). */
 videoPlaying?: boolean
 /** Silenciar o activar audio del vídeo en proyección. */
 videoMuted?: boolean
 /** Bucle continuo del vídeo en proyección (por defecto true). */
 videoLoop?: boolean
 /** Marca de tiempo para reiniciar el vídeo desde el inicio. */
 videoRestartTime?: number
 /** Posición en segundos hacia la cual adelantar o retroceder el vídeo. */
 videoSeekSeconds?: number
 /** Marca de tiempo para activar el salto en el reproductor de vídeo. */
 videoSeekTrigger?: number
 /** Modo de ajuste de imagen o vídeo en proyección: 'contain' (acomodar completo sin salirse), 'fill' (llenar pantalla completa visible) o 'cover'. */
 mediaFit?: 'contain' | 'fill' | 'cover'
}

export interface LiveProjectionState {
 mode: ProjectionDisplayMode
 deckTitle: string
 slides: PresentationSlide[]
 currentIndex: number
 theme: ProjectionTheme
 churchName: string
 welcomeSubtitle: string
 showClockOnLogo: boolean
}

export interface AppSettings {
 churchName: string
 welcomeSubtitle: string
 defaultProjectionTarget: 'auto' | 'windowed'
 showClockOnLogo: boolean
 remotePort: number
 remotePin: string
 theme: ProjectionTheme
}

export interface RemoteServerInfo {
 running: boolean
 port: number
 pin: string
 urls: string[]
 connectedClients: number
}

export interface AiSuggestionResult {
 theme: string
 suggestedSongs: Song[]
 suggestedVerses: BibleVerse[]
 suggestedAnnouncement: PresentationSlide
}

