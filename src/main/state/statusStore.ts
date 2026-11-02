import type {
  AppStatus,
  LiveProjectionState,
  MobileStatus,
  PresentationSlide,
  ProjectionDisplayMode,
  ProjectionGoToSlideRequest,
  ProjectionLoadDeckRequest,
  ProjectionStatus,
  ProjectionTheme
} from '../../shared/ipc'
import { songToSlides } from '../../shared/slideHelpers'
import { DEFAULT_INITIAL_SONG, DEFAULT_SETTINGS, DEFAULT_THEME } from '../data/defaultSeeds'

export type StatusListener = (status: AppStatus) => void

/**
 * Igualdad profunda con la misma semántica que la comparación anterior por
 * `JSON.stringify(a) === JSON.stringify(b)`, pero sin serializar nada.
 *
 * Ventaja de rendimiento: corta en cuanto dos subárboles comparten referencia,
 * por lo que comprobar si algo ha cambiado recorre solo lo modificado y no
 * vuelca en memoria el deck completo (que incluye imágenes en base64).
 */
function isSameStateValue(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a === 'number' && typeof b === 'number' && Number.isNaN(a) && Number.isNaN(b)) return true
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false
  if (a instanceof Date || b instanceof Date) {
    return a instanceof Date && b instanceof Date && a.getTime() === b.getTime()
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      // JSON.stringify convierte huecos y `undefined` de un array en `null`
      if (!isSameStateValue(a[i] ?? null, b[i] ?? null)) return false
    }
    return true
  }
  if (Object.getPrototypeOf(a) !== Object.prototype || Object.getPrototypeOf(b) !== Object.prototype) {
    // Tipos exóticos: no deberían existir en AppStatus, pero comparamos bien.
    return JSON.stringify(a) === JSON.stringify(b)
  }
  const aRecord = a as Record<string, unknown>
  const bRecord = b as Record<string, unknown>
  let aCount = 0
  for (const key of Object.keys(aRecord)) {
    const value = aRecord[key]
    if (value === undefined) continue // JSON.stringify omitía estas claves
    aCount++
    if (!isSameStateValue(value, bRecord[key])) return false
  }
  let bCount = 0
  for (const key of Object.keys(bRecord)) {
    if (bRecord[key] !== undefined) bCount++
  }
  return aCount === bCount
}

export function createInitialLiveState(): LiveProjectionState {
  const initialSong = DEFAULT_INITIAL_SONG
  return {
    mode: 'live',
    deckTitle: initialSong.title,
    slides: songToSlides(initialSong),
    currentIndex: 0,
    theme: structuredClone(DEFAULT_THEME),
    churchName: DEFAULT_SETTINGS.churchName,
    welcomeSubtitle: DEFAULT_SETTINGS.welcomeSubtitle,
    showClockOnLogo: DEFAULT_SETTINGS.showClockOnLogo
  }
}

export function createInitialStatus(displayCount = 1): AppStatus {
  return {
    projection: {
      windowOpen: false,
      fullscreen: false,
      displayId: null,
      displayCount,
      content: 'live',
      live: createInitialLiveState()
    },
    mobile: {
      state: 'not-started',
      connectedClients: 0
    }
  }
}

/**
 * Almacén del estado global de la aplicación en el proceso principal.
 * No depende de Electron para poder probarse de forma aislada.
 */
export class StatusStore {
  private status: AppStatus
  private readonly listeners = new Set<StatusListener>()

  constructor(initial: AppStatus = createInitialStatus()) {
    this.status = structuredClone(initial)
  }

  /** Devuelve una copia para que nadie pueda mutar el estado interno. */
  get(): AppStatus {
    return structuredClone(this.status)
  }

  /** Devuelve solo el tema en vivo: evita clonar el deck completo (imágenes en base64) para leer unos campos. */
  getLiveTheme(): ProjectionTheme {
    return structuredClone(this.status.projection.live.theme)
  }

  updateProjection(patch: Partial<ProjectionStatus>): void {
    this.commit({ ...this.status, projection: { ...this.status.projection, ...patch } })
  }

  updateLive(patch: Partial<LiveProjectionState>): void {
    const nextLive: LiveProjectionState = {
      ...this.status.projection.live,
      ...patch
    }
    const content = nextLive.mode === 'test-pattern' ? 'test-pattern' : 'live'
    this.updateProjection({ content, live: nextLive })
  }

  loadDeck(request: ProjectionLoadDeckRequest): void {
    const slides: PresentationSlide[] = structuredClone(request.slides)
    if (slides.length === 0) return
    const clampedIndex = Math.max(0, Math.min(request.startIndex ?? 0, slides.length - 1))
    this.updateLive({
      mode: 'live',
      deckTitle: request.deckTitle,
      slides,
      currentIndex: clampedIndex,
      theme: {
        ...this.status.projection.live.theme,
        frozen: false
      }
    })
  }

  goToSlide(request: ProjectionGoToSlideRequest): void {
    const { slides, currentIndex } = this.status.projection.live
    if (slides.length === 0) return
    let nextIndex = currentIndex
    if (request.index !== undefined) {
      nextIndex = Math.max(0, Math.min(request.index, slides.length - 1))
    } else if (request.direction === 'next') {
      nextIndex = Math.min(currentIndex + 1, slides.length - 1)
    } else if (request.direction === 'prev') {
      nextIndex = Math.max(currentIndex - 1, 0)
    }
    this.updateLive({
      mode: 'live',
      currentIndex: nextIndex,
      theme: {
        ...this.status.projection.live.theme,
        frozen: false
      }
    })
  }

  setMode(mode: ProjectionDisplayMode): void {
    this.updateLive({ mode })
  }

  updateTheme(patch: Partial<ProjectionTheme>): void {
    const nextTheme: ProjectionTheme = {
      ...this.status.projection.live.theme,
      ...patch
    }
    this.updateLive({ theme: nextTheme })
  }

  updateMobile(patch: Partial<MobileStatus>): void {
    this.commit({ ...this.status, mobile: { ...this.status.mobile, ...patch } })
  }

  subscribe(listener: StatusListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private commit(next: AppStatus): void {
    if (isSameStateValue(next, this.status)) return
    this.status = next
    const snapshot = this.get()
    for (const listener of this.listeners) {
      listener(snapshot)
    }
  }
}
