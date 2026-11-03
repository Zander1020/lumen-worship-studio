import { clipboard, ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron'
import { IpcChannels, type AppInfo, type IpcChannel } from '../../shared/ipc'
import type { PresentationDeck } from '../../shared/models'
import { parseRawLyricsToStanzas } from '../../shared/slideHelpers'
import {
  ValidationError,
  assertNoPayload,
  parseBibleBooksRequest,
  parseBibleChapterRequest,
  parseBibleSearchRequest,
  parseBibleVersionImportRequest,
  parseHolyricsImportPayload,
  parseMediaBackgroundInput,
  parseNonEmptyId,
  parseProjectionGoToSlideRequest,
  parseProjectionLoadDeckRequest,
  parseProjectionOpenRequest,
  parseProjectionSetModeRequest,
  parseProjectionThemePatch,
  parseRawString,
  parseScheduleItemInput,
  parseScheduleMoveRequest,
  parseSettingsPatch,
  parseSongInput,
  parseYoutubeDownloadRequest,
  parseYoutubeInfoRequest
} from '../../shared/validation'
import { AiService, type AiChatMessage } from '../services/aiService'
import { getYoutubeInfo, youtubeDownloadManager } from '../services/youtubeDownloader'
import type { RemoteControlServer } from '../remote/remoteControlServer'
import { isSenderAllowed, type SenderInfo } from '../security/senderPolicy'
import type { StatusStore } from '../state/statusStore'
import type { WorkspaceStore } from '../state/workspaceStore'
import type { ProjectionWindowManager } from '../windows/projectionWindow'

export interface IpcContext {
  store: StatusStore
  workspace: WorkspaceStore
  remote: RemoteControlServer
  projection: ProjectionWindowManager
  getMainWebContentsId: () => number | null
  getMainWindow?: () => BrowserWindow | null
  getAppInfo: () => AppInfo
  devServerUrl: string | undefined
}

type AllowedSenders = () => number[]
type Handler = (payload: unknown) => unknown

function describeSender(event: IpcMainInvokeEvent): SenderInfo {
  const frame = event.senderFrame
  return {
    webContentsId: event.sender.id,
    frameUrl: frame?.url,
    isMainFrame: frame ? frame.parent === null : false
  }
}

/**
 * Registra todos los manejadores IPC. Cada canal declara qué ventanas pueden
 * usarlo; los parámetros se validan antes de ejecutar cualquier acción.
 */
export function registerIpcHandlers(ctx: IpcContext): () => void {
  const registered: IpcChannel[] = []

  const handle = (channel: IpcChannel, allowed: AllowedSenders, handler: Handler): void => {
    ipcMain.handle(channel, async (event, ...args: unknown[]) => {
      if (!isSenderAllowed(describeSender(event), allowed(), ctx.devServerUrl)) {
        console.warn(`[ipc] Remitente no autorizado en "${channel}"`)
        throw new Error('Remitente IPC no autorizado.')
      }
      if (args.length > 1) {
        throw new ValidationError('Demasiados argumentos.')
      }
      return await handler(args[0])
    })
    registered.push(channel)
  }

  const onlyMain: AllowedSenders = () => compact([ctx.getMainWebContentsId()])
  const mainAndProjection: AllowedSenders = () =>
    compact([ctx.getMainWebContentsId(), ctx.projection.getWebContentsId()])

  handle(IpcChannels.appGetInfo, onlyMain, (payload) => {
    assertNoPayload(payload)
    return ctx.getAppInfo()
  })

  handle(IpcChannels.statusGet, mainAndProjection, (payload) => {
    assertNoPayload(payload)
    return ctx.store.get()
  })

  handle(IpcChannels.projectionOpen, onlyMain, async (payload) => {
    const request = parseProjectionOpenRequest(payload)
    await ctx.projection.open(request.target)
    return ctx.store.get()
  })

  handle(IpcChannels.projectionClose, mainAndProjection, async (payload) => {
    assertNoPayload(payload)
    await ctx.projection.close()
    return ctx.store.get()
  })

  handle(IpcChannels.projectionLoadDeck, onlyMain, async (payload) => {
    const request = parseProjectionLoadDeckRequest(payload)
    const curTheme = ctx.store.getLiveTheme()
    if (curTheme.background.category === 'Culto' || curTheme.background.id.startsWith('culto-') || curTheme.background.id.startsWith('img-')) {
      const savedBg = ctx.workspace.getSettings().theme.background
      if (savedBg.category !== 'Culto' && !savedBg.id.startsWith('culto-') && !savedBg.id.startsWith('img-')) {
        ctx.store.updateTheme({ background: savedBg })
      } else {
        const defaultBg = ctx.workspace.listMedia().find((m) => m.category === 'Fondo' || m.id.startsWith('bg-'))
        if (defaultBg) {
          ctx.store.updateTheme({ background: defaultBg })
        }
      }
    }
    ctx.store.loadDeck(request)
    if (request.openWindow && !ctx.projection.isOpen()) {
      const target = ctx.workspace.getSettings().defaultProjectionTarget
      await ctx.projection.open(target)
    }
    return ctx.store.get()
  })

  handle(IpcChannels.projectionGoToSlide, onlyMain, (payload) => {
    const request = parseProjectionGoToSlideRequest(payload)
    ctx.store.goToSlide(request)
    return ctx.store.get()
  })

  handle(IpcChannels.projectionSetMode, onlyMain, (payload) => {
    const request = parseProjectionSetModeRequest(payload)
    ctx.store.setMode(request.mode)
    return ctx.store.get()
  })

  handle(IpcChannels.projectionUpdateTheme, onlyMain, (payload) => {
    const patch = parseProjectionThemePatch(payload)
    ctx.store.updateTheme(patch)
    const nextTheme = ctx.store.getLiveTheme()
    ctx.workspace.updateSettings({ theme: nextTheme })
    return ctx.store.get()
  })

  // --- Canciones ---

  handle(IpcChannels.songsList, onlyMain, (payload) => {
    assertNoPayload(payload)
    return ctx.workspace.listSongs()
  })

  handle(IpcChannels.songsUpsert, onlyMain, (payload) => {
    const songInput = parseSongInput(payload)
    return ctx.workspace.upsertSong(songInput)
  })

  handle(IpcChannels.songsDelete, onlyMain, (payload) => {
    const id = parseNonEmptyId(payload, 'songId')
    return ctx.workspace.deleteSong(id)
  })

  handle(IpcChannels.songsParseRaw, onlyMain, (payload) => {
    const rawText = parseRawString(payload, 'rawLyrics', 30_000)
    return parseRawLyricsToStanzas(rawText)
  })

  handle(IpcChannels.songsImportHolyrics, onlyMain, (payload) => {
    const items = parseHolyricsImportPayload(payload)
    return ctx.workspace.importHolyricsCatalog(items)
  })

  // --- Biblia ---

  handle(IpcChannels.bibleBooks, onlyMain, (payload) => {
    const req = parseBibleBooksRequest(payload)
    return ctx.workspace.listBibleBooks(req.version)
  })

  handle(IpcChannels.bibleGetChapter, onlyMain, (payload) => {
    const req = parseBibleChapterRequest(payload)
    return ctx.workspace.getBibleChapter(req.book, req.chapter, req.version)
  })

  handle(IpcChannels.bibleSearch, onlyMain, (payload) => {
    const req = parseBibleSearchRequest(payload)
    return ctx.workspace.searchBible(req.query, req.version)
  })

  handle(IpcChannels.bibleVersions, onlyMain, (payload) => {
    assertNoPayload(payload)
    return ctx.workspace.listBibleVersions()
  })

  handle(IpcChannels.bibleImportVersion, onlyMain, (payload) => {
    const req = parseBibleVersionImportRequest(payload)
    return ctx.workspace.importBibleVersion(req)
  })

  handle(IpcChannels.bibleDeleteVersion, onlyMain, (payload) => {
    const id = parseNonEmptyId(payload, 'versionId')
    return ctx.workspace.deleteBibleVersion(id)
  })

  // --- Programación ---

  handle(IpcChannels.scheduleList, onlyMain, (payload) => {
    assertNoPayload(payload)
    return ctx.workspace.listSchedule()
  })

  handle(IpcChannels.scheduleAdd, onlyMain, (payload) => {
    const itemInput = parseScheduleItemInput(payload)
    return ctx.workspace.addScheduleItem(itemInput)
  })

  handle(IpcChannels.scheduleRemove, onlyMain, (payload) => {
    const id = parseNonEmptyId(payload, 'scheduleItemId')
    return ctx.workspace.removeScheduleItem(id)
  })

  handle(IpcChannels.scheduleMove, onlyMain, (payload) => {
    const moveReq = parseScheduleMoveRequest(payload)
    return ctx.workspace.moveScheduleItem(moveReq)
  })

  handle(IpcChannels.scheduleClear, onlyMain, (payload) => {
    assertNoPayload(payload)
    return ctx.workspace.clearSchedule()
  })

  // --- Multimedia ---

  handle(IpcChannels.mediaList, onlyMain, (payload) => {
    assertNoPayload(payload)
    return ctx.workspace.listMedia()
  })

  handle(IpcChannels.mediaAdd, onlyMain, (payload) => {
    const mediaInput = parseMediaBackgroundInput(payload)
    return ctx.workspace.addMedia(mediaInput)
  })

  handle(IpcChannels.mediaDelete, onlyMain, (payload) => {
    const id = parseNonEmptyId(payload, 'mediaId')
    return ctx.workspace.deleteMedia(id)
  })

  handle(IpcChannels.mediaOpenFolder, onlyMain, async (payload) => {
    assertNoPayload(payload)
    return await ctx.workspace.openMediaFolder()
  })

  handle(IpcChannels.mediaReload, onlyMain, (payload) => {
    assertNoPayload(payload)
    return ctx.workspace.reloadMedia()
  })

  handle(IpcChannels.mediaYoutubeGetInfo, onlyMain, async (payload) => {
    const req = parseYoutubeInfoRequest(payload)
    return await getYoutubeInfo(req.url)
  })

  handle(IpcChannels.mediaYoutubeDownload, onlyMain, async (payload) => {
    const req = parseYoutubeDownloadRequest(payload)
    const mediaDir = ctx.workspace.getMediaDirectory()
    const { app } = await import('electron')
    const userDataDir = app.getPath('userData')

    const downloaded = await youtubeDownloadManager.download({
      request: req,
      mediaDir,
      userDataDir,
      onProgress: (p) => {
        const mainWin = ctx.getMainWindow?.()
        if (mainWin && !mainWin.isDestroyed()) {
          mainWin.webContents.send(IpcChannels.mediaYoutubeProgress, p)
        }
      }
    })

    const fileUrl = 'lumen-media://local/' + encodeURIComponent(downloaded.filePath.replace(/\\/g, '/'))
    return ctx.workspace.addMedia({
      name: downloaded.title,
      kind: 'video',
      value: fileUrl,
      category: req.category || 'Culto',
      accentColor: '#38bdf8'
    })
  })

  handle(IpcChannels.mediaYoutubeCancel, onlyMain, (payload) => {
    assertNoPayload(payload)
    return youtubeDownloadManager.cancel()
  })

  handle(IpcChannels.backgroundsOpenFolder, onlyMain, async (payload) => {
    assertNoPayload(payload)
    return await ctx.workspace.openBackgroundsFolder()
  })

  handle(IpcChannels.backgroundsReload, onlyMain, (payload) => {
    assertNoPayload(payload)
    return ctx.workspace.reloadBackgrounds()
  })

  handle(IpcChannels.slidesList, onlyMain, (payload) => {
    assertNoPayload(payload)
    return ctx.workspace.listPresentations()
  })

  handle(IpcChannels.slidesSave, onlyMain, (payload) => {
    return ctx.workspace.savePresentation(payload as PresentationDeck)
  })

  handle(IpcChannels.slidesDelete, onlyMain, (payload) => {
    const id = parseRawString(payload, 'id', 200)
    return ctx.workspace.deletePresentation(id)
  })

  handle(IpcChannels.slidesOpenFolder, onlyMain, async (payload) => {
    assertNoPayload(payload)
    return await ctx.workspace.openSlidesFolder()
  })

  handle(IpcChannels.slidesReload, onlyMain, (payload) => {
    assertNoPayload(payload)
    return ctx.workspace.reloadSlides()
  })

  handle(IpcChannels.slidesScanFolder, onlyMain, (payload) => {
    assertNoPayload(payload)
    return ctx.workspace.scanSlidesFolderFiles()
  })

  handle(IpcChannels.appOpenExternal, onlyMain, async (payload) => {
    const url = parseRawString(payload, 'url', 1000)
    if (url.startsWith('https://wa.me/') || url.startsWith('mailto:') || url.startsWith('https://api.whatsapp.com/')) {
      const { shell } = await import('electron')
      await shell.openExternal(url)
      return true
    }
    return false
  })

  handle(IpcChannels.appReadClipboard, onlyMain, (payload) => {
    assertNoPayload(payload)
    return clipboard.readText()
  })

  // --- Control remoto móvil ---

  handle(IpcChannels.remoteGetInfo, onlyMain, (payload) => {
    assertNoPayload(payload)
    return ctx.remote.getInfo()
  })

  handle(IpcChannels.remoteStart, onlyMain, async (payload) => {
    assertNoPayload(payload)
    return await ctx.remote.start()
  })

  handle(IpcChannels.remoteStop, onlyMain, async (payload) => {
    assertNoPayload(payload)
    return await ctx.remote.stop()
  })

  handle(IpcChannels.remoteRegeneratePin, onlyMain, (payload) => {
    assertNoPayload(payload)
    return ctx.remote.regeneratePin()
  })

  // --- Asistente inteligente local ---

  handle(IpcChannels.aiSuggestForTheme, onlyMain, (payload) => {
    const theme = parseRawString(payload, 'theme', 200)
    return ctx.workspace.suggestForTheme(theme)
  })

  handle(IpcChannels.aiChat, onlyMain, async (payload) => {
    if (!Array.isArray(payload)) throw new ValidationError('Payload inválido.')
    const messages = payload
      .filter((m): m is { role: string; content: string } => !!m && typeof m === 'object' && typeof (m as { content?: unknown }).content === 'string' && typeof (m as { role?: unknown }).role === 'string')
      .map((m) => ({ role: m.role as AiChatMessage['role'], content: m.content.slice(0, 8000) }))
      .filter((m): m is AiChatMessage => ['user', 'assistant', 'system'].includes(m.role))
    if (messages.length === 0) throw new ValidationError('Sin mensajes.')
    const settings = ctx.workspace.getSettings()
    return await AiService.chat(
      {
        provider: settings.aiProvider,
        apiKey: settings.aiApiKey,
        model: settings.aiModel,
        customUrl: settings.aiCustomUrl
      },
      messages
    )
  })

  // --- Configuración ---

  handle(IpcChannels.settingsGet, onlyMain, (payload) => {
    assertNoPayload(payload)
    return ctx.workspace.getSettings()
  })

  handle(IpcChannels.settingsUpdate, onlyMain, (payload) => {
    const patch = parseSettingsPatch(payload)
    const updated = ctx.workspace.updateSettings(patch)
    ctx.store.updateLive({
      churchName: updated.churchName,
      welcomeSubtitle: updated.welcomeSubtitle,
      showClockOnLogo: updated.showClockOnLogo,
      theme: updated.theme
    })
    return updated
  })

  // --- Control de Ventana Principal ---

  handle(IpcChannels.windowMinimize, onlyMain, () => {
    const win = ctx.getMainWindow ? ctx.getMainWindow() : null
    if (win && !win.isDestroyed()) {
      win.minimize()
      return true
    }
    return false
  })

  handle(IpcChannels.windowMaximize, onlyMain, () => {
    const win = ctx.getMainWindow ? ctx.getMainWindow() : null
    if (win && !win.isDestroyed()) {
      if (win.isMaximized()) {
        win.unmaximize()
        return false
      } else {
        win.maximize()
        return true
      }
    }
    return false
  })

  handle(IpcChannels.windowClose, onlyMain, () => {
    const win = ctx.getMainWindow ? ctx.getMainWindow() : null
    if (win && !win.isDestroyed()) {
      win.close()
      return true
    }
    return false
  })

  handle(IpcChannels.windowIsMaximized, onlyMain, () => {
    const win = ctx.getMainWindow ? ctx.getMainWindow() : null
    return win && !win.isDestroyed() ? win.isMaximized() : false
  })

  ipcMain.handle(IpcChannels.aiChatStream, async (event, ...args: unknown[]) => {
    if (args.length > 1) throw new ValidationError('Demasiados argumentos.')
    const payload = args[0]
    if (!payload || typeof payload !== 'object') throw new ValidationError('Payload inválido.')
    const obj = payload as { messages?: unknown; requestId?: unknown }
    const requestId = typeof obj.requestId === 'string' ? obj.requestId : String(Date.now())
    if (!Array.isArray(obj.messages)) throw new ValidationError('Payload inválido.')
    const messages = obj.messages
      .filter((m): m is { role: string; content: string } => !!m && typeof m === 'object' && typeof (m as { content?: unknown }).content === 'string' && typeof (m as { role?: unknown }).role === 'string')
      .map((m) => ({ role: m.role as AiChatMessage['role'], content: m.content.slice(0, 8000) }))
      .filter((m): m is AiChatMessage => ['user', 'assistant', 'system'].includes(m.role))
    if (messages.length === 0) {
      event.sender.send(IpcChannels.aiChatChunk, { requestId, chunk: '', done: true, error: 'Sin mensajes.' })
      return
    }
    const allowed = isSenderAllowed(describeSender(event), onlyMain(), ctx.devServerUrl)
    if (!allowed) {
      event.sender.send(IpcChannels.aiChatChunk, { requestId, chunk: '', done: true, error: 'Remitente no autorizado.' })
      return
    }
    const settings = ctx.workspace.getSettings()
    try {
      await AiService.streamChat(
        {
          provider: settings.aiProvider,
          apiKey: settings.aiApiKey,
          model: settings.aiModel,
          customUrl: settings.aiCustomUrl
        },
        messages,
        (chunk) => {
          if (!event.sender.isDestroyed()) {
            event.sender.send(IpcChannels.aiChatChunk, { requestId, chunk, done: false })
          }
        }
      )
      if (!event.sender.isDestroyed()) {
        event.sender.send(IpcChannels.aiChatChunk, { requestId, chunk: '', done: true })
      }
    } catch (err) {
      if (!event.sender.isDestroyed()) {
        event.sender.send(IpcChannels.aiChatChunk, {
          requestId,
          chunk: '',
          done: true,
          error: err instanceof Error ? err.message : String(err)
        })
      }
    }
  })

  registered.push(IpcChannels.aiChatStream)

  return () => {
    for (const channel of registered) ipcMain.removeHandler(channel)
  }
}

function compact(ids: (number | null)[]): number[] {
  return ids.filter((id): id is number => id !== null)
}
