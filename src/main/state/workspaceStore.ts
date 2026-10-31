import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { parseHolyricsCatalogPayload, parseHolyricsMufl } from '../../shared/holyricsCompat'
import type {
  AiSuggestionResult,
  AppSettings,
  BibleBookSummary,
  BibleVerse,
  HolyricsImportItem,
  MediaBackground,
  MediaBackgroundInput,
  ScheduleItem,
  ScheduleItemInput,
  ScheduleMoveRequest,
  Song,
  SongInput
} from '../../shared/ipc'
import { createAnnouncementSlide } from '../../shared/slideHelpers'
import { BibleRepository } from '../data/bibleRepository'
import {
  DEFAULT_MEDIA_BACKGROUNDS,
  DEFAULT_SETTINGS,
  DEFAULT_SONGS,
  createDefaultSchedule
} from '../data/defaultSeeds'

interface PersistedWorkspace {
  songs: Song[]
  schedule: ScheduleItem[]
  media: MediaBackground[]
  settings: AppSettings
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/**
 * Almacén de datos de dominio del estudio (alabanzas, Biblia completa de 66 libros,
 * programación, fondos multimedia, sugerencias temáticas y configuración).
 */
export class WorkspaceStore {
  private songs: Song[]
  private schedule: ScheduleItem[]
  private media: MediaBackground[]
  private settings: AppSettings
  private readonly bible = new BibleRepository()
  private readonly filePath: string | undefined
  private readonly mediaDir: string
  private readonly backgroundsDir: string

  constructor(filePath?: string) {
    this.filePath = filePath
    const baseDir = this.filePath ? dirname(this.filePath) : join(process.cwd(), 'lumen-data')
    this.mediaDir = join(baseDir, 'media')
    this.backgroundsDir = join(baseDir, 'fondos')
    try {
      if (!existsSync(this.mediaDir)) {
        mkdirSync(this.mediaDir, { recursive: true })
      }
      if (!existsSync(this.backgroundsDir)) {
        mkdirSync(this.backgroundsDir, { recursive: true })
      }
    } catch {
      // Ignorar fallo de creación si no hay permisos de disco
    }
    const loaded = this.loadFromDisk()
    this.songs = loaded?.songs ?? structuredClone([...DEFAULT_SONGS])
    this.schedule = loaded?.schedule ?? createDefaultSchedule()
    if (loaded?.media && loaded.media.length > 0) {
      const existingIds = new Set(loaded.media.map((m) => m.id))
      const missingDefaults = DEFAULT_MEDIA_BACKGROUNDS.filter((m) => !existingIds.has(m.id))
      this.media = [...structuredClone(missingDefaults), ...loaded.media]
    } else {
      this.media = structuredClone([...DEFAULT_MEDIA_BACKGROUNDS])
    }
    this.settings = loaded?.settings ?? structuredClone(DEFAULT_SETTINGS)

    // Migrar medios antiguos con data: URLs pesadas a archivos reales en mediaDir
    if (this.mediaDir && existsSync(this.mediaDir)) {
      let migrated = false
      for (const item of this.media) {
        if (typeof item.value === 'string' && item.value.startsWith('data:')) {
          try {
            const comma = item.value.indexOf(',')
            if (comma !== -1) {
              const rawB64 = item.value.slice(comma + 1)
              const ext = item.kind === 'video' ? '.mp4' : '.png'
              const safeName = item.name.replace(/[^a-zA-Z0-9_\-.]/g, '_')
              const fileName = safeName.includes('.') ? safeName : `${safeName}${ext}`
              const targetPath = join(this.mediaDir, fileName)
              if (!existsSync(targetPath)) {
                writeFileSync(targetPath, Buffer.from(rawB64, 'base64'))
              }
              item.value = `lumen-media://local/${encodeURIComponent(targetPath.replace(/\\/g, '/'))}`
              migrated = true
            }
          } catch {
            // ignore
          }
        }
      }
      if (migrated) this.saveToDisk()
    }

    this.reloadMedia()
    this.reloadBackgrounds()

    // Auto-cargar catálogo .mufl si está disponible y la base de datos sólo tiene las 5 canciones por defecto
    if (this.songs.length <= 5) {
      const muflCandidates: string[] = [
        join(process.cwd(), 'bd.mufl'),
        join(__dirname, '../../bd.mufl'),
        join(homedir(), 'Downloads', 'bd.mufl'),
        'C:\\Users\\Zander\\Downloads\\bd.mufl'
      ]
      if (typeof process.resourcesPath === 'string') {
        muflCandidates.unshift(join(process.resourcesPath, 'bd.mufl'))
      }
      for (const p of muflCandidates) {
        if (existsSync(p)) {
          try {
            const rawMufl = readFileSync(p)
            const muflSongs = parseHolyricsMufl(rawMufl)
            if (muflSongs.length > 0) {
              const now = new Date().toISOString()
              let count = 0
              for (const input of muflSongs) {
                count++
                const song: Song = {
                  id: `song-mufl-${count}-${Math.random().toString(36).slice(2, 6)}`,
                  title: input.title,
                  author: input.author,
                  musicalKey: input.musicalKey,
                  bpm: input.bpm,
                  tags: [...input.tags],
                  stanzas: structuredClone(input.stanzas),
                  updatedAt: now
                }
                this.songs.push(song)
              }
              this.saveToDisk()
              break
            }
          } catch (e) {
            console.warn('[workspace] Error al cargar bd.mufl inicial:', e)
          }
        }
      }
    }
  }

  // --- Canciones y Catálogo Holyrics ---

  listSongs(): Song[] {
    return structuredClone(this.songs)
  }

  upsertSong(input: SongInput): Song[] {
    const now = new Date().toISOString()
    const id = input.id ?? `song-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const song: Song = {
      id,
      title: input.title,
      author: input.author,
      musicalKey: input.musicalKey,
      bpm: input.bpm,
      tags: [...input.tags],
      stanzas: structuredClone(input.stanzas),
      updatedAt: now
    }
    const existingIdx = this.songs.findIndex((s) => s.id === id)
    if (existingIdx >= 0) {
      this.songs[existingIdx] = song
    } else {
      this.songs.unshift(song)
    }
    this.saveToDisk()
    return this.listSongs()
  }

  importHolyricsCatalog(items: readonly HolyricsImportItem[]): Song[] {
    const now = new Date().toISOString()
    let counter = 0
    for (const item of items) {
      const parsedSongs = parseHolyricsCatalogPayload(item.content, item.fileName)
      for (const input of parsedSongs) {
        counter += 1
        const normTitle = normalizeText(input.title)
        const existingIdx = this.songs.findIndex((s) => normalizeText(s.title) === normTitle)
        const id =
          existingIdx >= 0
            ? (this.songs[existingIdx]?.id ?? `song-hly-${Date.now()}-${counter}`)
            : `song-hly-${Date.now()}-${counter}-${Math.random().toString(36).slice(2, 5)}`

        const song: Song = {
          id,
          title: input.title,
          author: input.author,
          musicalKey: input.musicalKey,
          bpm: input.bpm,
          tags: [...input.tags],
          stanzas: structuredClone(input.stanzas),
          updatedAt: now
        }
        if (existingIdx >= 0) {
          this.songs[existingIdx] = song
        } else {
          this.songs.unshift(song)
        }
      }
    }
    this.saveToDisk()
    return this.listSongs()
  }

  deleteSong(id: string): Song[] {
    this.songs = this.songs.filter((s) => s.id !== id)
    this.saveToDisk()
    return this.listSongs()
  }

  // --- Biblia completa (66 libros) ---

  listBibleBooks(): BibleBookSummary[] {
    return this.bible.listBooks()
  }

  getBibleChapter(book: string, chapter: number, version?: string): BibleVerse[] {
    return this.bible.getChapter(book, chapter, version)
  }

  searchBible(query: string): BibleVerse[] {
    return this.bible.search(query, 60)
  }

  // --- Programación del culto ---

  listSchedule(): ScheduleItem[] {
    return structuredClone(this.schedule)
  }

  addScheduleItem(input: ScheduleItemInput): ScheduleItem[] {
    const item: ScheduleItem = {
      id: `sched-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      kind: input.kind,
      title: input.title,
      subtitle: input.subtitle,
      slides: structuredClone(input.slides)
    }
    if (input.refId) item.refId = input.refId
    this.schedule.push(item)
    this.saveToDisk()
    return this.listSchedule()
  }

  removeScheduleItem(id: string): ScheduleItem[] {
    this.schedule = this.schedule.filter((item) => item.id !== id)
    this.saveToDisk()
    return this.listSchedule()
  }

  moveScheduleItem(request: ScheduleMoveRequest): ScheduleItem[] {
    const idx = this.schedule.findIndex((item) => item.id === request.id)
    if (idx < 0) return this.listSchedule()
    const targetIdx = request.direction === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= this.schedule.length) return this.listSchedule()
    const current = this.schedule[idx]
    const neighbor = this.schedule[targetIdx]
    if (!current || !neighbor) return this.listSchedule()
    this.schedule[idx] = neighbor
    this.schedule[targetIdx] = current
    this.saveToDisk()
    return this.listSchedule()
  }

  clearSchedule(): ScheduleItem[] {
    this.schedule = []
    this.saveToDisk()
    return []
  }

  // --- Multimedia y fondos ---

  getMediaDirectory(): string {
    return this.mediaDir
  }

  async openMediaFolder(): Promise<string> {
    try {
      if (!existsSync(this.mediaDir)) {
        mkdirSync(this.mediaDir, { recursive: true })
      }
      const { shell } = await import('electron')
      await shell.openPath(this.mediaDir)
    } catch {
      // Ignorar fallo de apertura fuera de Electron
    }
    return this.mediaDir
  }

  listMedia(): MediaBackground[] {
    return structuredClone(this.media)
  }

  addMedia(input: MediaBackgroundInput): MediaBackground[] {
    let finalValue = input.value
    const destDir = input.category === 'Fondo' ? this.backgroundsDir : this.mediaDir
    if (destDir) {
      if (!existsSync(destDir)) {
        try {
          mkdirSync(destDir, { recursive: true })
        } catch {
          // ignore
        }
      }
      if (typeof input.value === 'string' && input.value.startsWith('lumen-media://local/')) {
        try {
          const rawUrl = new URL(input.value)
          let sourceDiskPath = decodeURIComponent(rawUrl.pathname)
          if (/^\/[a-zA-Z]:/.test(sourceDiskPath)) sourceDiskPath = sourceDiskPath.slice(1)
          sourceDiskPath = sourceDiskPath.replace(/\//g, '\\')
          const fileName = basename(sourceDiskPath)
          const targetPath = join(destDir, fileName)
          if (existsSync(sourceDiskPath) && !existsSync(targetPath)) {
            copyFileSync(sourceDiskPath, targetPath)
            finalValue = `lumen-media://local/${encodeURIComponent(targetPath.replace(/\\/g, '/'))}`
          }
        } catch {
          // fallback
        }
      } else if (typeof input.value === 'string' && input.value.startsWith('data:')) {
        try {
          const comma = input.value.indexOf(',')
          if (comma !== -1) {
            const rawB64 = input.value.slice(comma + 1)
            const ext = input.kind === 'video' ? '.mp4' : '.png'
            const safeName = input.name.replace(/[^a-zA-Z0-9_\-.]/g, '_')
            const fileName = safeName.includes('.') ? safeName : `${safeName}${ext}`
            const targetPath = join(destDir, fileName)
            if (!existsSync(targetPath)) {
              writeFileSync(targetPath, Buffer.from(rawB64, 'base64'))
            }
            finalValue = `lumen-media://local/${encodeURIComponent(targetPath.replace(/\\/g, '/'))}`
          }
        } catch {
          // Fallback silencioso si falla la escritura en disco
        }
      }
    }
    const bg: MediaBackground = {
      id: `bg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: input.name,
      kind: input.kind,
      value: finalValue,
      accentColor: input.accentColor ?? (input.kind === 'video' ? '#38bdf8' : '#f2b84b'),
      ...(input.category ? { category: input.category } : {})
    }
    this.media.unshift(bg)
    this.saveToDisk()
    return this.listMedia()
  }

  async openBackgroundsFolder(): Promise<string> {
    try {
      if (!existsSync(this.backgroundsDir)) {
        mkdirSync(this.backgroundsDir, { recursive: true })
      }
      const { shell } = await import('electron')
      await shell.openPath(this.backgroundsDir)
    } catch {
      // Ignorar fallo de apertura fuera de Electron
    }
    return this.backgroundsDir
  }

  reloadBackgrounds(): MediaBackground[] {
    if (!this.backgroundsDir || !existsSync(this.backgroundsDir)) return this.listMedia()
    try {
      const files = readdirSync(this.backgroundsDir)
      const existingNames = new Set(this.media.map((m) => m.name.toLowerCase()))
      let added = false
      for (const file of files) {
        const ext = file.split('.').pop()?.toLowerCase() ?? ''
        const isVideo = ['mp4', 'webm', 'mov', 'mkv', 'avi'].includes(ext)
        const isImage = ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)
        if (!isVideo && !isImage) continue
        const baseName = file.replace(/\.[^/.]+$/, '')
        if (!existingNames.has(baseName.toLowerCase())) {
          const targetPath = join(this.backgroundsDir, file)
          const newBg: MediaBackground = {
            id: `bg-fondo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: baseName,
            kind: isVideo ? 'video' : 'image',
            value: `lumen-media://local/${encodeURIComponent(targetPath.replace(/\\/g, '/'))}`,
            accentColor: isVideo ? '#38bdf8' : '#f59e0b',
            category: 'Fondo'
          }
          this.media.unshift(newBg)
          existingNames.add(baseName.toLowerCase())
          added = true
        }
      }
      if (added) this.saveToDisk()
    } catch (e) {
      console.warn('[workspace] Error al recargar fondos:', e)
    }
    return this.listMedia()
  }

  reloadMedia(): MediaBackground[] {
    if (!this.mediaDir || !existsSync(this.mediaDir)) return this.listMedia()
    try {
      const files = readdirSync(this.mediaDir)
      const existingNames = new Set(this.media.map((m) => m.name.toLowerCase()))
      let added = false
      for (const file of files) {
        const ext = file.split('.').pop()?.toLowerCase() ?? ''
        const isVideo = ['mp4', 'webm', 'mov', 'mkv', 'avi'].includes(ext)
        const isImage = ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)
        if (!isVideo && !isImage) continue
        const baseName = file.replace(/\.[^/.]+$/, '')
        if (!existingNames.has(baseName.toLowerCase())) {
          const targetPath = join(this.mediaDir, file)
          const newBg: MediaBackground = {
            id: `bg-disk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: baseName,
            kind: isVideo ? 'video' : 'image',
            value: `lumen-media://local/${encodeURIComponent(targetPath.replace(/\\/g, '/'))}`,
            accentColor: isVideo ? '#38bdf8' : '#f59e0b',
            category: 'Culto'
          }
          this.media.unshift(newBg)
          existingNames.add(baseName.toLowerCase())
          added = true
        }
      }
      if (added) this.saveToDisk()
    } catch (e) {
      console.warn('[workspace] Error al recargar medios:', e)
    }
    return this.listMedia()
  }

  deleteMedia(id: string): MediaBackground[] {
    if (this.media.length <= 1) return this.listMedia()
    this.media = this.media.filter((m) => m.id !== id)
    this.saveToDisk()
    return this.listMedia()
  }

  // --- Asistente inteligente local (sin conexión externa) ---

  suggestForTheme(rawTheme: string): AiSuggestionResult {
    const cleanTheme = rawTheme.trim() || 'Adoración y Gracia'
    const keywords = normalizeText(cleanTheme)
      .split(/[\s,.;:]+/)
      .filter((w) => w.length >= 2)

    const scoredSongs = this.songs.map((song) => {
      const corpus = normalizeText(
        [song.title, song.author, ...song.tags, ...song.stanzas.flatMap((s) => s.lines)].join(' ')
      )
      const score = keywords.reduce((acc, kw) => acc + (corpus.includes(kw) ? 3 : 0), 0)
      return { song, score }
    })

    scoredSongs.sort((a, b) => b.score - a.score)
    const suggestedSongs = scoredSongs.slice(0, 3).map((entry) => structuredClone(entry.song))

    const primaryKeyword = keywords[0] ?? 'gracia'
    const matchedVerses = this.bible.search(primaryKeyword, 4)
    const suggestedVerses =
      matchedVerses.length > 0 ? matchedVerses : this.bible.getChapter('Salmos', 23).slice(0, 4)

    const topVerse = suggestedVerses[0]
    const verseLine = topVerse
      ? `"${topVerse.text}" (${topVerse.book} ${topVerse.chapter}:${topVerse.verse})`
      : 'Prepárate para adorar en espíritu y en verdad.'

    const suggestedAnnouncement = createAnnouncementSlide(
      `Tema: ${cleanTheme}`,
      `Bienvenidos al Servicio de Adoración\nTema de hoy: ${cleanTheme}\n${verseLine}`,
      `${this.settings.churchName} · Orden del Culto`
    )

    return {
      theme: cleanTheme,
      suggestedSongs,
      suggestedVerses,
      suggestedAnnouncement
    }
  }

  // --- Configuración ---

  getSettings(): AppSettings {
    return structuredClone(this.settings)
  }

  updateSettings(patch: Partial<AppSettings>): AppSettings {
    this.settings = {
      ...this.settings,
      ...structuredClone(patch)
    }
    this.saveToDisk()
    return this.getSettings()
  }

  // --- Persistencia en disco ---

  private loadFromDisk(): Partial<PersistedWorkspace> | null {
    if (!this.filePath || !existsSync(this.filePath)) return null
    try {
      const raw = readFileSync(this.filePath, 'utf-8')
      const parsed = JSON.parse(raw) as Partial<PersistedWorkspace>
      return parsed
    } catch {
      return null
    }
  }

  private saveToDisk(): void {
    if (!this.filePath) return
    try {
      mkdirSync(dirname(this.filePath), { recursive: true })
      const payload: PersistedWorkspace = {
        songs: this.songs,
        schedule: this.schedule,
        media: this.media,
        settings: this.settings
      }
      writeFileSync(this.filePath, JSON.stringify(payload, null, 2), 'utf-8')
    } catch (error) {
      console.warn('[workspace] No se pudo guardar en disco:', error)
    }
  }
}
