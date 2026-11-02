import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { BiblePage } from './BiblePage'
import type { UseAppStatus } from '../../hooks/useAppStatus'
import type { BibleBookSummary, BibleVerse } from '../../../../shared/ipc'

const BOOKS: BibleBookSummary[] = [
  { book: 'Génesis', abbrev: 'Gn', testament: 'AT', chapters: [1, 2, 3, 4, 5] },
  { book: 'Salmos', abbrev: 'Sal', testament: 'AT', chapters: [1, 2, 3, 23, 24] }
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
    getBibleChapter: vi.fn().mockResolvedValue(CHAPTER_VERSES),
    searchBible: vi.fn().mockResolvedValue(SEARCH_RESULTS),
    loadBibleBooks: vi.fn().mockResolvedValue(BOOKS)
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
})
