import { describe, expect, it } from 'vitest'
import { exportCatalogToHolyricsJson, parseHolyricsCatalogPayload } from './holyricsCompat'

describe('parseHolyricsCatalogPayload (compatibilidad con Holyrics)', () => {
  it('importa un catálogo JSON en formato Holyrics (titulo, autor, tom, lyrics.paragraphs)', () => {
    const json = JSON.stringify({
      musicas: [
        {
          titulo: 'Tu Fidelidad Es Grande',
          autor: 'Miguel Cassina',
          tom: 'D',
          bpm: 74,
          categorias: ['Adoración', 'Fidelidad'],
          lyrics: {
            paragraphs: [
              {
                description: 'Verso 1',
                text: 'Tu fidelidad es grande,\nTu fidelidad incomparable es.'
              },
              {
                description: 'Coro',
                text: 'Nadie como Tú, bendito Dios,\nGrande es tu fidelidad.'
              }
            ]
          }
        }
      ]
    })

    const songs = parseHolyricsCatalogPayload(json)
    expect(songs).toHaveLength(1)
    expect(songs[0]?.title).toBe('Tu Fidelidad Es Grande')
    expect(songs[0]?.author).toBe('Miguel Cassina')
    expect(songs[0]?.musicalKey).toBe('D')
    expect(songs[0]?.stanzas).toHaveLength(2)
    expect(songs[0]?.stanzas[1]?.kind).toBe('chorus')
  })

  it('importa canciones en formato XML OpenLyrics / Holyrics', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<song>
  <properties>
    <titles><title>Alabaré a mi Señor</title></titles>
    <authors><author>Tradicional</author></authors>
    <key>G</key>
  </properties>
  <lyrics>
    <verse name="v1"><lines>Alabaré, alabaré,<br/>Alabaré a mi Señor.</lines></verse>
    <verse name="c1"><lines>Todos unidos alegres cantamos<br/>Glorias y alabanzas al Señor.</lines></verse>
  </lyrics>
</song>`

    const songs = parseHolyricsCatalogPayload(xml)
    expect(songs).toHaveLength(1)
    expect(songs[0]?.title).toBe('Alabaré a mi Señor')
    expect(songs[0]?.stanzas).toHaveLength(2)
    expect(songs[0]?.stanzas[0]?.label).toBe('Verso 1')
    expect(songs[0]?.stanzas[1]?.label).toBe('Coro')
  })

  it('importa catálogos de texto plano (.txt) con una o múltiples canciones separadas por ===', () => {
    const txt = `# Digno Es El Cordero
Autor: Tradicional
Tono: A

[Verso 1]
Digno es el Cordero que fue inmolado
De recibir la gloria y el poder.

===

# Dios Está Aquí
Autor: Tradicional
Tono: C

[Coro]
Dios está aquí,
Tan cierto como el aire que respiro.`

    const songs = parseHolyricsCatalogPayload(txt)
    expect(songs).toHaveLength(2)
    expect(songs[0]?.title).toBe('Digno Es El Cordero')
    expect(songs[0]?.musicalKey).toBe('A')
    expect(songs[1]?.title).toBe('Dios Está Aquí')
    expect(songs[1]?.musicalKey).toBe('C')
  })

  it('exporta y reimporta un catálogo completo sin pérdida', () => {
    const exported = exportCatalogToHolyricsJson([
      {
        id: '1',
        title: 'Sublime Gracia',
        author: 'John Newton',
        musicalKey: 'G',
        bpm: 72,
        tags: ['Himno'],
        updatedAt: '2026-10-28T00:00:00Z',
        stanzas: [{ id: 's1', label: 'Verso 1', kind: 'verse', lines: ['Sublime gracia del Señor'] }]
      }
    ])
    const reimported = parseHolyricsCatalogPayload(exported)
    expect(reimported).toHaveLength(1)
    expect(reimported[0]?.title).toBe('Sublime Gracia')
    expect(reimported[0]?.stanzas[0]?.lines).toEqual(['Sublime gracia del Señor'])
  })
})

