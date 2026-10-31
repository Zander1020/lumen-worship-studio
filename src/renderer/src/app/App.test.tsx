import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_BIBLE_VERSES,
  DEFAULT_MEDIA_BACKGROUNDS,
  DEFAULT_SETTINGS,
  DEFAULT_SONGS,
  createDefaultSchedule
} from '../../../main/data/defaultSeeds'
import { createInitialLiveState } from '../../../main/state/statusStore'
import type { LumenApi } from '../../../shared/api'
import type { AppStatus } from '../../../shared/ipc'
import { SECTIONS } from '../../../shared/sections'
import { parseRawLyricsToStanzas } from '../../../shared/slideHelpers'
import { App } from './App'

function makeStatus(windowOpen = false): AppStatus {
  return {
    projection: {
      windowOpen,
      fullscreen: false,
      displayId: windowOpen ? 1 : null,
      displayCount: 1,
      content: 'live',
      live: createInitialLiveState()
    },
    mobile: {
      state: 'not-started',
      connectedClients: 0
    }
  }
}

describe('App (ventana principal)', () => {
  let currentStatus: AppStatus
  let mockApi: LumenApi

  beforeEach(() => {
    currentStatus = makeStatus(false)
    mockApi = {
      getAppInfo: vi.fn().mockResolvedValue({
        name: 'Lumen Worship Studio',
        version: '0.1.0',
        platform: 'win32',
        electron: '45.1.0',
        chrome: '136.0.0',
        node: '22.18.0'
      }),
      getStatus: vi.fn().mockImplementation(() => Promise.resolve(currentStatus)),
      onStatusChanged: vi.fn().mockReturnValue(() => undefined),
      openProjection: vi.fn().mockImplementation(() => {
        currentStatus = makeStatus(true)
        return Promise.resolve(currentStatus)
      }),
      closeProjection: vi.fn().mockImplementation(() => {
        currentStatus = makeStatus(false)
        return Promise.resolve(currentStatus)
      }),
      loadProjectionDeck: vi.fn().mockImplementation(() => Promise.resolve(currentStatus)),
      goToSlide: vi.fn().mockImplementation(() => Promise.resolve(currentStatus)),
      setProjectionMode: vi.fn().mockImplementation(() => Promise.resolve(currentStatus)),
      updateProjectionTheme: vi.fn().mockImplementation(() => Promise.resolve(currentStatus)),
      listSongs: vi.fn().mockResolvedValue([...DEFAULT_SONGS]),
      upsertSong: vi.fn().mockResolvedValue([...DEFAULT_SONGS]),
      deleteSong: vi.fn().mockResolvedValue([...DEFAULT_SONGS]),
      parseRawLyrics: vi.fn().mockImplementation((raw: string) => Promise.resolve(parseRawLyricsToStanzas(raw))),
      importHolyricsCatalog: vi.fn().mockResolvedValue([...DEFAULT_SONGS]),
      listBibleBooks: vi.fn().mockResolvedValue([{ book: 'Salmos', chapters: [23] }]),
      getBibleChapter: vi.fn().mockResolvedValue(
        DEFAULT_BIBLE_VERSES.filter((v) => v.book === 'Salmos' && v.chapter === 23)
      ),
      searchBible: vi.fn().mockResolvedValue([]),
      listSchedule: vi.fn().mockResolvedValue(createDefaultSchedule()),
      addScheduleItem: vi.fn().mockResolvedValue(createDefaultSchedule()),
      removeScheduleItem: vi.fn().mockResolvedValue(createDefaultSchedule()),
      moveScheduleItem: vi.fn().mockResolvedValue(createDefaultSchedule()),
      clearSchedule: vi.fn().mockResolvedValue([]),
      listMedia: vi.fn().mockResolvedValue([...DEFAULT_MEDIA_BACKGROUNDS]),
      addMedia: vi.fn().mockResolvedValue([...DEFAULT_MEDIA_BACKGROUNDS]),
      deleteMedia: vi.fn().mockResolvedValue([...DEFAULT_MEDIA_BACKGROUNDS]),
      openMediaFolder: vi.fn().mockResolvedValue('C:\\test\\media'),
      reloadMedia: vi.fn().mockResolvedValue([...DEFAULT_MEDIA_BACKGROUNDS]),
      getRemoteInfo: vi.fn().mockResolvedValue({
        running: false,
        port: 4319,
        pin: '2468',
        urls: [],
        connectedClients: 0
      }),
      startRemoteServer: vi.fn().mockResolvedValue({
        running: true,
        port: 4319,
        pin: '2468',
        urls: ['http://localhost:4319'],
        connectedClients: 0
      }),
      stopRemoteServer: vi.fn().mockResolvedValue({
        running: false,
        port: 4319,
        pin: '2468',
        urls: [],
        connectedClients: 0
      }),
      regenerateRemotePin: vi.fn().mockResolvedValue({
        running: false,
        port: 4319,
        pin: '9999',
        urls: [],
        connectedClients: 0
      }),
      suggestForTheme: vi.fn().mockResolvedValue({
        theme: 'Gracia',
        suggestedSongs: DEFAULT_SONGS.slice(0, 1),
        suggestedVerses: DEFAULT_BIBLE_VERSES.slice(0, 1),
        suggestedAnnouncement: {
          id: 'ann-1',
          sourceKind: 'announcement',
          sourceTitle: 'Tema: Gracia',
          label: 'Tema: Gracia',
          lines: ['Bienvenidos'],
          footer: 'Lumen'
        }
      }),
      getSettings: vi.fn().mockResolvedValue(DEFAULT_SETTINGS),
      updateSettings: vi.fn().mockResolvedValue(DEFAULT_SETTINGS)
    }
    Object.defineProperty(window, 'lumen', {
      value: mockApi,
      configurable: true,
      writable: true
    })
  })

  it('muestra todas las secciones requeridas en el menú lateral y permite navegar entre ellas', async () => {
    const user = userEvent.setup()
    render(<App />)

    const nav = screen.getByRole('navigation', { name: /secciones principales/i })
    const visibleSections = SECTIONS.filter((s) => s.id !== 'songs' && s.id !== 'bible' && s.id !== 'projection')
    for (const section of visibleSections) {
      expect(within(nav).getByRole('button', { name: new RegExp(section.label, 'i') })).toBeInTheDocument()
    }

    // Navegar a cada sección y verificar el título principal
    for (const section of visibleSections) {
      await user.click(within(nav).getByRole('button', { name: new RegExp(section.label, 'i') }))
      expect(screen.getByRole('heading', { level: 1, name: section.label })).toBeInTheDocument()
    }
  })

  it('muestra el estado de la proyección y de la conexión móvil, y permite abrir/cerrar la proyección', async () => {
    const user = userEvent.setup()
    render(<App />)

    const projIndicator = await screen.findByTestId('status-projection')
    const mobileIndicator = screen.getByTestId('status-mobile')

    expect(projIndicator).toHaveTextContent('Proyección:Cerrada')
    expect(mobileIndicator).toHaveTextContent('Conexión móvil:Servicio no iniciado')

    const openBtn = screen.getByRole('button', { name: 'Abrir proyección' })
    await user.click(openBtn)

    expect(mockApi.openProjection).toHaveBeenCalledWith({ target: 'auto' })
    expect(await screen.findByTestId('status-projection')).toHaveTextContent('Abierta (en ventana, en vivo)')

    const closeBtn = screen.getByRole('button', { name: 'Cerrar proyección' })
    await user.click(closeBtn)

    expect(mockApi.closeProjection).toHaveBeenCalledTimes(1)
    expect(await screen.findByTestId('status-projection')).toHaveTextContent('Cerrada')
  })
})
