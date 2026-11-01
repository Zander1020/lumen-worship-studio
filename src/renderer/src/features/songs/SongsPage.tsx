import { type ChangeEvent, type DragEvent, useEffect, useMemo, useRef, useState } from 'react'
import { exportCatalogToHolyricsJson } from '../../../../shared/holyricsCompat'
import type { HolyricsImportItem, Song } from '../../../../shared/ipc'
import {
  autoSplitLongStanzas,
  cleanInternetLyrics,
  fuzzyMatchScore,
  parseRawLyricsToStanzas,
  songToSlides,
  transposeChordText
} from '../../../../shared/slideHelpers'
import type { UseAppStatus } from '../../hooks/useAppStatus'
import { ConfirmDeleteModal } from '../../components/ConfirmDeleteModal'

export interface SongsPageProps {
  app: UseAppStatus
}

type StanzaViewMode = 'table' | 'grid'

function stanzaTagClass(label: string): string {
  const lower = label.toLowerCase()
  if (lower.includes('coro')) return 'hly-slide-row__tag hly-slide-row__tag--chorus'
  if (lower.includes('puente') || lower.includes('bridge')) return 'hly-slide-row__tag hly-slide-row__tag--bridge'
  return 'hly-slide-row__tag'
}

const DEFAULT_RAW_LYRICS = `[Verso 1]
Señor, mi Dios, al contemplar los cielos,
El firmamento y las estrellas mil.

[Coro]
Mi corazón entona la canción:
¡Cuán grande es Él! ¡Cuán grande es Él!`

const SAMPLE_HOLYRICS_PASTE = `# Tu Fidelidad Es Grande
Autor: Miguel Cassina
Tono: D

[Verso 1]
Tu fidelidad es grande,
Tu fidelidad incomparable es.

[Coro]
Nadie como Tú, bendito Dios,
Grande es tu fidelidad.

===

# Alabaré
Autor: Tradicional
Tono: G

[Coro]
Alabaré, alabaré, alabaré a mi Señor.`

export function SongsPage({ app }: SongsPageProps) {
  const [search, setSearch] = useState('')
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null)
  const [stanzaViewMode, setStanzaViewMode] = useState<StanzaViewMode>('table')
  const [editing, setEditing] = useState(false)
  const [importingModal, setImportingModal] = useState(false)
  const [holyricsRawPaste, setHolyricsRawPaste] = useState(SAMPLE_HOLYRICS_PASTE)
  const [includeTitleSlide, setIncludeTitleSlide] = useState(false)
  const [contextMenu, setContextMenu] = useState<{
    song: Song
    x: number
    y: number
  } | null>(null)
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
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const handleClose = (): void => setContextMenu(null)
    window.addEventListener('click', handleClose)
    window.addEventListener('contextmenu', handleClose)
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setContextMenu(null)
    }
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('click', handleClose)
      window.removeEventListener('contextmenu', handleClose)
      window.removeEventListener('keydown', handleKey)
    }
  }, [])

  // Campos del formulario de creación/edición
  const [editId, setEditId] = useState<string | undefined>(undefined)
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [musicalKey, setMusicalKey] = useState('G')
  const [bpm, setBpm] = useState('80')
  const [tagsText, setTagsText] = useState('Adoración, Himno')
  const [verseOrder, setVerseOrder] = useState('')
  const [chords, setChords] = useState('')
  const [defaultBgId, setDefaultBgId] = useState('')
  const [rawLyrics, setRawLyrics] = useState(DEFAULT_RAW_LYRICS)

  const liveEditorStanzas = useMemo(() => parseRawLyricsToStanzas(rawLyrics), [rawLyrics])

  const filteredSongs = useMemo(() => {
    const q = search.trim()
    if (!q) return app.songs
    return app.songs.filter((song) => {
      const targetText = [
        song.title,
        song.author,
        song.musicalKey,
        ...song.tags,
        ...song.stanzas.flatMap((s) => s.lines)
      ].join(' ')
      return fuzzyMatchScore(targetText, q) >= 60
    })
  }, [app.songs, search])

  const selectedSong: Song | undefined =
    filteredSongs.find((s) => s.id === selectedSongId) ?? filteredSongs[0]

  const startNewSong = (): void => {
    setEditId(undefined)
    setTitle('')
    setAuthor('')
    setMusicalKey('G')
    setBpm('80')
    setTagsText('Adoración')
    setVerseOrder('')
    setChords('')
    setDefaultBgId('')
    setRawLyrics(DEFAULT_RAW_LYRICS)
    setEditing(true)
  }

  const startEditSong = (song: Song): void => {
    setEditId(song.id)
    setTitle(song.title)
    setAuthor(song.author)
    setMusicalKey(song.musicalKey)
    setBpm(song.bpm ? String(song.bpm) : '')
    setTagsText(song.tags.join(', '))
    setVerseOrder(song.verseOrder ?? '')
    setChords(song.chords ?? '')
    setDefaultBgId(song.defaultBackgroundId ?? '')
    const serialized = song.stanzas
      .map((st) => `[${st.label}]\n${st.lines.join('\n')}`)
      .join('\n\n')
    setRawLyrics(serialized)
    setEditing(true)
  }

  const handleCleanLyrics = (): void => {
    setRawLyrics((prev) => cleanInternetLyrics(prev))
  }

  const handleAutoSplitStanzas = (): void => {
    const parsed = parseRawLyricsToStanzas(rawLyrics)
    const split = autoSplitLongStanzas(parsed, 4)
    setRawLyrics(split.map((st) => `[${st.label}]\n${st.lines.join('\n')}`).join('\n\n'))
  }

  const handleTranspose = (semitones: number): void => {
    setMusicalKey((prev) => transposeChordText(prev, semitones))
    setChords((prev) => transposeChordText(prev, semitones))
  }

  const handleSaveSong = async (): Promise<void> => {
    const stanzas = parseRawLyricsToStanzas(rawLyrics)
    if (!title.trim() || stanzas.length === 0) return
    const parsedBpm = bpm.trim() ? Number(bpm) : null
    const tags = tagsText
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0)

    await app.upsertSong({
      ...(editId ? { id: editId } : {}),
      title: title.trim(),
      author: author.trim(),
      musicalKey: musicalKey.trim(),
      bpm: parsedBpm && Number.isFinite(parsedBpm) ? parsedBpm : null,
      tags,
      stanzas,
      ...(verseOrder.trim() ? { verseOrder: verseOrder.trim() } : {}),
      ...(chords.trim() ? { chords: chords.trim() } : {}),
      ...(defaultBgId.trim() ? { defaultBackgroundId: defaultBgId.trim() } : {})
    })
    setEditing(false)
  }

  const processFileList = async (fileList: FileList): Promise<void> => {
    const items: HolyricsImportItem[] = []
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i]
      if (!file) continue
      if (file.name.toLowerCase().endsWith('.mufl')) {
        const arrayBuf = await file.arrayBuffer()
        const bytes = new Uint8Array(arrayBuf)
        let binary = ''
        const chunkSize = 8192
        for (let j = 0; j < bytes.length; j += chunkSize) {
          const chunk = bytes.subarray(j, j + chunkSize)
          binary += String.fromCharCode.apply(null, Array.from(chunk))
        }
        const base64 = btoa(binary)
        items.push({ content: `base64:${base64}`, fileName: file.name })
      } else {
        const content = await file.text()
        items.push({ content, fileName: file.name })
      }
    }
    if (items.length > 0) {
      await app.importHolyricsCatalog(items)
    }
  }

  const handleHolyricsFilesSelected = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
    if (e.target.files && e.target.files.length > 0) {
      await processFileList(e.target.files)
    }
    e.target.value = ''
  }

  const handleDropFiles = async (e: DragEvent<HTMLElement>): Promise<void> => {
    e.preventDefault()
    if (e.dataTransfer.files.length > 0) {
      await processFileList(e.dataTransfer.files)
    }
  }

  const handleHolyricsPasteImport = async (): Promise<void> => {
    if (!holyricsRawPaste.trim()) return
    await app.importHolyricsCatalog([{ content: holyricsRawPaste }])
    setImportingModal(false)
  }

  const handleExportHolyricsJson = (): void => {
    const json = exportCatalogToHolyricsJson(app.songs)
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'catalogo-alabanzas-lumen.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleExportPrintableSongbook = (): void => {
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"/><title>Cancionero Lumen Worship</title>
    <style>body{font-family:Segoe UI,sans-serif;max-width:800px;margin:24px auto;color:#111}h1{border-bottom:2px solid #222;padding-bottom:8px}.song{margin-bottom:28px;page-break-inside:avoid}</style></head><body>
    <h1>Cancionero (${app.songs.length} alabanzas)</h1>
    ${app.songs
      .map(
        (s) =>
          `<div class="song"><h2>${s.title} <small>(${s.musicalKey || '—'}) - ${s.author || 'Tradicional'}</small></h2>` +
          s.stanzas.map((st) => `<p><strong>[${st.label}]</strong><br/>${st.lines.join('<br/>')}</p>`).join('') +
          `</div>`
      )
      .join('')}</body></html>`
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'cancionero-imprimible.html'
    link.click()
    URL.revokeObjectURL(url)
  }

  const live = app.status?.projection.live

  const projectSong = (song: Song, startIndex = 0, openWindow = false): void => {
    setSelectedSongId(song.id)
    if (song.defaultBackgroundId) {
      const assignedBg = app.media.find((m) => m.id === song.defaultBackgroundId)
      if (assignedBg) {
        void app.updateProjectionTheme({ background: assignedBg })
      }
    }
    void app.loadProjectionDeck({
      deckTitle: song.title,
      slides: songToSlides(song, includeTitleSlide),
      startIndex,
      ...(openWindow ? { openWindow: true } : {})
    })
    if (openWindow && !app.status?.projection.windowOpen) {
      void app.openProjection({ target: 'auto' })
    }
  }

  const addSongToSchedule = (song: Song): void => {
    void app.addScheduleItem({
      kind: 'song',
      title: song.title,
      subtitle: `${song.author || 'Autor desconocido'}${song.musicalKey ? ` · Tono ${song.musicalKey}` : ''}`,
      refId: song.id,
      slides: songToSlides(song, includeTitleSlide)
    })
  }

  return (
    <section
      className="page hly-page"
      aria-labelledby="page-title"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => void handleDropFiles(e)}
    >
      {/* Barra superior limpia de 1 sola fila */}
      <header className="hly-module-bar hly-module-bar--compact">
        <div className="hly-module-bar__left">
          <h1 id="page-title" className="hly-module-bar__title">
            Alabanzas
          </h1>
        </div>

        <div className="button-row" style={{ alignItems: 'center' }}>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".mufl,.json,.hly,.xml,.txt"
            style={{ display: 'none' }}
            aria-label="Archivos de catálogo de alabanzas"
            onChange={(e) => void handleHolyricsFilesSelected(e)}
          />
          <button
            type="button"
            className="hly-mini-btn"
            title="Importar base de datos .mufl o archivos de alabanzas"
            onClick={() => fileInputRef.current?.click()}
          >
            📥 Importar Catálogo (.mufl / .json)
          </button>
          <button type="button" className="hly-mini-btn" onClick={() => setImportingModal((v) => !v)}>
            📋 Pegar Catálogo / Letras
          </button>
          <button type="button" className="hly-mini-btn" onClick={handleExportHolyricsJson}>
            📤 Exportar Catálogo
          </button>
          <button type="button" className="hly-mini-btn" onClick={handleExportPrintableSongbook}>
            🖨 Cancionero HTML
          </button>
          <button type="button" className="hly-mini-btn hly-mini-btn--primary" onClick={startNewSong}>
            + Nueva alabanza
          </button>
        </div>
      </header>

      {importingModal && (
        <div className="card" data-testid="holyrics-import-modal">
          <h2 className="card__title">Importar catálogo o canciones</h2>
          <p className="hint" style={{ marginTop: 0, marginBottom: 10 }}>
            Pega aquí un archivo JSON de alabanzas, un XML OpenLyrics, o varias canciones en texto separadas
            por <code>===</code>:
          </p>
          <textarea
            rows={9}
            aria-label="Contenido de catálogo de alabanzas"
            value={holyricsRawPaste}
            onChange={(e) => setHolyricsRawPaste(e.target.value)}
          />
          <div className="button-row" style={{ marginTop: 10 }}>
            <button
              type="button"
              className="button button--primary"
              onClick={() => void handleHolyricsPasteImport()}
            >
              Importar al catálogo
            </button>
            <button type="button" className="button" onClick={() => setImportingModal(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {editing && (
        <div className="card" data-testid="song-editor">
          <div className="card__header-row">
            <h2 className="card__title" style={{ margin: 0 }}>
              {editId ? 'Editar alabanza' : 'Nueva alabanza'}
            </h2>
            <div className="button-row">
              <button type="button" className="hly-mini-btn" onClick={handleCleanLyrics}>
                ✨ Limpiar letra de Internet
              </button>
              <button type="button" className="hly-mini-btn" onClick={handleAutoSplitStanzas}>
                ✂ Dividir estrofas &gt;4 líneas
              </button>
              <button type="button" className="hly-mini-btn" onClick={() => handleTranspose(-1)}>
                ♭ -1 Semitono
              </button>
              <button type="button" className="hly-mini-btn" onClick={() => handleTranspose(1)}>
                ♯ +1 Semitono
              </button>
            </div>
          </div>

          <div className="form-grid">
            <label className="field">
              <span>Título</span>
              <input
                type="text"
                placeholder="Ej. Cuán Grande Es Él"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Autor / Intérprete</span>
              <input
                type="text"
                placeholder="Autor o ministerio"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Tonalidad</span>
              <input
                type="text"
                placeholder="G, D, Am..."
                value={musicalKey}
                onChange={(e) => setMusicalKey(e.target.value)}
              />
            </label>
            <label className="field">
              <span>BPM</span>
              <input
                type="number"
                min={30}
                max={260}
                value={bpm}
                onChange={(e) => setBpm(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Orden de ejecución (Verse Order)</span>
              <input
                type="text"
                placeholder="Ej. V1 C V2 C P C (opcional)"
                value={verseOrder}
                onChange={(e) => setVerseOrder(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Fondo predeterminado de la canción</span>
              <select value={defaultBgId} onChange={(e) => setDefaultBgId(e.target.value)}>
                <option value="">(Conservar fondo actual)</option>
                {app.media.map((bg) => (
                  <option key={bg.id} value={bg.id}>
                    {bg.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Acordes / Cifrado (para músicos)</span>
              <input
                type="text"
                placeholder="Ej. Intro: G D Em C | Coro: G D C"
                value={chords}
                onChange={(e) => setChords(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Etiquetas (separadas por coma)</span>
              <input
                type="text"
                value={tagsText}
                onChange={(e) => setTagsText(e.target.value)}
              />
            </label>
          </div>

          {/* Vista dividida estilo Editor de Holyrics: Letra a la izquierda | Previsualización de diapositivas a la derecha */}
          <div className="grid" style={{ marginTop: 10 }}>
            <label className="field">
              <span>Letra (separa estrofas con una línea en blanco o usa [Verso 1], [Coro])</span>
              <textarea
                rows={9}
                value={rawLyrics}
                onChange={(e) => setRawLyrics(e.target.value)}
              />
            </label>
            <div>
              <div className="label" style={{ marginBottom: 4 }}>
                Previsualización de diapositivas en tiempo real ({liveEditorStanzas.length})
              </div>
              <div className="hly-editor-preview-box">
                {liveEditorStanzas.map((st, idx) => (
                  <div key={st.id} className="hly-slide-row">
                    <span className="hly-slide-row__num">{String(idx + 1).padStart(2, '0')}</span>
                    <span className="hly-slide-row__tag">{st.label}</span>
                    <span className="hly-slide-row__text">{st.lines.join(' / ')}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="button-row" style={{ marginTop: 12 }}>
            <button type="button" className="button button--primary" onClick={() => void handleSaveSong()}>
              Guardar alabanza
            </button>
            <button type="button" className="button" onClick={() => setEditing(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Vista dividida a altura completa estilo Holyrics: [Lista de Alabanzas] | [Estrofas + Salto Rápido] */}
      <div className="hly-center-split">
        {/* COLUMNA IZQUIERDA: LISTA DE ALABANZAS LIMPIA */}
        <div className="hly-panel hly-panel--flex">
          <div className="hly-panel__header">
            <span className="hly-panel__title">♪ CATÁLOGO DE ALABANZAS ({filteredSongs.length})</span>
          </div>

          <div className="hly-SubToolbar">
            <input
              type="search"
              aria-label="Buscar alabanza"
              placeholder="Buscar alabanza por título, letra, coro o autor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="hly-grid-header hly-grid-header--songs" aria-hidden="true">
            <span>Título</span>
            <span>Autor / Artista</span>
            <span>Tono</span>
            <span>Acción</span>
          </div>

          <ul
            className="hly-scroll-area"
            aria-label="Lista de alabanzas"
            style={{ listStyle: 'none', margin: 0, padding: 0 }}
          >
            {filteredSongs.map((song) => {
              const active = song.id === selectedSong?.id
              const isLive = live?.deckTitle === song.title
              return (
                <li
                  key={song.id}
                  className={`hly-song-grid-row${active ? ' hly-song-grid-row--selected' : ''}${
                    isLive ? ' hly-song-grid-row--live' : ''
                  }`}
                  onDoubleClick={() => projectSong(song, 0, true)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setSelectedSongId(song.id)
                    setContextMenu({ song, x: e.clientX, y: e.clientY })
                  }}
                >
                  <button
                    type="button"
                    className="hly-song-grid-row__main item-row__select"
                    onClick={() => setSelectedSongId(song.id)}
                    onDoubleClick={(e) => {
                      e.stopPropagation()
                      projectSong(song, 0, true)
                    }}
                  >
                    <span className="hly-song-grid-row__title">{song.title}</span>
                    <span className="hly-song-grid-row__author">{song.author || 'Tradicional'}</span>
                    <span className="hly-song-grid-row__key">{song.musicalKey || '—'}</span>
                  </button>
                  <div className="hly-song-grid-row__actions">
                    <button
                      type="button"
                      className="hly-mini-btn hly-mini-btn--primary"
                      title="Proyectar alabanza ahora"
                      onClick={() => projectSong(song, 0, true)}
                    >
                      Proyectar
                    </button>
                    <button
                      type="button"
                      className="hly-mini-btn"
                      title="Añadir a la Lista del culto"
                      onClick={() => addSongToSchedule(song)}
                    >
                      + Programar
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>

        {/* COLUMNA DERECHA: ESTROFAS DE LA ALABANZA CON DOBLE CLIC Y SALTO POR FLECHAS */}
        <div className="hly-panel hly-panel--flex">
          {selectedSong ? (
            <>
              <div className="hly-panel__header">
                <div>
                  <span className="hly-panel__title">▣ {selectedSong.title.toUpperCase()}</span>
                  <div className="hly-panel__subtitle">
                    {selectedSong.author || 'Tradicional'} · Tono {selectedSong.musicalKey || '—'}
                    {selectedSong.bpm ? ` · ${selectedSong.bpm} BPM` : ''}
                    {selectedSong.chords ? ` · Acordes: ${selectedSong.chords}` : ''}
                  </div>
                </div>
                <div className="btn-row" style={{ alignItems: 'center' }}>
                  <button
                    type="button"
                    className={`hly-mini-btn${stanzaViewMode === 'table' ? ' hly-mini-btn--active' : ''}`}
                    onClick={() => setStanzaViewMode('table')}
                  >
                    ▤ Tabla
                  </button>
                  <button
                    type="button"
                    className={`hly-mini-btn${stanzaViewMode === 'grid' ? ' hly-mini-btn--active' : ''}`}
                    onClick={() => setStanzaViewMode('grid')}
                  >
                    ⊞ Tarjetas
                  </button>
                  <label className="field field--checkbox" style={{ margin: '0 4px' }}>
                    <input
                      type="checkbox"
                      checked={includeTitleSlide}
                      onChange={(e) => setIncludeTitleSlide(e.target.checked)}
                    />
                    <span>Portada</span>
                  </label>
                  <button
                    type="button"
                    className="hly-mini-btn"
                    onClick={() => startEditSong(selectedSong)}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="hly-mini-btn"
                    style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
                    onClick={() => {
                      setDeleteConfirm({
                        isOpen: true,
                        title: '¿Eliminar alabanza?',
                        itemName: selectedSong.title,
                        itemType: 'alabanza del repertorio',
                        onConfirm: () => {
                          void app.deleteSong(selectedSong.id)
                          setSelectedSongId(null)
                          setDeleteConfirm((prev) => ({ ...prev, isOpen: false }))
                        }
                      })
                    }}
                  >
                    Eliminar
                  </button>
                </div>
              </div>

              {/* Barra de salto directo a estrofa (1 clic previa · Doble clic activa proyección) */}
              <div
                className="hly-SubToolbar"
                style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}
                role="group"
                aria-label="Salto rápido a estrofas"
              >
                <span className="hly-mini-label" style={{ margin: '0 4px 0 0' }}>
                  Estrofas ({selectedSong.stanzas.length}):
                </span>
                {selectedSong.stanzas.map((st, idx) => {
                  const slideIdx = includeTitleSlide ? idx + 1 : idx
                  const isActiveStanza =
                    live?.deckTitle === selectedSong.title && live.currentIndex === slideIdx
                  return (
                    <button
                      key={st.id}
                      type="button"
                      title="1 clic: Previa · Doble clic: Activar proyección y enviar estrofa"
                      className={`chapter-chip${isActiveStanza ? ' chapter-chip--active' : ''}`}
                      onClick={() => projectSong(selectedSong, slideIdx, false)}
                      onDoubleClick={() => projectSong(selectedSong, slideIdx, true)}
                    >
                      {idx + 1} · {st.label}
                    </button>
                  )
                })}
              </div>

              {stanzaViewMode === 'table' ? (
                <>
                  <div className="hly-slide-table-header" aria-hidden="true">
                    <span>#</span>
                    <span>Etiqueta</span>
                    <span>Letra de la estrofa</span>
                  </div>
                  <div className="hly-scroll-area">
                    {selectedSong.stanzas.map((stanza, idx) => {
                      const slideIdx = includeTitleSlide ? idx + 1 : idx
                      const isActiveStanza =
                        live?.deckTitle === selectedSong.title && live.currentIndex === slideIdx
                      return (
                        <button
                          key={stanza.id}
                          type="button"
                          title="1 clic: Cargar en monitor · Doble clic: Activar proyección y enviar estrofa"
                          className={`hly-slide-row${isActiveStanza ? ' hly-slide-row--active' : ''}`}
                          onClick={() => projectSong(selectedSong, slideIdx, false)}
                          onDoubleClick={() => projectSong(selectedSong, slideIdx, true)}
                        >
                          <span className="hly-slide-row__num">{String(idx + 1).padStart(2, '0')}</span>
                          <span className={stanzaTagClass(stanza.label)}>{stanza.label}</span>
                          <span className="hly-slide-row__text">
                            {stanza.lines.map((line, lIdx) => (
                              <span key={lIdx} className="hly-slide-row__line">
                                {line}
                              </span>
                            ))}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </>
              ) : (
                <div className="hly-scroll-area" style={{ padding: 8 }}>
                  <div className="slide-grid">
                    {selectedSong.stanzas.map((stanza, idx) => {
                      const slideIdx = includeTitleSlide ? idx + 1 : idx
                      const isActiveStanza =
                        live?.deckTitle === selectedSong.title && live.currentIndex === slideIdx
                      return (
                        <button
                          key={stanza.id}
                          type="button"
                          className={`slide-tile${isActiveStanza ? ' slide-tile--active' : ''}`}
                          onClick={() => projectSong(selectedSong, slideIdx, false)}
                          onDoubleClick={() => projectSong(selectedSong, slideIdx, true)}
                        >
                          <div className="slide-tile__header">
                            <span className="slide-tile__label">{stanza.label}</span>
                            <span className="slide-tile__num">#{idx + 1}</span>
                          </div>
                          <div className="slide-tile__body">{stanza.lines.join('\n')}</div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="hly-empty-box" style={{ margin: 10 }}>
              Selecciona una alabanza para ver sus estrofas.
            </div>
          )}
        </div>
      </div>

      {/* Menú contextual al dar clic derecho sobre una alabanza */}
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
          <div className="hly-context-menu__header">
            {contextMenu.song.title}
          </div>
          <button
            type="button"
            className="hly-context-menu__item"
            onClick={() => {
              projectSong(contextMenu.song, 0, true)
              setContextMenu(null)
            }}
          >
            ▶ Proyectar alabanza en vivo
          </button>
          <button
            type="button"
            className="hly-context-menu__item"
            onClick={() => {
              addSongToSchedule(contextMenu.song)
              setContextMenu(null)
            }}
          >
            + Añadir a la Lista del culto
          </button>
          <button
            type="button"
            className="hly-context-menu__item"
            onClick={() => {
              startEditSong(contextMenu.song)
              setContextMenu(null)
            }}
          >
            ✎ Editar alabanza
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
                  if (selectedSongId === toDelete.id) setSelectedSongId(null)
                  setDeleteConfirm((prev) => ({ ...prev, isOpen: false }))
                }
              })
            }}
          >
            🗑 Eliminar alabanza
          </button>
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
