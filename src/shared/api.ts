import type {
  AiSuggestionResult,
  AppInfo,
  AppSettings,
  AppStatus,
  BibleBookSummary,
  BibleChapterRequest,
  BibleVersionImportRequest,
  BibleVersionInfo,
  BibleVerse,
  HolyricsImportItem,
  MediaBackground,
  MediaBackgroundInput,
  PresentationDeck,
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
  SongStanza,
  YoutubeVideoInfo,
  YoutubeDownloadRequest,
  YoutubeProgressPayload
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
  readonly listBibleBooks: (version?: string) => Promise<BibleBookSummary[]>
  readonly getBibleChapter: (request: BibleChapterRequest) => Promise<BibleVerse[]>
  readonly searchBible: (query: string, version?: string) => Promise<BibleVerse[]>
  readonly listBibleVersions?: () => Promise<BibleVersionInfo[]>
  readonly importBibleVersion?: (request: BibleVersionImportRequest) => Promise<BibleVersionInfo[]>
  readonly deleteBibleVersion?: (id: string) => Promise<BibleVersionInfo[]>

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
  readonly getYoutubeInfo?: (url: string) => Promise<YoutubeVideoInfo>
  readonly downloadYoutubeVideo?: (request: YoutubeDownloadRequest) => Promise<MediaBackground[]>
  readonly cancelYoutubeDownload?: () => Promise<boolean>
  readonly onYoutubeDownloadProgress?: (listener: (payload: YoutubeProgressPayload) => void) => () => void

  /** Diapositivas y presentaciones (PDF / PowerPoint) */
  readonly listPresentations?: () => Promise<PresentationDeck[]>
  readonly savePresentation?: (deck: PresentationDeck) => Promise<PresentationDeck[]>
  readonly deletePresentation?: (id: string) => Promise<PresentationDeck[]>
  readonly openSlidesFolder?: () => Promise<string>
  readonly reloadSlides?: () => Promise<PresentationDeck[]>
  readonly scanSlidesFolder?: () => Promise<Array<{ fileName: string; filePath: string; ext: string }>>

  /** Control remoto móvil en red local */
  readonly getRemoteInfo: () => Promise<RemoteServerInfo>
  readonly startRemoteServer: () => Promise<RemoteServerInfo>
  readonly stopRemoteServer: () => Promise<RemoteServerInfo>
  readonly regenerateRemotePin: () => Promise<RemoteServerInfo>

  /** Asistente inteligente local */
  readonly suggestForTheme: (theme: string) => Promise<AiSuggestionResult>
  readonly chatWithAI?: (messages: { role: string; content: string }[]) => Promise<string>
  readonly chatWithAIStream?: (request: { messages: { role: string; content: string }[]; requestId: string }) => Promise<void>
  readonly onAIChatChunk?: (listener: (payload: { requestId: string; chunk: string; done: boolean; error?: string }) => void) => () => void

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

  /** Auto-actualizador */
  /** Estado del auto-actualizador compartido entre main, preload y renderer. */
  readonly getUpdateStatus?: () => Promise<UpdateStatus>
  readonly checkForUpdates?: () => Promise<unknown>
  readonly downloadUpdate?: () => Promise<boolean>
  readonly installUpdate?: () => Promise<boolean>
  readonly onUpdateStatusChanged?: (listener: (status: UpdateStatus) => void) => () => void
}

export interface UpdateStatus {
  status: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
  version?: string
  releaseNotes?: string
  progressPercent?: number
  error?: string
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
  'listBibleVersions',
  'importBibleVersion',
  'deleteBibleVersion',
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
  'chatWithAI',
  'chatWithAIStream',
  'onAIChatChunk',
  'getSettings',
  'updateSettings'
] as const satisfies readonly (keyof LumenApi)[]

export const LUMEN_PROJECTION_API_KEYS = [
  'getStatus',
  'onStatusChanged',
  'close'
] as const satisfies readonly (keyof LumenProjectionApi)[]
