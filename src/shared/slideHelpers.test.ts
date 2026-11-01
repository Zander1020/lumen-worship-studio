import { describe, expect, it } from 'vitest'
import {
 applyVerseOrder,
 autoSplitLongStanzas,
 cleanInternetLyrics,
 createAnnouncementSlide,
 fuzzyMatchScore,
 parseRawLyricsToStanzas,
 songToSlides,
 transposeChordText,
 versesToSlides
} from './slideHelpers'

describe('parseRawLyricsToStanzas', () => {
 it('separa estrofas con encabezados [Verso 1] y [Coro]', () => {
 const raw = `[Verso 1]
Sublime gracia del Señor
Que a un infeliz salvó

[Coro]
De mis cadenas libre soy
Mi Salvador me rescató`

 const stanzas = parseRawLyricsToStanzas(raw)
 expect(stanzas).toHaveLength(2)
 expect(stanzas[0]?.label).toBe('Verso 1')
 expect(stanzas[0]?.kind).toBe('verse')
 expect(stanzas[0]?.lines).toEqual(['Sublime gracia del Señor', 'Que a un infeliz salvó'])
 expect(stanzas[1]?.label).toBe('Coro')
 expect(stanzas[1]?.kind).toBe('chorus')
 })

 it('numera automáticamente bloques sin encabezado', () => {
 const raw = `Primera línea
Segunda línea

Tercera línea
Cuarta línea`

 const stanzas = parseRawLyricsToStanzas(raw)
 expect(stanzas).toHaveLength(2)
 expect(stanzas[0]?.label).toBe('Verso 1')
 expect(stanzas[1]?.label).toBe('Verso 2')
 })
})

describe('songToSlides y versesToSlides', () => {
 it('convierte una canción y versículos en diapositivas presentables', () => {
 const slides = songToSlides({
 id: 's1',
 title: 'Sublime Gracia',
 author: 'John Newton',
 musicalKey: 'G',
 bpm: 72,
 tags: ['Gracia'],
 updatedAt: '2026-10-28T00:00:00Z',
 stanzas: [{ id: 'st1', label: 'Verso 1', kind: 'verse', lines: ['Línea 1'] }]
 })
 expect(slides).toHaveLength(1)
 expect(slides[0]?.footer).toContain('Sublime Gracia')

 const bibleSlides = versesToSlides([
 { book: 'Salmos', chapter: 23, verse: 1, text: 'Jehová es mi pastor; nada me faltará.' }
 ])
 expect(bibleSlides).toHaveLength(1)
 expect(bibleSlides[0]?.label).toBe('Salmos 23:1')

 const ann = createAnnouncementSlide('Bienvenida', 'Línea A\nLínea B')
 expect(ann.sourceKind).toBe('announcement')
 expect(ann.lines).toEqual(['Línea A', 'Línea B'])
 })

 it('limpia letras de internet, divide estrofas largas, aplica VerseOrder y transpone acordes', () => {
 const dirty = `G D Em C\n1. [Am]Sublime gracia del Señor\nQue a un infeliz salvó`
 const cleaned = cleanInternetLyrics(dirty)
 expect(cleaned).toBe('Sublime gracia del Señor\nQue a un infeliz salvó')

 const split = autoSplitLongStanzas(
 [{ id: '1', label: 'Verso 1', kind: 'verse', lines: ['L1', 'L2', 'L3', 'L4', 'L5', 'L6'] }],
 4
 )
 expect(split).toHaveLength(2)
 expect(split[0]?.label).toBe('Verso 1 (A)')
 expect(split[1]?.label).toBe('Verso 1 (B)')

 const ordered = applyVerseOrder(
 [
 { id: '1', label: 'Verso 1', kind: 'verse', lines: ['V1'] },
 { id: '2', label: 'Coro', kind: 'chorus', lines: ['C'] }
 ],
 'C V1 C'
 )
 expect(ordered.map((s) => s.label)).toEqual(['Coro', 'Verso 1', 'Coro'])

 expect(transposeChordText('G D Em C', 2)).toBe('A E F#m D')
 expect(fuzzyMatchScore('Sublime Gracia del Señor', 'sublme senor')).toBeGreaterThan(30)
 })
})

