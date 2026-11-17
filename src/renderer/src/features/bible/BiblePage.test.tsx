import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { BiblePage } from './BiblePage'
import type { UseAppStatus } from '../../hooks/useAppStatus'
import type { BibleBookSummary, BibleVerse } from '../../../../shared/ipc'

const BOOKS: BibleBookSummary[] = [
  { book: 'Génesis', abbrev: 'Gn', testament: 'AT', chapters: [1, 2, 3, 4, 5] },
  { book: 'Salmos', abbrev: 'Sal', testament: 'AT', chapters: [1, 2, 3, 23, 24] },
  { book: 'Juan', abbrev: 'Jn', testament: 'NT', chapters: [1, 2, 3] }
]

const CHAPTER_VERSES: BibleVerse[] = [
  { book: 'Génesis', chapter: 1, verse: 1, text: 'En el principio creó Dios los cielos y la tierra.' },
  { book: 'Génesis', chapter: 1, verse: 2, text: 'Y la tierra estaba desordenada y vacía.' }
]

const SEARCH_RESULTS: BibleVerse[] = [
  { book: 'Juan', chapter: 3, verse: 16, text: 'Porque de tal manera amó Dios al mundo.' }
]

function makeApp(): UseAppStatus {
  return {
    status: null,
    songs: [],
    schedule: [],
    media: [],
    bibleBooks: BOOKS,
    bibleVersions: [{ id: 'rvr1960', name: 'Reina-Valera 1960', builtIn: true }],
    settings: null,
    remoteInfo: null,
    error: null,
    notice: null,
    busy: false,
    bridgeAvailable: true,
    getBibleChapter: vi.fn().mockImplementation(({ book, chapter }: { book: string; chapter: number }) => {
      if (book === 'Juan' && chapter === 3) {
        return Promise.resolve([
          { book: 'Juan', chapter: 3, verse: 1, text: 'Había un hombre de los fariseos que se llamaba Nicodemo.' },
          { book: 'Juan', chapter: 3, verse: 16, text: 'Porque de tal manera amó Dios al mundo.' }
        ])
      }
      return Promise.resolve(CHAPTER_VERSES)
    }),
    searchBible: vi.fn().mockResolvedValue(SEARCH_RESULTS),
    loadBibleBooks: vi.fn().mockResolvedValue(BOOKS),
    loadProjectionDeck: vi.fn().mockResolvedValue(undefined)
  } as unknown as UseAppStatus
}

describe('BiblePage', () => {
  it('retoma libro, capítulo, versículo y búsqueda al volver de otra pestaña', async () => {
    const user = userEvent.setup()
    const app = makeApp()

    // --- Pestaña Bíblica: estado inicial y navegación ---
    const first = render(<BiblePage app={app} />)
    expect(await screen.findByText(/SALMOS 23 \(/)).toBeInTheDocument()

    const bookList = screen.getByRole('list', { name: 'Libros de la Biblia' })
    await user.click(within(bookList).getByText('Génesis'))
    expect(await screen.findByText(/GÉNESIS 1 \(/)).toBeInTheDocument()

    // --- Búsqueda de una cita (con debounce de 300 ms) ---
    await user.type(screen.getByRole('searchbox', { name: 'Buscar en la Biblia' }), 'jn 3 16')
    await waitFor(() => expect(app.searchBible).toHaveBeenCalledTimes(1), { timeout: 2000 })
    expect(app.searchBible).toHaveBeenCalledWith('jn 3:16', 'rvr1960')
    expect(await screen.findByText(/RESULTADOS PARA «JN 3 16»/)).toBeInTheDocument()

    // --- Salir de la pestaña (el componente se desmonta) ---
    first.unmount()

    // --- Volver: la vista debe seguir intacta sin repetir la búsqueda ---
    render(<BiblePage app={app} />)
    expect(screen.getByRole('searchbox', { name: 'Buscar en la Biblia' })).toHaveValue('jn 3 16')
    expect(screen.getByText(/RESULTADOS PARA «JN 3 16»/)).toBeInTheDocument()

    // Pasado el plazo del debounce, no se vuelve a consultar el buscador
    await new Promise((resolve) => setTimeout(resolve, 450))
    expect(app.searchBible).toHaveBeenCalledTimes(1)

    // Al limpiar la búsqueda se comprueba que libro y capítulo siguen guardados
    const chapterList = screen.getByRole('list', { name: 'Capítulos disponibles' })
    await user.click(within(chapterList).getByText('1'))
    expect(screen.getByText(/GÉNESIS 1 \(/)).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Libros de la Biblia' }).querySelector('.bible-book-btn--active'))
      .not.toBeNull()
  })

  it('abre la modal de cita rápida al escribir, autocompleta libro con Tab y proyecta capítulo y versículo', async () => {
    const user = userEvent.setup()
    const app = makeApp()

    render(<BiblePage app={app} />)

    // Al escribir una letra sin ningún input enfocado se abre automáticamente la modal con ese carácter
    await user.keyboard('j')

    const dialog = await screen.findByRole('dialog', { name: 'Ir a cita bíblica' })
    const bookInput = within(dialog).getByLabelText('Libro bíblico')
    await waitFor(() => expect(bookInput).toHaveValue('j'))

    // Completar abreviatura "jn" y pulsar Tab para autocompletar "Juan" y pasar a Capítulo
    await user.type(bookInput, 'n{Tab}')
    expect(bookInput).toHaveValue('Juan')

    const chapterInput = within(dialog).getByLabelText('Capítulo bíblico')
    await waitFor(() => expect(chapterInput).toHaveFocus())

    // Escribir capítulo 3 y pulsar Tab para pasar a Versículo
    await user.type(chapterInput, '3{Tab}')
    expect(chapterInput).toHaveValue('3')

    const verseInput = within(dialog).getByLabelText('Versículo bíblico')
    await waitFor(() => expect(verseInput).toHaveFocus())

    // Escribir versículo 16, comprobar vista previa y pulsar Enter para proyectar
    await user.type(verseInput, '16')
    expect(await within(dialog).findByText(/Porque de tal manera amó Dios al mundo\./)).toBeInTheDocument()

    await user.keyboard('{Enter}')

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Ir a cita bíblica' })).not.toBeInTheDocument())
    expect(app.loadProjectionDeck).toHaveBeenCalledWith(
      expect.objectContaining({
        deckTitle: 'Juan 3',
        startIndex: 1,
        openWindow: true
      })
    )

    // También puede abrirse mediante el botón dedicado y cerrarse con Escape
    await user.click(screen.getByRole('button', { name: 'Ir a cita bíblica rápida' }))
    expect(await screen.findByRole('dialog', { name: 'Ir a cita bíblica' })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Ir a cita bíblica' })).not.toBeInTheDocument())
  })
})
