import { EventEmitter } from 'node:events'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { afterEach, describe, expect, it } from 'vitest'
import { RemoteControlServer } from './remoteControlServer'
import { StatusStore } from '../state/statusStore'
import { WorkspaceStore } from '../state/workspaceStore'

function createMockReqRes(options: {
 method: string
 url: string
 headers?: Record<string, string>
 body?: string
}) {
 const req = new EventEmitter() as IncomingMessage & EventEmitter
 req.method = options.method
 req.url = options.url
 req.headers = options.headers ?? {}

 let responseBody = ''
 let statusCode = 200
 let responseHeaders: Record<string, string> = {}

 const res = {
 writeHead: (code: number, h: Record<string, string>) => {
 statusCode = code
 responseHeaders = h
 },
 write: (chunk: string) => {
 responseBody += chunk
 },
 end: (chunk?: string) => {
 if (chunk) responseBody += chunk
 }
 } as unknown as ServerResponse

 const execute = (server: RemoteControlServer) => {
 server.handleRequest(req, res)
 if (options.body) {
 req.emit('data', Buffer.from(options.body, 'utf-8'))
 req.emit('end')
 }
 }

 return {
 execute,
 getResult: () => ({ statusCode, headers: responseHeaders, body: responseBody })
 }
}

describe('RemoteControlServer', () => {
 let remote: RemoteControlServer | null = null

 afterEach(async () => {
 if (remote) {
 await remote.stop()
 remote = null
 }
 })

 it('inicia y detiene el servidor local y sincroniza el estado móvil', async () => {
 const statusStore = new StatusStore()
 const workspace = new WorkspaceStore()
 remote = new RemoteControlServer(statusStore, workspace)

 expect(remote.getInfo().running).toBe(false)

 const started = await remote.start(0)
 expect(started.running).toBe(true)
 expect(started.port).toBeGreaterThan(0)
 expect(statusStore.get().mobile.state).toBe('waiting')

 const newPinInfo = remote.regeneratePin()
 expect(newPinInfo.pin).toMatch(/^\d{4}$/)

 const stopped = await remote.stop()
 expect(stopped.running).toBe(false)
 expect(statusStore.get().mobile.state).toBe('not-started')
 })

 it('permite buscar canciones, versículos y proyectar desde el control remoto', () => {
 const statusStore = new StatusStore()
 const workspace = new WorkspaceStore()
 remote = new RemoteControlServer(statusStore, workspace)
 const pin = remote.getInfo().pin

 // 1. Obtener canciones filtradas
 const songsReq = createMockReqRes({
 method: 'GET',
 url: '/api/songs?q=sublime',
 headers: { 'x-lumen-pin': pin }
 })
 songsReq.execute(remote)
 const songsResult = songsReq.getResult()
 expect(songsResult.statusCode).toBe(200)
 const songsData = JSON.parse(songsResult.body) as { ok: boolean; songs: Array<{ id: string; title: string }> }
 expect(songsData.ok).toBe(true)
 expect(songsData.songs.length).toBeGreaterThan(0)
 const songId = songsData.songs[0]?.id ?? ''

 // 2. Buscar en la Biblia
 const bibleReq = createMockReqRes({
 method: 'GET',
 url: '/api/bible/search?q=Juan%203:16',
 headers: { 'x-lumen-pin': pin }
 })
 bibleReq.execute(remote)
 const bibleResult = bibleReq.getResult()
 expect(bibleResult.statusCode).toBe(200)
 const bibleData = JSON.parse(bibleResult.body) as {
 ok: boolean
 verses: Array<{ book: string; chapter: number; verse: number; text: string }>
 }
 expect(bibleData.ok).toBe(true)
 expect(bibleData.verses.length).toBeGreaterThan(0)
 expect(bibleData.verses[0]?.text).toContain('Dios')

 // 3. Proyectar alabanza desde el control remoto
 const projectSongReq = createMockReqRes({
 method: 'POST',
 url: '/api/action',
 headers: { 'x-lumen-pin': pin },
 body: JSON.stringify({ action: 'project-song', songId, stanzaIndex: 1 })
 })
 projectSongReq.execute(remote)
 const projectSongResult = projectSongReq.getResult()
 expect(projectSongResult.statusCode).toBe(200)
 const liveAfterSong = statusStore.get().projection.live
 expect(liveAfterSong.deckTitle).toBe(songsData.songs[0]?.title)
 expect(liveAfterSong.currentIndex).toBe(1)

 // 4. Proyectar pasaje bíblico desde el control remoto
 const projectBibleReq = createMockReqRes({
 method: 'POST',
 url: '/api/action',
 headers: { 'x-lumen-pin': pin },
 body: JSON.stringify({ action: 'project-bible', book: 'Salmos', chapter: 23, verse: 1 })
 })
 projectBibleReq.execute(remote)
 const projectBibleResult = projectBibleReq.getResult()
 expect(projectBibleResult.statusCode).toBe(200)
 const liveAfterBible = statusStore.get().projection.live
 expect(liveAfterBible.deckTitle).toBe('Salmos 23')
 expect(liveAfterBible.currentIndex).toBe(0)

 // 5. Servir la aplicación HTML móvil en la raíz
 const htmlReq = createMockReqRes({
 method: 'GET',
 url: '/'
 })
 htmlReq.execute(remote)
 const htmlResult = htmlReq.getResult()
 expect(htmlResult.statusCode).toBe(200)
 expect(htmlResult.body).toContain('Lumen — Control Remoto')
 expect(htmlResult.body).toContain('Alabanzas')
 expect(htmlResult.body).toContain('Biblia')
 expect(htmlResult.body).toContain('Medios')
 expect(htmlResult.body).toContain('Fondos')

 // 6. Listar medios desde el control remoto
 const mediaReq = createMockReqRes({
 method: 'GET',
 url: '/api/media',
 headers: { 'x-lumen-pin': pin }
 })
 mediaReq.execute(remote)
 const mediaResult = mediaReq.getResult()
 expect(mediaResult.statusCode).toBe(200)
 const mediaData = JSON.parse(mediaResult.body) as { ok: boolean; media: Array<{ id: string; name: string; kind: string }> }
 expect(mediaData.ok).toBe(true)
 expect(mediaData.media.length).toBeGreaterThan(0)
 const mediaId = mediaData.media[0]?.id ?? ''

 // 7. Proyectar medio y controlar reproducción desde el control remoto
 const projectMediaReq = createMockReqRes({
 method: 'POST',
 url: '/api/action',
 headers: { 'x-lumen-pin': pin },
 body: JSON.stringify({ action: 'project-media', mediaId })
 })
 projectMediaReq.execute(remote)
 expect(projectMediaReq.getResult().statusCode).toBe(200)
 expect(statusStore.get().projection.live.deckTitle).toBe(mediaData.media[0]?.name)

 // 8. Controlar pausa/reanudación y alerta desde el móvil
 const togglePlayReq = createMockReqRes({
 method: 'POST',
 url: '/api/action',
 headers: { 'x-lumen-pin': pin },
 body: JSON.stringify({ action: 'video-toggle-play' })
 })
 togglePlayReq.execute(remote)
 expect(togglePlayReq.getResult().statusCode).toBe(200)

 const tickerReq = createMockReqRes({
 method: 'POST',
 url: '/api/action',
 headers: { 'x-lumen-pin': pin },
 body: JSON.stringify({ action: 'set-ticker', text: 'Bienvenida a los visitantes' })
 })
 tickerReq.execute(remote)
 expect(tickerReq.getResult().statusCode).toBe(200)
 expect(statusStore.get().projection.live.theme.tickerActive).toBe(true)
 expect(statusStore.get().projection.live.theme.tickerText).toBe('Bienvenida a los visitantes')
 })
})
