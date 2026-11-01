import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { WorkspaceStore } from './workspaceStore'

describe('WorkspaceStore', () => {
  it('gestiona el CRUD de alabanzas y la importación de catálogos Holyrics', () => {
    const store = new WorkspaceStore()
    const initialCount = store.listSongs().length
    expect(initialCount).toBeGreaterThanOrEqual(5)

    const afterAdd = store.upsertSong({
      id: 'song-custom-test',
      title: 'Mi Alabanza de Prueba',
      author: 'Autor Local',
      musicalKey: 'A',
      bpm: 100,
      tags: ['Prueba', 'Gozo'],
      stanzas: [{ id: 's1', label: 'Verso 1', kind: 'verse', lines: ['Línea de prueba'] }]
    })
    expect(afterAdd.length).toBe(initialCount + 1)
    expect(afterAdd[0]?.title).toBe('Mi Alabanza de Prueba')

    const afterDelete = store.deleteSong('song-custom-test')
    expect(afterDelete.length).toBe(initialCount)

    const afterHolyricsImport = store.importHolyricsCatalog([
      {
        fileName: 'catalogo.json',
        content: JSON.stringify({
          musicas: [
            {
              titulo: 'Canto desde Holyrics',
              autor: 'Ministerio',
              tom: 'E',
              lyrics: {
                paragraphs: [{ description: 'Coro', text: 'Gloria a Dios en las alturas' }]
              }
            }
          ]
        })
      }
    ])
    expect(afterHolyricsImport.length).toBe(initialCount + 1)
    expect(afterHolyricsImport[0]?.title).toBe('Canto desde Holyrics')
  })

  it('carga los 66 libros completos de la Biblia y busca por capítulo, cita y palabra clave', () => {
    const store = new WorkspaceStore()
    const books = store.listBibleBooks()
    expect(books.length).toBe(66)
    expect(books[0]?.book).toBe('Génesis')
    expect(books[65]?.book).toBe('Apocalipsis')

    const psalm23 = store.getBibleChapter('Salmos', 23)
    expect(psalm23.length).toBe(6)

    const range = store.searchBible('Salmos 23:1-2')
    expect(range.length).toBe(2)

    const gen1 = store.searchBible('Génesis 1:1')
    expect(gen1[0]?.text).toContain('En el principio creó Dios los cielos y la tierra')

    const byWord = store.searchBible('pastor')
    expect(byWord.some((v) => v.book === 'Salmos' && v.chapter === 23 && v.verse === 1)).toBe(true)
  })

  it('gestiona la programación del culto, fondos multimedia, sugerencias temáticas y ajustes', () => {
    const store = new WorkspaceStore()
    const initialSchedule = store.listSchedule()
    expect(initialSchedule.length).toBeGreaterThan(0)

    const firstId = initialSchedule[0]?.id ?? ''
    const secondId = initialSchedule[1]?.id ?? ''
    const moved = store.moveScheduleItem({ id: secondId, direction: 'up' })
    expect(moved[0]?.id).toBe(secondId)
    expect(moved[1]?.id).toBe(firstId)

    const suggestion = store.suggestForTheme('Gracia y Salvación')
    expect(suggestion.suggestedSongs.length).toBeGreaterThan(0)
    expect(suggestion.suggestedVerses.length).toBeGreaterThan(0)

    const updatedSettings = store.updateSettings({ churchName: 'Iglesia Luz Viva' })
    expect(updatedSettings.churchName).toBe('Iglesia Luz Viva')
  })

  it('sincroniza presentaciones con la carpeta de diapositivas y purga elementos huérfanos al recargar', async () => {
    const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs')
    const { tmpdir } = await import('node:os')

    const tempDir = mkdtempSync(join(tmpdir(), 'lumen-test-'))
    const workspaceJson = join(tempDir, 'workspace.json')

    try {
      const store = new WorkspaceStore(workspaceJson)

      // Guardar una presentación huérfana (sin archivo físico)
      store.savePresentation({
        id: 'orphan-1',
        title: 'Presentación Huérfana',
        subtitle: '1 diapositiva',
        kind: 'pptx',
        slides: [{ id: 's1', sourceKind: 'custom', sourceTitle: 'Test', label: 'Diapositiva 1', lines: ['Prueba'], footer: '' }]
      })

      expect(store.listPresentations().length).toBe(1)

      // Al recargar cuando la carpeta diapositivas está vacía, debe purgarse
      const reloaded = store.reloadSlides()
      expect(reloaded.length).toBe(0)
      expect(store.listPresentations().length).toBe(0)

      // Ahora colocamos un archivo real en la carpeta diapositivas
      const slidesDir = join(tempDir, 'diapositivas')
      const realPptx = join(slidesDir, 'Tema Domingo.pptx')
      writeFileSync(realPptx, 'dummy pptx content')

      // Guardamos la presentación asociada a ese archivo
      store.savePresentation({
        id: 'real-1',
        title: 'Tema Domingo',
        subtitle: '1 diapositiva',
        kind: 'pptx',
        filePath: realPptx,
        slides: [{ id: 's1', sourceKind: 'custom', sourceTitle: 'Tema', label: 'Diapositiva 1', lines: ['Contenido'], footer: '' }]
      })

      expect(store.listPresentations().length).toBe(1)

      // Al recargar, como el archivo existe físicamente, se preserva
      const reloaded2 = store.reloadSlides()
      expect(reloaded2.length).toBe(1)
      expect(reloaded2[0]?.title).toBe('Tema Domingo')

      // Al eliminar, debe borrar el archivo físico
      store.deletePresentation('real-1')
      expect(store.listPresentations().length).toBe(0)
      const { existsSync } = await import('node:fs')
      expect(existsSync(realPptx)).toBe(false)
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })
})
