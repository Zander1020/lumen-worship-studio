import type {
  AiSuggestionResult,
  AppSettings,
  BackgroundKind,
  BibleBookSummary,
  BibleVersionImportRequest,
  BibleVersionInfo,
  BibleVerse,
  HolyricsImportItem,
  LiveProjectionState,
  MediaBackground,
  MediaBackgroundInput,
  PresentationDeck,
  PresentationSlide,
  ProjectionDisplayMode,
  ProjectionTheme,
  RemoteServerInfo,
  ScheduleItem,
  ScheduleItemInput,
  ScheduleItemKind,
  SlideSourceKind,
  Song,
  SongInput,
  SongStanza,
  StanzaKind
} from './models'

/**
 * Contrato IPC compartido entre el proceso principal, los preloads y el renderer.
 *
 * Toda comunicación entre procesos debe pasar por estos canales. Cualquier canal
 * que no figure aquí es rechazado por el proceso principal.
 */

export const IpcChannels = {
  /** renderer → main (invoke): información básica de la aplicación. */
  appGetInfo: 'app:get-info',
  /** renderer → main (invoke): estado actual (proyección, diapositivas y conexión móvil). */
  statusGet: 'status:get',
  /** main → renderer (evento): el estado ha cambiado. */
  statusChanged: 'status:changed',
  /** renderer → main (invoke): abrir la ventana de proyección. */
  projectionOpen: 'projection:open',
  /** renderer/proyección → main (invoke): cerrar la ventana de proyección. */
  projectionClose: 'projection:close',
  /** renderer → main (invoke): cargar conjunto de diapositivas en vivo. */
  projectionLoadDeck: 'projection:load-deck',
  /** renderer → main (invoke): ir a un índice o avanzar/retroceder diapositiva. */
  projectionGoToSlide: 'projection:goto-slide',
  /** renderer → main (invoke): cambiar el modo de visualización (live/black/clear/logo/test-pattern). */
  projectionSetMode: 'projection:set-mode',
  /** renderer → main (invoke): actualizar el tema o fondo de proyección. */
  projectionUpdateTheme: 'projection:update-theme',

  /** Canciones (Alabanzas) */
  songsList: 'songs:list',
  songsUpsert: 'songs:upsert',
  songsDelete: 'songs:delete',
  songsParseRaw: 'songs:parse-raw',
  songsImportHolyrics: 'songs:import-holyrics',

  /** Biblia */
  bibleBooks: 'bible:books',
  bibleGetChapter: 'bible:get-chapter',
  bibleSearch: 'bible:search',
  bibleVersions: 'bible:versions',
  bibleImportVersion: 'bible:import-version',
  bibleDeleteVersion: 'bible:delete-version',

  /** Programación del culto */
  scheduleList: 'schedule:list',
  scheduleAdd: 'schedule:add',
  scheduleRemove: 'schedule:remove',
  scheduleMove: 'schedule:move',
  scheduleClear: 'schedule:clear',

  /** Multimedia y fondos */
  mediaList: 'media:list',
  mediaAdd: 'media:add',
  mediaDelete: 'media:delete',
  mediaOpenFolder: 'media:open-folder',
  mediaReload: 'media:reload',
  mediaYoutubeGetInfo: 'media:youtube-get-info',
  mediaYoutubeDownload: 'media:youtube-download',
  mediaYoutubeCancel: 'media:youtube-cancel',
  mediaYoutubeProgress: 'media:youtube-progress',
  backgroundsOpenFolder: 'backgrounds:open-folder',
  backgroundsReload: 'backgrounds:reload',

  /** Diapositivas y presentaciones (PDF / PowerPoint) */
  slidesList: 'slides:list',
  slidesSave: 'slides:save',
  slidesDelete: 'slides:delete',
  slidesOpenFolder: 'slides:open-folder',
  slidesReload: 'slides:reload',
  slidesScanFolder: 'slides:scan-folder',

  /** Enlaces externos (WhatsApp, mailto) */
  appOpenExternal: 'app:open-external',

  /** Ventana principal (minimizar, maximizar/restaurar, cerrar) */
  windowMinimize: 'window:minimize',
  windowMaximize: 'window:maximize',
  windowClose: 'window:close',
  windowIsMaximized: 'window:is-maximized',

  /** Control remoto en red local */
  remoteGetInfo: 'remote:get-info',
  remoteStart: 'remote:start',
  remoteStop: 'remote:stop',
  remoteRegeneratePin: 'remote:regenerate-pin',

  /** Asistente inteligente local */
  aiSuggestForTheme: 'ai:suggest-for-theme',
  aiChat: 'ai:chat',
  aiChatStream: 'ai:chat-stream',
  aiChatChunk: 'ai:chat-chunk',

  /** Configuración */
  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',

  /** Auto-actualizador */
  updaterGetStatus: 'updater:get-status',
  updaterCheck: 'updater:check',
  updaterDownload: 'updater:download',
  updaterInstall: 'updater:install',
  updaterStatusChanged: 'updater:status-changed'
} as const

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels]

/** Modo de apertura de la ventana de proyección. */
export type ProjectionTarget = 'auto' | 'windowed'

export interface ProjectionOpenRequest {
  /**
   * `auto`: pantalla completa en un monitor secundario si existe; si no, en ventana.
   * `windowed`: siempre en ventana sobre el monitor principal (útil para pruebas).
   */
  target: ProjectionTarget
}

export interface ProjectionLoadDeckRequest {
  deckTitle: string
  slides: PresentationSlide[]
  startIndex?: number
  openWindow?: boolean
}

export interface ProjectionGoToSlideRequest {
  direction?: 'next' | 'prev'
  index?: number
}

export interface ProjectionSetModeRequest {
  mode: ProjectionDisplayMode
}

export interface BibleChapterRequest {
  book: string
  chapter: number
  version?: string
}

export interface BibleSearchRequest {
  query: string
  version?: string
}

export interface ScheduleMoveRequest {
  id: string
  direction: 'up' | 'down'
}

export interface ProjectionStatus {
  windowOpen: boolean
  fullscreen: boolean
  /** Identificador del monitor donde está la ventana, o `null` si está cerrada. */
  displayId: number | null
  /** Número de monitores detectados. */
  displayCount: number
  /** Tipo de contenido actual mostrado en la ventana de proyección. */
  content: 'test-pattern' | 'live'
  /** Estado detallado del motor de proyección en vivo. */
  live: LiveProjectionState
}

/**
 * Estado de la conexión con el control remoto móvil.
 */
export type MobileConnectionState = 'not-started' | 'waiting' | 'connected'

export interface MobileStatus {
  state: MobileConnectionState
  connectedClients: number
  port?: number
  urls?: string[]
  pin?: string
}

export interface AppStatus {
  projection: ProjectionStatus
  mobile: MobileStatus
}

export interface AppInfo {
  name: string
  version: string
  platform: string
  electron: string
  chrome: string
  node: string
}

export interface YoutubeVideoInfo {
  id: string
  url: string
  title: string
  author?: string
  thumbnailUrl?: string
  durationSeconds?: number
}

export interface YoutubeDownloadRequest {
  url: string
  customTitle?: string
  category?: string
}

export interface YoutubeProgressPayload {
  url: string
  percent: number
  speed?: string
  eta?: string
  status:
    | 'initializing'
    | 'downloading-binary'
    | 'fetching-info'
    | 'downloading'
    | 'processing'
    | 'completed'
    | 'error'
    | 'cancelled'
  message?: string
}

export type {
  AiSuggestionResult,
  AppSettings,
  BackgroundKind,
  BibleBookSummary,
  BibleVersionImportRequest,
  BibleVersionInfo,
  BibleVerse,
  HolyricsImportItem,
  LiveProjectionState,
  MediaBackground,
  MediaBackgroundInput,
  PresentationDeck,
  PresentationSlide,
  ProjectionDisplayMode,
  ProjectionTheme,
  RemoteServerInfo,
  ScheduleItem,
  ScheduleItemInput,
  ScheduleItemKind,
  SlideSourceKind,
  Song,
  SongInput,
  SongStanza,
  StanzaKind
}
