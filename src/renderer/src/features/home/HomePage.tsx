import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import type { MediaBackground, PresentationSlide, Song } from '../../../../shared/ipc'
import {
  autoSplitLongStanzas,
  cleanInternetLyrics,
  createAnnouncementSlide,
  isVideoUrl,
  parseRawLyricsToStanzas,
  resolveMediaVideoUrl,
  songToSlides,
  transposeChordText
} from '../../../../shared/slideHelpers'
import { convertPdfToSlides, convertPptxToSlides } from './presentationDocHelpers'
import type { UseAppStatus } from '../../hooks/useAppStatus'
import { BiblePage } from '../bible/BiblePage'
import { ConfirmDeleteModal } from '../../components/ConfirmDeleteModal'

export interface HomePageProps {
  app: UseAppStatus
}

type QuickTab = 'music' | 'bible' | 'presentation' | 'images' | 'text'

function stanzaTagClass(label: string): string {
  const l = label.toLowerCase()
  if (l.includes('coro')) return 'hly-slide-row__tag hly-slide-row__tag--chorus'
  if (l.includes('puente')) return 'hly-slide-row__tag hly-slide-row__tag--bridge'
  if (l.includes('intro')) return 'hly-slide-row__tag hly-slide-row__tag--intro'
  return 'hly-slide-row__tag'
}

/**
 * Mesa Principal de Operación idéntica a la ventana central de Holyrics:
 * - Izquierda: Catálogo rápido con pestañas (Música, Biblia 66 libros, Presentaciones PDF/PPTX, Imágenes del Culto, Texto/Alerta rápida).
 * - Derecha: Barra de pestañas de documentos abiertos + Tabla numerada de Párrafos / Versículos / Diapositivas en Previsualización.
 */
export function HomePage({ app }: HomePageProps) {
  const [activeTab, setActiveTab] = useState<QuickTab>('music')
  const [songQuery, setSongQuery] = useState('')
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null)
  const [openSongTabIds, setOpenSongTabIds] = useState<string[]>([])
  const [openDocTabs, setOpenDocTabs] = useState<Array<{ id: string; title: string; slides: PresentationSlide[] }>>([])
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null)
  const [presentationSearch, setPresentationSearch] = useState('')
  const [isReloadingSlides, setIsReloadingSlides] = useState(false)
  const [imageSearch, setImageSearch] = useState('')
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean
    title: string
    itemName: string
    itemType: string
    onConfirm: () => void
  }>({
    isOpen: false,
    title: '',
    itemName: '',
    itemType: '',
    onConfirm: () => {}
  })
  const homeMediaInputRef = useRef<HTMLInputElement | null>(null)
  const presentationFileInputRef = useRef<HTMLInputElement | null>(null)
  const activeSlideRef = useRef<HTMLButtonElement | null>(null)

  const handleUploadPresentationFile = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const files = Array.from(e.target.files ?? [])
    for (const file of files) {
      const lower = file.name.toLowerCase()
      const nativePath =
        (file as unknown as { path?: string }).path ||
        (typeof window !== 'undefined' &&
          (window as unknown as { lumen?: { getPathForFile?: (f: File) => string } }).lumen?.getPathForFile?.(file))

      let fileData: string | undefined = undefined
      if (!nativePath) {
        try {
          fileData = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => {
              const res = (reader.result as string) || ''
              const comma = res.indexOf(',')
              resolve(comma !== -1 ? res.slice(comma + 1) : res)
            }
            reader.onerror = reject
            reader.readAsDataURL(file)
          })
        } catch {
          // ignore
        }
      }

      if (lower.endsWith('.pdf')) {
        try {
          const deck = await convertPdfToSlides(file, file.name)
          if (deck.slides.length > 0) {
            void app.savePresentation?.({
              id: `pdf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              title: deck.title,
              subtitle: `${deck.slides.length} páginas · PDF`,
              kind: 'pdf',
              filePath: nativePath || undefined,
              fileData,
              slides: deck.slides
            })
            setOpenDocTabs((prev) => [...prev.filter((d) => d.title !== deck.title), { id: `doc-${Date.now()}`, title: deck.title, slides: deck.slides }])
            setSelectedDocId(deck.title)
            setActiveTab('presentation')
            void app.loadProjectionDeck({
              deckTitle: deck.title,
              slides: deck.slides,
              startIndex: 0,
              openWindow: false
            })
          }
        } catch (err) {
          console.error('Error al procesar PDF:', err)
        }
      } else if (
        lower.endsWith('.pptx') ||
        lower.endsWith('.ppt') ||
        lower.endsWith('.ppsx') ||
        lower.endsWith('.pps') ||
        lower.endsWith('.potx')
      ) {
        try {
          const deck = await convertPptxToSlides(file, file.name)
          if (deck.slides.length > 0) {
            void app.savePresentation?.({
              id: `pptx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              title: deck.title,
              subtitle: `${deck.slides.length} diapositivas · PowerPoint`,
              kind: 'pptx',
              filePath: nativePath || undefined,
              fileData,
              slides: deck.slides
            })
            setOpenDocTabs((prev) => [...prev.filter((d) => d.title !== deck.title), { id: `doc-${Date.now()}`, title: deck.title, slides: deck.slides }])
            setSelectedDocId(deck.title)
            setActiveTab('presentation')
            void app.loadProjectionDeck({
              deckTitle: deck.title,
              slides: deck.slides,
              startIndex: 0,
              openWindow: false
            })
          }
        } catch (err) {
          console.error('Error al procesar PPTX:', err)
        }
      }
    }
    e.target.value = ''
  }

  const handleUploadMediaFiles = (e: ChangeEvent<HTMLInputElement>): void => {
    const files = Array.from(e.target.files ?? [])
    files.forEach((file) => {
      // Bloqueo total: Si es PDF o PowerPoint, jamás se añade a Medios (solo a Diapositivas)
      if (
        /\.(pdf|pptx|ppt|ppsx|pps|potx)$/i.test(file.name) ||
        file.type.includes('pdf') ||
        file.type.includes('presentation')
      ) {
        return
      }
      const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mov|mkv|avi|ogv|m4v)$/i.test(file.name)
      const nativePath =
        (file as unknown as { path?: string }).path ||
        (typeof window !== 'undefined' &&
          (window as unknown as { lumen?: { getPathForFile?: (f: File) => string } }).lumen?.getPathForFile?.(file))
      if (nativePath) {
        const fileUrl = `lumen-media://local/${encodeURIComponent(nativePath.replace(/\\/g, '/'))}`
        void app.addMedia({
          name: file.name.replace(/\.[^/.]+$/, ''),
          kind: isVideo ? 'video' : 'image',
          value: fileUrl,
          category: 'Culto'
        })
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        let dataUrl = typeof reader.result === 'string' ? reader.result : ''
        if (dataUrl) {
          if (isVideo && !dataUrl.startsWith('data:video/')) {
            const comma = dataUrl.indexOf(',')
            if (comma !== -1) {
              const ext = file.name.split('.').pop()?.toLowerCase()
              const mime = ext === 'webm' ? 'video/webm' : 'video/mp4'
              dataUrl = `data:${mime};base64,${dataUrl.slice(comma + 1)}`
            }
          }
          void app.addMedia({
            name: file.name.replace(/\.[^/.]+$/, ''),
            kind: isVideo ? 'video' : 'image',
            value: dataUrl,
            category: 'Culto'
          })
        }
      }
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  // Menú contextual clic derecho en canciones
  const [contextMenu, setContextMenu] = useState<{ song: Song; x: number; y: number } | null>(null)

  // Estado de edición rápida de alabanza (clic derecho -> Editar alabanza)
  const [editingSong, setEditingSong] = useState<Song | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editAuthor, setEditAuthor] = useState('')
  const [editKey, setEditKey] = useState('')
  const [editBpm, setEditBpm] = useState<number | null>(null)
  const [editRawLyrics, setEditRawLyrics] = useState('')

  const openSongEditor = (song: Song): void => {
    setEditingSong(song)
    setEditTitle(song.title)
    setEditAuthor(song.author || '')
    setEditKey(song.musicalKey || '')
    setEditBpm(song.bpm ?? null)
    const raw = song.stanzas.map((st) => `[${st.label}]\n${st.lines.join('\n')}`).join('\n\n')
    setEditRawLyrics(raw)
  }

  const handleSaveEditedSong = async (): Promise<void> => {
    if (!editingSong || !editTitle.trim()) return
    const stanzas = parseRawLyricsToStanzas(editRawLyrics.trim() || 'Letra')
    await app.upsertSong({
      id: editingSong.id,
      title: editTitle.trim(),
      author: editAuthor.trim(),
      musicalKey: editKey.trim() || '—',
      bpm: editBpm ?? null,
      tags: editingSong.tags,
      stanzas
    })
    setEditingSong(null)
  }

  // Opción para mostrar u ocultar la columna de etiquetas en la tabla de diapositivas
  const [showTagsColumn, setShowTagsColumn] = useState(false)

  // Estado de Texto / Alerta rápida estilo Holyrics
  const [isReloadingMedia, setIsReloadingMedia] = useState(false)
  const [quickTitle, setQuickTitle] = useState('Bienvenidos al Servicio de Adoración')
  const [quickBody, setQuickBody] = useState('Dios bendiga tu vida y tu familia en este día.')
  const [quickFooter, setQuickFooter] = useState('Lumen Worship Studio')

  useEffect(() => {
    const handleGlobalClick = (): void => setContextMenu(null)
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setContextMenu(null)
    }
    window.addEventListener('click', handleGlobalClick)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('click', handleGlobalClick)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const filteredSongs = useMemo(() => {
    const q = songQuery.trim().toLowerCase()
    if (!q) return app.songs
    return app.songs.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.author.toLowerCase().includes(q) ||
        s.musicalKey.toLowerCase().includes(q) ||
        s.stanzas.some((st) => st.lines.some((line) => line.toLowerCase().includes(q)))
    )
  }, [app.songs, songQuery])

  const selectedSong: Song | undefined = useMemo(
    () => app.songs.find((s) => s.id === selectedSongId) ?? filteredSongs[0] ?? app.songs[0],
    [app.songs, filteredSongs, selectedSongId]
  )

  const isDoc = (m: MediaBackground): boolean => {
    if ((m.slides && m.slides.length > 0) || (m as { slides?: unknown[] }).slides !== undefined) return true
    const lowerName = (m.name || '').toLowerCase()
    if (/\.(pdf|pptx|ppt|ppsx|pps|potx)($|[?#])/i.test(lowerName) || /^(pdf|powerpoint):/i.test(lowerName)) return true
    const lowerVal = typeof m.value === 'string' ? m.value.toLowerCase() : ''
    if (/\.(pdf|pptx|ppt|ppsx|pps|potx)($|[?#])/i.test(lowerVal)) return true
    if (m.category && ['diapositivas', 'presentaciones', 'documentos', 'pdf'].includes(m.category.toLowerCase())) return true
    return false
  }

  const churchMedia = useMemo(() => {
    // En la vista Medios sólo deben salir vídeos e imágenes de culto (excluyendo fondos y presentaciones)
    return app.media.filter(
      (m) => m.category === 'Culto' && !isDoc(m)
    )
  }, [app.media])

  const filteredMedia = useMemo(() => {
    const q = imageSearch.trim().toLowerCase()
    if (!q) return churchMedia
    return churchMedia.filter(
      (m) => m.name.toLowerCase().includes(q) || (m.category && m.category.toLowerCase().includes(q))
    )
  }, [churchMedia, imageSearch])

  const selectedMedia = useMemo(() => {
    return churchMedia.find((m) => m.id === selectedImageId) ?? churchMedia[0]
  }, [churchMedia, selectedImageId])

  const selectSongAndPinTab = (songId: string): void => {
    setSelectedSongId(songId)
    setActiveTab('music')
    setOpenSongTabIds((prev) => (prev.includes(songId) ? prev : [...prev, songId].slice(-6)))
  }

  const closeSongTab = (songId: string): void => {
    setOpenSongTabIds((prev) => prev.filter((id) => id !== songId))
  }

  const closeDocTab = (tabId: string): void => {
    setOpenDocTabs((prev) => prev.filter((d) => d.id !== tabId && d.title !== tabId))
  }

  // Recopilar presentaciones disponibles (almacén persistente de diapositivas)
  const presentationDecks = useMemo(() => {
    const list: Array<{ id: string; title: string; subtitle: string; slides: PresentationSlide[]; kind: 'pdf' | 'pptx' }> = []
    const seenTitles = new Set<string>()

    // 1. Presentaciones guardadas en la base de datos de diapositivas
    ;(app.presentations || []).forEach((p) => {
      const lower = p.title.toLowerCase()
      if (!seenTitles.has(lower)) {
        seenTitles.add(lower)
        list.push({
          id: p.id,
          title: p.title,
          subtitle: p.subtitle || `${p.slides.length} diapositivas / páginas`,
          slides: p.slides,
          kind: p.kind
        })
      }
    })

    return list
  }, [app.presentations])

  const filteredPresentations = useMemo(() => {
    const q = presentationSearch.trim().toLowerCase()
    if (!q) return presentationDecks
    return presentationDecks.filter((p) => p.title.toLowerCase().includes(q))
  }, [presentationDecks, presentationSearch])

  const selectedDocDeck = useMemo(() => {
    if (selectedDocId) {
      const match = presentationDecks.find((d) => d.id === selectedDocId || d.title.toLowerCase() === selectedDocId.toLowerCase())
      if (match) return match
    }
    return presentationDecks[0] ?? null
  }, [presentationDecks, selectedDocId])

  const projectPresentationImmediately = (deck: { title: string; slides: PresentationSlide[] }, openWindow = true): void => {
    setSelectedDocId(deck.title)
    setActiveTab('presentation')
    setOpenDocTabs((prev) => {
      const exists = prev.some((d) => d.title === deck.title)
      if (!exists) {
        return [...prev, { id: `doc-${Date.now()}`, title: deck.title, slides: deck.slides }]
      }
      return prev
    })
    void app.loadProjectionDeck({
      deckTitle: deck.title,
      slides: deck.slides,
      startIndex: 0,
      openWindow
    })
    void app.setProjectionMode('live')
    if (openWindow && !app.status?.projection.windowOpen) {
      void app.openProjection({ target: 'auto' })
    }
  }

  const live = app.status?.projection.live

  // Auto-scroll para mantener la fila de diapositiva activa siempre visible en la mesa de control
  useEffect(() => {
    if (typeof activeSlideRef.current?.scrollIntoView === 'function') {
      activeSlideRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [live?.currentIndex, live?.deckTitle])

  // Si se proyecta o carga un documento desde el dock o el cronograma, abrir su pestaña y seleccionarlo
  useEffect(() => {
    if (!live?.deckTitle || !live.slides || live.slides.length <= 1) return
    const isDoc =
      live.slides.some((s) => s.label.toLowerCase().includes('página') || s.label.toLowerCase().includes('diapositiva')) ||
      live.deckTitle.toLowerCase().includes('pdf') ||
      live.deckTitle.toLowerCase().includes('powerpoint') ||
      live.deckTitle.toLowerCase().includes('presentaci')
    if (isDoc) {
      setOpenDocTabs((prev) => {
        const exists = prev.some((d) => d.title === live.deckTitle)
        if (!exists) {
          return [...prev, { id: `doc-${Date.now()}`, title: live.deckTitle, slides: live.slides }]
        }
        return prev
      })
      setSelectedDocId(live.deckTitle)
      setActiveTab('presentation')
    }
  }, [live?.deckTitle, live?.slides])

  const previewTitle =
    activeTab === 'music'
      ? selectedSong?.title ?? 'Sin alabanza seleccionada'
      : activeTab === 'presentation'
        ? selectedDocDeck?.title ?? 'Sin presentación seleccionada'
        : activeTab === 'images'
          ? (selectedMedia ? `${selectedMedia.kind === 'video' || isVideoUrl(selectedMedia.value) ? 'Vídeo' : 'Imagen'}: ${selectedMedia.name}` : 'Sin medio seleccionado')
          : quickTitle || 'Anuncio rápido'

  const previewSub =
    activeTab === 'music'
      ? `${selectedSong?.author || 'Autor desconocido'} · Tono: ${selectedSong?.musicalKey || '—'}`
      : activeTab === 'presentation'
        ? `${selectedDocDeck?.slides.length ?? 0} diapositivas / páginas`
        : activeTab === 'images'
          ? (selectedMedia?.category || (selectedMedia?.kind === 'video' || isVideoUrl(selectedMedia?.value) ? 'Vídeo a Pantalla Completa' : 'Imagen a Pantalla Completa'))
          : 'Texto / Alerta en vivo'

  const previewSlides: PresentationSlide[] = useMemo(() => {
    if (activeTab === 'music') {
      return selectedSong ? songToSlides(selectedSong) : []
    }
    if (activeTab === 'presentation') {
      return selectedDocDeck ? selectedDocDeck.slides : []
    }
    if (activeTab === 'images') {
      if (!selectedMedia) return []
      if (selectedMedia.slides && selectedMedia.slides.length > 0) {
        return selectedMedia.slides
      }
      const matchSchedule = app.schedule.find(
        (s) =>
          s.title.toLowerCase().includes(selectedMedia.name.toLowerCase()) ||
          selectedMedia.name.toLowerCase().includes(s.title.toLowerCase().replace(/^(pdf|powerpoint):\s*/i, ''))
      )
      if (matchSchedule && matchSchedule.slides && matchSchedule.slides.length > 0) {
        return matchSchedule.slides
      }
      const isVid = selectedMedia.kind === 'video' || isVideoUrl(selectedMedia.value)
      return [
        {
          id: `media-preview-${selectedMedia.id}`,
          sourceKind: 'custom',
          sourceTitle: selectedMedia.name,
          label: selectedMedia.name,
          lines: [],
          footer: '',
          imageUrl: isVideoUrl(selectedMedia.value) ? resolveMediaVideoUrl(selectedMedia.value) : selectedMedia.value,
          mediaKind: isVid ? 'video' : 'image'
        }
      ]
    }
    return [createAnnouncementSlide(quickTitle.trim() || 'Anuncio', quickBody, quickFooter.trim())]
  }, [activeTab, quickBody, quickFooter, quickTitle, selectedDocDeck, selectedMedia, selectedSong, app.schedule])

  const projectPreviewSlide = (index: number, openWindow = false): void => {
    if (previewSlides.length === 0) return
    void app.loadProjectionDeck({
      deckTitle: previewTitle,
      slides: previewSlides,
      startIndex: index,
      ...(openWindow ? { openWindow: true } : {})
    })
    void app.setProjectionMode('live')
    if (openWindow && !app.status?.projection.windowOpen) {
      void app.openProjection({ target: 'auto' })
    }
  }

  const projectSongImmediately = (song: Song, openWindow = true): void => {
    selectSongAndPinTab(song.id)
    if (song.defaultBackgroundId) {
      const bg = app.media.find((m) => m.id === song.defaultBackgroundId)
      if (bg) void app.updateProjectionTheme({ background: bg })
    }
    void app.loadProjectionDeck({
      deckTitle: song.title,
      slides: songToSlides(song),
      startIndex: 0,
      ...(openWindow ? { openWindow: true } : {})
    })
    void app.setProjectionMode('live')
    if (openWindow && !app.status?.projection.windowOpen) {
      void app.openProjection({ target: 'auto' })
    }
  }

  const projectMediaImmediately = (img: MediaBackground, openWindow = true): void => {
    setSelectedImageId(img.id)
    const mediaVal = isVideoUrl(img.value) ? resolveMediaVideoUrl(img.value) : img.value
    const isVid = img.kind === 'video' || isVideoUrl(img.value)

    const matchSchedule = app.schedule.find(
      (s) =>
        s.title.toLowerCase().includes(img.name.toLowerCase()) ||
        img.name.toLowerCase().includes(s.title.toLowerCase().replace(/^(pdf|powerpoint):\s*/i, ''))
    )
    const deckSlides: PresentationSlide[] =
      img.slides && img.slides.length > 0
        ? img.slides
        : matchSchedule && matchSchedule.slides && matchSchedule.slides.length > 0
          ? matchSchedule.slides
          : [
              {
                id: `media-deck-${img.id}`,
                sourceKind: 'custom',
                sourceTitle: img.name,
                label: img.name,
                lines: [],
                footer: '',
                imageUrl: mediaVal,
                mediaKind: isVid ? 'video' : 'image'
              }
            ]

    void app.loadProjectionDeck({
      deckTitle: `${isVid ? 'Vídeo' : 'Imagen'}: ${img.name}`,
      slides: deckSlides,
      startIndex: 0,
      openWindow
    })
    if (isVid) {
      void app.updateProjectionTheme({
        videoPlaying: true,
        videoMuted: false
      })
    }
    void app.setProjectionMode('live')
    if (openWindow && !app.status?.projection.windowOpen) {
      void app.openProjection({ target: 'auto' })
    }
  }

  const addMediaToSchedule = (img: MediaBackground): void => {
    const mediaVal = isVideoUrl(img.value) ? resolveMediaVideoUrl(img.value) : img.value
    const isVid = img.kind === 'video' || isVideoUrl(img.value)

    const matchSchedule = app.schedule.find(
      (s) =>
        s.title.toLowerCase().includes(img.name.toLowerCase()) ||
        img.name.toLowerCase().includes(s.title.toLowerCase().replace(/^(pdf|powerpoint):\s*/i, ''))
    )
    const deckSlides: PresentationSlide[] =
      img.slides && img.slides.length > 0
        ? img.slides
        : matchSchedule && matchSchedule.slides && matchSchedule.slides.length > 0
          ? matchSchedule.slides
          : [
              {
                id: `media-deck-${img.id}`,
                sourceKind: 'custom',
                sourceTitle: img.name,
                label: img.name,
                lines: [],
                footer: '',
                imageUrl: mediaVal,
                mediaKind: isVid ? 'video' : 'image'
              }
            ]

    const isPres =
      img.name.toLowerCase().includes('pdf') ||
      img.name.toLowerCase().includes('powerpoint') ||
      deckSlides.length > 1
    const title = isPres
      ? img.name.toLowerCase().includes('pdf')
        ? `PDF: ${img.name}`
        : `PowerPoint: ${img.name}`
      : `${isVid ? 'Vídeo' : 'Imagen'}: ${img.name}`
    const subtitle = deckSlides.length > 1 ? `${deckSlides.length} diapositivas` : isVid ? 'Vídeo del culto' : 'Imagen del culto'

    void app.addScheduleItem({
      kind: 'announcement',
      title,
      subtitle,
      slides: deckSlides
    })
  }

  const previewMedia = (img: MediaBackground): void => {
    setSelectedImageId(img.id)
    projectMediaImmediately(img, false)
  }

  return (
    <section className="page hly-page" aria-labelledby="page-title">
      <header className="hly-module-bar hly-module-bar--compact">
        <div className="hly-module-bar__left">
          <h1 id="page-title" className="hly-module-bar__title">
            Inicio
          </h1>
          <div className="hly-tab-strip" role="tablist" aria-label="Modo de consola central">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'music'}
              className={`hly-tab-btn${activeTab === 'music' ? ' hly-tab-btn--active' : ''}`}
              onClick={() => setActiveTab('music')}
            >
              ♪ Música (<span data-testid="home-song-count">{app.songs.length}</span>)
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'bible'}
              className={`hly-tab-btn${activeTab === 'bible' ? ' hly-tab-btn--active' : ''}`}
              onClick={() => setActiveTab('bible')}
            >
              📖 Biblia ({app.bibleBooks.length || 66})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'presentation'}
              className={`hly-tab-btn${activeTab === 'presentation' ? ' hly-tab-btn--active' : ''}`}
              onClick={() => setActiveTab('presentation')}
            >
              📄 Diapositivas / PDF ({presentationDecks.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'images'}
              className={`hly-tab-btn${activeTab === 'images' ? ' hly-tab-btn--active' : ''}`}
              onClick={() => setActiveTab('images')}
            >
              🎬 Medios ({churchMedia.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'text'}
              className={`hly-tab-btn${activeTab === 'text' ? ' hly-tab-btn--active' : ''}`}
              onClick={() => setActiveTab('text')}
            >
              📢 Texto Rápido
            </button>
          </div>
        </div>
      </header>

      {!app.bridgeAvailable && (
        <div className="card card--warn" role="alert">
          No se detectó la conexión con el proceso principal. Ejecuta la aplicación con Electron.
        </div>
      )}

      {activeTab === 'bible' ? (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <BiblePage app={app} />
        </div>
      ) : (
        <div className="hly-center-split">
          {/* PANEL CENTRAL IZQUIERDO: CATÁLOGO / SELECTOR */}
          <div className="hly-panel hly-panel--flex">
          {activeTab === 'music' && (
            <>
              <div className="hly-panel__header">
                <span className="hly-panel__title">♪ LISTA DE ALABANZAS ({filteredSongs.length})</span>
              </div>
              <div className="hly-SubToolbar">
                <input
                  type="text"
                  className="input"
                  value={songQuery}
                  onChange={(e) => setSongQuery(e.target.value)}
                  placeholder="Filtrar por título, letra, artista o tonalidad..."
                  aria-label="Filtrar alabanzas en consola"
                />
              </div>
              <div className="hly-grid-header hly-grid-header--songs" aria-hidden="true">
                <span>Título</span>
                <span>Autor / Artista</span>
                <span>Tono</span>
                <span>Acción</span>
              </div>
              <div className="hly-scroll-area" role="list">
                {filteredSongs.map((song) => {
                  const isSelected = selectedSong?.id === song.id
                  const isLive = live?.deckTitle === song.title
                  return (
                    <div
                      key={song.id}
                      role="listitem"
                      className={`hly-song-grid-row${isSelected ? ' hly-song-grid-row--selected' : ''}${
                        isLive ? ' hly-song-grid-row--live' : ''
                      }`}
                      onDoubleClick={() => projectSongImmediately(song, true)}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setSelectedSongId(song.id)
                        setContextMenu({ song, x: e.clientX, y: e.clientY })
                      }}
                    >
                      <button
                        type="button"
                        className="hly-song-grid-row__main"
                        onClick={() => selectSongAndPinTab(song.id)}
                        onDoubleClick={(e) => {
                          e.stopPropagation()
                          projectSongImmediately(song, true)
                        }}
                      >
                        <span className="hly-song-grid-row__title">{song.title}</span>
                        <span className="hly-song-grid-row__author">{song.author || '—'}</span>
                        <span className="hly-song-grid-row__key">{song.musicalKey || '—'}</span>
                      </button>
                      <div className="hly-song-grid-row__actions">
                        <button
                          type="button"
                          className="hly-icon-btn"
                          title="Enviar directo a proyección en vivo"
                          onClick={() => projectSongImmediately(song, true)}
                        >
                          ▶
                        </button>
                        <button
                          type="button"
                          className="hly-icon-btn"
                          title="Añadir a la Lista de Reproducción"
                          onClick={() =>
                            void app.addScheduleItem({
                              kind: 'song',
                              title: song.title,
                              subtitle: `${song.author || 'Alabanza'} (${song.stanzas.length} estrofas)`,
                              slides: songToSlides(song)
                            })
                          }
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}



          {activeTab === 'presentation' && (
            <>
              <div
                className="hly-panel__header"
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 8px'
                }}
              >
                <span className="hly-panel__title">📄 DIAPOSITIVAS Y PRESENTACIONES ({filteredPresentations.length})</span>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <input
                    ref={presentationFileInputRef}
                    type="file"
                    accept=".pdf,.pptx,.ppt,.ppsx,.pps,.potx"
                    multiple
                    style={{ display: 'none' }}
                    onChange={handleUploadPresentationFile}
                  />
                  <button
                    type="button"
                    className="hly-mini-btn"
                    title="Abrir carpeta dedicada de diapositivas y presentaciones de la app"
                    onClick={() => void app.openSlidesFolder?.()}
                  >
                    📁
                  </button>
                  <button
                    type="button"
                    className="hly-mini-btn"
                    title="Recargar diapositivas desde la carpeta física"
                    aria-label="Recargar diapositivas desde la carpeta física"
                    disabled={isReloadingSlides}
                    onClick={async () => {
                      setIsReloadingSlides(true)
                      try {
                        // 1. Recargar y sincronizar presentaciones con los archivos de la carpeta
                        const updated = (await app.reloadSlides?.()) || []
                        const validTitles = new Set(updated.map((p) => p.title.toLowerCase()))

                        // Cerrar pestañas abiertas de documentos que ya no existen
                        setOpenDocTabs((prev) =>
                          prev.filter((d) => validTitles.has(d.title.toLowerCase()))
                        )
                        if (
                          selectedDocId &&
                          !validTitles.has(selectedDocId.toLowerCase()) &&
                          !updated.some((p) => p.id === selectedDocId)
                        ) {
                          setSelectedDocId(null)
                        }

                        // 2. Escanear la carpeta de diapositivas en busca de nuevos archivos PDF/PowerPoint
                        if (typeof app.scanSlidesFolder === 'function') {
                          const folderFiles = await app.scanSlidesFolder()
                          const existingTitles = new Set(
                            updated.map((p) => p.title.toLowerCase())
                          )

                          for (const fileInfo of folderFiles) {
                            const cleanName = fileInfo.fileName.replace(/\.[^/.]+$/, '')
                            if (!existingTitles.has(cleanName.toLowerCase())) {
                              try {
                                const fileUrl = `lumen-media://local/${encodeURIComponent(fileInfo.filePath.replace(/\\/g, '/'))}`
                                const res = await fetch(fileUrl)
                                if (res.ok) {
                                  const arrayBuf = await res.arrayBuffer()
                                  if (fileInfo.ext === 'pdf') {
                                    const deck = await convertPdfToSlides(arrayBuf, fileInfo.fileName)
                                    if (deck.slides.length > 0) {
                                      await app.savePresentation({
                                        id: `pdf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                                        title: deck.title,
                                        subtitle: `${deck.slides.length} páginas · PDF`,
                                        kind: 'pdf',
                                        filePath: fileInfo.filePath,
                                        slides: deck.slides
                                      })
                                      existingTitles.add(cleanName.toLowerCase())
                                    }
                                  } else {
                                    const deck = await convertPptxToSlides(arrayBuf, fileInfo.fileName)
                                    if (deck.slides.length > 0) {
                                      await app.savePresentation({
                                        id: `pptx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                                        title: deck.title,
                                        subtitle: `${deck.slides.length} diapositivas · PowerPoint`,
                                        kind: 'pptx',
                                        filePath: fileInfo.filePath,
                                        slides: deck.slides
                                      })
                                      existingTitles.add(cleanName.toLowerCase())
                                    }
                                  }
                                }
                              } catch (err) {
                                console.warn('[Slides] Error al auto-procesar archivo de carpeta:', fileInfo.fileName, err)
                              }
                            }
                          }
                        }
                      } finally {
                        setTimeout(() => setIsReloadingSlides(false), 300)
                      }
                    }}
                  >
                    <span style={{ display: 'inline-block', transform: isReloadingSlides ? 'rotate(360deg)' : 'none', transition: 'transform 0.5s ease' }}>🔄</span>
                  </button>
                  <button
                    type="button"
                    className="hly-mini-btn hly-mini-btn--primary"
                    style={{ fontSize: 11, padding: '3px 8px', fontWeight: 700 }}
                    title="Cargar presentación de PowerPoint (.pptx) o archivo PDF"
                    onClick={() => presentationFileInputRef.current?.click()}
                  >
                    ➕ Cargar Diapositiva / PDF
                  </button>
                </div>
              </div>
              <div className="hly-SubToolbar">
                <input
                  type="text"
                  className="input"
                  value={presentationSearch}
                  onChange={(e) => setPresentationSearch(e.target.value)}
                  placeholder="Filtrar presentaciones por título..."
                  aria-label="Filtrar presentaciones y diapositivas"
                />
              </div>
              <div className="hly-grid-body" style={{ flex: 1, overflowY: 'auto' }}>
                {filteredPresentations.length === 0 ? (
                  <div className="hly-empty-box" style={{ padding: 24, textAlign: 'center' }}>
                    <p style={{ fontSize: 13, marginBottom: 12 }}>
                      No hay diapositivas o presentaciones en el sistema.
                    </p>
                    <button
                      type="button"
                      className="button button--primary"
                      onClick={() => presentationFileInputRef.current?.click()}
                    >
                      ➕ Cargar PowerPoint (.pptx) o PDF
                    </button>
                  </div>
                ) : (
                  <div className="hly-table-list" role="list" style={{ padding: '4px 6px' }}>
                    {filteredPresentations.map((item, idx) => {
                      const isSelected = selectedDocDeck?.id === item.id
                      const isLive = live?.deckTitle === item.title
                      const firstThumb = item.slides?.[0]?.imageUrl
                      return (
                        <div
                          key={item.id}
                          role="listitem"
                          className={`hly-playlist-row${isLive ? ' hly-playlist-row--active' : ''}${isSelected ? ' hly-playlist-row--selected' : ''}`}
                          style={{ cursor: 'pointer', padding: '4px 8px' }}
                          onClick={() => {
                            setSelectedDocId(item.id)
                            setOpenDocTabs((prev) => {
                              const exists = prev.some((d) => d.title === item.title)
                              if (!exists) {
                                return [...prev, { id: item.id, title: item.title, slides: item.slides }]
                              }
                              return prev
                            })
                          }}
                          onDoubleClick={() => projectPresentationImmediately(item, true)}
                        >
                          <div
                            className="hly-playlist-row__main"
                            style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', padding: 0, color: 'inherit', cursor: 'pointer' }}
                          >
                            <span className="hly-playlist-row__idx" style={{ fontSize: 11, width: 20, textAlign: 'right', color: 'var(--text-muted)' }}>
                              {String(idx + 1).padStart(2, '0')}
                            </span>
                            <div
                              style={{
                                width: 44,
                                height: 30,
                                borderRadius: 4,
                                overflow: 'hidden',
                                background: '#0a0e17',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                border: '1px solid var(--border)'
                              }}
                            >
                              {firstThumb ? (
                                <img
                                  src={firstThumb}
                                  alt=""
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                              ) : (
                                <span style={{ fontSize: 15 }}>{item.kind === 'pdf' ? '📄' : '📊'}</span>
                              )}
                            </div>
                            <div className="hly-playlist-row__info" style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                              <span className="hly-playlist-row__title" style={{ fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {item.title}
                              </span>
                              <span className="hly-playlist-row__sub" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                                {item.subtitle} · {item.kind === 'pdf' ? 'PDF' : 'PowerPoint'}
                              </span>
                            </div>
                          </div>

                          <div className="hly-playlist-row__actions" style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                            <button
                              type="button"
                              className="hly-icon-btn"
                              title="Añadir al orden del culto"
                              onClick={(e) => {
                                e.stopPropagation()
                                void app.addScheduleItem({
                                  kind: 'announcement',
                                  title: item.title.startsWith('PDF:') || item.title.startsWith('PowerPoint:') ? item.title : `${item.kind === 'pdf' ? 'PDF' : 'PowerPoint'}: ${item.title}`,
                                  subtitle: item.subtitle,
                                  slides: item.slides
                                })
                              }}
                            >
                              ➕
                            </button>
                            <button
                              type="button"
                              className="hly-icon-btn"
                              title="Vista previa en cabina (sin proyectar)"
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedDocId(item.id)
                                setOpenDocTabs((prev) => {
                                  const exists = prev.some((d) => d.title === item.title)
                                  if (!exists) {
                                    return [...prev, { id: item.id, title: item.title, slides: item.slides }]
                                  }
                                  return prev
                                })
                                void app.loadProjectionDeck({
                                  deckTitle: item.title,
                                  slides: item.slides,
                                  startIndex: 0,
                                  openWindow: false
                                })
                              }}
                            >
                              👁
                            </button>
                            <button
                              type="button"
                              className="hly-icon-btn hly-icon-btn--primary"
                              title="Proyectar todas las diapositivas en vivo (doble clic)"
                              onClick={(e) => {
                                e.stopPropagation()
                                projectPresentationImmediately(item, true)
                              }}
                            >
                              ▶
                            </button>
                            <button
                              type="button"
                              className="hly-icon-btn hly-icon-btn--danger"
                              title="Eliminar presentación"
                              onClick={(e) => {
                                e.stopPropagation()
                                setDeleteConfirm({
                                  isOpen: true,
                                  title: '¿Eliminar presentación de diapositivas?',
                                  itemName: item.title,
                                  itemType: 'presentación',
                                  onConfirm: () => {
                                    // 1. Eliminar de la base de datos persistente de presentaciones
                                    const savedDeck = app.presentations?.find(
                                      (p) => p.id === item.id || p.title.toLowerCase() === item.title.toLowerCase()
                                    )
                                    if (savedDeck) {
                                      void app.deletePresentation(savedDeck.id)
                                    } else {
                                      void app.deletePresentation(item.id)
                                    }
                                    // 2. Eliminar del cronograma si existía allí
                                    const schedMatches = (app.schedule || []).filter(
                                      (s) =>
                                        s.id === item.id ||
                                        s.title.toLowerCase() === item.title.toLowerCase() ||
                                        s.title.toLowerCase() === `pdf: ${item.title.toLowerCase()}` ||
                                        s.title.toLowerCase() === `powerpoint: ${item.title.toLowerCase()}`
                                    )
                                    for (const sm of schedMatches) {
                                      void app.removeScheduleItem(sm.id)
                                    }
                                    // 3. Cerrar pestañas abiertas del documento
                                    setOpenDocTabs((prev) => prev.filter((d) => d.id !== item.id && d.title.toLowerCase() !== item.title.toLowerCase()))
                                    if (selectedDocId === item.id || selectedDocId?.toLowerCase() === item.title.toLowerCase()) {
                                      setSelectedDocId(null)
                                    }
                                    setDeleteConfirm((prev) => ({ ...prev, isOpen: false }))
                                  }
                                })
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'images' && (
            <>
              <div
                className="hly-panel__header"
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 8px'
                }}
              >
                <span className="hly-panel__title">🎬 MEDIOS ({filteredMedia.length})</span>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <input
                    ref={homeMediaInputRef}
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    style={{ display: 'none' }}
                    onChange={handleUploadMediaFiles}
                  />
                  <button
                    type="button"
                    className="hly-mini-btn"
                    title="Abrir carpeta dedicada de imágenes y vídeos de la app"
                    onClick={() => void app.openMediaFolder()}
                  >
                    📁
                  </button>
                  <button
                    type="button"
                    className="hly-mini-btn"
                    title="Recargar medios desde el almacenamiento local"
                    onClick={async () => {
                      setIsReloadingMedia(true)
                      await app.reloadMedia()
                      setTimeout(() => setIsReloadingMedia(false), 500)
                    }}
                  >
                    <span style={{ display: 'inline-block', transform: isReloadingMedia ? 'rotate(360deg)' : 'none', transition: 'transform 0.5s ease' }}>🔄</span>
                  </button>
                  <button
                    type="button"
                    className="hly-mini-btn hly-mini-btn--primary"
                    style={{ fontWeight: 700 }}
                    title="Añadir imágenes o vídeos del culto"
                    onClick={() => homeMediaInputRef.current?.click()}
                  >
                    + Importar
                  </button>
                </div>
              </div>
              <div className="hly-SubToolbar">
                <input
                  type="text"
                  className="input"
                  value={imageSearch}
                  onChange={(e) => setImageSearch(e.target.value)}
                  placeholder="Filtrar por nombre de imagen o vídeo..."
                  aria-label="Filtrar medios del culto"
                />
              </div>
              <div className="hly-scroll-area" role="list">
                {filteredMedia.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)' }}>
                    No hay medios registrados. Usa <strong>📁</strong> para abrir la carpeta o <strong>+ Importar</strong> para subirlos.
                  </div>
                ) : (
                  <div className="hly-table-list" role="list" style={{ padding: '4px 6px' }}>
                    {filteredMedia.map((m, idx) => {
                      const isSelected = selectedMedia?.id === m.id
                      const isVid = m.kind === 'video' || isVideoUrl(m.value)
                      const isLive = live?.deckTitle === `${isVid ? 'Vídeo' : 'Imagen'}: ${m.name}` || live?.deckTitle === m.name
                      const hasSlides = m.slides && m.slides.length > 0
                      return (
                        <div
                          key={m.id}
                          role="listitem"
                          className={`hly-playlist-row${isLive ? ' hly-playlist-row--active' : ''}${isSelected ? ' hly-playlist-row--selected' : ''}`}
                          style={{ cursor: 'pointer', padding: '4px 8px' }}
                          onClick={() => {
                            setSelectedImageId(m.id)
                          }}
                          onDoubleClick={() => projectMediaImmediately(m, true)}
                        >
                          <div
                            className="hly-playlist-row__main"
                            style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', padding: 0, color: 'inherit', cursor: 'pointer' }}
                          >
                            <span className="hly-playlist-row__idx" style={{ fontSize: 11, width: 20, textAlign: 'right', color: 'var(--text-muted)' }}>
                              {String(idx + 1).padStart(2, '0')}
                            </span>
                            <div
                              style={{
                                width: 44,
                                height: 30,
                                borderRadius: 4,
                                overflow: 'hidden',
                                background: '#0a0e17',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                border: '1px solid var(--border)',
                                position: 'relative'
                              }}
                            >
                              {isVid ? (
                                <span style={{ fontSize: 14 }}>🎬</span>
                              ) : m.value.startsWith('data:image') || m.value.startsWith('http') || m.value.startsWith('lumen-media:') ? (
                                <img
                                  src={m.value}
                                  alt=""
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                              ) : (
                                <span style={{ fontSize: 14 }}>🖼</span>
                              )}
                              {isVid && (
                                <span
                                  style={{
                                    position: 'absolute',
                                    bottom: 1,
                                    right: 1,
                                    fontSize: 8,
                                    fontWeight: 800,
                                    padding: '0 2px',
                                    borderRadius: 2,
                                    background: 'rgba(234, 88, 12, 0.9)',
                                    color: '#fff',
                                    lineHeight: 1
                                  }}
                                >
                                  ▶
                                </span>
                              )}
                            </div>
                            <div className="hly-playlist-row__info" style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                              <span className="hly-playlist-row__title" style={{ fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {m.name}
                              </span>
                              <span className="hly-playlist-row__sub" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                                {hasSlides ? `${m.slides?.length} diapositivas` : isVid ? 'Vídeo' : 'Imagen'} {m.category ? `· ${m.category}` : ''}
                              </span>
                            </div>
                          </div>

                          <div className="hly-playlist-row__actions" style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                            <button
                              type="button"
                              className="hly-icon-btn"
                              title="Añadir al orden del culto"
                              onClick={(e) => {
                                e.stopPropagation()
                                addMediaToSchedule(m)
                              }}
                            >
                              ➕
                            </button>
                            <button
                              type="button"
                              className="hly-icon-btn"
                              title="Vista previa en cabina"
                              onClick={(e) => {
                                e.stopPropagation()
                                previewMedia(m)
                              }}
                            >
                              👁
                            </button>
                            <button
                              type="button"
                              className="hly-icon-btn hly-icon-btn--primary"
                              title="Proyectar en vivo (doble clic)"
                              onClick={(e) => {
                                e.stopPropagation()
                                projectMediaImmediately(m, true)
                              }}
                            >
                              ▶
                            </button>
                            <button
                              type="button"
                              className="hly-icon-btn hly-icon-btn--danger"
                              title="Eliminar medio"
                              onClick={(e) => {
                                e.stopPropagation()
                                setDeleteConfirm({
                                  isOpen: true,
                                  title: '¿Eliminar archivo multimedia?',
                                  itemName: m.name,
                                  itemType: m.kind === 'video' ? 'vídeo' : 'imagen',
                                  onConfirm: () => {
                                    void app.deleteMedia(m.id)
                                    setDeleteConfirm((prev) => ({ ...prev, isOpen: false }))
                                  }
                                })
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'text' && (
            <>
              <div className="hly-panel__header">
                <span className="hly-panel__title">📢 GENERADOR DE TEXTO / ALERTA EN VIVO</span>
              </div>
              <div className="hly-quick-text-form">
                <div className="form-group">
                  <label className="label" htmlFor="hly-qt-title">
                    Encabezado / Título
                  </label>
                  <input
                    id="hly-qt-title"
                    className="input"
                    value={quickTitle}
                    onChange={(e) => setQuickTitle(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="label" htmlFor="hly-qt-body">
                    Texto para proyectar en pantalla
                  </label>
                  <textarea
                    id="hly-qt-body"
                    className="textarea"
                    style={{ minHeight: 110 }}
                    value={quickBody}
                    onChange={(e) => setQuickBody(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="label" htmlFor="hly-qt-footer">
                    Pie de página
                  </label>
                  <input
                    id="hly-qt-footer"
                    className="input"
                    value={quickFooter}
                    onChange={(e) => setQuickFooter(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* PANEL CENTRAL DERECHO: PESTAÑAS ABIERTAS + PÁRRAFOS EN PREVISUALIZACIÓN */}
        <div className="hly-panel hly-panel--flex">
          {(openSongTabIds.length > 0 || openDocTabs.length > 0) && (
            <div className="hly-open-docs-bar" role="tablist" aria-label="Elementos abiertos en previsualización">
              {openSongTabIds.map((id) => {
                const s = app.songs.find((item) => item.id === id)
                if (!s) return null
                const isSelected = activeTab === 'music' && selectedSong?.id === id
                return (
                  <div key={id} className={`hly-doc-tab${isSelected ? ' hly-doc-tab--active' : ''}`}>
                    <button
                      type="button"
                      className="hly-doc-tab__btn"
                      onClick={() => {
                        setSelectedSongId(id)
                        setActiveTab('music')
                      }}
                    >
                      ♪ {s.title}
                    </button>
                    <button
                      type="button"
                      className="hly-doc-tab__close"
                      title="Cerrar pestaña"
                      onClick={() => closeSongTab(id)}
                    >
                      ×
                    </button>
                  </div>
                )
              })}
              {openDocTabs.map((doc) => {
                const isSelected = activeTab === 'presentation' && (selectedDocId === doc.id || selectedDocId === doc.title)
                return (
                  <div key={doc.id} className={`hly-doc-tab${isSelected ? ' hly-doc-tab--active' : ''}`}>
                    <button
                      type="button"
                      className="hly-doc-tab__btn"
                      onClick={() => {
                        setSelectedDocId(doc.id)
                        setActiveTab('presentation')
                      }}
                    >
                      📄 {doc.title}
                    </button>
                    <button
                      type="button"
                      className="hly-doc-tab__close"
                      title="Cerrar pestaña"
                      onClick={() => closeDocTab(doc.id)}
                    >
                      ×
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          <div className="hly-panel__header">
            <div>
              <span className="hly-panel__title">▣ PREVISUALIZACIÓN: {previewTitle.toUpperCase()}</span>
              <div className="hly-panel__subtitle">{previewSub}</div>
            </div>
            <div className="btn-row" style={{ alignItems: 'center' }}>
              <button
                type="button"
                className={`hly-mini-btn${showTagsColumn ? ' hly-mini-btn--primary' : ''}`}
                style={{ fontSize: 10.5 }}
                title={showTagsColumn ? 'Ocultar columna de etiquetas' : 'Mostrar columna de etiquetas'}
                onClick={() => setShowTagsColumn((prev) => !prev)}
              >
                🏷 {showTagsColumn ? 'Ocultar etiqueta' : 'Ver etiqueta'}
              </button>
            </div>
          </div>

          <div
            className={`hly-slide-table-header${!showTagsColumn ? ' hly-slide-table-header--no-tag' : ''}`}
            aria-hidden="true"
          >
            <span>#</span>
            {showTagsColumn && <span>Etiqueta</span>}
            <span>Letra / Contenido (1 clic previa · Doble clic proyecta en vivo)</span>
          </div>

          <div className="hly-scroll-area" role="list" aria-label="Párrafos en previsualización">
            {previewSlides.map((slide, idx) => {
              const isLiveSlide = live?.deckTitle === previewTitle && live.currentIndex === idx
              return (
                <button
                  key={slide.id}
                  type="button"
                  role="listitem"
                  ref={isLiveSlide ? activeSlideRef : undefined}
                  className={`hly-slide-row hly-slide-row--preview${
                    !showTagsColumn ? ' hly-slide-row--no-tag' : ''
                  }${isLiveSlide ? ' hly-slide-row--active' : ''}`}
                  onClick={() => projectPreviewSlide(idx, false)}
                  onDoubleClick={() => projectPreviewSlide(idx, true)}
                >
                  <span className="hly-slide-row__num">{String(idx + 1).padStart(2, '0')}</span>
                  {showTagsColumn && <span className={stanzaTagClass(slide.label)}>{slide.label}</span>}
                  <span className="hly-slide-row__text">
                    {slide.imageUrl ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, width: '100%' }}>
                        {slide.mediaKind === 'video' || isVideoUrl(slide.imageUrl) ? (
                          <video
                            src={resolveMediaVideoUrl(slide.imageUrl)}
                            muted
                            playsInline
                            preload="metadata"
                            style={{ width: 54, height: 36, objectFit: 'cover', borderRadius: 4, border: '1px solid #444', background: '#000', flexShrink: 0 }}
                          />
                        ) : (
                          <img
                            src={slide.imageUrl}
                            alt={slide.label}
                            style={{ width: 54, height: 36, objectFit: 'contain', borderRadius: 4, border: '1px solid #444', background: '#111', flexShrink: 0 }}
                          />
                        )}
                        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden', textAlign: 'left' }}>
                          <strong style={{ fontSize: 12, color: 'var(--text)' }}>{slide.label}</strong>
                          {slide.footer && (
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {slide.footer}
                            </span>
                          )}
                          {slide.lines.length > 0 && (
                            <span style={{ fontSize: 11, color: 'var(--text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {slide.lines.slice(0, 2).join(' ')}
                            </span>
                          )}
                        </span>
                      </span>
                    ) : (
                      slide.lines.map((line, lineIdx) => (
                        <span key={lineIdx} className="hly-slide-row__line">
                          {line}
                        </span>
                      ))
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
      )}

      {/* Menú contextual flotante al hacer clic derecho sobre una alabanza */}
      {contextMenu && (
        <div
          className="hly-context-menu"
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            zIndex: 9999
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="hly-context-menu__header">{contextMenu.song.title}</div>
          <button
            type="button"
            className="hly-context-menu__item"
            onClick={() => {
              projectSongImmediately(contextMenu.song, true)
              setContextMenu(null)
            }}
          >
            ▶ Proyectar alabanza en vivo
          </button>
          <button
            type="button"
            className="hly-context-menu__item"
            onClick={() => {
              openSongEditor(contextMenu.song)
              setContextMenu(null)
            }}
          >
            ✏ Editar alabanza
          </button>
          <button
            type="button"
            className="hly-context-menu__item"
            onClick={() => {
              void app.addScheduleItem({
                kind: 'song',
                title: contextMenu.song.title,
                subtitle: `${contextMenu.song.author || 'Alabanza'} (${contextMenu.song.stanzas.length} estrofas)`,
                slides: songToSlides(contextMenu.song)
              })
              setContextMenu(null)
            }}
          >
            + Añadir a la Lista del culto
          </button>
          <div className="hly-context-menu__divider" />
          <button
            type="button"
            className="hly-context-menu__item hly-context-menu__item--danger"
            onClick={() => {
              const toDelete = contextMenu.song
              setContextMenu(null)
              setDeleteConfirm({
                isOpen: true,
                title: '¿Eliminar alabanza?',
                itemName: toDelete.title,
                itemType: 'alabanza del repertorio',
                onConfirm: () => {
                  void app.deleteSong(toDelete.id)
                  setDeleteConfirm((prev) => ({ ...prev, isOpen: false }))
                }
              })
            }}
          >
            🗑 Eliminar alabanza
          </button>
        </div>
      )}

      {/* Modal flotante de edición rápida de alabanza */}
      {editingSong && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20
          }}
          onClick={() => setEditingSong(null)}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: 720,
              maxHeight: '90vh',
              overflowY: 'auto',
              background: 'var(--bg-panel)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: 20,
              boxShadow: '0 10px 40px rgba(0,0,0,0.6)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
                borderBottom: '1px solid var(--border)',
                paddingBottom: 10
              }}
            >
              <h2 style={{ margin: 0, fontSize: 18, color: '#f8fafc' }}>
                ✏ Editar alabanza: {editingSong.title}
              </h2>
              <button
                type="button"
                className="hly-icon-btn"
                style={{ fontSize: 16, cursor: 'pointer' }}
                onClick={() => setEditingSong(null)}
              >
                ✕
              </button>
            </div>

            <div
              className="form-grid"
              style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr', gap: 10, marginBottom: 14 }}
            >
              <label className="field">
                <span style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8' }}>Título</span>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px' }}
                />
              </label>
              <label className="field">
                <span style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8' }}>Autor / Artista</span>
                <input
                  type="text"
                  value={editAuthor}
                  onChange={(e) => setEditAuthor(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px' }}
                />
              </label>
              <label className="field">
                <span style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8' }}>Tonalidad</span>
                <input
                  type="text"
                  value={editKey}
                  placeholder="Ej. G, C, Em"
                  onChange={(e) => setEditKey(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px' }}
                />
              </label>
              <label className="field">
                <span style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8' }}>BPM</span>
                <input
                  type="number"
                  value={editBpm ?? ''}
                  placeholder="72"
                  onChange={(e) => setEditBpm(e.target.value ? Number(e.target.value) : null)}
                  style={{ width: '100%', padding: '6px 8px' }}
                />
              </label>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="hly-mini-btn"
                title="Elimina etiquetas web, acordes desalineados y caracteres raros"
                onClick={() => setEditRawLyrics((prev) => cleanInternetLyrics(prev))}
              >
                ✨ Limpiar letra
              </button>
              <button
                type="button"
                className="hly-mini-btn"
                title="Divide estrofas largas de más de 4 líneas para lectura clara en pantalla"
                onClick={() => {
                  const parsed = parseRawLyricsToStanzas(editRawLyrics)
                  const split = autoSplitLongStanzas(parsed, 4)
                  setEditRawLyrics(split.map((st) => `[${st.label}]\n${st.lines.join('\n')}`).join('\n\n'))
                }}
              >
                ✂ Dividir estrofas &gt;4 líneas
              </button>
              <button
                type="button"
                className="hly-mini-btn"
                onClick={() => setEditRawLyrics((prev) => transposeChordText(prev, -1))}
              >
                ♭ -1 Semitono
              </button>
              <button
                type="button"
                className="hly-mini-btn"
                onClick={() => setEditRawLyrics((prev) => transposeChordText(prev, 1))}
              >
                ♯ +1 Semitono
              </button>
            </div>

            <label className="field" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8' }}>
                Letra de la alabanza (Estrofas separadas por línea en blanco o etiquetas [Verso 1], [Coro])
              </span>
              <textarea
                rows={12}
                value={editRawLyrics}
                onChange={(e) => setEditRawLyrics(e.target.value)}
                style={{
                  width: '100%',
                  fontFamily: 'monospace',
                  fontSize: 13,
                  lineHeight: 1.4,
                  padding: 10,
                  borderRadius: 6,
                  background: '#090d16',
                  color: '#f8fafc',
                  border: '1px solid var(--border)'
                }}
              />
            </label>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
                marginTop: 16,
                paddingTop: 12,
                borderTop: '1px solid var(--border)'
              }}
            >
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => setEditingSong(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => void handleSaveEditedSong()}
              >
                💾 Guardar cambios
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal elegante de confirmación de eliminación */}
      <ConfirmDeleteModal
        isOpen={deleteConfirm.isOpen}
        title={deleteConfirm.title}
        itemName={deleteConfirm.itemName}
        itemType={deleteConfirm.itemType}
        onConfirm={deleteConfirm.onConfirm}
        onCancel={() => setDeleteConfirm((prev) => ({ ...prev, isOpen: false }))}
      />
    </section>
  )
}
