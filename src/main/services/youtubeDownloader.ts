import { spawn, type ChildProcess, execSync } from 'node:child_process'
import { createWriteStream, existsSync, mkdirSync, readdirSync, renameSync, unlinkSync } from 'node:fs'
import { basename, dirname, extname, join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { YoutubeDownloadRequest, YoutubeProgressPayload, YoutubeVideoInfo } from '../../shared/ipc'

/**
 * Extrae el ID de vídeo de 11 caracteres de cualquier URL válida de YouTube.
 * Admite: watch?v=, youtu.be/, shorts/, embed/, music.youtube.com, m.youtube.com.
 */
export function parseYoutubeId(url: string): string | null {
  if (!url || typeof url !== 'string') return null
  const trimmed = url.trim()

  // youtu.be/<id>
  const shortMatch = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|shorts\/))([\w-]{11})/i)
  if (shortMatch?.[1]) return shortMatch[1]

  // watch?v=<id> o ?v=<id>
  const watchMatch = trimmed.match(/[?&]v=([\w-]{11})/i)
  if (watchMatch?.[1]) return watchMatch[1]

  // Si pasaron directamente el ID de 11 caracteres
  if (/^[\w-]{11}$/.test(trimmed)) {
    return trimmed
  }

  return null
}

/**
 * Normaliza y sanea un nombre de archivo para evitar caracteres no válidos en Windows.
 */
export function sanitizeFilename(name: string): string {
  if (!name || typeof name !== 'string') return 'video_youtube'
  const cleaned = name
    .replace(/[<>:"/\\|?*]/g, '_')
    .split('')
    .filter((char) => char.charCodeAt(0) >= 32)
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '') // Windows no permite puntos ni espacios al final

  const withoutUnderscores = cleaned.replace(/^_+$/, '')
  return (withoutUnderscores ? cleaned.slice(0, 120) : '') || 'video_youtube'
}

/**
 * Obtiene información básica del vídeo (título, autor, miniatura) de forma ultrarrápida
 * mediante la API oEmbed pública de YouTube (sin requerir claves de API ni llamadas pesadas).
 */
export async function getYoutubeInfo(url: string): Promise<YoutubeVideoInfo> {
  const videoId = parseYoutubeId(url)
  if (!videoId) {
    throw new Error('La URL proporcionada no es un enlace válido de YouTube.')
  }

  const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`
  const oEmbedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(canonicalUrl)}&format=json`

  try {
    const res = await fetch(oEmbedUrl, { signal: AbortSignal.timeout(8000) })
    if (res.ok) {
      const data = (await res.json()) as { title?: string; author_name?: string; thumbnail_url?: string }
      return {
        id: videoId,
        url: canonicalUrl,
        title: data.title || `Vídeo de YouTube (${videoId})`,
        author: data.author_name || 'YouTube',
        thumbnailUrl: data.thumbnail_url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
      }
    }
  } catch (err) {
    console.warn('[youtubeDownloader] oEmbed falló o tardó demasiado, usando datos de reserva:', err)
  }

  // Fallback con miniatura de alta resolución estándar de YouTube
  return {
    id: videoId,
    url: canonicalUrl,
    title: `Vídeo de YouTube (${videoId})`,
    author: 'YouTube',
    thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
  }
}

/**
 * Localiza el ejecutable de yt-dlp en el sistema o lo descarga automáticamente
 * si es la primera vez que se utiliza en esta máquina.
 */
export async function ensureYtDlpBinary(
  userDataDir: string,
  onProgress?: (payload: { message: string; percent?: number }) => void
): Promise<string> {
  const isWin = process.platform === 'win32'
  const binName = isWin ? 'yt-dlp.exe' : 'yt-dlp'

  // 1. Verificar si ya fue descargado previamente en userData/bin
  const localBinPath = join(userDataDir, 'bin', binName)
  if (existsSync(localBinPath)) {
    return localBinPath
  }

  // 2. Verificar si está empaquetado en resourcesPath/bin
  try {
    const resourcesBin = join((process as unknown as { resourcesPath?: string }).resourcesPath || '', 'bin', binName)
    if (existsSync(resourcesBin)) {
      return resourcesBin
    }
  } catch {
    // ignore
  }

  // 3. Verificar si está en el PATH del sistema operativo
  try {
    const checkCmd = isWin ? `where.exe ${binName}` : `which ${binName}`
    const found = execSync(checkCmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'], timeout: 3000 }).trim()
    const firstPath = found.split(/\r?\n/)[0]?.trim()
    if (firstPath && existsSync(firstPath)) {
      return firstPath
    }
  } catch {
    // No está en PATH
  }

  // 4. Descargar el binario oficial standalone de GitHub Releases
  const binDir = join(userDataDir, 'bin')
  if (!existsSync(binDir)) {
    mkdirSync(binDir, { recursive: true })
  }

  const downloadUrl = isWin
    ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
    : process.platform === 'darwin'
      ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos'
      : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp'

  onProgress?.({ message: 'Descargando componente yt-dlp para descarga de vídeos...', percent: 0 })

  const tempFile = `${localBinPath}.download-${Date.now()}`
  const response = await fetch(downloadUrl, { redirect: 'follow' })
  if (!response.ok || !response.body) {
    throw new Error(`Fallo al descargar componente de YouTube (HTTP ${response.status})`)
  }

  const totalBytes = Number(response.headers.get('content-length') || 0)
  let receivedBytes = 0

  const fileStream = createWriteStream(tempFile)
  const nodeStream = Readable.fromWeb(response.body)

  nodeStream.on('data', (chunk: Buffer) => {
    receivedBytes += chunk.length
    if (totalBytes > 0 && onProgress) {
      const pct = Math.round((receivedBytes / totalBytes) * 100)
      onProgress({ message: `Descargando componente yt-dlp (${pct}%)...`, percent: pct })
    }
  })

  await pipeline(nodeStream, fileStream)

  // Asignar permisos ejecutables si no es Windows
  if (!isWin) {
    try {
      const { chmodSync } = await import('node:fs')
      chmodSync(tempFile, 0o755)
    } catch {
      // ignore
    }
  }

  // Renombrar a destino final
  if (existsSync(localBinPath)) {
    try {
      unlinkSync(localBinPath)
    } catch {
      // ignore
    }
  }
  renameSync(tempFile, localBinPath)

  return localBinPath
}

export class YoutubeDownloadManager {
  private activeProcess: ChildProcess | null = null
  private isCancelled = false

  /**
   * Descarga un vídeo de YouTube y lo guarda directamente en la carpeta de medios.
   */
  async download(options: {
    request: YoutubeDownloadRequest
    mediaDir: string
    userDataDir: string
    onProgress: (payload: YoutubeProgressPayload) => void
  }): Promise<{ filePath: string; title: string }> {
    const { request, mediaDir, userDataDir, onProgress } = options
    this.isCancelled = false

    const videoId = parseYoutubeId(request.url)
    if (!videoId) {
      throw new Error('La URL proporcionada no es un enlace válido de YouTube.')
    }
    const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`

    onProgress({
      url: canonicalUrl,
      percent: 0,
      status: 'initializing',
      message: 'Preparando descargador...'
    })

    // Asegurar binario de yt-dlp
    let binaryPath: string
    try {
      binaryPath = await ensureYtDlpBinary(userDataDir, (info) => {
        onProgress({
          url: canonicalUrl,
          percent: info.percent ?? 0,
          status: 'downloading-binary',
          message: info.message
        })
      })
    } catch (err) {
      throw new Error(`No se pudo inicializar el descargador: ${err instanceof Error ? err.message : String(err)}`, { cause: err })
    }

    if ((this.isCancelled as boolean)) {
      throw new Error('Descarga cancelada por el usuario.')
    }

    // Obtener información para el título si no fue provisto
    onProgress({
      url: canonicalUrl,
      percent: 5,
      status: 'fetching-info',
      message: 'Obteniendo información del vídeo...'
    })

    let finalTitle = request.customTitle?.trim()
    if (!finalTitle) {
      try {
        const info = await getYoutubeInfo(canonicalUrl)
        finalTitle = info.title
      } catch {
        finalTitle = `YouTube_${videoId}`
      }
    }

    if (!existsSync(mediaDir)) {
      mkdirSync(mediaDir, { recursive: true })
    }

    const safeBaseName = sanitizeFilename(finalTitle)
    let candidatePath = join(mediaDir, `${safeBaseName}.mp4`)
    if (existsSync(candidatePath)) {
      candidatePath = join(mediaDir, `${safeBaseName}_${Date.now().toString().slice(-4)}.mp4`)
    }

    // Configuración de argumentos de descarga
    // Selecciona MP4 estándar combinando video y audio, o el mejor MP4 pre-multiplexado
    const outputTemplate = join(dirname(candidatePath), `${basename(candidatePath, extname(candidatePath))}.%(ext)s`)
    const args = [
      '--no-playlist',
      '--no-warnings',
      '--newline',
      '--progress',
      '--no-check-certificates',
      '--remote-components',
      'ejs:github',
      '--js-runtimes',
      'node',
      '--extractor-args',
      'youtube:player_client=web_creator,mweb,android,ios',
      '-f',
      'bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/best',
      '--merge-output-format',
      'mp4',
      '-o',
      outputTemplate,
      canonicalUrl
    ]

    onProgress({
      url: canonicalUrl,
      percent: 10,
      status: 'downloading',
      message: 'Iniciando descarga del vídeo...'
    })

    return new Promise((resolve, reject) => {
      const child = spawn(binaryPath, args, {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
      })
      this.activeProcess = child

      let stderrBuffer = ''

      child.stdout.on('data', (data: Buffer) => {
        const text = data.toString()
        const lines = text.split(/\r?\n/)

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue

          // Formato típico de yt-dlp:
          // [download]  45.2% of  15.30MiB at  3.45MiB/s ETA 00:08
          // [download] 100% of 15.30MiB in 00:04
          const progressMatch = trimmed.match(
            /\[download\]\s+([\d.]+)%\s+of\s+~?([^\s]+)\s+at\s+([^\s]+)\s+ETA\s+([^\s]+)/i
          )
          if (progressMatch) {
            const rawPct = progressMatch[1] ? parseFloat(progressMatch[1]) : 0
            const pct = Math.min(99, Math.max(10, Math.round(rawPct)))
            const speed = progressMatch[3]
            const eta = progressMatch[4]
            const payload: YoutubeProgressPayload = {
              url: canonicalUrl,
              percent: pct,
              status: 'downloading',
              message: `Descargando: ${pct}%${speed ? ` · ${speed}` : ''}${eta ? ` · ETA: ${eta}` : ''}`,
              ...(speed ? { speed } : {}),
              ...(eta ? { eta } : {})
            }
            onProgress(payload)
            continue
          }

          if (trimmed.includes('[Merger]') || trimmed.includes('Merging formats')) {
            onProgress({
              url: canonicalUrl,
              percent: 95,
              status: 'processing',
              message: 'Empaquetando archivo de vídeo MP4...'
            })
            continue
          }

          if (trimmed.includes('[download] 100%')) {
            onProgress({
              url: canonicalUrl,
              percent: 98,
              status: 'processing',
              message: 'Finalizando archivo...'
            })
          }
        }
      })

      child.stderr.on('data', (data: Buffer) => {
        stderrBuffer += data.toString()
      })

      child.on('error', (err) => {
        this.activeProcess = null
        if (this.isCancelled) {
          reject(new Error('Descarga cancelada por el usuario.'))
        } else {
          reject(new Error(`Fallo al ejecutar descargador: ${err.message}`))
        }
      })

      child.on('close', (code) => {
        this.activeProcess = null

        if (this.isCancelled) {
          this.cleanPartialFiles(mediaDir, safeBaseName)
          onProgress({
            url: canonicalUrl,
            percent: 0,
            status: 'cancelled',
            message: 'Descarga cancelada.'
          })
          reject(new Error('Descarga cancelada por el usuario.'))
          return
        }

        if (code === 0) {
          // Localizar el archivo resultante en disco
          let finalPath = candidatePath
          if (!existsSync(finalPath)) {
            // yt-dlp puede haber usado otra extensión si no hubo ffmpeg
            const possibleBase = basename(candidatePath, extname(candidatePath))
            const files = readdirSync(mediaDir)
            const match = files.find((f) => f.startsWith(possibleBase) && !f.endsWith('.part') && !f.endsWith('.ytdl'))
            if (match) {
              finalPath = join(mediaDir, match)
            }
          }

          if (existsSync(finalPath)) {
            onProgress({
              url: canonicalUrl,
              percent: 100,
              status: 'completed',
              message: '¡Descarga completada con éxito!'
            })
            resolve({
              filePath: finalPath,
              title: finalTitle
            })
          } else {
            reject(new Error('El archivo descargado no se encontró en la carpeta de medios.'))
          }
        } else {
          this.cleanPartialFiles(mediaDir, safeBaseName)
          const rawError = stderrBuffer.trim()
          let friendlyError = rawError || `yt-dlp finalizó con código de error ${code}`
          if (/This video is unavailable|Video unavailable/i.test(rawError)) {
            friendlyError = 'Este vídeo no está disponible en YouTube (puede haber sido eliminado o ser privado).'
          } else if (/Sign in to confirm you are not a bot/i.test(rawError)) {
            friendlyError = 'YouTube bloqueó temporalmente la descarga de este enlace por verificación de bot.'
          } else if (/Private video/i.test(rawError)) {
            friendlyError = 'Este vídeo es privado en YouTube y no puede descargarse sin credenciales de la cuenta.'
          } else if (/Premieres in/i.test(rawError)) {
            friendlyError = 'Este vídeo es un estreno programado en YouTube y aún no se ha transmitido.'
          } else if (/HTTP Error 404/i.test(rawError)) {
            friendlyError = 'El vídeo no fue encontrado en YouTube (Error 404).'
          }
          onProgress({
            url: canonicalUrl,
            percent: 0,
            status: 'error',
            message: friendlyError
          })
          reject(new Error(friendlyError))
        }
      })
    })
  }

  /**
   * Cancela la descarga activa si existe.
   */
  cancel(): boolean {
    if (!this.activeProcess) {
      return false
    }

    this.isCancelled = true
    try {
      if (process.platform === 'win32' && this.activeProcess.pid) {
        // En Windows, matar el árbol de procesos completo para no dejar procesos huérfanos
        execSync(`taskkill /pid ${this.activeProcess.pid} /f /t`, { stdio: 'ignore' })
      } else {
        this.activeProcess.kill('SIGTERM')
      }
    } catch {
      try {
        this.activeProcess.kill('SIGKILL')
      } catch {
        // ignore
      }
    }

    this.activeProcess = null
    return true
  }

  private cleanPartialFiles(mediaDir: string, safeBaseName: string): void {
    try {
      if (existsSync(mediaDir)) {
        const files = readdirSync(mediaDir)
        for (const file of files) {
          if (file.startsWith(safeBaseName) && (file.endsWith('.part') || file.endsWith('.ytdl'))) {
            try {
              unlinkSync(join(mediaDir, file))
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

/** Instancia única compartida del gestor de descargas */
export const youtubeDownloadManager = new YoutubeDownloadManager()
