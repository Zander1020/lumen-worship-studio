import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { networkInterfaces } from 'node:os'
import { extname } from 'node:path'
import type { ProjectionDisplayMode, RemoteServerInfo } from '../../shared/ipc'
import type { BibleVerse, ProjectionTheme } from '../../shared/models'
import { createAnnouncementSlide, songToSlides, versesToSlides } from '../../shared/slideHelpers'
import type { StatusStore } from '../state/statusStore'
import type { WorkspaceStore } from '../state/workspaceStore'

function getMimeType(filePath: string): string {
  const ext = extname(filePath).toLowerCase()
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.png':
      return 'image/png'
    case '.gif':
      return 'image/gif'
    case '.webp':
      return 'image/webp'
    case '.svg':
      return 'image/svg+xml'
    case '.mp4':
      return 'video/mp4'
    case '.webm':
      return 'video/webm'
    case '.mov':
      return 'video/quicktime'
    case '.mkv':
      return 'video/x-matroska'
    default:
      return 'application/octet-stream'
  }
}

function extractDiskPath(mediaValue: string): string | null {
  if (typeof mediaValue !== 'string') return null
  if (mediaValue.startsWith('lumen-media://local/')) {
    try {
      const rawUrl = new URL(mediaValue)
      let pathname = decodeURIComponent(rawUrl.pathname)
      if (/^\/[a-zA-Z]:/.test(pathname)) pathname = pathname.slice(1)
      return pathname.replace(/\//g, '\\')
    } catch {
      return null
    }
  }
  return null
}

export class RemoteControlServer {
  private server: Server | null = null
  private activePort = 0
  private readonly sseClients = new Set<ServerResponse>()
  private unsubscribeStore: (() => void) | null = null

  constructor(
    private readonly statusStore: StatusStore,
    private readonly workspace: WorkspaceStore,
    private readonly openProjectionWindow?: () => Promise<void>,
    private readonly closeProjectionWindow?: () => Promise<void>
  ) {}

  getInfo(): RemoteServerInfo {
    const settings = this.workspace.getSettings()
    const running = this.server !== null && this.server.listening
    const port = running ? this.activePort : settings.remotePort
    const urls = running ? this.computeUrls(port) : []
    return {
      running,
      port,
      pin: settings.remotePin,
      urls,
      connectedClients: this.sseClients.size
    }
  }

  async start(preferredPort?: number): Promise<RemoteServerInfo> {
    if (this.server && this.server.listening) {
      return this.getInfo()
    }

    const settings = this.workspace.getSettings()
    const targetPort = preferredPort ?? settings.remotePort

    const srv = createServer((req, res) => {
      this.handleRequest(req, res)
    })

    await new Promise<void>((resolve, reject) => {
      const onError = (err: NodeJS.ErrnoException): void => {
        if (err.code === 'EADDRINUSE' && targetPort !== 0) {
          srv.listen(0, '0.0.0.0')
          return
        }
        reject(err)
      }
      srv.once('error', onError)
      srv.listen(targetPort, '0.0.0.0', () => {
        srv.removeListener('error', onError)
        resolve()
      })
    })

    const addr = srv.address()
    this.activePort = typeof addr === 'object' && addr ? addr.port : targetPort
    this.server = srv

    this.unsubscribeStore = this.statusStore.subscribe((status) => {
      const payload = JSON.stringify({
        projection: status.projection,
        schedule: this.workspace.listSchedule()
      })
      for (const client of this.sseClients) {
        client.write(`data: ${payload}\n\n`)
      }
    })

    this.syncMobileStatus()
    return this.getInfo()
  }

  async stop(): Promise<RemoteServerInfo> {
    if (this.unsubscribeStore) {
      this.unsubscribeStore()
      this.unsubscribeStore = null
    }
    for (const client of this.sseClients) {
      client.end()
    }
    this.sseClients.clear()

    const srv = this.server
    this.server = null
    this.activePort = 0

    if (srv && srv.listening) {
      await new Promise<void>((resolve) => {
        srv.close(() => resolve())
      })
    }

    this.syncMobileStatus()
    return this.getInfo()
  }

  regeneratePin(): RemoteServerInfo {
    const newPin = String(Math.floor(1000 + Math.random() * 9000))
    this.workspace.updateSettings({ remotePin: newPin })
    this.syncMobileStatus()
    return this.getInfo()
  }

  private syncMobileStatus(): void {
    const info = this.getInfo()
    if (!info.running) {
      this.statusStore.updateMobile({
        state: 'not-started',
        connectedClients: 0
      })
      return
    }
    this.statusStore.updateMobile({
      state: info.connectedClients > 0 ? 'connected' : 'waiting',
      connectedClients: info.connectedClients,
      port: info.port,
      urls: info.urls,
      pin: info.pin
    })
  }

  private computeUrls(port: number): string[] {
    const nets = networkInterfaces()
    const urls: string[] = []
    for (const list of Object.values(nets)) {
      if (!list) continue
      for (const net of list) {
        if (net.family === 'IPv4' && !net.internal) {
          urls.push(`http://${net.address}:${port}`)
        }
      }
    }
    urls.push(`http://localhost:${port}`)
    return urls
  }

  private ensureActiveBackground(): void {
    const curTheme = this.statusStore.get().projection.live.theme
    // Solo corregir si el fondo actual era un medio del culto (categoría 'Culto' o id 'culto-')
    if (curTheme.background && (curTheme.background.category === 'Culto' || curTheme.background.id.startsWith('culto-'))) {
      const savedBg = this.workspace.getSettings().theme?.background
      if (savedBg && savedBg.category !== 'Culto' && !savedBg.id.startsWith('culto-')) {
        this.statusStore.updateTheme({ background: savedBg })
      } else {
        const defaultBg = this.workspace.listMedia().find((m) => m.category === 'Fondo' || m.id.startsWith('bg-'))
        if (defaultBg) {
          this.statusStore.updateTheme({ background: defaultBg })
        }
      }
    }
  }

  private isAuthorized(req: IncomingMessage): boolean {
    const expectedPin = this.workspace.getSettings().remotePin
    const urlObj = new URL(req.url ?? '/', 'http://localhost')
    const headerPin = req.headers['x-lumen-pin']
    const queryPin = urlObj.searchParams.get('pin')
    return headerPin === expectedPin || queryPin === expectedPin
  }

  handleRequest(req: IncomingMessage, res: ServerResponse): void {
    const urlObj = new URL(req.url ?? '/', 'http://localhost')
    const pathname = urlObj.pathname

    const noCacheHeaders = {
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      Pragma: 'no-cache',
      Expires: '0'
    }

    if (req.method === 'GET' && pathname === '/') {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        ...noCacheHeaders
      })
      res.end(renderMobileHtml())
      return
    }

    if (req.method === 'GET' && pathname === '/favicon.ico') {
      res.writeHead(204)
      res.end()
      return
    }

    if (req.method === 'GET' && pathname === '/stage') {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        ...noCacheHeaders
      })
      res.end(renderStageMonitorHtml())
      return
    }

    if (req.method === 'GET' && pathname === '/obs') {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        ...noCacheHeaders
      })
      res.end(renderObsOverlayHtml())
      return
    }

    // Servicio de streaming y visualización de archivos de imágenes y vídeos
    if (req.method === 'GET' && pathname === '/api/media/file') {
      if (!this.isAuthorized(req)) {
        res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ ok: false, error: 'PIN requerido' }))
        return
      }
      const id = urlObj.searchParams.get('id')
      if (!id) {
        res.writeHead(400, { 'Content-Type': 'text/plain' })
        res.end('Falta id')
        return
      }
      const media = this.workspace.listMedia().find((m) => m.id === id)
      if (!media) {
        res.writeHead(404, { 'Content-Type': 'text/plain' })
        res.end('Medio no encontrado')
        return
      }

      if (typeof media.value === 'string' && media.value.startsWith('data:')) {
        const comma = media.value.indexOf(',')
        if (comma !== -1) {
          const header = media.value.slice(0, comma)
          const mime = header.replace(/^data:/, '').replace(/;base64$/, '') || 'image/png'
          const buf = Buffer.from(media.value.slice(comma + 1), 'base64')
          res.writeHead(200, {
            'Content-Type': mime,
            'Content-Length': buf.length,
            'Cache-Control': 'public, max-age=3600'
          })
          res.end(buf)
          return
        }
      }

      const diskPath = extractDiskPath(media.value)
      if (diskPath && existsSync(diskPath)) {
        try {
          const stat = statSync(diskPath)
          const fileSize = stat.size
          const mime = getMimeType(diskPath)
          const range = req.headers.range

          if (range && mime.startsWith('video/')) {
            const parts = range.replace(/bytes=/, '').split('-')
            const start = parseInt(parts[0] ?? '0', 10)
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
            const chunkSize = end - start + 1
            const stream = createReadStream(diskPath, { start, end })
            res.writeHead(206, {
              'Content-Range': `bytes ${start}-${end}/${fileSize}`,
              'Accept-Ranges': 'bytes',
              'Content-Length': chunkSize,
              'Content-Type': mime
            })
            stream.pipe(res)
            return
          } else {
            res.writeHead(200, {
              'Content-Length': fileSize,
              'Content-Type': mime,
              'Accept-Ranges': 'bytes',
              'Cache-Control': 'public, max-age=1800'
            })
            createReadStream(diskPath).pipe(res)
            return
          }
        } catch {
          res.writeHead(500, { 'Content-Type': 'text/plain' })
          res.end('Error al leer archivo')
          return
        }
      }

      res.writeHead(404, { 'Content-Type': 'text/plain' })
      res.end('Archivo no disponible en disco')
      return
    }

    if (!this.isAuthorized(req)) {
      res.writeHead(401, {
        'Content-Type': 'application/json; charset=utf-8',
        ...noCacheHeaders
      })
      res.end(JSON.stringify({ ok: false, error: 'PIN inválido o no proporcionado.' }))
      return
    }

    if (req.method === 'GET' && pathname === '/api/state') {
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        ...noCacheHeaders
      })
      res.end(
        JSON.stringify({
          ok: true,
          projection: this.statusStore.get().projection,
          schedule: this.workspace.listSchedule()
        })
      )
      return
    }

    if (req.method === 'GET' && pathname === '/api/media') {
      const pin = (urlObj.searchParams.get('pin') || (req.headers['x-lumen-pin'] as string) || '').trim()
      const allMedia = this.workspace.listMedia()
      const items = allMedia.map((m) => {
        let fileUrl = m.value
        if (m.value.startsWith('lumen-media://local/') || m.value.startsWith('data:')) {
          fileUrl = `/api/media/file?id=${encodeURIComponent(m.id)}&pin=${encodeURIComponent(pin)}`
        }
        return {
          id: m.id,
          name: m.name,
          kind: m.kind,
          category: m.category || (m.id.startsWith('bg-') ? 'Fondo' : 'Culto'),
          accentColor: m.accentColor,
          url: fileUrl,
          rawBackgroundValue: (m.kind === 'gradient' || m.kind === 'solid') ? m.value : '',
          isMotion: m.value.startsWith('motion:')
        }
      })
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        ...noCacheHeaders
      })
      res.end(JSON.stringify({ ok: true, media: items }))
      return
    }

    if (req.method === 'GET' && pathname === '/api/songs') {
      const q = (urlObj.searchParams.get('q') ?? '').trim().toLowerCase()
      let songs = this.workspace.listSongs()
      if (q) {
        songs = songs.filter(
          (s) =>
            s.title.toLowerCase().includes(q) ||
            (s.author && s.author.toLowerCase().includes(q)) ||
            (s.musicalKey && s.musicalKey.toLowerCase().includes(q)) ||
            s.stanzas.some((st) => st.lines.some((l) => l.toLowerCase().includes(q)))
        )
      }
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        ...noCacheHeaders
      })
      res.end(JSON.stringify({ ok: true, songs }))
      return
    }

    if (req.method === 'GET' && pathname === '/api/bible/books') {
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        ...noCacheHeaders
      })
      res.end(JSON.stringify({ ok: true, books: this.workspace.listBibleBooks() }))
      return
    }

    if (req.method === 'GET' && pathname === '/api/bible/chapter') {
      const book = urlObj.searchParams.get('book') ?? 'Salmos'
      const chapter = Number(urlObj.searchParams.get('chapter') ?? '23')
      const verses = this.workspace.getBibleChapter(book, chapter)
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        ...noCacheHeaders
      })
      res.end(JSON.stringify({ ok: true, verses }))
      return
    }

    if (req.method === 'GET' && pathname === '/api/bible/search') {
      const q = (urlObj.searchParams.get('q') ?? '').trim()
      const verses = this.workspace.searchBible(q)
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        ...noCacheHeaders
      })
      res.end(JSON.stringify({ ok: true, verses }))
      return
    }

    if (req.method === 'GET' && pathname === '/api/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive'
      })
      res.write(
        `data: ${JSON.stringify({
          projection: this.statusStore.get().projection,
          schedule: this.workspace.listSchedule()
        })}\n\n`
      )
      this.sseClients.add(res)
      this.syncMobileStatus()

      req.on('close', () => {
        this.sseClients.delete(res)
        this.syncMobileStatus()
      })
      return
    }

    if (req.method === 'POST' && pathname === '/api/action') {
      let body = ''
      req.on('data', (chunk: Buffer) => {
        if (body.length < 65_536) body += chunk.toString('utf-8')
      })
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body) as Record<string, unknown>
          const action = parsed['action']
          if (action === 'toggle-projection') {
            const isCurrentlyOpen = this.statusStore.get().projection.windowOpen
            if (isCurrentlyOpen) {
              void this.closeProjectionWindow?.()
            } else {
              void this.openProjectionWindow?.()
            }
          } else if (action === 'open-projection') {
            void this.openProjectionWindow?.()
          } else if (action === 'close-projection') {
            void this.closeProjectionWindow?.()
          } else if (action === 'next') {
            this.statusStore.goToSlide({ direction: 'next' })
          } else if (action === 'prev') {
            this.statusStore.goToSlide({ direction: 'prev' })
          } else if (action === 'goto' && typeof parsed['index'] === 'number') {
            this.statusStore.goToSlide({ index: parsed['index'] })
          } else if (
            action === 'mode' &&
            typeof parsed['mode'] === 'string' &&
            ['live', 'black', 'clear', 'logo', 'test-pattern'].includes(parsed['mode'])
          ) {
            this.statusStore.setMode(parsed['mode'] as ProjectionDisplayMode)
          } else if (action === 'toggle-freeze' || action === 'freeze') {
            const currentFrozen = this.statusStore.get().projection.live.theme.frozen
            this.statusStore.updateTheme({ frozen: !currentFrozen })
          } else if (action === 'project-media' && typeof parsed['mediaId'] === 'string') {
            const media = this.workspace.listMedia().find((m) => m.id === parsed['mediaId'])
            if (media) {
              this.statusStore.loadDeck({
                deckTitle: media.name,
                slides: [
                  {
                    id: `slide-media-${media.id}`,
                    sourceKind: 'custom',
                    sourceTitle: media.name,
                    label: media.name,
                    lines: [],
                    footer: '',
                    imageUrl: media.value
                  }
                ],
                startIndex: 0
              })
              this.statusStore.updateTheme({
                videoPlaying: true,
                videoSeekSeconds: 0
              })
              this.statusStore.setMode('live')
              void this.openProjectionWindow?.()
            }
          } else if (action === 'video-seek' && typeof parsed['seconds'] === 'number') {
            const now = Date.now()
            this.statusStore.updateTheme({
              videoSeekSeconds: parsed['seconds'],
              videoSeekTrigger: now
            })
          } else if (action === 'video-toggle-play') {
            const curPlaying = this.statusStore.get().projection.live.theme.videoPlaying !== false
            this.statusStore.updateTheme({ videoPlaying: !curPlaying })
          } else if (action === 'video-play') {
            this.statusStore.updateTheme({ videoPlaying: true })
          } else if (action === 'video-pause') {
            this.statusStore.updateTheme({ videoPlaying: false })
          } else if (action === 'video-restart') {
            const now = Date.now()
            this.statusStore.updateTheme({
              videoRestartTime: now,
              videoSeekSeconds: 0,
              videoSeekTrigger: now
            })
          } else if (action === 'video-toggle-mute') {
            const curMuted = Boolean(this.statusStore.get().projection.live.theme.videoMuted)
            this.statusStore.updateTheme({ videoMuted: !curMuted })
          } else if (action === 'video-toggle-fit') {
            const curFit = this.statusStore.get().projection.live.theme.mediaFit
            const nextFit = curFit === 'fill' || curFit === 'cover' ? 'contain' : 'fill'
            this.statusStore.updateTheme({ mediaFit: nextFit })
          } else if (action === 'media-stop') {
            this.statusStore.setMode('clear')
          } else if (action === 'set-background' && typeof parsed['mediaId'] === 'string') {
            const bg = this.workspace.listMedia().find((m) => m.id === parsed['mediaId'])
            if (bg) {
              this.statusStore.updateTheme({ background: bg, videoPlaying: true })
              const curSettings = this.workspace.getSettings()
              this.workspace.updateSettings({
                theme: {
                  ...curSettings.theme,
                  background: bg
                }
              })
            }
          } else if (action === 'adjust-font-scale' && typeof parsed['delta'] === 'number') {
            const curScale = this.statusStore.get().projection.live.theme.fontScale ?? 100
            const nextScale = Math.max(50, Math.min(200, curScale + parsed['delta']))
            this.statusStore.updateTheme({ fontScale: nextScale })
          } else if (action === 'set-ticker' && typeof parsed['text'] === 'string') {
            const txt = parsed['text'].trim()
            this.statusStore.updateTheme({
              tickerActive: txt.length > 0,
              tickerText: txt
            })
          } else if (action === 'clear-ticker') {
            this.statusStore.updateTheme({
              tickerActive: false,
              tickerText: ''
            })
          } else if (action === 'update-theme' && typeof parsed['theme'] === 'object' && parsed['theme']) {
            this.statusStore.updateTheme(parsed['theme'] as Partial<ProjectionTheme>)
          } else if (action === 'load-schedule' && typeof parsed['id'] === 'string') {
            const item = this.workspace.listSchedule().find((s) => s.id === parsed['id'])
            if (item) {
              this.statusStore.loadDeck({ deckTitle: item.title, slides: item.slides, startIndex: 0 })
              void this.openProjectionWindow?.()
            }
          } else if (action === 'project-song' && typeof parsed['songId'] === 'string') {
            const song = this.workspace.listSongs().find((s) => s.id === parsed['songId'])
            if (song) {
              if (song.defaultBackgroundId) {
                const assignedBg = this.workspace.listMedia().find((m) => m.id === song.defaultBackgroundId)
                if (assignedBg) {
                  this.statusStore.updateTheme({ background: assignedBg, videoPlaying: true })
                }
              } else {
                this.ensureActiveBackground()
              }
              const slides = songToSlides(song, false)
              const startIndex =
                typeof parsed['stanzaIndex'] === 'number'
                  ? Math.max(0, Math.min(parsed['stanzaIndex'], slides.length - 1))
                  : 0
              this.statusStore.loadDeck({
                deckTitle: song.title,
                slides,
                startIndex
              })
              this.statusStore.updateTheme({
                videoPlaying: true,
                videoSeekSeconds: 0
              })
              this.statusStore.setMode('live')
              void this.openProjectionWindow?.()
            }
          } else if (action === 'project-bible') {
            this.ensureActiveBackground()
            const book = typeof parsed['book'] === 'string' ? parsed['book'] : 'Salmos'
            const chapter = typeof parsed['chapter'] === 'number' ? parsed['chapter'] : 23
            const verses = this.workspace.getBibleChapter(book, chapter)
            if (verses.length > 0) {
              const slides = versesToSlides(verses)
              let startIndex = 0
              if (typeof parsed['verse'] === 'number') {
                const vIdx = verses.findIndex((v) => v.verse === parsed['verse'])
                if (vIdx >= 0) startIndex = vIdx
              } else if (typeof parsed['startIndex'] === 'number') {
                startIndex = Math.max(0, Math.min(parsed['startIndex'], slides.length - 1))
              }
              this.statusStore.loadDeck({
                deckTitle: `${verses[0]?.book ?? book} ${chapter}`,
                slides,
                startIndex
              })
              this.statusStore.updateTheme({
                videoPlaying: true,
                videoSeekSeconds: 0
              })
              this.statusStore.setMode('live')
              void this.openProjectionWindow?.()
            }
          } else if (action === 'project-verses' && Array.isArray(parsed['verses']) && parsed['verses'].length > 0) {
            this.ensureActiveBackground()
            const verses = parsed['verses'] as BibleVerse[]
            const slides = versesToSlides(verses)
            const title =
              typeof parsed['title'] === 'string' && parsed['title'].trim()
                ? parsed['title'].trim()
                : `${verses[0]?.book} ${verses[0]?.chapter}:${verses[0]?.verse}`
            const startIndex =
              typeof parsed['startIndex'] === 'number'
                ? Math.max(0, Math.min(parsed['startIndex'], slides.length - 1))
                : 0
            this.statusStore.loadDeck({
              deckTitle: title,
              slides,
              startIndex
            })
            this.statusStore.updateTheme({
              videoPlaying: true,
              videoSeekSeconds: 0
            })
            this.statusStore.setMode('live')
            void this.openProjectionWindow?.()
          } else if (action === 'project-text' && typeof parsed['text'] === 'string') {
            this.ensureActiveBackground()
            const slide = createAnnouncementSlide(
              typeof parsed['title'] === 'string' && parsed['title'].trim() ? parsed['title'].trim() : 'Mensaje',
              parsed['text']
            )
            this.statusStore.loadDeck({
              deckTitle: slide.sourceTitle,
              slides: [slide],
              startIndex: 0
            })
            this.statusStore.updateTheme({
              videoPlaying: true,
              videoSeekSeconds: 0
            })
            this.statusStore.setMode('live')
            void this.openProjectionWindow?.()
          }

          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            ...noCacheHeaders
          })
          res.end(JSON.stringify({ ok: true, projection: this.statusStore.get().projection }))
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' })
          res.end(JSON.stringify({ ok: false, error: 'Solicitud mal formada.' }))
        }
      })
      return
    }

    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ ok: false, error: 'Ruta no encontrada' }))
  }
}

function renderMobileHtml(): string {
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
  <title>Lumen — Control Remoto</title>
  <style>
    :root {
      --bg: #0b0c10;
      --bg-card: #14151b;
      --bg-panel: #1e2028;
      --bg-hover: #282b36;
      --border: #2e313d;
      --border-subtle: #20222a;
      --text: #f4f4f5;
      --text-muted: #94a3b8;
      --accent: #2563eb;
      --accent-strong: #1d4ed8;
      --ok: #10b981;
      --warn: #f59e0b;
      --danger: #ef4444;
      --radius: 10px;
    }
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    html {
      height: 100%;
      height: 100dvh;
      overflow: hidden;
      position: fixed;
      width: 100%;
    }
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      font-size: 14px;
      line-height: 1.4;
      display: flex;
      flex-direction: column;
      height: 100%;
      height: 100dvh;
      width: 100%;
      overflow: hidden;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      user-select: none;
      -webkit-user-select: none;
    }
    .fixed-top-header {
      position: sticky;
      top: 0;
      left: 0;
      right: 0;
      width: 100%;
      z-index: 1000;
      flex-shrink: 0;
      background: var(--bg-card);
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
    }
    header.app-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      background: var(--bg-card);
      border-bottom: 1px solid var(--border);
      gap: 8px;
    }
    .brand { font-size: 15px; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 6px; }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 3px 8px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      background: var(--bg-panel);
      border: 1px solid var(--border);
    }
    .dot { width: 7px; height: 7px; border-radius: 50%; background: #666; }
    .dot.connected { background: var(--ok); box-shadow: 0 0 6px var(--ok); }
    .proj-toggle-btn {
      padding: 5px 10px;
      border-radius: 6px;
      border: 1px solid #334155;
      background: #1e293b;
      color: #94a3b8;
      font-size: 12px;
      font-weight: 800;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      transition: all 150ms ease;
    }
    .proj-toggle-btn.active {
      background: #059669;
      border-color: #10b981;
      color: #ffffff;
      box-shadow: 0 0 10px rgba(16, 185, 129, 0.4);
    }
    .nav-tabs {
      display: flex;
      overflow-x: auto;
      background: var(--bg-card);
      border-bottom: 1px solid var(--border);
      scrollbar-width: none;
      touch-action: pan-x;
      -webkit-overflow-scrolling: touch;
    }
    .nav-tabs::-webkit-scrollbar { display: none; }
    .nav-tab {
      padding: 10px 12px;
      text-align: center;
      border: 0;
      border-bottom: 3px solid transparent;
      background: transparent;
      color: var(--text-muted);
      font-weight: 700;
      font-size: 12px;
      white-space: nowrap;
      cursor: pointer;
      flex-shrink: 0;
    }
    .nav-tab.active {
      color: #fff;
      border-bottom-color: var(--accent);
      background: var(--bg-panel);
    }
    main.view-container {
      flex: 1;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      overscroll-behavior-y: contain;
      touch-action: pan-y;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 12px;
    }
    .deck-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 8px;
    }
    .deck-title { font-size: 16px; font-weight: 800; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 75%; }
    .deck-counter { font-size: 12px; font-weight: 800; color: var(--ok); }
    .current-slide-box {
      background: #000000;
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      padding: 14px 12px;
      min-height: 80px;
      font-size: 16px;
      font-weight: 600;
      line-height: 1.4;
      white-space: pre-line;
      color: #fff;
      display: flex;
      flex-direction: column;
      justify-content: center;
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    .next-preview-box {
      margin-top: 8px;
      padding: 8px 10px;
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.04);
      border-left: 3px solid var(--warn);
      font-size: 12px;
      color: var(--text-muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .touch-nav-grid {
      display: grid;
      grid-template-columns: 1fr 1.4fr;
      gap: 10px;
      margin-top: 10px;
    }
    .big-nav-btn {
      min-height: 52px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--bg-panel);
      color: #fff;
      font-size: 16px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    .big-nav-btn:active { transform: scale(0.97); }
    .big-nav-btn.primary {
      background: #059669;
      border-color: var(--ok);
      color: #fff;
      box-shadow: 0 2px 10px rgba(16, 185, 129, 0.35);
    }
    .chips-strip {
      display: flex;
      gap: 6px;
      overflow-x: auto;
      padding: 6px 0;
      margin-top: 8px;
      scrollbar-width: none;
    }
    .chips-strip::-webkit-scrollbar { display: none; }
    .stanza-chip {
      padding: 6px 10px;
      border-radius: 6px;
      border: 1px solid var(--border);
      background: var(--bg);
      color: var(--text);
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
      cursor: pointer;
      flex-shrink: 0;
    }
    .stanza-chip.active {
      background: rgba(16, 185, 129, 0.25);
      border-color: var(--ok);
      color: #86efac;
    }
    .search-row {
      display: flex;
      gap: 8px;
      margin-bottom: 10px;
    }
    .search-input {
      flex: 1;
      padding: 10px 12px;
      border-radius: 6px;
      border: 1px solid var(--border);
      background: var(--bg);
      color: #fff;
      font-size: 14px;
      font-family: inherit;
      outline: none;
    }
    .search-input:focus { border-color: var(--accent); }
    .action-btn {
      padding: 9px 12px;
      border-radius: 6px;
      border: 1px solid var(--border);
      background: var(--bg-panel);
      color: #fff;
      font-weight: 700;
      font-size: 12px;
      cursor: pointer;
      white-space: nowrap;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
    }
    .action-btn.primary {
      background: var(--accent);
      border-color: var(--accent-strong);
    }
    .action-btn.danger {
      background: rgba(239, 68, 68, 0.15);
      border-color: var(--danger);
      color: #fca5a5;
    }
    .list-items {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .item-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 10px 12px;
      cursor: pointer;
      transition: border-color 150ms ease;
    }
    .item-card:hover { border-color: var(--accent); }
    .item-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .item-card-title { font-weight: 700; font-size: 14px; color: #fff; }
    .item-card-meta { font-size: 11.5px; color: var(--text-muted); margin-top: 2px; }
    .item-tag { font-size: 10.5px; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: rgba(255, 255, 255, 0.08); color: #cbd5e1; }
    .item-stanzas {
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid var(--border-subtle);
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .stanza-pick-row {
      padding: 8px;
      background: var(--bg);
      border: 1px solid var(--border-subtle);
      border-radius: 5px;
      font-size: 12.5px;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .stanza-pick-row:active { background: var(--bg-panel); border-color: var(--accent); }
    .stanza-pick-label { font-size: 10.5px; font-weight: 800; color: #93c5fd; }
    .stanza-pick-text { color: #e4e4e7; line-height: 1.35; }

    /* Estilos multimedia para móviles */
    .media-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
    }
    .media-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .media-card-thumb {
      width: 100%;
      height: 95px;
      background: #000;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .media-card-thumb img,
    .media-card-thumb video {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .media-card-badge {
      position: absolute;
      top: 4px;
      right: 4px;
      background: rgba(0, 0, 0, 0.75);
      font-size: 9px;
      font-weight: 800;
      padding: 2px 6px;
      border-radius: 4px;
      color: #facc15;
    }
    .media-card-body {
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .media-card-name {
      font-size: 12px;
      font-weight: 700;
      color: #fff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .media-card-actions {
      display: flex;
      gap: 4px;
    }

    .player-controls-bar {
      display: flex;
      gap: 6px;
      align-items: center;
      padding: 6px 0;
      margin-top: 6px;
      border-top: 1px solid var(--border-subtle);
    }
    .player-btn {
      flex: 1;
      height: 38px;
      border-radius: 6px;
      border: 1px solid var(--border);
      background: var(--bg-panel);
      color: #fff;
      font-size: 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .player-btn.active {
      background: var(--accent);
      border-color: var(--accent-strong);
    }
    .player-btn.danger {
      background: rgba(239, 68, 68, 0.2);
      border-color: var(--danger);
      color: #f87171;
    }

    .toast {
      position: fixed;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      background: #047857;
      color: #fff;
      padding: 8px 16px;
      border-radius: 999px;
      font-size: 12.5px;
      font-weight: 700;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5);
      opacity: 0;
      pointer-events: none;
      transition: opacity 200ms ease;
      z-index: 9999;
    }
    .toast.show { opacity: 1; }
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.85);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      z-index: 10000;
    }
    .pin-box {
      width: 100%;
      max-width: 320px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="fixed-top-header">
    <header class="app-bar">
      <div class="brand">✺ Lumen Remoto</div>
      <div style="display:flex;align-items:center;gap:6px;">
        <button id="projToggleBtn" class="proj-toggle-btn" onclick="sendAction({action:'toggle-projection'})" title="Iniciar o detener proyección">📺 Proyección: OFF</button>
        <div class="status-badge">
          <span class="dot" id="netDot"></span>
          <span id="modeBadge">CONECTANDO...</span>
        </div>
        <button onclick="promptPin()" style="background:none;border:0;color:var(--text-muted);font-size:16px;cursor:pointer;">⚙</button>
      </div>
    </header>

    <nav class="nav-tabs">
      <button class="nav-tab active" id="tabBtn-control" onclick="switchTab('control')">⏵ En Vivo</button>
      <button class="nav-tab" id="tabBtn-media" onclick="switchTab('media')">🎬 Medios</button>
      <button class="nav-tab" id="tabBtn-songs" onclick="switchTab('songs')">♪ Alabanzas</button>
      <button class="nav-tab" id="tabBtn-bible" onclick="switchTab('bible')">📖 Biblia</button>
      <button class="nav-tab" id="tabBtn-backgrounds" onclick="switchTab('backgrounds')">🎨 Fondos</button>
    </nav>
  </div>

  <main class="view-container">
    <!-- PESTAÑA 1: MONITOR EN VIVO Y CONTROLES -->
    <section id="view-control" style="display:flex;flex-direction:column;gap:10px;">
      <div class="card">
        <div class="deck-header">
          <span class="deck-title" id="deckTitle">Cargando...</span>
          <span class="deck-counter" id="deckCounter">0 / 0</span>
        </div>

        <div id="mediaLiveBox" style="display:none;margin-bottom:8px;">
          <div id="mediaLiveContainer" style="width:100%;max-height:190px;background:#000;border-radius:6px;overflow:hidden;display:flex;align-items:center;justify-content:center;"></div>
          <!-- LÍNEA DE TIEMPO DEL VÍDEO -->
          <div id="mTimelineBox" style="display:flex;align-items:center;gap:8px;padding:6px 2px 2px;">
            <span id="mVideoCurrent" style="font-size:11px;color:var(--text-muted);font-variant-numeric:tabular-nums;min-width:34px;">00:00</span>
            <input type="range" id="mVideoRange" min="0" max="100" value="0" step="1" style="flex:1;accent-color:#2563eb;height:5px;cursor:pointer;" onchange="onUserSeek(this.value)" oninput="onUserSeeking(this.value)" />
            <span id="mVideoDuration" style="font-size:11px;color:var(--text-muted);font-variant-numeric:tabular-nums;min-width:34px;text-align:right;">00:00</span>
          </div>
          <div class="player-controls-bar">
            <button class="player-btn" id="mPlayBtn" onclick="sendAction({action:'video-toggle-play'})" title="Pausar / Reanudar">▶</button>
            <button class="player-btn" onclick="sendAction({action:'video-restart'})" title="Reiniciar vídeo">⏮</button>
            <button class="player-btn" id="mMuteBtn" onclick="sendAction({action:'video-toggle-mute'})" title="Audio">🔊</button>
            <button class="player-btn" id="mFitBtn" onclick="sendAction({action:'video-toggle-fit'})" title="Ajustar / Llenar">⛶</button>
            <button class="player-btn danger" onclick="sendAction({action:'media-stop'})" title="Quitar de pantalla">⏹</button>
          </div>
        </div>

        <div class="current-slide-box" id="slideText">—</div>
        <div class="next-preview-box" id="nextSlideText">Siguiente: —</div>

        <div class="touch-nav-grid">
          <button class="big-nav-btn" onclick="sendAction({action:'prev'})">◀ Anterior</button>
          <button class="big-nav-btn primary" onclick="sendAction({action:'next'})">Siguiente ▶</button>
        </div>

        <div class="chips-strip" id="stanzasChips"></div>
      </div>

      <!-- ALERTA RÁPIDA / MARQUESINA -->
      <div class="card">
        <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:6px;">Aviso / Alerta en Vivo</div>
        <div style="display:flex;gap:6px;">
          <input type="text" id="tickerInput" class="search-input" placeholder="Escribir mensaje urgente a la pantalla..." />
          <button class="action-btn primary" onclick="submitTicker()">📢 Enviar</button>
          <button class="action-btn danger" onclick="clearTicker()">✕</button>
        </div>
      </div>
    </section>

    <!-- PESTAÑA 2: MEDIOS (IMÁGENES Y VÍDEOS DEL CULTO) -->
    <section id="view-media" style="display:none;flex-direction:column;gap:10px;">
      <div class="search-row">
        <input type="search" class="search-input" id="mediaQuery" placeholder="Filtrar imágenes y vídeos..." oninput="filterMedia()" />
        <button class="action-btn" onclick="loadMediaCatalog()">↻</button>
      </div>

      <div style="display:flex;gap:6px;">
        <button class="stanza-chip active" id="mediaFilter-all" onclick="setMediaFilter('all')">Todos</button>
        <button class="stanza-chip" id="mediaFilter-video" onclick="setMediaFilter('video')">🎬 Vídeos</button>
        <button class="stanza-chip" id="mediaFilter-image" onclick="setMediaFilter('image')">🖼 Imágenes</button>
      </div>

      <div class="media-grid" id="mediaListContainer">
        <div style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:20px;">Cargando medios...</div>
      </div>
    </section>

    <!-- PESTAÑA 3: ALABANZAS Y LETRAS -->
    <section id="view-songs" style="display:none;flex-direction:column;gap:10px;">
      <div class="search-row">
        <input type="search" class="search-input" id="songQuery" placeholder="Buscar por título, letra o autor..." oninput="filterSongs()" />
        <button class="action-btn" onclick="loadSongsCatalog()">↻</button>
      </div>
      <div class="list-items" id="songsList">
        <div style="text-align:center;color:var(--text-muted);padding:20px;">Cargando catálogo...</div>
      </div>
    </section>

    <!-- PESTAÑA 4: BIBLIA -->
    <section id="view-bible" style="display:none;flex-direction:column;gap:10px;">
      <div class="search-row">
        <input type="search" class="search-input" id="bibleQuery" placeholder="Cita o palabra (ej. Juan 3:16, Salmos 23, fe)..." onkeydown="if(event.key==='Enter')searchBibleVerses()" />
        <button class="action-btn primary" onclick="searchBibleVerses()">Buscar</button>
      </div>

      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:4px;">
        <button class="stanza-chip" onclick="quickBibleQuote('Salmos 23')">★ Salmos 23</button>
        <button class="stanza-chip" onclick="quickBibleQuote('Juan 3:16')">★ Juan 3:16</button>
        <button class="stanza-chip" onclick="quickBibleQuote('Filipenses 4:13')">★ Fil 4:13</button>
        <button class="stanza-chip" onclick="quickBibleQuote('Salmos 91')">★ Sal 91</button>
        <button class="stanza-chip" onclick="quickBibleQuote('1 Corintios 13')">★ 1 Cor 13</button>
      </div>

      <div class="search-row" style="margin-bottom:6px;">
        <select id="bibleBookSelect" class="search-input" onchange="loadSelectedBibleChapter()"></select>
        <input type="number" id="bibleChapterInput" class="search-input" value="1" min="1" max="150" style="max-width:80px;" onchange="loadSelectedBibleChapter()" />
        <button class="action-btn" onclick="loadSelectedBibleChapter()">Ver</button>
      </div>

      <div class="list-items" id="bibleVersesList">
        <div style="text-align:center;color:var(--text-muted);padding:20px;">Escribe una cita bíblica o selecciona un capítulo.</div>
      </div>
    </section>

    <!-- PESTAÑA 5: FONDOS EN VIVO -->
    <section id="view-backgrounds" style="display:none;flex-direction:column;gap:10px;">
      <div style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;">Cambiar Fondo de Pantalla en Vivo</div>
      <div class="media-grid" id="backgroundsGrid">
        <div style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:20px;">Cargando fondos...</div>
      </div>
    </section>
  </main>

  <div class="toast" id="toast">Acción ejecutada</div>

  <!-- MODAL DE VISTA PREVIA MULTIMEDIA EN MÓVIL -->
  <div class="modal-overlay" id="mediaPreviewModal" style="display:none;" onclick="closeMediaPreviewModal()">
    <div class="card" style="width:100%;max-width:440px;background:var(--bg-card);border-radius:12px;" onclick="event.stopPropagation()">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <strong id="previewModalTitle" style="color:#fff;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:80%;">Vista previa</strong>
        <button onclick="closeMediaPreviewModal()" style="background:none;border:none;color:#fff;font-size:18px;cursor:pointer;">✕</button>
      </div>
      <div id="previewModalContent" style="width:100%;min-height:160px;max-height:260px;background:#000;border-radius:8px;overflow:hidden;display:flex;align-items:center;justify-content:center;"></div>
      <div style="display:flex;gap:8px;margin-top:12px;">
        <button class="action-btn" style="flex:1;" onclick="closeMediaPreviewModal()">Cerrar</button>
        <button class="action-btn primary" style="flex:1.5;" id="previewModalProjectBtn">▶ Proyectar en Pantalla</button>
      </div>
    </div>
  </div>

  <!-- MODAL DE PIN -->
  <div class="modal-overlay" id="pinModal" style="display:none;">
    <div class="pin-box">
      <h3 style="margin:0 0 8px;font-size:17px;color:#fff;">PIN de Seguridad</h3>
      <p style="font-size:12px;color:var(--text-muted);margin:0 0 14px;">Ingresa el PIN de 4 dígitos configurado en Lumen:</p>
      <input type="text" id="modalPinInput" maxlength="6" inputmode="numeric" class="search-input" style="text-align:center;font-size:24px;letter-spacing:6px;font-weight:800;margin-bottom:14px;" />
      <div style="display:flex;gap:8px;">
        <button class="action-btn primary" style="flex:1;" onclick="submitPin()">Conectar</button>
      </div>
    </div>
  </div>

  <script>
    let currentPin = localStorage.getItem('lumen_remote_pin') || '';
    const urlParams = new URLSearchParams(location.search);
    if (urlParams.get('pin')) {
      currentPin = urlParams.get('pin');
      localStorage.setItem('lumen_remote_pin', currentPin);
    }

    let allSongs = [];
    let allMedia = [];
    let mediaFilterKind = 'all';
    let expandedSongId = null;
    let sseSource = null;
    let lastLiveState = null;
    let bibleBooks = [];
    let isUserDraggingTimeline = false;

    // Prevenir zoom táctil en móviles
    document.addEventListener('gesturestart', function(e) { e.preventDefault(); });
    document.addEventListener('gesturechange', function(e) { e.preventDefault(); });
    document.addEventListener('gestureend', function(e) { e.preventDefault(); });
    let lastTouchEnd = 0;
    document.addEventListener('touchend', function(e) {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) { e.preventDefault(); }
      lastTouchEnd = now;
    }, false);

    function formatTime(sec) {
      if (!sec || isNaN(sec)) return '00:00';
      const m = Math.floor(sec / 60);
      const s = Math.floor(sec % 60);
      return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
    }

    function onUserSeeking(val) {
      isUserDraggingTimeline = true;
      document.getElementById('mVideoCurrent').textContent = formatTime(Number(val));
    }

    function onUserSeek(val) {
      isUserDraggingTimeline = false;
      const secs = Number(val);
      sendAction({ action: 'video-seek', seconds: secs });
      const vid = document.querySelector('#mediaLiveContainer video');
      if (vid) { try { vid.currentTime = secs; } catch (e) {} }
    }

    function showToast(msg) {
      const t = document.getElementById('toast');
      t.textContent = msg;
      t.classList.add('show');
      setTimeout(() => t.classList.remove('show'), 2200);
    }

    function switchTab(tabId) {
      ['control', 'media', 'songs', 'bible', 'backgrounds'].forEach(t => {
        const el = document.getElementById('view-' + t);
        const btn = document.getElementById('tabBtn-' + t);
        if (el) el.style.display = (t === tabId) ? 'flex' : 'none';
        if (btn) btn.classList.toggle('active', t === tabId);
      });
      if (tabId === 'media' && allMedia.length === 0) loadMediaCatalog();
      if (tabId === 'backgrounds' && allMedia.length === 0) loadMediaCatalog();
      if (tabId === 'songs' && allSongs.length === 0) loadSongsCatalog();
      if (tabId === 'bible' && bibleBooks.length === 0) loadBibleBooks();
    }

    function promptPin() {
      document.getElementById('modalPinInput').value = currentPin;
      document.getElementById('pinModal').style.display = 'flex';
    }

    function submitPin() {
      const val = document.getElementById('modalPinInput').value.trim();
      if (!val) return;
      currentPin = val;
      localStorage.setItem('lumen_remote_pin', currentPin);
      document.getElementById('pinModal').style.display = 'none';
      initConnection();
      loadMediaCatalog();
      loadSongsCatalog();
    }

    function initConnection() {
      if (!currentPin) {
        promptPin();
        return;
      }
      if (sseSource) sseSource.close();
      sseSource = new EventSource('/api/events?pin=' + encodeURIComponent(currentPin));
      sseSource.onopen = () => {
        document.getElementById('netDot').classList.add('connected');
      };
      sseSource.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          updateLiveUI(data.projection.live, data.schedule, data.projection.windowOpen);
        } catch (e) {
          console.error(e);
        }
      };
      sseSource.onerror = () => {
        document.getElementById('netDot').classList.remove('connected');
        document.getElementById('modeBadge').textContent = 'DESCONECTADO';
      };
    }

    function updateLiveUI(live, schedule, windowOpen) {
      lastLiveState = live;
      document.getElementById('netDot').classList.add('connected');
      document.getElementById('modeBadge').textContent = live.mode.toUpperCase();
      document.getElementById('deckTitle').textContent = live.deckTitle || 'Sin título';
      document.getElementById('deckCounter').textContent = (live.currentIndex + 1) + ' / ' + Math.max(1, live.slides.length);

      // Interruptor de proyección (Iniciar / Detener)
      const projBtn = document.getElementById('projToggleBtn');
      if (projBtn) {
        const isOpen = windowOpen !== undefined ? !!windowOpen : (live.mode === 'live');
        projBtn.textContent = isOpen ? '📺 Proyección: ON' : '📺 Proyección: OFF';
        projBtn.classList.toggle('active', isOpen);
      }

      const curSlide = live.slides[live.currentIndex];
      const mediaLiveBox = document.getElementById('mediaLiveBox');
      const mediaLiveContainer = document.getElementById('mediaLiveContainer');
      const slideTextBox = document.getElementById('slideText');

      if (curSlide && curSlide.imageUrl) {
        mediaLiveBox.style.display = 'block';
        slideTextBox.style.display = 'none';
        const isVid = curSlide.imageUrl.indexOf('.mp4') !== -1 || curSlide.imageUrl.indexOf('video') !== -1 || (curSlide.imageUrl.startsWith('/api/media/file') && curSlide.label.toLowerCase().includes('vídeo'));
        const existingVid = mediaLiveContainer.querySelector('video');
        const existingImg = mediaLiveContainer.querySelector('img');

        if (isVid) {
          if (!existingVid || existingVid.getAttribute('data-src') !== curSlide.imageUrl) {
            mediaLiveContainer.innerHTML = '<video src="' + curSlide.imageUrl + '" data-src="' + curSlide.imageUrl + '" muted playsinline style="width:100%;max-height:190px;object-fit:contain;"></video>';
            const newVid = mediaLiveContainer.querySelector('video');
            if (newVid) {
              newVid.onloadedmetadata = function() {
                const dur = newVid.duration || 0;
                document.getElementById('mVideoRange').max = Math.floor(dur);
                document.getElementById('mVideoDuration').textContent = formatTime(dur);
              };
              newVid.ontimeupdate = function() {
                if (!isUserDraggingTimeline) {
                  document.getElementById('mVideoRange').value = Math.floor(newVid.currentTime);
                  document.getElementById('mVideoCurrent').textContent = formatTime(newVid.currentTime);
                }
              };
            }
          }
          const vidEl = mediaLiveContainer.querySelector('video');
          if (vidEl) {
            const isPlaying = live.theme?.videoPlaying !== false;
            if (isPlaying && vidEl.paused) {
              vidEl.play().catch(function() {});
            } else if (!isPlaying && !vidEl.paused) {
              vidEl.pause();
            }
          }
          document.getElementById('mTimelineBox').style.display = 'flex';
        } else {
          if (!existingImg || existingImg.getAttribute('src') !== curSlide.imageUrl) {
            mediaLiveContainer.innerHTML = '<img src="' + curSlide.imageUrl + '" style="width:100%;max-height:190px;object-fit:contain;" />';
          }
          document.getElementById('mTimelineBox').style.display = 'none';
        }

        // Estado de botones de reproducción
        const isPlaying = live.theme?.videoPlaying !== false;
        document.getElementById('mPlayBtn').textContent = isPlaying ? '⏸' : '▶';
        document.getElementById('mPlayBtn').classList.toggle('active', isPlaying);
        document.getElementById('mMuteBtn').textContent = live.theme?.videoMuted ? '🔇' : '🔊';
        document.getElementById('mFitBtn').textContent = (live.theme?.mediaFit === 'fill') ? '⊡' : '⛶';
      } else {
        mediaLiveBox.style.display = 'none';
        slideTextBox.style.display = 'flex';
        slideTextBox.textContent = curSlide ? curSlide.lines.join('\\n') : '—';
      }

      const nextSlide = live.slides[live.currentIndex + 1];
      document.getElementById('nextSlideText').textContent = nextSlide ? ('Siguiente: "' + (nextSlide.lines.slice(0, 2).join(' / ') || nextSlide.label) + '"') : 'Fin del elemento';

      // Actualizar chips de diapositivas
      const chipsBox = document.getElementById('stanzasChips');
      chipsBox.innerHTML = '';
      live.slides.forEach((sl, idx) => {
        const btn = document.createElement('button');
        btn.className = 'stanza-chip' + (idx === live.currentIndex ? ' active' : '');
        btn.textContent = (idx + 1) + ' · ' + (sl.label || 'Slide');
        btn.onclick = () => sendAction({ action: 'goto', index: idx });
        chipsBox.appendChild(btn);
      });
    }

    async function sendAction(payload) {
      try {
        const res = await fetch('/api/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-lumen-pin': currentPin },
          body: JSON.stringify(payload)
        });
        if (res.status === 401) {
          promptPin();
          return;
        }
        const data = await res.json();
        if (data.ok && data.projection) {
          updateLiveUI(data.projection.live, undefined, data.projection.windowOpen);
        }
      } catch (e) {
        console.error(e);
      }
    }

    // --- ALERTAS Y MARQUESINAS ---
    function submitTicker() {
      const input = document.getElementById('tickerInput');
      const text = (input.value || '').trim();
      if (!text) return;
      sendAction({ action: 'set-ticker', text });
      showToast('Alerta enviada a la pantalla');
    }

    function clearTicker() {
      document.getElementById('tickerInput').value = '';
      sendAction({ action: 'clear-ticker' });
      showToast('Alerta retirada');
    }

    // --- MEDIOS Y FONDOS ---
    async function loadMediaCatalog() {
      try {
        const res = await fetch('/api/media?pin=' + encodeURIComponent(currentPin), {
          headers: { 'x-lumen-pin': currentPin }
        });
        if (res.status === 401) { promptPin(); return; }
        const data = await res.json();
        if (data.ok) {
          allMedia = data.media;
          filterMedia();
          renderBackgrounds();
        }
      } catch (e) {
        console.error(e);
      }
    }

    function setMediaFilter(k) {
      mediaFilterKind = k;
      ['all', 'video', 'image'].forEach(f => {
        const b = document.getElementById('mediaFilter-' + f);
        if (b) b.classList.toggle('active', f === k);
      });
      filterMedia();
    }

    function filterMedia() {
      const q = (document.getElementById('mediaQuery').value || '').trim().toLowerCase();
      // En Medios solo mostrar los medios subidos para el culto (excluir fondos y predeterminados)
      const cultMedia = allMedia.filter(m => m.category === 'Culto' || (!m.id.startsWith('bg-') && m.category !== 'Fondo'));
      const filtered = cultMedia.filter(m => {
        const matchQ = !q || m.name.toLowerCase().includes(q);
        const matchK = mediaFilterKind === 'all' || m.kind === mediaFilterKind;
        return matchQ && matchK;
      });

      const box = document.getElementById('mediaListContainer');
      if (filtered.length === 0) {
        box.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:20px;">No se encontraron medios.</div>';
        return;
      }

      box.innerHTML = filtered.map(function(m) {
        const isVid = m.kind === 'video';
        let thumbHtml = isVid
          ? '<video src="' + m.url + '#t=0.5" preload="metadata" muted playsinline style="width:100%;height:100%;object-fit:cover;"></video>'
          : '<img src="' + m.url + '" alt="" style="width:100%;height:100%;object-fit:cover;" />';

        return '<div class="media-card">'
          + '<div class="media-card-thumb">'
          + thumbHtml
          + '<span class="media-card-badge">' + (isVid ? '🎬 VÍDEO' : '🖼 IMAGEN') + '</span>'
          + '</div>'
          + '<div class="media-card-body">'
          + '<span class="media-card-name" title="' + escapeHtml(m.name) + '">' + escapeHtml(m.name) + '</span>'
          + '<div class="media-card-actions">'
          + '<button class="action-btn primary" style="flex:1;" onclick="projectMediaItem(\\'' + m.id + '\\')">▶ Proyectar</button>'
          + '<button class="action-btn" style="padding:8px 8px;" onclick="openMediaPreviewModal(\\'' + m.id + '\\')">👁</button>'
          + '</div>'
          + '</div>'
          + '</div>';
      }).join('');
    }

    function renderBackgrounds() {
      const box = document.getElementById('backgroundsGrid');
      // En Fondos solo mostrar fondos reales (Fondo o bg-*), NUNCA medios de la carpeta del culto
      const bgs = allMedia.filter(m => (m.category === 'Fondo' || m.id.startsWith('bg-')) && m.category !== 'Culto');
      if (bgs.length === 0) {
        box.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:20px;">No hay fondos disponibles.</div>';
        return;
      }
      box.innerHTML = bgs.map(function(bg) {
        const isVid = bg.kind === 'video' || bg.isMotion;
        let thumbContent = '';
        let thumbStyle = '';

        if (bg.rawBackgroundValue) {
          // Gradiente o color sólido predeterminado
          thumbStyle = 'background:' + bg.rawBackgroundValue + ';';
          thumbContent = '<div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.85);text-align:center;padding:4px;text-shadow:0 1px 3px rgba(0,0,0,0.8);">' + escapeHtml(bg.name) + '</div>';
        } else if (bg.isMotion) {
          // Motion vídeo predeterminado
          thumbStyle = 'background: linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%);';
          thumbContent = '<span style="font-size:26px;">🎬</span><span style="font-size:10px;color:#cbd5e1;font-weight:700;margin-top:4px;">Motion FX</span>';
        } else if (bg.kind === 'video') {
          thumbContent = '<video src="' + bg.url + '#t=0.5" preload="metadata" muted playsinline style="width:100%;height:100%;object-fit:cover;"></video>';
        } else {
          // Imagen de fondo
          thumbContent = '<img src="' + bg.url + '" alt="" style="width:100%;height:100%;object-fit:cover;" />';
        }

        return '<div class="media-card" onclick="setFondoDirect(\\'' + bg.id + '\\')" style="cursor:pointer;">'
          + '<div class="media-card-thumb" style="' + thumbStyle + '">'
          + thumbContent
          + '<span class="media-card-badge">' + (isVid ? '🎬 MOTION' : '🎨 FONDO') + '</span>'
          + '</div>'
          + '<div class="media-card-body">'
          + '<span class="media-card-name">' + escapeHtml(bg.name) + '</span>'
          + '<button class="action-btn primary" style="width:100%;font-size:11px;padding:6px 8px;">Usar de Fondo</button>'
          + '</div>'
          + '</div>';
      }).join('');
    }

    function setFondoDirect(bgId) {
      sendAction({ action: 'set-background', mediaId: bgId });
      showToast('Fondo cambiado en vivo');
    }

    function projectMediaItem(mediaId) {
      sendAction({ action: 'project-media', mediaId });
      switchTab('control');
      showToast('Medio proyectado en pantalla');
    }

    function openMediaPreviewModal(mediaId) {
      const item = allMedia.find(m => m.id === mediaId);
      if (!item) return;
      document.getElementById('previewModalTitle').textContent = item.name;
      const content = document.getElementById('previewModalContent');
      if (item.kind === 'video') {
        content.innerHTML = '<video src="' + item.url + '" controls autoplay playsinline style="max-width:100%;max-height:240px;"></video>';
      } else {
        content.innerHTML = '<img src="' + item.url + '" style="max-width:100%;max-height:240px;object-fit:contain;" />';
      }
      document.getElementById('previewModalProjectBtn').onclick = function() {
        projectMediaItem(item.id);
        closeMediaPreviewModal();
      };
      document.getElementById('mediaPreviewModal').style.display = 'flex';
    }

    function closeMediaPreviewModal() {
      const content = document.getElementById('previewModalContent');
      content.innerHTML = '';
      document.getElementById('mediaPreviewModal').style.display = 'none';
    }

    // --- ALABANZAS ---
    async function loadSongsCatalog() {
      try {
        const res = await fetch('/api/songs', {
          headers: { 'x-lumen-pin': currentPin }
        });
        if (res.status === 401) { promptPin(); return; }
        const data = await res.json();
        if (data.ok) {
          allSongs = data.songs;
          filterSongs();
        }
      } catch (e) {
        console.error(e);
      }
    }

    function filterSongs() {
      const q = (document.getElementById('songQuery').value || '').trim().toLowerCase();
      const filtered = q
        ? allSongs.filter(s =>
            s.title.toLowerCase().includes(q) ||
            (s.author && s.author.toLowerCase().includes(q)) ||
            (s.musicalKey && s.musicalKey.toLowerCase().includes(q)) ||
            s.stanzas.some(st => st.lines.some(l => l.toLowerCase().includes(q)))
          )
        : allSongs;

      const box = document.getElementById('songsList');
      if (filtered.length === 0) {
        box.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px;">No se encontraron alabanzas.</div>';
        return;
      }

      box.innerHTML = filtered.map(function(s) {
        var isExpanded = s.id === expandedSongId;
        var stanzasHtml = '';
        if (isExpanded) {
          stanzasHtml = '<div class="item-stanzas">'
            + '<button class="action-btn primary" style="width:100%;margin-bottom:6px;" data-id="' + s.id + '" onclick="projectSongDirect(this.dataset.id, 0)">▶ Proyectar desde el inicio</button>'
            + s.stanzas.map(function(st, sIdx) {
                return '<div class="stanza-pick-row" data-id="' + s.id + '" data-idx="' + sIdx + '" onclick="projectSongDirect(this.dataset.id, Number(this.dataset.idx))">'
                  + '<span class="stanza-pick-label">' + escapeHtml(st.label) + ' (Tocar para proyectar)</span>'
                  + '<span class="stanza-pick-text">' + escapeHtml(st.lines.join(' / ')) + '</span>'
                  + '</div>';
              }).join('')
            + '</div>';
        }
        return '<div class="item-card" id="song-card-' + s.id + '">'
          + '<div class="item-card-header" data-id="' + s.id + '" onclick="toggleExpandSong(this.dataset.id)">'
          + '<div>'
          + '<div class="item-card-title">' + escapeHtml(s.title) + '</div>'
          + '<div class="item-card-meta">' + escapeHtml(s.author || 'Tradicional') + (s.musicalKey ? ' · Tono ' + s.musicalKey : '') + ' · ' + s.stanzas.length + ' estrofas</div>'
          + '</div>'
          + '<span class="item-tag">' + (s.musicalKey || '♪') + '</span>'
          + '</div>'
          + stanzasHtml
          + '</div>';
      }).join('');
    }

    function toggleExpandSong(songId) {
      expandedSongId = (expandedSongId === songId) ? null : songId;
      filterSongs();
    }

    function projectSongDirect(songId, stanzaIndex) {
      sendAction({ action: 'project-song', songId, stanzaIndex });
      switchTab('control');
      showToast('Alabanza proyectada en vivo');
    }

    // --- BIBLIA ---
    async function loadBibleBooks() {
      try {
        const res = await fetch('/api/bible/books', {
          headers: { 'x-lumen-pin': currentPin }
        });
        if (res.status === 401) { promptPin(); return; }
        const data = await res.json();
        if (data.ok) {
          bibleBooks = data.books;
          const select = document.getElementById('bibleBookSelect');
          select.innerHTML = bibleBooks.map(function(b) {
            return '<option value="' + escapeHtml(b.book) + '">' + escapeHtml(b.book) + '</option>';
          }).join('');
          select.value = 'Salmos';
          document.getElementById('bibleChapterInput').value = 23;
        }
      } catch (e) {
        console.error(e);
      }
    }

    async function loadSelectedBibleChapter() {
      const book = document.getElementById('bibleBookSelect').value || 'Salmos';
      const chapter = Number(document.getElementById('bibleChapterInput').value || 1);
      try {
        const res = await fetch('/api/bible/chapter?book=' + encodeURIComponent(book) + '&chapter=' + chapter, {
          headers: { 'x-lumen-pin': currentPin }
        });
        if (res.status === 401) { promptPin(); return; }
        const data = await res.json();
        if (data.ok) {
          renderBibleVerses(data.verses, book + ' ' + chapter);
        }
      } catch (e) {
        console.error(e);
      }
    }

    async function searchBibleVerses() {
      const q = (document.getElementById('bibleQuery').value || '').trim();
      if (!q) return;
      try {
        const res = await fetch('/api/bible/search?q=' + encodeURIComponent(q), {
          headers: { 'x-lumen-pin': currentPin }
        });
        if (res.status === 401) { promptPin(); return; }
        const data = await res.json();
        if (data.ok) {
          renderBibleVerses(data.verses, 'Resultados: ' + q);
        }
      } catch (e) {
        console.error(e);
      }
    }

    function quickBibleQuote(quote) {
      document.getElementById('bibleQuery').value = quote;
      searchBibleVerses();
    }

    function renderBibleVerses(verses, headerTitle) {
      const box = document.getElementById('bibleVersesList');
      if (!verses || verses.length === 0) {
        box.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px;">No se encontraron versículos.</div>';
        return;
      }
      var versesHtml = verses.map(function(v) {
        return '<div class="stanza-pick-row" data-book="' + escapeHtml(v.book) + '" data-ch="' + v.chapter + '" data-verse="' + v.verse + '" onclick="projectSingleVerse(this.dataset.book, Number(this.dataset.ch), Number(this.dataset.verse))">'
          + '<span class="stanza-pick-label">' + escapeHtml(v.book) + ' ' + v.chapter + ':' + v.verse + ' · (Tocar para proyectar)</span>'
          + '<span class="stanza-pick-text">' + escapeHtml(v.text) + '</span>'
          + '</div>';
      }).join('');

      box.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 2px;">'
        + '<strong style="color:#fff;font-size:13px;">' + escapeHtml(headerTitle) + ' (' + verses.length + ' versículos)</strong>'
        + '<button class="action-btn primary" style="padding:6px 10px;font-size:11px;" onclick="projectVersesList(0)">▶ Proyectar Todo</button>'
        + '</div>'
        + versesHtml;

      window.__lastRenderedVerses = verses;
      window.__lastRenderedTitle = headerTitle;
    }

    function projectSingleVerse(book, chapter, verse) {
      sendAction({ action: 'project-bible', book, chapter, verse });
      switchTab('control');
      showToast('Proyectando: ' + book + ' ' + chapter + ':' + verse);
    }

    function projectVersesList(startIndex) {
      if (!window.__lastRenderedVerses) return;
      sendAction({
        action: 'project-verses',
        title: window.__lastRenderedTitle || 'Pasaje Bíblico',
        verses: window.__lastRenderedVerses,
        startIndex
      });
      switchTab('control');
      showToast('Pasaje cargado en vivo');
    }

    // --- CULTO / PROGRAMACIÓN ---
    function renderSchedule(schedule) {
      const box = document.getElementById('scheduleList');
      if (!schedule || schedule.length === 0) {
        box.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px;">No hay elementos programados.</div>';
        return;
      }
      box.innerHTML = schedule.map(function(item, idx) {
        return '<div class="item-card" data-id="' + item.id + '" data-title="' + escapeHtml(item.title) + '" onclick="selectScheduleItem(this)">'
          + '<div class="item-card-header">'
          + '<span class="item-card-title">#' + (idx + 1) + ' ' + escapeHtml(item.title) + '</span>'
          + '<span class="item-tag">' + item.kind.toUpperCase() + '</span>'
          + '</div>'
          + '<div class="item-card-meta">' + escapeHtml(item.subtitle || '') + ' · ' + item.slides.length + ' diapositivas</div>'
          + '</div>';
      }).join('');
    }

    function selectScheduleItem(el) {
      sendAction({ action: 'load-schedule', id: el.dataset.id });
      switchTab('control');
      showToast('Cargado: ' + el.dataset.title);
    }

    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    // Inicio automático
    initConnection();
  </script>
</body>
</html>`
}

function renderStageMonitorHtml(): string {
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Lumen — Monitor de Retorno / Escenario</title>
  <style>
    body { margin: 0; font-family: system-ui, sans-serif; background: #09090b; color: #fff; height: 100vh; display: flex; flex-direction: column; justify-content: space-between; padding: 24px; box-sizing: border-box; }
    .top { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #27272a; padding-bottom: 10px; font-size: 20px; color: #a1a1aa; font-weight: 700; }
    .clock { color: #22c55e; font-size: 28px; font-variant-numeric: tabular-nums; }
    .current { font-size: clamp(26px, 4.5vw, 64px); font-weight: 700; line-height: 1.3; white-space: pre-line; }
    .next { border-top: 1px solid #27272a; padding-top: 12px; color: #facc15; font-size: clamp(18px, 2.5vw, 34px); white-space: pre-line; }
  </style>
</head>
<body>
  <div class="top">
    <span id="title">RETORNO DE ESCENARIO (Introduce ?pin=XXXX en la URL)</span>
    <span class="clock" id="clock">--:--:--</span>
  </div>
  <div class="current" id="currentSlide">Esperando señal...</div>
  <div class="next" id="nextSlide">Siguiente: —</div>
  <script>
    setInterval(() => {
      document.getElementById('clock').textContent = new Date().toLocaleTimeString('es-ES');
    }, 1000);
    const params = new URLSearchParams(location.search);
    const pin = params.get('pin') || '';
    if (pin) {
      const es = new EventSource('/api/events?pin=' + encodeURIComponent(pin));
      es.onmessage = (ev) => {
        const data = JSON.parse(ev.data);
        const live = data.projection.live;
        document.getElementById('title').textContent = live.deckTitle + ' (' + (live.currentIndex + 1) + '/' + live.slides.length + ')';
        const cur = live.slides[live.currentIndex];
        const nxt = live.slides[live.currentIndex + 1];
        document.getElementById('currentSlide').textContent = cur ? cur.lines.join('\\n') : '—';
        document.getElementById('nextSlide').textContent = 'SIGUIENTE: ' + (nxt ? nxt.lines.join(' / ') : 'Fin del elemento');
      };
    }
  </script>
</body>
</html>`
}

function renderObsOverlayHtml(): string {
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Lumen — Superposición Lower-Thirds OBS</title>
  <style>
    body { margin: 0; background: transparent; color: #fff; font-family: 'Segoe UI', system-ui, sans-serif; height: 100vh; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; padding-bottom: 48px; box-sizing: border-box; overflow: hidden; }
    .box { background: rgba(12, 12, 14, 0.78); border-left: 4px solid #22c55e; padding: 14px 28px; border-radius: 8px; max-width: 82vw; text-align: center; font-size: 34px; font-weight: 700; line-height: 1.3; text-shadow: 0 2px 8px rgba(0,0,0,0.9); white-space: pre-line; }
  </style>
</head>
<body>
  <div class="box" id="obsText"></div>
  <script>
    const params = new URLSearchParams(location.search);
    const pin = params.get('pin') || '';
    const box = document.getElementById('obsText');
    if (pin) {
      const es = new EventSource('/api/events?pin=' + encodeURIComponent(pin));
      es.onmessage = (ev) => {
        const data = JSON.parse(ev.data);
        const live = data.projection.live;
        if (live.mode !== 'live') { box.style.display = 'none'; return; }
        const cur = live.slides[live.currentIndex];
        box.style.display = cur ? 'block' : 'none';
        box.textContent = cur ? cur.lines.slice(0, 2).join('\\n') : '';
      };
    }
  </script>
</body>
</html>`
}
