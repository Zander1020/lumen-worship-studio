import type {
  AiSuggestionResult,
  AppInfo,
  AppSettings,
  AppStatus,
  BibleBookSummary,
  BibleChapterRequest,
  BibleVerse,
  HolyricsImportItem,
  MediaBackground,
  MediaBackgroundInput,
  ProjectionGoToSlideRequest,
  ProjectionLoadDeckRequest,
  ProjectionOpenRequest,
  ProjectionSetModeRequest,
  ProjectionTheme,
  RemoteServerInfo,
  ScheduleItem,
  ScheduleItemInput,
  ScheduleMoveRequest,
  Song,
  SongInput,
  SongStanza
} from './ipc'

/**
 * API expuesta a la ventana principal mediante `contextBridge` como `window.lumen`.
 * Es la única superficie del proceso principal accesible desde la interfaz.
 */
export interface LumenApi {
  readonly getAppInfo: () => Promise<AppInfo>
  readonly getStatus: () => Promise<AppStatus>
  /** Se suscribe a cambios de estado. Devuelve la función para cancelar la suscripción. */
  readonly onStatusChanged: (listener: (status: AppStatus) => void) => () => void
  readonly openProjection: (request?: ProjectionOpenRequest) => Promise<AppStatus>
  readonly closeProjection: () => Promise<AppStatus>
  readonly loadProjectionDeck: (request: ProjectionLoadDeckRequest) => Promise<AppStatus>
  readonly goToSlide: (request: ProjectionGoToSlideRequest) => Promise<AppStatus>
  readonly setProjectionMode: (request: ProjectionSetModeRequest) => Promise<AppStatus>
  readonly updateProjectionTheme: (patch: Partial<ProjectionTheme>) => Promise<AppStatus>

  /** Biblioteca de alabanzas */
  readonly listSongs: () => Promise<Song[]>
  readonly upsertSong: (input: SongInput) => Promise<Song[]>
  readonly deleteSong: (id: string) => Promise<Song[]>
  readonly parseRawLyrics: (rawText: string) => Promise<SongStanza[]>
  readonly importHolyricsCatalog: (items: HolyricsImportItem[]) => Promise<Song[]>

  /** Biblia */
  readonly listBibleBooks: () => Promise<BibleBookSummary[]>
  readonly getBibleChapter: (request: BibleChapterRequest) => Promise<BibleVerse[]>
  readonly searchBible: (query: string) => Promise<BibleVerse[]>

  /** Programación del culto */
  readonly listSchedule: () => Promise<ScheduleItem[]>
  readonly addScheduleItem: (input: ScheduleItemInput) => Promise<ScheduleItem[]>
  readonly removeScheduleItem: (id: string) => Promise<ScheduleItem[]>
  readonly moveScheduleItem: (request: ScheduleMoveRequest) => Promise<ScheduleItem[]>
  readonly clearSchedule: () => Promise<ScheduleItem[]>

  /** Multimedia y fondos */
  readonly listMedia: () => Promise<MediaBackground[]>
  readonly addMedia: (input: MediaBackgroundInput) => Promise<MediaBackground[]>
  readonly deleteMedia: (id: string) => Promise<MediaBackground[]>
  readonly openMediaFolder: () => Promise<string>
  readonly reloadMedia: () => Promise<MediaBackground[]>
  readonly openBackgroundsFolder?: () => Promise<string>
  readonly reloadBackgrounds?: () => Promise<MediaBackground[]>
  readonly getPathForFile?: (file: File) => string

  /** Control remoto móvil en red local */
  readonly getRemoteInfo: () => Promise<RemoteServerInfo>
  readonly startRemoteServer: () => Promise<RemoteServerInfo>
  readonly stopRemoteServer: () => Promise<RemoteServerInfo>
  readonly regenerateRemotePin: () => Promise<RemoteServerInfo>

  /** Asistente inteligente local */
  readonly suggestForTheme: (theme: string) => Promise<AiSuggestionResult>

  /** Control de ventana principal */
  readonly minimizeWindow?: () => Promise<boolean>
  readonly maximizeWindow?: () => Promise<boolean>
  readonly closeWindow?: () => Promise<boolean>
  readonly isWindowMaximized?: () => Promise<boolean>

  /** Apertura de enlaces externos (WhatsApp, correo) */
  readonly openExternalUrl?: (url: string) => Promise<boolean>

  /** Configuración */
  readonly getSettings: () => Promise<AppSettings>
  readonly updateSettings: (patch: Partial<AppSettings>) => Promise<AppSettings>
}

/**
 * API mínima expuesta a la ventana de proyección como `window.lumenProjection`.
 */
export interface LumenProjectionApi {
  readonly getStatus: () => Promise<AppStatus>
  readonly onStatusChanged: (listener: (status: AppStatus) => void) => () => void
  readonly close: () => Promise<AppStatus>
}

/** Claves exactas expuestas por cada preload (usadas en pruebas de seguridad). */
export const LUMEN_API_KEYS = [
  'getAppInfo',
  'getStatus',
  'onStatusChanged',
  'openProjection',
  'closeProjection',
  'loadProjectionDeck',
  'goToSlide',
  'setProjectionMode',
  'updateProjectionTheme',
  'listSongs',
  'upsertSong',
  'deleteSong',
  'parseRawLyrics',
  'importHolyricsCatalog',
  'listBibleBooks',
  'getBibleChapter',
  'searchBible',
  'listSchedule',
  'addScheduleItem',
  'removeScheduleItem',
  'moveScheduleItem',
  'clearSchedule',
  'listMedia',
  'addMedia',
  'deleteMedia',
  'openMediaFolder',
  'reloadMedia',
  'getRemoteInfo',
  'startRemoteServer',
  'stopRemoteServer',
  'regenerateRemotePin',
  'suggestForTheme',
  'getSettings',
  'updateSettings'
] as const satisfies readonly (keyof LumenApi)[]

export const LUMEN_PROJECTION_API_KEYS = [
  'getStatus',
  'onStatusChanged',
  'close'
] as const satisfies readonly (keyof LumenProjectionApi)[]
