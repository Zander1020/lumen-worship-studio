/**
 * Preload de la ventana principal.
 *
 * Se ejecuta en sandbox con aislamiento de contexto: solo expone, mediante
 * `contextBridge`, funciones concretas. Nunca expone `ipcRenderer` ni módulos de Node.
 */
import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron'
import type { LumenApi, UpdateStatus } from '../shared/api'
import {
  IpcChannels,
  type AiSuggestionResult,
  type AppInfo,
  type AppSettings,
  type AppStatus,
  type BibleBookSummary,
  type BibleChapterRequest,
  type BibleVersionImportRequest,
  type BibleVersionInfo,
  type BibleVerse,
  type HolyricsImportItem,
  type MediaBackground,
  type MediaBackgroundInput,
  type PresentationDeck,
  type ProjectionGoToSlideRequest,
  type ProjectionLoadDeckRequest,
  type ProjectionOpenRequest,
  type ProjectionSetModeRequest,
  type ProjectionTheme,
  type RemoteServerInfo,
  type ScheduleItem,
  type ScheduleItemInput,
  type ScheduleMoveRequest,
  type Song,
  type SongInput,
  type SongStanza
} from '../shared/ipc'

const api: LumenApi = {
  getAppInfo: () => ipcRenderer.invoke(IpcChannels.appGetInfo) as Promise<AppInfo>,
  getStatus: () => ipcRenderer.invoke(IpcChannels.statusGet) as Promise<AppStatus>,
  onStatusChanged: (listener) => {
    const wrapped = (_event: IpcRendererEvent, status: AppStatus): void => {
      listener(status)
    }
    ipcRenderer.on(IpcChannels.statusChanged, wrapped)
    return () => {
      ipcRenderer.removeListener(IpcChannels.statusChanged, wrapped)
    }
  },
  openProjection: (request?: ProjectionOpenRequest) =>
    ipcRenderer.invoke(IpcChannels.projectionOpen, request) as Promise<AppStatus>,
  closeProjection: () => ipcRenderer.invoke(IpcChannels.projectionClose) as Promise<AppStatus>,
  loadProjectionDeck: (request: ProjectionLoadDeckRequest) =>
    ipcRenderer.invoke(IpcChannels.projectionLoadDeck, request) as Promise<AppStatus>,
  goToSlide: (request: ProjectionGoToSlideRequest) =>
    ipcRenderer.invoke(IpcChannels.projectionGoToSlide, request) as Promise<AppStatus>,
  setProjectionMode: (request: ProjectionSetModeRequest) =>
    ipcRenderer.invoke(IpcChannels.projectionSetMode, request) as Promise<AppStatus>,
  updateProjectionTheme: (patch: Partial<ProjectionTheme>) =>
    ipcRenderer.invoke(IpcChannels.projectionUpdateTheme, patch) as Promise<AppStatus>,

  listSongs: () => ipcRenderer.invoke(IpcChannels.songsList) as Promise<Song[]>,
  upsertSong: (input: SongInput) => ipcRenderer.invoke(IpcChannels.songsUpsert, input) as Promise<Song[]>,
  deleteSong: (id: string) => ipcRenderer.invoke(IpcChannels.songsDelete, id) as Promise<Song[]>,
  parseRawLyrics: (rawText: string) => ipcRenderer.invoke(IpcChannels.songsParseRaw, rawText) as Promise<SongStanza[]>,
  importHolyricsCatalog: (items: HolyricsImportItem[]) =>
    ipcRenderer.invoke(IpcChannels.songsImportHolyrics, items) as Promise<Song[]>,

  listBibleBooks: (version?: string) =>
    ipcRenderer.invoke(IpcChannels.bibleBooks, version ? { version } : undefined) as Promise<BibleBookSummary[]>,
  getBibleChapter: (request: BibleChapterRequest) =>
    ipcRenderer.invoke(IpcChannels.bibleGetChapter, request) as Promise<BibleVerse[]>,
  searchBible: (query: string, version?: string) =>
    ipcRenderer.invoke(IpcChannels.bibleSearch, version ? { query, version } : query) as Promise<BibleVerse[]>,
  listBibleVersions: () => ipcRenderer.invoke(IpcChannels.bibleVersions) as Promise<BibleVersionInfo[]>,
  importBibleVersion: (request: BibleVersionImportRequest) =>
    ipcRenderer.invoke(IpcChannels.bibleImportVersion, request) as Promise<BibleVersionInfo[]>,
  deleteBibleVersion: (id: string) =>
    ipcRenderer.invoke(IpcChannels.bibleDeleteVersion, id) as Promise<BibleVersionInfo[]>,

  listSchedule: () => ipcRenderer.invoke(IpcChannels.scheduleList) as Promise<ScheduleItem[]>,
  addScheduleItem: (input: ScheduleItemInput) =>
    ipcRenderer.invoke(IpcChannels.scheduleAdd, input) as Promise<ScheduleItem[]>,
  removeScheduleItem: (id: string) =>
    ipcRenderer.invoke(IpcChannels.scheduleRemove, id) as Promise<ScheduleItem[]>,
  moveScheduleItem: (request: ScheduleMoveRequest) =>
    ipcRenderer.invoke(IpcChannels.scheduleMove, request) as Promise<ScheduleItem[]>,
  clearSchedule: () => ipcRenderer.invoke(IpcChannels.scheduleClear) as Promise<ScheduleItem[]>,

  listMedia: () => ipcRenderer.invoke(IpcChannels.mediaList) as Promise<MediaBackground[]>,
  addMedia: (input: MediaBackgroundInput) =>
    ipcRenderer.invoke(IpcChannels.mediaAdd, input) as Promise<MediaBackground[]>,
  deleteMedia: (id: string) => ipcRenderer.invoke(IpcChannels.mediaDelete, id) as Promise<MediaBackground[]>,
  openMediaFolder: () => ipcRenderer.invoke(IpcChannels.mediaOpenFolder) as Promise<string>,
  reloadMedia: () => ipcRenderer.invoke(IpcChannels.mediaReload) as Promise<MediaBackground[]>,
  openBackgroundsFolder: () => ipcRenderer.invoke(IpcChannels.backgroundsOpenFolder) as Promise<string>,
  reloadBackgrounds: () => ipcRenderer.invoke(IpcChannels.backgroundsReload) as Promise<MediaBackground[]>,
  listPresentations: () => ipcRenderer.invoke(IpcChannels.slidesList) as Promise<PresentationDeck[]>,
  savePresentation: (deck: PresentationDeck) =>
    ipcRenderer.invoke(IpcChannels.slidesSave, deck) as Promise<PresentationDeck[]>,
  deletePresentation: (id: string) =>
    ipcRenderer.invoke(IpcChannels.slidesDelete, { id }) as Promise<PresentationDeck[]>,
  openSlidesFolder: () => ipcRenderer.invoke(IpcChannels.slidesOpenFolder) as Promise<string>,
  reloadSlides: () => ipcRenderer.invoke(IpcChannels.slidesReload) as Promise<PresentationDeck[]>,
  scanSlidesFolder: () =>
    ipcRenderer.invoke(IpcChannels.slidesScanFolder) as Promise<Array<{ fileName: string; filePath: string; ext: string }>>,
  openExternalUrl: (url: string) => ipcRenderer.invoke(IpcChannels.appOpenExternal, url) as Promise<boolean>,
  getPathForFile: (file: File) => {
    try {
      if (typeof webUtils.getPathForFile === 'function') {
        return webUtils.getPathForFile(file)
      }
    } catch {
      // fallback
    }
    return (file as unknown as { path?: string }).path || ''
  },

  getRemoteInfo: () => ipcRenderer.invoke(IpcChannels.remoteGetInfo) as Promise<RemoteServerInfo>,
  startRemoteServer: () => ipcRenderer.invoke(IpcChannels.remoteStart) as Promise<RemoteServerInfo>,
  stopRemoteServer: () => ipcRenderer.invoke(IpcChannels.remoteStop) as Promise<RemoteServerInfo>,
  regenerateRemotePin: () => ipcRenderer.invoke(IpcChannels.remoteRegeneratePin) as Promise<RemoteServerInfo>,

  suggestForTheme: (theme: string) =>
    ipcRenderer.invoke(IpcChannels.aiSuggestForTheme, theme) as Promise<AiSuggestionResult>,
  chatWithAI: (messages: { role: string; content: string }[]) =>
    ipcRenderer.invoke(IpcChannels.aiChat, messages) as Promise<string>,
  chatWithAIStream: (request: { messages: { role: string; content: string }[]; requestId: string }) =>
    ipcRenderer.invoke(IpcChannels.aiChatStream, request) as Promise<void>,
  onAIChatChunk: (listener: (payload: { requestId: string; chunk: string; done: boolean; error?: string }) => void) => {
    const wrapped = (_event: unknown, payload: { requestId: string; chunk: string; done: boolean; error?: string }) => listener(payload)
    ipcRenderer.on(IpcChannels.aiChatChunk, wrapped)
    return () => ipcRenderer.removeListener(IpcChannels.aiChatChunk, wrapped)
  },

  getSettings: () => ipcRenderer.invoke(IpcChannels.settingsGet) as Promise<AppSettings>,
  updateSettings: (patch: Partial<AppSettings>) =>
    ipcRenderer.invoke(IpcChannels.settingsUpdate, patch) as Promise<AppSettings>,

  minimizeWindow: () => ipcRenderer.invoke(IpcChannels.windowMinimize) as Promise<boolean>,
  maximizeWindow: () => ipcRenderer.invoke(IpcChannels.windowMaximize) as Promise<boolean>,
  closeWindow: () => ipcRenderer.invoke(IpcChannels.windowClose) as Promise<boolean>,
  isWindowMaximized: () => ipcRenderer.invoke(IpcChannels.windowIsMaximized) as Promise<boolean>,

  getUpdateStatus: () => ipcRenderer.invoke(IpcChannels.updaterGetStatus),
  checkForUpdates: () => ipcRenderer.invoke(IpcChannels.updaterCheck),
  downloadUpdate: () => ipcRenderer.invoke(IpcChannels.updaterDownload),
  installUpdate: () => ipcRenderer.invoke(IpcChannels.updaterInstall),
  onUpdateStatusChanged: (listener: (status: UpdateStatus) => void) => {
    const wrapped = (_event: IpcRendererEvent, status: UpdateStatus): void => {
      listener(status)
    }
    ipcRenderer.on(IpcChannels.updaterStatusChanged, wrapped)
    return () => {
      ipcRenderer.removeListener(IpcChannels.updaterStatusChanged, wrapped)
    }
  }
}

contextBridge.exposeInMainWorld('lumen', api)
