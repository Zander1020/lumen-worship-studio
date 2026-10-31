import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron'
import { IpcChannels, type AppInfo, type IpcChannel } from '../../shared/ipc'
import { parseRawLyricsToStanzas } from '../../shared/slideHelpers'
import {
  ValidationError,
  assertNoPayload,
  parseBibleChapterRequest,
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
  parseSongInput
} from '../../shared/validation'
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
    const curTheme = ctx.store.get().projection.live.theme
    if (curTheme.background && (curTheme.background.category === 'Culto' || curTheme.background.id.startsWith('culto-') || curTheme.background.id.startsWith('img-'))) {
      const savedBg = ctx.workspace.getSettings().theme?.background
      if (savedBg && savedBg.category !== 'Culto' && !savedBg.id.startsWith('culto-') && !savedBg.id.startsWith('img-')) {
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
    const nextTheme = ctx.store.get().projection.live.theme
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
    assertNoPayload(payload)
    return ctx.workspace.listBibleBooks()
  })

  handle(IpcChannels.bibleGetChapter, onlyMain, (payload) => {
    const req = parseBibleChapterRequest(payload)
    return ctx.workspace.getBibleChapter(req.book, req.chapter, req.version)
  })

  handle(IpcChannels.bibleSearch, onlyMain, (payload) => {
    const query = parseRawString(payload, 'query', 200)
    return ctx.workspace.searchBible(query)
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

  handle(IpcChannels.backgroundsOpenFolder, onlyMain, async (payload) => {
    assertNoPayload(payload)
    return await ctx.workspace.openBackgroundsFolder()
  })

  handle(IpcChannels.backgroundsReload, onlyMain, (payload) => {
    assertNoPayload(payload)
    return ctx.workspace.reloadBackgrounds()
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

  return () => {
    for (const channel of registered) ipcMain.removeHandler(channel)
  }
}

function compact(ids: (number | null)[]): number[] {
  return ids.filter((id): id is number => id !== null)
}
