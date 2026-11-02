import { closeSync, copyFileSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, readSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, extname, join, resolve } from 'node:path'
import { parseHolyricsCatalogPayload, parseHolyricsMufl } from '../../shared/holyricsCompat'
import type {
  AiSuggestionResult,
  AppSettings,
  BibleBookSummary,
  BibleVersionImportRequest,
  BibleVersionInfo,
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
import type { PresentationDeck } from '../../shared/models'
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
  presentations?: PresentationDeck[]
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
  private presentations: PresentationDeck[]
  private settings: AppSettings
  private readonly bible: BibleRepository
  private readonly filePath: string | undefined
  private readonly mediaDir: string
  private readonly backgroundsDir: string
  private readonly slidesDir: string

  constructor(filePath?: string) {
    this.filePath = filePath
    const baseDir = this.filePath ? dirname(this.filePath) : join(process.cwd(), 'lumen-data')
    this.mediaDir = join(baseDir, 'media')
    this.backgroundsDir = join(baseDir, 'fondos')
    this.slidesDir = join(baseDir, 'diapositivas')
    this.bible = new BibleRepository(join(baseDir, 'bible'))
    try {
      if (!existsSync(this.mediaDir)) {
        mkdirSync(this.mediaDir, { recursive: true })
      }
      if (!existsSync(this.backgroundsDir)) {
        mkdirSync(this.backgroundsDir, { recursive: true })
      }
      if (!existsSync(this.slidesDir)) {
        mkdirSync(this.slidesDir, { recursive: true })
      }
    } catch {
      // Ignorar fallo de creación si no hay permisos de disco
    }
    const loaded = this.loadFromDisk()
    this.songs = loaded?.songs ?? structuredClone([...DEFAULT_SONGS])
    this.schedule = loaded?.schedule ?? createDefaultSchedule()
    this.presentations = loaded?.presentations ? structuredClone(loaded.presentations) : []
    if (loaded?.media && loaded.media.length > 0) {
      const existingIds = new Set(loaded.media.map((m) => m.id))
      const missingDefaults = DEFAULT_MEDIA_BACKGROUNDS.filter((m) => !existingIds.has(m.id))
      this.media = [...structuredClone(missingDefaults), ...loaded.media]
    } else {
      this.media = structuredClone([...DEFAULT_MEDIA_BACKGROUNDS])
    }
    this.settings = loaded?.settings ?? structuredClone(DEFAULT_SETTINGS)

    // Aislamiento estricto: Purgar radicalmente cualquier documento (PDF, PPTX, PPT, diapositivas) de Medios
    const isDocumentItem = (m: MediaBackground): boolean => {
      if ((m.slides && m.slides.length > 0) || (m as { slides?: unknown[] }).slides !== undefined) return true
      const lowerName = (m.name || '').toLowerCase()
      if (/\.(pdf|pptx|ppt|ppsx|pps|potx)($|[?#])/i.test(lowerName) || /^(pdf|powerpoint):/i.test(lowerName)) return true
      const lowerVal = typeof m.value === 'string' ? m.value.toLowerCase() : ''
      if (/\.(pdf|pptx|ppt|ppsx|pps|potx)($|[?#])/i.test(lowerVal)) return true
      if (m.category && ['diapositivas', 'presentaciones', 'documentos', 'pdf'].includes(m.category.toLowerCase())) return true
      return false
    }

    const mediaCountBefore = this.media.length
    this.media = this.media.filter((m) => {
      if (isDocumentItem(m)) {
        if (m.slides && m.slides.length > 0) {
          const isPdf = m.name.toLowerCase().includes('pdf') || (typeof m.value === 'string' && m.value.toLowerCase().includes('.pdf'))
          if (!this.presentations.some((p) => p.title.toLowerCase() === m.name.toLowerCase())) {
            this.presentations.push({
              id: m.id,
              title: m.name,
              subtitle: `${m.slides.length} diapositivas / páginas`,
              kind: isPdf ? 'pdf' : 'pptx',
              slides: m.slides
            })
          }
        }
        return false // Excluir permanentemente de Medios
      }
      return true
    })
    if (this.media.length !== mediaCountBefore) {
      this.saveToDisk()
    }

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
              const safeName = item.name.replace(/[^a-zA-Z0-9_-]/g, '_')
              const fileName = `${safeName}${ext}`
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

    // Reparar posibles archivos huérfanos o sin extensión en media/
    if (this.mediaDir && existsSync(this.mediaDir)) {
      let repaired = false
      for (const item of this.media) {
        if (typeof item.value === 'string' && item.value.startsWith('lumen-media://local/')) {
          try {
            const rawUrl = new URL(item.value)
            let filePath = decodeURIComponent(rawUrl.pathname)
            if (/^\/[a-zA-Z]:/.test(filePath)) filePath = filePath.slice(1)
            filePath = filePath.replace(/\//g, '\\')
            if (existsSync(filePath)) {
              const ext = extname(filePath)
              if (!ext) {
                const targetExt = item.kind === 'video' ? '.mp4' : '.png'
                const newFilePath = `${filePath}${targetExt}`
                if (!existsSync(newFilePath)) {
                  copyFileSync(filePath, newFilePath)
                }
                item.value = `lumen-media://local/${encodeURIComponent(newFilePath.replace(/\\/g, '/'))}`
                repaired = true
              }
            } else if (!extname(filePath)) {
              const targetExt = item.kind === 'video' ? '.mp4' : '.png'
              const newFilePath = `${filePath}${targetExt}`
              if (existsSync(newFilePath)) {
                item.value = `lumen-media://local/${encodeURIComponent(newFilePath.replace(/\\/g, '/'))}`
                repaired = true
              }
            }
          } catch {
            // ignore
          }
        }
      }
      if (repaired) this.saveToDisk()
    }

    this.reloadMedia()
    this.reloadBackgrounds()
    if (this.syncPresentationsWithDisk()) {
      this.saveToDisk()
    }

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

  // --- Biblia completa (66 libros + versiones propias importadas) ---

  listBibleVersions(): BibleVersionInfo[] {
    return this.bible.listVersions()
  }

  importBibleVersion(request: BibleVersionImportRequest): BibleVersionInfo[] {
    return this.bible.importVersion(request)
  }

  deleteBibleVersion(id: string): BibleVersionInfo[] {
    return this.bible.deleteVersion(id)
  }

  listBibleBooks(version?: string): BibleBookSummary[] {
    return this.bible.listBooks(version)
  }

  getBibleChapter(book: string, chapter: number, version?: string): BibleVerse[] {
    return this.bible.getChapter(book, chapter, version)
  }

  searchBible(query: string, version?: string): BibleVerse[] {
    return this.bible.search(query, 60, version)
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

  private isDocument(item: { name?: string; value?: string; category?: string; slides?: unknown[] }): boolean {
    if ((item.slides && item.slides.length > 0) || item.slides !== undefined) return true
    const n = (item.name || '').toLowerCase()
    if (/\.(pdf|pptx|ppt|ppsx|pps|potx)($|[?#])/i.test(n) || /^(pdf|powerpoint):/i.test(n)) return true
    const v = typeof item.value === 'string' ? item.value.toLowerCase() : ''
    if (/\.(pdf|pptx|ppt|ppsx|pps|potx)($|[?#])/i.test(v)) return true
    if (item.category && ['diapositivas', 'presentaciones', 'documentos', 'pdf'].includes(item.category.toLowerCase())) return true
    return false
  }

  listMedia(): MediaBackground[] {
    // Nunca devolver PDFs, PPTXs ni medios con diapositivas — esos van estrictamente en listPresentations()
    return structuredClone(this.media.filter((m) => !this.isDocument(m)))
  }

  addMedia(input: MediaBackgroundInput): MediaBackground[] {
    // Bloqueo total: Si es PDF, PPTX o diapositivas, JAMÁS entra en Medios
    if (this.isDocument(input)) {
      if (input.slides && input.slides.length > 0) {
        this.savePresentation({
          id: `deck-${Date.now()}`,
          title: input.name,
          subtitle: `${input.slides.length} diapositivas`,
          kind: (input.name || '').toLowerCase().includes('pdf') ? 'pdf' : 'pptx',
          slides: input.slides
        })
      }
      return this.listMedia()
    }

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
          const rawExt = extname(sourceDiskPath)
          const ext = rawExt || (input.kind === 'video' ? '.mp4' : '.png')
          const baseNoExt = basename(sourceDiskPath, rawExt)
          const targetPath = join(destDir, `${baseNoExt}${ext}`)
          if (existsSync(sourceDiskPath) && !existsSync(targetPath)) {
            copyFileSync(sourceDiskPath, targetPath)
            finalValue = `lumen-media://local/${encodeURIComponent(targetPath.replace(/\\/g, '/'))}`
          } else if (existsSync(targetPath)) {
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
            const safeName = input.name.replace(/[^a-zA-Z0-9_-]/g, '_')
            const fileName = `${safeName}${ext}`
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
      ...(input.category ? { category: input.category } : {}),
      ...(input.slides ? { slides: input.slides } : {})
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
      let changed = false

      // 1. Eliminar de la lista fondos en backgroundsDir o fondos/ que hayan sido borrados en disco
      this.media = this.media.filter((m) => {
        if (m.category === 'Fondo' && typeof m.value === 'string' && m.value.startsWith('lumen-media://local/')) {
          try {
            const u = new URL(m.value)
            let p = decodeURIComponent(u.pathname)
            if (/^\/[a-zA-Z]:/.test(p)) p = p.slice(1)
            p = p.replace(/\//g, '\\')
            const isFondoPath = p.toLowerCase().includes('fondos') || p.toLowerCase().includes('backgrounds')
            if (isFondoPath && !existsSync(p) && !existsSync(`${p}.mp4`) && !existsSync(`${p}.png`)) {
              changed = true
              return false
            }
          } catch {
            // ignore
          }
        }
        return true
      })

      // 2. Incorporar archivos nuevos detectados en la carpeta de fondos
      const existingNames = new Set(this.media.map((m) => m.name.toLowerCase()))
      const existingPaths = new Set(
        this.media
          .filter((m) => typeof m.value === 'string' && m.value.startsWith('lumen-media://local/'))
          .map((m) => {
            try {
              const u = new URL(m.value)
              let p = decodeURIComponent(u.pathname)
              if (/^\/[a-zA-Z]:/.test(p)) p = p.slice(1)
              return p.replace(/\//g, '\\').toLowerCase()
            } catch {
              return ''
            }
          })
          .filter(Boolean)
      )

      for (const file of files) {
        let filePath = join(this.backgroundsDir, file)
        let rawExt = extname(file).replace(/^\./, '').toLowerCase()

        if (!rawExt && existsSync(filePath)) {
          try {
            const buf = Buffer.alloc(16)
            const fd = openSync(filePath, 'r')
            readSync(fd, buf, 0, 16, 0)
            closeSync(fd)
            const isFtyp = buf.includes(Buffer.from('ftyp'))
            const targetExt = isFtyp ? '.mp4' : '.png'
            const newPath = `${filePath}${targetExt}`
            if (!existsSync(newPath)) {
              copyFileSync(filePath, newPath)
            }
            filePath = newPath
            rawExt = targetExt.replace(/^\./, '')
          } catch {
            // ignore
          }
        }

        const isVideo = ['mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v'].includes(rawExt)
        const isImage = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'].includes(rawExt)
        if (!isVideo && !isImage) continue
        const baseName = basename(filePath, extname(filePath))
        if (!existingNames.has(baseName.toLowerCase()) && !existingPaths.has(filePath.toLowerCase())) {
          const newBg: MediaBackground = {
            id: `bg-fondo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: baseName,
            kind: isVideo ? 'video' : 'image',
            value: `lumen-media://local/${encodeURIComponent(filePath.replace(/\\/g, '/'))}`,
            accentColor: isVideo ? '#38bdf8' : '#6366f1',
            category: 'Fondo'
          }
          this.media.unshift(newBg)
          existingNames.add(baseName.toLowerCase())
          existingPaths.add(filePath.toLowerCase())
          changed = true
        }
      }
      if (changed) this.saveToDisk()
    } catch (e) {
      console.warn('[workspace] Error al recargar fondos:', e)
    }
    return this.listMedia()
  }

  reloadMedia(): MediaBackground[] {
    if (!this.mediaDir || !existsSync(this.mediaDir)) return this.listMedia()
    try {
      const files = readdirSync(this.mediaDir)
      let changed = false

      // 1. Eliminar medios de culto que hayan sido borrados manualmente de la carpeta
      this.media = this.media.filter((m) => {
        if (m.category === 'Culto' && typeof m.value === 'string' && m.value.startsWith('lumen-media://local/')) {
          try {
            const u = new URL(m.value)
            let p = decodeURIComponent(u.pathname)
            if (/^\/[a-zA-Z]:/.test(p)) p = p.slice(1)
            p = p.replace(/\//g, '\\')
            if (p.toLowerCase().includes('media') && !existsSync(p) && !existsSync(`${p}.mp4`) && !existsSync(`${p}.png`)) {
              changed = true
              return false
            }
          } catch {
            // ignore
          }
        }
        return true
      })

      // 2. Reparar y añadir archivos nuevos en la carpeta media/
      const existingNames = new Set(this.media.map((m) => m.name.toLowerCase()))
      const existingPaths = new Set(
        this.media
          .filter((m) => typeof m.value === 'string' && m.value.startsWith('lumen-media://local/'))
          .map((m) => {
            try {
              const u = new URL(m.value)
              let p = decodeURIComponent(u.pathname)
              if (/^\/[a-zA-Z]:/.test(p)) p = p.slice(1)
              return p.replace(/\//g, '\\').toLowerCase()
            } catch {
              return ''
            }
          })
          .filter(Boolean)
      )

      for (const file of files) {
        // Bloqueo total: Ignorar radicalmente cualquier PDF o PowerPoint en media/
        if (/\.(pdf|pptx|ppt|ppsx|pps|potx)($|[?#])/i.test(file)) continue

        let filePath = join(this.mediaDir, file)
        let rawExt = extname(file).replace(/^\./, '').toLowerCase()

        // Si no tiene extensión, verificar si es video mp4 o imagen real (NUNCA pdf ni pptx)
        if (!rawExt && existsSync(filePath)) {
          try {
            const buf = Buffer.alloc(16)
            const fd = openSync(filePath, 'r')
            readSync(fd, buf, 0, 16, 0)
            closeSync(fd)
            // Si es documento PDF (%PDF) o ZIP/PPTX (PK), ignorar de inmediato
            if (buf.includes(Buffer.from('%PDF')) || (buf[0] === 0x50 && buf[1] === 0x4B)) {
              continue
            }
            const isFtyp = buf.includes(Buffer.from('ftyp'))
            const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47
            const isJpg = buf[0] === 0xFF && buf[1] === 0xD8
            if (!isFtyp && !isPng && !isJpg) {
              continue
            }
            const targetExt = isFtyp ? '.mp4' : isPng ? '.png' : '.jpg'
            const newPath = `${filePath}${targetExt}`
            if (!existsSync(newPath)) {
              copyFileSync(filePath, newPath)
            }
            filePath = newPath
            rawExt = targetExt.replace(/^\./, '')
          } catch {
            continue
          }
        }

        const isVideo = ['mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v'].includes(rawExt)
        const isImage = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'].includes(rawExt)
        if (!isVideo && !isImage) continue
        const baseName = basename(filePath, extname(filePath))
        if (!existingNames.has(baseName.toLowerCase()) && !existingPaths.has(filePath.toLowerCase())) {
          const newBg: MediaBackground = {
            id: `bg-disk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: baseName,
            kind: isVideo ? 'video' : 'image',
            value: `lumen-media://local/${encodeURIComponent(filePath.replace(/\\/g, '/'))}`,
            accentColor: isVideo ? '#38bdf8' : '#f59e0b',
            category: 'Culto'
          }
          this.media.unshift(newBg)
          existingNames.add(baseName.toLowerCase())
          existingPaths.add(filePath.toLowerCase())
          changed = true
        }
      }
      if (changed) this.saveToDisk()
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

  // --- Diapositivas y presentaciones (PDF / PowerPoint) ---

  getSlidesDirectory(): string {
    return this.slidesDir
  }

  async openSlidesFolder(): Promise<string> {
    try {
      if (!existsSync(this.slidesDir)) {
        mkdirSync(this.slidesDir, { recursive: true })
      }
      const { shell } = await import('electron')
      await shell.openPath(this.slidesDir)
    } catch {
      // Ignorar fallo fuera de Electron
    }
    return this.slidesDir
  }

  listPresentations(): PresentationDeck[] {
    return structuredClone(this.presentations)
  }

  savePresentation(deck: PresentationDeck): PresentationDeck[] {
    if (this.slidesDir && !existsSync(this.slidesDir)) {
      try {
        mkdirSync(this.slidesDir, { recursive: true })
      } catch {
        // ignore
      }
    }

    if (this.slidesDir) {
      // 1. Si viene con fileData (base64) y no existe el archivo en slidesDir, guardarlo
      if (deck.fileData) {
        try {
          const ext = deck.kind === 'pdf' ? '.pdf' : '.pptx'
          const fileName = deck.title.toLowerCase().endsWith(ext) ? deck.title : `${deck.title}${ext}`
          const safeName = fileName.replace(/[<>:"/\\|?*]/g, '_')
          const destPath = join(this.slidesDir, safeName)
          writeFileSync(destPath, Buffer.from(deck.fileData, 'base64'))
          deck.filePath = destPath
          delete deck.fileData
        } catch (err) {
          console.warn('[WorkspaceStore] Error guardando fileData en slidesDir:', err)
        }
      }

      // 2. Si viene con filePath externo, copiar el archivo a slidesDir
      if (deck.filePath && existsSync(deck.filePath)) {
        try {
          const destPath = join(this.slidesDir, basename(deck.filePath))
          if (resolve(deck.filePath) !== resolve(destPath)) {
            copyFileSync(deck.filePath, destPath)
          }
          deck.filePath = destPath
        } catch (err) {
          console.warn('[WorkspaceStore] Error copiando archivo a slidesDir:', err)
        }
      }
    }

    const existingIdx = this.presentations.findIndex(
      (p) => p.id === deck.id || p.title.toLowerCase() === deck.title.toLowerCase()
    )
    if (existingIdx !== -1) {
      this.presentations[existingIdx] = deck
    } else {
      this.presentations.unshift(deck)
    }
    this.saveToDisk()
    return this.listPresentations()
  }

  deletePresentation(id: string): PresentationDeck[] {
    const lower = id.toLowerCase()
    const target = this.presentations.find(
      (p) => p.id === id || p.title.toLowerCase() === lower
    )
    if (target) {
      // 1. Borrar archivo físico si target.filePath apunta a disco
      if (target.filePath && existsSync(target.filePath)) {
        try {
          unlinkSync(target.filePath)
        } catch (err) {
          console.warn('[WorkspaceStore] Error al borrar archivo de diapositiva:', err)
        }
      }
      // 2. Si no tenía filePath o ya no está en esa ruta, comprobar si hay archivo en slidesDir con ese título
      if (this.slidesDir && existsSync(this.slidesDir)) {
        try {
          const files = readdirSync(this.slidesDir)
          const cleanTitle = target.title.replace(/\.[^/.]+$/, '').toLowerCase().trim()
          for (const file of files) {
            const base = basename(file, extname(file)).toLowerCase().trim()
            if (base === cleanTitle || file.toLowerCase() === cleanTitle) {
              const fullP = join(this.slidesDir, file)
              if (existsSync(fullP)) {
                try {
                  unlinkSync(fullP)
                } catch {
                  // ignore
                }
              }
            }
          }
        } catch {
          // ignore
        }
      }
    }
    this.presentations = this.presentations.filter(
      (p) => p.id !== id && p.title.toLowerCase() !== lower
    )
    this.saveToDisk()
    return this.listPresentations()
  }

  private syncPresentationsWithDisk(): boolean {
    if (!this.slidesDir || !existsSync(this.slidesDir)) return false
    try {
      const rawFiles = readdirSync(this.slidesDir)
      const diskFileNames = new Set(rawFiles.map((f) => f.toLowerCase()))
      let changed = false

      this.presentations = this.presentations.filter((p) => {
        // 1. Si la presentación tiene ruta física
        if (p.filePath) {
          const fileName = basename(p.filePath).toLowerCase()
          const exists = diskFileNames.has(fileName) || existsSync(p.filePath)
          if (!exists) {
            changed = true
            return false
          }
          // Si el archivo está en slidesDir, asegurar que apunte a la ruta dentro de slidesDir
          const inSlidesDir = join(this.slidesDir, basename(p.filePath))
          if (existsSync(inSlidesDir) && p.filePath !== inSlidesDir) {
            p.filePath = inSlidesDir
            changed = true
          }
          return true
        }

        // 2. Si no tiene filePath (legacy / huérfano):
        // Comprobar si existe un archivo físico en diapositivas/ con coincidencia de título
        const cleanTitle = p.title.replace(/\.[^/.]+$/, '').toLowerCase().trim()
        const matchedFile = rawFiles.find((f) => {
          const base = basename(f, extname(f)).toLowerCase().trim()
          return base === cleanTitle || f.toLowerCase() === cleanTitle
        })

        if (matchedFile) {
          p.filePath = join(this.slidesDir, matchedFile)
          changed = true
          return true
        }

        // Si la carpeta de diapositivas no contiene ningún archivo para esta presentación,
        // se elimina porque no existe físicamente en disco.
        changed = true
        return false
      })

      return changed
    } catch {
      return false
    }
  }

  reloadSlides(): PresentationDeck[] {
    const loaded = this.loadFromDisk()
    if (loaded && Array.isArray(loaded.presentations)) {
      this.presentations = loaded.presentations
    }
    if (this.syncPresentationsWithDisk()) {
      this.saveToDisk()
    }
    return this.listPresentations()
  }

  scanSlidesFolderFiles(): Array<{ fileName: string; filePath: string; ext: string }> {
    if (!this.slidesDir || !existsSync(this.slidesDir)) return []
    try {
      const files = readdirSync(this.slidesDir)
      const results: Array<{ fileName: string; filePath: string; ext: string }> = []
      for (const file of files) {
        const ext = extname(file).replace(/^\./, '').toLowerCase()
        if (['pdf', 'pptx', 'ppt', 'ppsx', 'pps', 'potx'].includes(ext)) {
          results.push({
            fileName: file,
            filePath: join(this.slidesDir, file),
            ext
          })
        }
      }
      return results
    } catch {
      return []
    }
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

  private saveTimer: ReturnType<typeof setTimeout> | null = null

  /**
   * Programa un guardado coalescido. Evita reescribir todo el workspace
   * (incluidos los base64 de medios y presentaciones) en cada tick de un
   * slider de tema, lo que bloqueaba el proceso principal.
   */
  private saveToDisk(): void {
    if (!this.filePath) return
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null
      this.flushPendingSave()
    }, 400)
  }

  /** Escribe de inmediato cualquier guardado pendiente (al salir de la app). */
  flush(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer)
      this.saveTimer = null
    }
    this.flushPendingSave()
  }

  private flushPendingSave(): void {
    if (!this.filePath) return
    try {
      mkdirSync(dirname(this.filePath), { recursive: true })
      const payload: PersistedWorkspace = {
        songs: this.songs,
        schedule: this.schedule,
        media: this.media,
        settings: this.settings,
        presentations: this.presentations
      }
      writeFileSync(this.filePath, JSON.stringify(payload, null, 2), 'utf-8')
    } catch (error) {
      console.warn('[workspace] No se pudo guardar en disco:', error)
    }
  }
}
