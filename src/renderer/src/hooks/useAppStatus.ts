import { useCallback, useEffect, useState } from 'react'
import type {
  AiSuggestionResult,
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
  ProjectionDisplayMode,
  ProjectionGoToSlideRequest,
  ProjectionLoadDeckRequest,
  ProjectionOpenRequest,
  ProjectionTheme,
  RemoteServerInfo,
  ScheduleItem,
  ScheduleItemInput,
  ScheduleMoveRequest,
  Song,
  SongInput,
  SongStanza,
  YoutubeDownloadRequest,
  YoutubeVideoInfo
} from '../../../shared/ipc'
import { parseRawLyricsToStanzas } from '../../../shared/slideHelpers'

export interface UseAppStatus {
  status: AppStatus | null
  songs: Song[]
  schedule: ScheduleItem[]
  media: MediaBackground[]
  bibleBooks: BibleBookSummary[]
  bibleVersions: BibleVersionInfo[]
  settings: AppSettings | null
  remoteInfo: RemoteServerInfo | null
  /** Mensaje de error de la última operación, si la hubo. */
  error: string | null
  /** Mensaje informativo breve de confirmación. */
  notice: string | null
  /** `true` mientras se ejecuta una operación IPC. */
  busy: boolean
  bridgeAvailable: boolean

  openProjection: (request?: ProjectionOpenRequest) => Promise<void>
  closeProjection: () => Promise<void>
  loadProjectionDeck: (request: ProjectionLoadDeckRequest) => Promise<void>
  goToSlide: (request: ProjectionGoToSlideRequest) => Promise<void>
  setProjectionMode: (mode: ProjectionDisplayMode) => Promise<void>
  updateProjectionTheme: (patch: Partial<ProjectionTheme>) => Promise<void>

  upsertSong: (input: SongInput) => Promise<void>
  deleteSong: (id: string) => Promise<void>
  parseRawLyrics: (rawText: string) => Promise<SongStanza[]>
  importHolyricsCatalog: (items: HolyricsImportItem[]) => Promise<void>

  getBibleChapter: (request: BibleChapterRequest) => Promise<BibleVerse[]>
  searchBible: (query: string, version?: string) => Promise<BibleVerse[]>
  loadBibleBooks: (version?: string) => Promise<BibleBookSummary[]>
  importBibleVersion: (request: BibleVersionImportRequest) => Promise<BibleVersionInfo[] | null>
  deleteBibleVersion: (id: string) => Promise<BibleVersionInfo[] | null>

  addScheduleItem: (input: ScheduleItemInput) => Promise<void>
  removeScheduleItem: (id: string) => Promise<void>
  moveScheduleItem: (request: ScheduleMoveRequest) => Promise<void>
  clearSchedule: () => Promise<void>

  addMedia: (input: MediaBackgroundInput) => Promise<void>
  deleteMedia: (id: string) => Promise<void>
  openMediaFolder: () => Promise<void>
  reloadMedia: () => Promise<void>
  openBackgroundsFolder?: () => Promise<void>
  reloadBackgrounds?: () => Promise<void>
  getYoutubeInfo: (url: string) => Promise<YoutubeVideoInfo>
  downloadYoutubeVideo: (request: YoutubeDownloadRequest) => Promise<void>
  cancelYoutubeDownload: () => Promise<boolean>

  presentations: PresentationDeck[]
  savePresentation: (deck: PresentationDeck) => Promise<void>
  deletePresentation: (id: string) => Promise<void>
  openSlidesFolder: () => Promise<void>
  reloadSlides: () => Promise<PresentationDeck[]>
  scanSlidesFolder?: () => Promise<Array<{ fileName: string; filePath: string; ext: string }>>

  startRemoteServer: () => Promise<void>
  stopRemoteServer: () => Promise<void>
  regenerateRemotePin: () => Promise<void>

  suggestForTheme: (theme: string) => Promise<AiSuggestionResult | null>
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>
  clearNotice: () => void
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Estado de la aplicación y acciones sincronizadas con el proceso principal. */
export function useAppStatus(): UseAppStatus {
  const api = window.lumen
  const [status, setStatus] = useState<AppStatus | null>(null)
  const [songs, setSongs] = useState<Song[]>([])
  const [schedule, setSchedule] = useState<ScheduleItem[]>([])
  const [media, setMedia] = useState<MediaBackground[]>([])
  const [presentations, setPresentations] = useState<PresentationDeck[]>([])
  const [bibleBooks, setBibleBooks] = useState<BibleBookSummary[]>([])
  const [bibleVersions, setBibleVersions] = useState<BibleVersionInfo[]>([])
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [remoteInfo, setRemoteInfo] = useState<RemoteServerInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!api) return
    let active = true
    api
      .getStatus()
      .then((initial) => {
        if (active) setStatus(initial)
      })
      .catch((err: unknown) => {
        if (active) setError(messageOf(err))
      })

    if (typeof api.listSongs === 'function') {
      void api.listSongs().then((res) => {
        if (active) setSongs(res)
      })
    }
    if (typeof api.listSchedule === 'function') {
      void api.listSchedule().then((res) => {
        if (active) setSchedule(res)
      })
    }
    if (typeof api.listMedia === 'function') {
      void api.listMedia().then((res) => {
        if (active) setMedia(res)
      })
    }
    if (typeof api.listPresentations === 'function') {
      void api.listPresentations().then((res) => {
        if (active) setPresentations(res)
      })
    }
    if (typeof api.listBibleBooks === 'function') {
      void api.listBibleBooks().then((res) => {
        if (active) setBibleBooks(res)
      })
    }
    if (typeof api.listBibleVersions === 'function') {
      void api.listBibleVersions().then((res) => {
        if (active) setBibleVersions(res)
      })
    }
    if (typeof api.getSettings === 'function') {
      void api.getSettings().then((res) => {
        if (active) setSettings(res)
      })
    }
    if (typeof api.getRemoteInfo === 'function') {
      void api.getRemoteInfo().then((res) => {
        if (active) setRemoteInfo(res)
      })
    }

    const unsubscribe = api.onStatusChanged((next) => {
      if (active) setStatus(next)
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [api])

  const runStatus = useCallback(async (action: () => Promise<AppStatus>) => {
    setBusy(true)
    setError(null)
    try {
      setStatus(await action())
    } catch (err: unknown) {
      setError(messageOf(err))
    } finally {
      setBusy(false)
    }
  }, [])

  const openProjection = useCallback(
    async (request?: ProjectionOpenRequest) => {
      if (api) await runStatus(() => api.openProjection(request))
    },
    [api, runStatus]
  )

  const closeProjection = useCallback(async () => {
    if (api) await runStatus(() => api.closeProjection())
  }, [api, runStatus])

  const loadProjectionDeck = useCallback(
    async (request: ProjectionLoadDeckRequest) => {
      if (api && typeof api.loadProjectionDeck === 'function') {
        await runStatus(async () => {
          if (status?.projection.live.theme.frozen && typeof api.updateProjectionTheme === 'function') {
            await api.updateProjectionTheme({ frozen: false })
          }
          let next = await api.loadProjectionDeck({
            deckTitle: request.deckTitle,
            slides: request.slides,
            ...(request.startIndex !== undefined ? { startIndex: request.startIndex } : {})
          })
          if (
            next.projection.live.mode !== 'live' &&
            typeof api.setProjectionMode === 'function'
          ) {
            next = await api.setProjectionMode({ mode: 'live' })
          }
          if (
            request.openWindow &&
            !next.projection.windowOpen &&
            typeof api.openProjection === 'function'
          ) {
            next = await api.openProjection({ target: 'auto' })
          }
          return next
        })
        setNotice(`Proyectando: ${request.deckTitle}`)
      }
    },
    [api, runStatus, status?.projection.live.theme.frozen]
  )

  const goToSlide = useCallback(
    async (request: ProjectionGoToSlideRequest) => {
      if (api && typeof api.goToSlide === 'function') {
        await runStatus(() => api.goToSlide(request))
      }
    },
    [api, runStatus]
  )

  const setProjectionMode = useCallback(
    async (mode: ProjectionDisplayMode) => {
      if (api && typeof api.setProjectionMode === 'function') {
        await runStatus(() => api.setProjectionMode({ mode }))
      }
    },
    [api, runStatus]
  )

  const updateProjectionTheme = useCallback(
    async (patch: Partial<ProjectionTheme>) => {
      if (api && typeof api.updateProjectionTheme === 'function') {
        await runStatus(() => api.updateProjectionTheme(patch))
        setNotice('Tema de proyección actualizado.')
      }
    },
    [api, runStatus]
  )

  const upsertSong = useCallback(
    async (input: SongInput) => {
      if (!api || typeof api.upsertSong !== 'function') return
      setBusy(true)
      setError(null)
      try {
        setSongs(await api.upsertSong(input))
        setNotice(`Alabanza "${input.title}" guardada.`)
      } catch (err: unknown) {
        setError(messageOf(err))
      } finally {
        setBusy(false)
      }
    },
    [api]
  )

  const deleteSong = useCallback(
    async (id: string) => {
      if (!api || typeof api.deleteSong !== 'function') return
      setBusy(true)
      setError(null)
      try {
        setSongs(await api.deleteSong(id))
        setNotice('Alabanza eliminada.')
      } catch (err: unknown) {
        setError(messageOf(err))
      } finally {
        setBusy(false)
      }
    },
    [api]
  )

  const parseRawLyrics = useCallback(
    async (rawText: string): Promise<SongStanza[]> => {
      if (api && typeof api.parseRawLyrics === 'function') {
        return await api.parseRawLyrics(rawText)
      }
      return parseRawLyricsToStanzas(rawText)
    },
    [api]
  )

  const importHolyricsCatalog = useCallback(
    async (items: HolyricsImportItem[]): Promise<void> => {
      if (!api || typeof api.importHolyricsCatalog !== 'function') return
      setBusy(true)
      setError(null)
      try {
        const updated = await api.importHolyricsCatalog(items)
        setSongs(updated)
        setNotice(`Catálogo Holyrics importado (${updated.length} alabanzas en biblioteca).`)
      } catch (err: unknown) {
        setError(messageOf(err))
      } finally {
        setBusy(false)
      }
    },
    [api]
  )

  const getBibleChapter = useCallback(
    async (request: BibleChapterRequest): Promise<BibleVerse[]> => {
      if (!api || typeof api.getBibleChapter !== 'function') return []
      return await api.getBibleChapter(request)
    },
    [api]
  )

  const searchBible = useCallback(
    async (query: string, version?: string): Promise<BibleVerse[]> => {
      if (!api || typeof api.searchBible !== 'function') return []
      return await api.searchBible(query, version)
    },
    [api]
  )

  const loadBibleBooks = useCallback(
    async (version?: string): Promise<BibleBookSummary[]> => {
      if (!api || typeof api.listBibleBooks !== 'function') return []
      const res = await api.listBibleBooks(version)
      setBibleBooks(res)
      return res
    },
    [api]
  )

  const importBibleVersion = useCallback(
    async (request: BibleVersionImportRequest): Promise<BibleVersionInfo[] | null> => {
      if (!api || typeof api.importBibleVersion !== 'function') return null
      setBusy(true)
      setError(null)
      try {
        const updated = await api.importBibleVersion(request)
        setBibleVersions(updated)
        setNotice(`Versión "${request.name}" importada correctamente.`)
        return updated
      } catch (err: unknown) {
        setError(messageOf(err))
        return null
      } finally {
        setBusy(false)
      }
    },
    [api]
  )

  const deleteBibleVersion = useCallback(
    async (id: string): Promise<BibleVersionInfo[] | null> => {
      if (!api || typeof api.deleteBibleVersion !== 'function') return null
      setBusy(true)
      setError(null)
      try {
        const updated = await api.deleteBibleVersion(id)
        setBibleVersions(updated)
        setNotice('Versión eliminada.')
        return updated
      } catch (err: unknown) {
        setError(messageOf(err))
        return null
      } finally {
        setBusy(false)
      }
    },
    [api]
  )

  const addScheduleItem = useCallback(
    async (input: ScheduleItemInput) => {
      if (!api || typeof api.addScheduleItem !== 'function') return
      setBusy(true)
      setError(null)
      try {
        setSchedule(await api.addScheduleItem(input))
        setNotice(`Añadido a la programación: ${input.title}`)
      } catch (err: unknown) {
        setError(messageOf(err))
      } finally {
        setBusy(false)
      }
    },
    [api]
  )

  const removeScheduleItem = useCallback(
    async (id: string) => {
      if (!api || typeof api.removeScheduleItem !== 'function') return
      setSchedule(await api.removeScheduleItem(id))
    },
    [api]
  )

  const moveScheduleItem = useCallback(
    async (request: ScheduleMoveRequest) => {
      if (!api || typeof api.moveScheduleItem !== 'function') return
      setSchedule(await api.moveScheduleItem(request))
    },
    [api]
  )

  const clearSchedule = useCallback(async () => {
    if (!api || typeof api.clearSchedule !== 'function') return
    setSchedule(await api.clearSchedule())
    setNotice('Programación vaciada.')
  }, [api])

  const addMedia = useCallback(
    async (input: MediaBackgroundInput) => {
      if (!api || typeof api.addMedia !== 'function') return
      setBusy(true)
      setError(null)
      try {
        setMedia(await api.addMedia(input))
        setNotice(`Fondo "${input.name}" añadido.`)
      } catch (err: unknown) {
        setError(messageOf(err))
      } finally {
        setBusy(false)
      }
    },
    [api]
  )

  const deleteMedia = useCallback(
    async (id: string) => {
      if (!api || typeof api.deleteMedia !== 'function') return
      setMedia(await api.deleteMedia(id))
    },
    [api]
  )

  const openMediaFolder = useCallback(async () => {
    if (!api || typeof api.openMediaFolder !== 'function') {
      setNotice('Carpeta de medios disponible en la aplicación de escritorio.')
      return
    }
    try {
      const folderPath = await api.openMediaFolder()
      setNotice(`Carpeta de medios abierta: ${folderPath}`)
      if (typeof api.listMedia === 'function') {
        setMedia(await api.listMedia())
      }
    } catch (err: unknown) {
      setError(messageOf(err))
    }
  }, [api])

  const reloadMedia = useCallback(async () => {
    if (!api) return
    try {
      if (typeof api.reloadMedia === 'function') {
        setMedia(await api.reloadMedia())
        setNotice('Medios actualizados desde el almacenamiento local.')
      } else if (typeof api.listMedia === 'function') {
        setMedia(await api.listMedia())
      }
    } catch (err: unknown) {
      setError(messageOf(err))
    }
  }, [api])

  const openBackgroundsFolder = useCallback(async () => {
    if (!api || typeof api.openBackgroundsFolder !== 'function') return
    try {
      const folderPath = await api.openBackgroundsFolder()
      setNotice(`Carpeta de fondos abierta: ${folderPath}`)
      if (typeof api.listMedia === 'function') {
        setMedia(await api.listMedia())
      }
    } catch (err: unknown) {
      setError(messageOf(err))
    }
  }, [api])

  const reloadBackgrounds = useCallback(async () => {
    if (!api) return
    try {
      if (typeof api.reloadBackgrounds === 'function') {
        setMedia(await api.reloadBackgrounds())
        setNotice('Fondos actualizados desde el almacenamiento local.')
      } else if (typeof api.listMedia === 'function') {
        setMedia(await api.listMedia())
      }
    } catch (err: unknown) {
      setError(messageOf(err))
    }
  }, [api])

  const getYoutubeInfo = useCallback(
    async (url: string) => {
      if (!api || typeof api.getYoutubeInfo !== 'function') {
        throw new Error('Función de YouTube no disponible.')
      }
      return await api.getYoutubeInfo(url)
    },
    [api]
  )

  const downloadYoutubeVideo = useCallback(
    async (request: YoutubeDownloadRequest) => {
      if (!api || typeof api.downloadYoutubeVideo !== 'function') {
        throw new Error('Función de descarga no disponible.')
      }
      setBusy(true)
      setError(null)
      try {
        const updated = await api.downloadYoutubeVideo(request)
        setMedia(updated)
        setNotice('Vídeo descargado con éxito y añadido a Medios.')
      } catch (err: unknown) {
        setError(messageOf(err))
        throw err
      } finally {
        setBusy(false)
      }
    },
    [api]
  )

  const cancelYoutubeDownload = useCallback(async () => {
    if (!api || typeof api.cancelYoutubeDownload !== 'function') return false
    return await api.cancelYoutubeDownload()
  }, [api])

  const savePresentation = useCallback(
    async (deck: PresentationDeck) => {
      if (!api || typeof api.savePresentation !== 'function') {
        setPresentations((prev) => {
          const idx = prev.findIndex((p) => p.id === deck.id || p.title.toLowerCase() === deck.title.toLowerCase())
          return idx !== -1 ? prev.map((p, i) => (i === idx ? deck : p)) : [deck, ...prev]
        })
        return
      }
      try {
        setPresentations(await api.savePresentation(deck))
      } catch (err: unknown) {
        setError(messageOf(err))
      }
    },
    [api]
  )

  const deletePresentation = useCallback(
    async (id: string) => {
      if (!api || typeof api.deletePresentation !== 'function') {
        setPresentations((prev) => prev.filter((p) => p.id !== id))
        return
      }
      try {
        setPresentations(await api.deletePresentation(id))
      } catch (err: unknown) {
        setError(messageOf(err))
      }
    },
    [api]
  )

  const openSlidesFolder = useCallback(async () => {
    if (!api || typeof api.openSlidesFolder !== 'function') return
    try {
      const folderPath = await api.openSlidesFolder()
      setNotice(`Carpeta de diapositivas abierta: ${folderPath}`)
    } catch (err: unknown) {
      setError(messageOf(err))
    }
  }, [api])

  const reloadSlides = useCallback(async (): Promise<PresentationDeck[]> => {
    if (!api) return []
    try {
      if (typeof api.reloadSlides === 'function') {
        const reloaded = await api.reloadSlides()
        setPresentations(reloaded)
        setNotice('Diapositivas actualizadas.')
        return reloaded
      } else if (typeof api.listPresentations === 'function') {
        const list = await api.listPresentations()
        setPresentations(list)
        return list
      }
      return []
    } catch (err: unknown) {
      setError(messageOf(err))
      return []
    }
  }, [api])

  const scanSlidesFolder = useCallback(async () => {
    if (!api || typeof api.scanSlidesFolder !== 'function') return []
    try {
      return await api.scanSlidesFolder()
    } catch (err: unknown) {
      setError(messageOf(err))
      return []
    }
  }, [api])

  const startRemoteServer = useCallback(async () => {
    if (!api || typeof api.startRemoteServer !== 'function') return
    setBusy(true)
    setError(null)
    try {
      setRemoteInfo(await api.startRemoteServer())
      setNotice('Servidor de control remoto iniciado en red local.')
    } catch (err: unknown) {
      setError(messageOf(err))
    } finally {
      setBusy(false)
    }
  }, [api])

  const stopRemoteServer = useCallback(async () => {
    if (!api || typeof api.stopRemoteServer !== 'function') return
    setBusy(true)
    setError(null)
    try {
      setRemoteInfo(await api.stopRemoteServer())
      setNotice('Servidor de control remoto detenido.')
    } catch (err: unknown) {
      setError(messageOf(err))
    } finally {
      setBusy(false)
    }
  }, [api])

  const regenerateRemotePin = useCallback(async () => {
    if (!api || typeof api.regenerateRemotePin !== 'function') return
    setRemoteInfo(await api.regenerateRemotePin())
    setNotice('Nuevo PIN de acceso generado.')
  }, [api])

  const suggestForTheme = useCallback(
    async (theme: string): Promise<AiSuggestionResult | null> => {
      if (!api || typeof api.suggestForTheme !== 'function') return null
      setBusy(true)
      setError(null)
      try {
        return await api.suggestForTheme(theme)
      } catch (err: unknown) {
        setError(messageOf(err))
        return null
      } finally {
        setBusy(false)
      }
    },
    [api]
  )

  const updateSettings = useCallback(
    async (patch: Partial<AppSettings>) => {
      if (!api || typeof api.updateSettings !== 'function') return
      setBusy(true)
      setError(null)
      try {
        setSettings(await api.updateSettings(patch))
        setNotice('Configuración guardada.')
      } catch (err: unknown) {
        setError(messageOf(err))
      } finally {
        setBusy(false)
      }
    },
    [api]
  )

  const clearNotice = useCallback(() => {
    setNotice(null)
  }, [])

  return {
    status,
    songs,
    schedule,
    media,
    bibleBooks,
    bibleVersions,
    settings,
    remoteInfo,
    error,
    notice,
    busy,
    bridgeAvailable: api !== undefined,
    openProjection,
    closeProjection,
    loadProjectionDeck,
    goToSlide,
    setProjectionMode,
    updateProjectionTheme,
    upsertSong,
    deleteSong,
    parseRawLyrics,
    importHolyricsCatalog,
    getBibleChapter,
    searchBible,
    loadBibleBooks,
    importBibleVersion,
    deleteBibleVersion,
    addScheduleItem,
    removeScheduleItem,
    moveScheduleItem,
    clearSchedule,
    addMedia,
    deleteMedia,
    openMediaFolder,
    reloadMedia,
    openBackgroundsFolder,
    reloadBackgrounds,
    getYoutubeInfo,
    downloadYoutubeVideo,
    cancelYoutubeDownload,
    presentations,
    savePresentation,
    deletePresentation,
    openSlidesFolder,
    reloadSlides,
    scanSlidesFolder,
    startRemoteServer,
    stopRemoteServer,
    regenerateRemotePin,
    suggestForTheme,
    updateSettings,
    clearNotice
  }
}
