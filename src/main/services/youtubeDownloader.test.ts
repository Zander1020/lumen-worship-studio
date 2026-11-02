import { describe, expect, it } from 'vitest'
import { parseYoutubeId, sanitizeFilename } from './youtubeDownloader'

describe('youtubeDownloader', () => {
  describe('parseYoutubeId', () => {
    it('extrae el ID de una URL estándar de YouTube', () => {
      expect(parseYoutubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
      expect(parseYoutubeId('http://youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
      expect(parseYoutubeId('https://m.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    })

    it('extrae el ID de enlaces cortos youtu.be', () => {
      expect(parseYoutubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
      expect(parseYoutubeId('http://youtu.be/dQw4w9WgXcQ?t=42')).toBe('dQw4w9WgXcQ')
    })

    it('extrae el ID de YouTube Shorts y Embeds', () => {
      expect(parseYoutubeId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
      expect(parseYoutubeId('https://youtube.com/shorts/dQw4w9WgXcQ?feature=share')).toBe('dQw4w9WgXcQ')
      expect(parseYoutubeId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    })

    it('extrae el ID cuando hay múltiples parámetros de consulta', () => {
      expect(
        parseYoutubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=RDdQw4w9WgXcQ&start_radio=1')
      ).toBe('dQw4w9WgXcQ')
      expect(
        parseYoutubeId('https://www.youtube.com/watch?feature=shared&v=dQw4w9WgXcQ')
      ).toBe('dQw4w9WgXcQ')
    })

    it('acepta un ID directo de 11 caracteres', () => {
      expect(parseYoutubeId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    })

    it('devuelve null ante URLs no válidas o cadenas vacías', () => {
      expect(parseYoutubeId('')).toBeNull()
      expect(parseYoutubeId('https://vimeo.com/123456789')).toBeNull()
      expect(parseYoutubeId('https://google.com')).toBeNull()
      expect(parseYoutubeId('not-a-youtube-url')).toBeNull()
      expect(parseYoutubeId(null as unknown as string)).toBeNull()
    })
  })

  describe('sanitizeFilename', () => {
    it('elimina caracteres prohibidos en nombres de archivo de Windows', () => {
      const sanitized = sanitizeFilename('Video: Dios existe? / Test <1> *demo* | "Audio"')
      expect(sanitized).not.toMatch(/[<>:"/\\|?*]/)
      expect(sanitized).toBe('Video_ Dios existe_ _ Test _1_ _demo_ _ _Audio_')
    })

    it('recorta espacios y puntos al final', () => {
      expect(sanitizeFilename('Alabanza Hermosa...  ')).toBe('Alabanza Hermosa')
    })

    it('asigna un nombre por defecto si la cadena queda vacía', () => {
      expect(sanitizeFilename('')).toBe('video_youtube')
      expect(sanitizeFilename('   ')).toBe('video_youtube')
      expect(sanitizeFilename('???***///')).toBe('video_youtube')
    })

    it('limita la longitud máxima a 120 caracteres', () => {
      const veryLong = 'A'.repeat(200)
      expect(sanitizeFilename(veryLong).length).toBe(120)
    })
  })
})
