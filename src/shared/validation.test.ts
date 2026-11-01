import { describe, expect, it } from 'vitest'
import {
 ValidationError,
 assertNoPayload,
 isTrustedAppUrl,
 parseBibleChapterRequest,
 parseProjectionGoToSlideRequest,
 parseProjectionLoadDeckRequest,
 parseProjectionOpenRequest,
 parseProjectionSetModeRequest,
 parseProjectionThemePatch,
 parseScheduleMoveRequest,
 parseSongInput
} from './validation'

describe('parseProjectionOpenRequest', () => {
 it('devuelve target "auto" cuando la entrada es undefined', () => {
 expect(parseProjectionOpenRequest(undefined)).toEqual({ target: 'auto' })
 })

 it('acepta target "auto" y "windowed"', () => {
 expect(parseProjectionOpenRequest({ target: 'auto' })).toEqual({ target: 'auto' })
 expect(parseProjectionOpenRequest({ target: 'windowed' })).toEqual({ target: 'windowed' })
 expect(parseProjectionOpenRequest({})).toEqual({ target: 'auto' })
 })

 it('rechaza valores que no sean objetos planos', () => {
 expect(() => parseProjectionOpenRequest(null)).toThrow(ValidationError)
 expect(() => parseProjectionOpenRequest('auto')).toThrow(ValidationError)
 expect(() => parseProjectionOpenRequest(123)).toThrow(ValidationError)
 expect(() => parseProjectionOpenRequest([])).toThrow(ValidationError)
 })

 it('rechaza propiedades desconocidas o targets inválidos', () => {
 expect(() => parseProjectionOpenRequest({ target: 'fullscreen' })).toThrow(ValidationError)
 expect(() => parseProjectionOpenRequest({ target: 'auto', extra: true })).toThrow(ValidationError)
 })
})

describe('validadores de proyección, canciones, Biblia y programación', () => {
 it('valida solicitudes de carga y navegación de diapositivas', () => {
 const deck = parseProjectionLoadDeckRequest({
 deckTitle: 'Sublime Gracia',
 slides: [
 {
 id: 'sl-1',
 sourceKind: 'song',
 sourceTitle: 'Sublime Gracia',
 label: 'Verso 1',
 lines: ['Sublime gracia del Señor'],
 footer: 'Sublime Gracia'
 }
 ],
 startIndex: 0
 })
 expect(deck.deckTitle).toBe('Sublime Gracia')
 expect(deck.slides).toHaveLength(1)

 expect(parseProjectionGoToSlideRequest({ direction: 'next' })).toEqual({ direction: 'next' })
 expect(parseProjectionGoToSlideRequest({ index: 2 })).toEqual({ index: 2 })
 expect(() => parseProjectionGoToSlideRequest({})).toThrow(ValidationError)

 expect(parseProjectionSetModeRequest({ mode: 'black' })).toEqual({ mode: 'black' })
 expect(() => parseProjectionSetModeRequest({ mode: 'invalid' })).toThrow(ValidationError)

 // Acepta diapositivas de imágenes/videos o diseños con líneas vacías
 const imageDeck = parseProjectionLoadDeckRequest({
 deckTitle: 'Diseño Culto',
 slides: [
 {
 id: 'sl-img-1',
 sourceKind: 'custom',
 sourceTitle: 'Diseño Culto',
 label: 'Anuncio',
 lines: [],
 footer: '',
 imageUrl: 'data:image/png;base64,abc'
 }
 ]
 })
 expect(imageDeck.slides[0]?.imageUrl).toBe('data:image/png;base64,abc')
 expect(imageDeck.slides[0]?.lines).toEqual([])

 // Valida parches de reproducción de vídeo en proyección
 const themePatch = parseProjectionThemePatch({
 videoPlaying: false,
 videoMuted: true,
 videoLoop: false,
 videoRestartTime: 123456789
 })
 expect(themePatch.videoPlaying).toBe(false)
 expect(themePatch.videoMuted).toBe(true)
 expect(themePatch.videoLoop).toBe(false)
 expect(themePatch.videoRestartTime).toBe(123456789)
 })

 it('valida creación de canciones, consultas bíblicas y movimiento de programación', () => {
 const song = parseSongInput({
 title: 'Canto Nuevo',
 author: 'Autor',
 musicalKey: 'D',
 bpm: 90,
 tags: ['Gozo'],
 stanzas: [{ id: '1', label: 'Verso 1', kind: 'verse', lines: ['Cantad a Dios'] }]
 })
 expect(song.title).toBe('Canto Nuevo')

 expect(parseBibleChapterRequest({ book: 'Salmos', chapter: 23 })).toEqual({
 book: 'Salmos',
 chapter: 23
 })
 expect(() => parseBibleChapterRequest({ book: 'Salmos', chapter: 0 })).toThrow(ValidationError)

 expect(parseScheduleMoveRequest({ id: 'sched-1', direction: 'up' })).toEqual({
 id: 'sched-1',
 direction: 'up'
 })
 })
})

describe('assertNoPayload', () => {
 it('permite undefined y rechaza cualquier otro valor', () => {
 expect(() => assertNoPayload(undefined)).not.toThrow()
 expect(() => assertNoPayload(null)).toThrow(ValidationError)
 expect(() => assertNoPayload({})).toThrow(ValidationError)
 })
})

describe('isTrustedAppUrl', () => {
 it('permite URLs con protocolo file:', () => {
 expect(isTrustedAppUrl('file:///C:/app/out/renderer/index.html')).toBe(true)
 })

 it('rechaza orígenes remotos arbitrarios', () => {
 expect(isTrustedAppUrl('https://example.com')).toBe(false)
 expect(isTrustedAppUrl('http://192.168.1.50:5173/index.html', 'http://192.168.1.50:5173')).toBe(false)
 expect(isTrustedAppUrl('javascript:alert(1)')).toBe(false)
 expect(isTrustedAppUrl('not-a-valid-url')).toBe(false)
 })

 it('permite el servidor de desarrollo local cuando coincide el origen', () => {
 expect(isTrustedAppUrl('http://localhost:5173/index.html', 'http://localhost:5173')).toBe(true)
 expect(isTrustedAppUrl('http://127.0.0.1:5173/projection.html', 'http://127.0.0.1:5173')).toBe(true)
 expect(isTrustedAppUrl('http://localhost:9999/index.html', 'http://localhost:5173')).toBe(false)
 })
})
