import { type CSSProperties, type ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import lumenLogo from '../assets/lumen.png'
import type { LiveProjectionState } from '../../../shared/ipc'
import { isVideoUrl, resolveMediaVideoUrl } from '../../../shared/slideHelpers'

const BARS = ['#c0c0c0', '#c0c000', '#00c0c0', '#00c000', '#c000c0', '#c00000', '#0000c0']

const FONT_MAP: Record<LiveProjectionState['theme']['fontFamily'], string> = {
  sans: "'Segoe UI', system-ui, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  mono: "'Cascadia Code', Consolas, monospace"
}

export interface MotionVideoBackgroundProps {
  value: string
  blurPx?: number | undefined
  playing?: boolean | undefined
  muted?: boolean | undefined
  loop?: boolean | undefined
  restartTrigger?: number | undefined
  seekTrigger?: number | undefined
  seekSeconds?: number | undefined
  fitMode?: 'cover' | 'contain' | 'fill' | undefined
}

/**
 * Renderiza un fondo de video en movimiento:
 * - Soporta los 4 videos animados predeterminados ("motion:aurora", "motion:particles", "motion:rays", "motion:nebula")
 *   a 60fps en lienzo HTML5 sin requerir internet.
 * - Soporta archivos de video locales (.mp4, .webm, data:video/...).
 */
export function MotionVideoBackground({
  value,
  blurPx = 0,
  playing = true,
  muted = true,
  loop = true,
  restartTrigger,
  seekTrigger,
  seekSeconds,
  fitMode = 'cover'
}: MotionVideoBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const isBuiltinMotion = value.startsWith('motion:')
  const videoSourceUrl = isBuiltinMotion ? '' : resolveMediaVideoUrl(value)

  const lastRestartRef = useRef<number | undefined>(restartTrigger)
  const lastSeekRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    const vid = videoRef.current
    if (!vid || isBuiltinMotion) return
    if (playing) {
      void vid.play().catch(() => {
        vid.muted = true
        void vid.play().catch(() => undefined)
      })
    } else {
      vid.pause()
    }
  }, [playing, videoSourceUrl, isBuiltinMotion])

  useEffect(() => {
    const vid = videoRef.current
    if (!vid || restartTrigger === undefined) return
    if (restartTrigger === lastRestartRef.current) return
    lastRestartRef.current = restartTrigger
    vid.currentTime = 0
    if (playing) {
      void vid.play().catch(() => {
        vid.muted = true
        void vid.play().catch(() => undefined)
      })
    }
  }, [restartTrigger, playing])

  useEffect(() => {
    const vid = videoRef.current
    if (!vid || seekTrigger === undefined || seekSeconds === undefined) return
    if (seekTrigger === lastSeekRef.current) return
    lastSeekRef.current = seekTrigger
    vid.currentTime = seekSeconds
  }, [seekTrigger, seekSeconds])

  useEffect(() => {
    if (!isBuiltinMotion) return
    if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)) return
    const canvas = canvasRef.current
    if (!canvas) return
    let ctx: CanvasRenderingContext2D | null = null
    try {
      ctx = canvas.getContext('2d')
    } catch {
      ctx = null
    }
    if (!ctx) return

    let animId = 0
    const start = performance.now()
    const variant = value.replace('motion:', '')

    const renderFrame = (now: number): void => {
      const t = (now - start) / 1000
      const w = canvas.width
      const h = canvas.height
      ctx.clearRect(0, 0, w, h)

      if (variant === 'aurora') {
        const bg = ctx.createLinearGradient(0, 0, w, h)
        bg.addColorStop(0, '#040b1a')
        bg.addColorStop(0.5, '#091e3a')
        bg.addColorStop(1, '#050c18')
        ctx.fillStyle = bg
        ctx.fillRect(0, 0, w, h)

        for (let i = 0; i < 4; i++) {
          ctx.beginPath()
          const yBase = h * (0.28 + i * 0.16)
          ctx.moveTo(0, h)
          for (let x = 0; x <= w; x += 12) {
            const y =
              yBase +
              Math.sin(x * 0.014 + t * (1.2 + i * 0.3) + i) * (h * 0.12) +
              Math.cos(x * 0.008 - t * 0.8) * (h * 0.06)
            ctx.lineTo(x, y)
          }
          ctx.lineTo(w, h)
          ctx.closePath()
          const waveGrad = ctx.createLinearGradient(0, yBase - h * 0.2, 0, h)
          const colors = [
            'rgba(56, 189, 248, 0.28)',
            'rgba(16, 185, 129, 0.24)',
            'rgba(99, 102, 241, 0.22)',
            'rgba(250, 204, 21, 0.16)'
          ]
          waveGrad.addColorStop(0, colors[i % colors.length] ?? 'rgba(56,189,248,0.25)')
          waveGrad.addColorStop(1, 'rgba(4, 11, 26, 0.02)')
          ctx.fillStyle = waveGrad
          ctx.fill()
        }
      } else if (variant === 'particles') {
        const bg = ctx.createRadialGradient(w * 0.5, h * 0.3, 10, w * 0.5, h * 0.5, w * 0.8)
        bg.addColorStop(0, '#2c1d0b')
        bg.addColorStop(0.55, '#120e1c')
        bg.addColorStop(1, '#06050a')
        ctx.fillStyle = bg
        ctx.fillRect(0, 0, w, h)

        for (let i = 0; i < 36; i++) {
          const seed = i * 17.37
          const px = ((seed * 43.1 + Math.sin(t * 0.7 + i) * 28) % w + w) % w
          const py = ((h - ((t * (18 + (i % 7) * 5) + seed * 29) % (h + 40))) + h + 20) % (h + 20) - 10
          const radius = 2 + (i % 5) * 1.8
          const alpha = 0.25 + 0.45 * Math.abs(Math.sin(t * 1.5 + i))
          const glow = ctx.createRadialGradient(px, py, 0, px, py, radius * 3.2)
          glow.addColorStop(0, `rgba(253, 224, 71, ${alpha.toFixed(2)})`)
          glow.addColorStop(0.5, `rgba(245, 158, 11, ${(alpha * 0.5).toFixed(2)})`)
          glow.addColorStop(1, 'rgba(245, 158, 11, 0)')
          ctx.fillStyle = glow
          ctx.beginPath()
          ctx.arc(px, py, radius * 3.2, 0, Math.PI * 2)
          ctx.fill()
        }
      } else if (variant === 'rays') {
        const bg = ctx.createLinearGradient(0, 0, 0, h)
        bg.addColorStop(0, '#0f2447')
        bg.addColorStop(0.6, '#081226')
        bg.addColorStop(1, '#030712')
        ctx.fillStyle = bg
        ctx.fillRect(0, 0, w, h)

        for (let i = 0; i < 7; i++) {
          const swing = Math.sin(t * 0.65 + i * 1.1) * (w * 0.14)
          const topX = w * (0.15 + i * 0.12)
          const botX = topX + swing + (i - 3) * (w * 0.08)
          const rayGrad = ctx.createLinearGradient(topX, 0, botX, h)
          rayGrad.addColorStop(0, 'rgba(147, 197, 253, 0.26)')
          rayGrad.addColorStop(0.65, 'rgba(59, 130, 246, 0.09)')
          rayGrad.addColorStop(1, 'rgba(59, 130, 246, 0)')
          ctx.fillStyle = rayGrad
          ctx.beginPath()
          ctx.moveTo(topX - w * 0.04, 0)
          ctx.lineTo(topX + w * 0.04, 0)
          ctx.lineTo(botX + w * 0.14, h)
          ctx.lineTo(botX - w * 0.14, h)
          ctx.closePath()
          ctx.fill()
        }
      } else {
        // nebula
        const bg = ctx.createLinearGradient(0, 0, w, h)
        bg.addColorStop(0, '#170b2c')
        bg.addColorStop(0.5, '#0f172a')
        bg.addColorStop(1, '#070510')
        ctx.fillStyle = bg
        ctx.fillRect(0, 0, w, h)

        const orbs = [
          { color: '192, 132, 252', speed: 0.7, r: 0.48 },
          { color: '56, 189, 248', speed: -0.55, r: 0.42 },
          { color: '244, 114, 182', speed: 0.45, r: 0.38 }
        ]
        orbs.forEach((orb, idx) => {
          const cx = w * (0.5 + 0.28 * Math.cos(t * orb.speed + idx * 2.1))
          const cy = h * (0.5 + 0.24 * Math.sin(t * (orb.speed * 1.2) + idx * 1.7))
          const rad = Math.max(w, h) * orb.r
          const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad)
          g.addColorStop(0, `rgba(${orb.color}, 0.34)`)
          g.addColorStop(0.5, `rgba(${orb.color}, 0.12)`)
          g.addColorStop(1, `rgba(${orb.color}, 0)`)
          ctx.fillStyle = g
          ctx.fillRect(0, 0, w, h)
        })
      }

      animId = window.requestAnimationFrame(renderFrame)
    }

    animId = window.requestAnimationFrame(renderFrame)
    return () => window.cancelAnimationFrame(animId)
  }, [isBuiltinMotion, value])

  if (isBuiltinMotion) {
    return (
      <canvas
        ref={canvasRef}
        width={960}
        height={540}
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: fitMode,
          filter: blurPx > 0 ? `blur(${blurPx}px)` : undefined,
          zIndex: 0,
          pointerEvents: 'none'
        }}
      />
    )
  }

  return (
    <video
      ref={videoRef}
      key={videoSourceUrl}
      src={videoSourceUrl}
      autoPlay={playing}
      loop={loop}
      muted={muted}
      playsInline
      preload="auto"
      onCanPlay={(e) => {
        if (playing) {
          const v = e.currentTarget
          void v.play().catch(() => {
            v.muted = true
            void v.play().catch(() => undefined)
          })
        }
      }}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: fitMode,
        filter: blurPx > 0 ? `blur(${blurPx}px)` : undefined,
        zIndex: 0,
        pointerEvents: 'none'
      }}
    />
  )
}

export interface SlidePreviewStageProps {
  live: LiveProjectionState
  clock?: string
  displayCount?: number
  compact?: boolean
  windowOpen?: boolean | undefined
  onVideoProgress?: ((currentTime: number, duration: number) => void) | undefined
}

export interface HolyricsFontFitOptions {
  lines: readonly string[]
  isUppercase: boolean
  hasHeader: boolean
  userScalePct?: number
}

export interface HolyricsFontFitResult {
  vw: number
  compactPx: number
  maxLineVh: number
  estimatedLines: number
}

/**
 * Motor de Auto-Ajuste de Texto Holyrics:
 * Maximiza de forma inteligente el tamaño de fuente para llenar el área útil
 * de la pantalla de proyección, logrando que el texto sea lo más grande y nítido
 * posible (legible desde el fondo de la iglesia), pero adaptando la escala
 * dinámicamente según la longitud del versículo o estrofa para que jamás se corte.
 */
export function computeHolyricsOptimalFontSize(options: HolyricsFontFitOptions): HolyricsFontFitResult {
  const { lines, isUppercase, hasHeader, userScalePct = 100 } = options
  const userMultiplier = Math.max(0.6, Math.min(2.0, userScalePct / 100))

  const fullText = lines.join(' ').trim()
  const totalChars = fullText.length
  const rawLineCount = lines.length

  if (totalChars === 0) {
    return { vw: 5.5, compactPx: 16, maxLineVh: 25, estimatedLines: 1 }
  }

  // En mayúsculas las palabras ocupan ~16% más de ancho promedio
  const charRatio = isUppercase ? 0.58 : 0.50

  // Dimensiones útiles de proyección en pantalla panorámica 16:9:
  // Ancho útil: 92vw (dejando 4% de margen a cada lado)
  // Alto útil: 78vh si tiene cabecera de cita bíblica / reloj, 84vh si no tiene cabecera
  // En 16:9, 1vh = 0.5625vw (alto total = 56.25vw)
  const availVw = 92
  const availVh = hasHeader ? 78 : 84
  const availVhInVw = availVh * 0.5625

  // Evaluamos de 1 a 8 renglones de ajuste (k) para encontrar el mayor tamaño de fuente posible
  let bestVw = 2.4
  const minK = Math.max(1, rawLineCount)
  const maxK = Math.max(minK, 8)

  for (let k = minK; k <= maxK; k++) {
    const maxLineChars = rawLineCount > 1
      ? Math.max(...lines.map((l) => l.trim().length), Math.ceil(totalChars / k))
      : Math.ceil(totalChars / k)

    const maxVwHorizontal = availVw / (Math.max(1, maxLineChars) * charRatio)
    const maxVwVertical = availVhInVw / (k * 1.20)
    const safeVw = Math.min(maxVwHorizontal, maxVwVertical)

    if (safeVw > bestVw) {
      bestVw = safeVw
    }
  }

  // Techo y piso estéticos para proyección:
  // Entre 2.4vw (textos ultra largos de 350+ caracteres) y 7.8vw (versos cortos / estrofas de alabanza)
  const clampedBaseVw = Math.max(2.4, Math.min(7.8, bestVw))
  const finalVw = clampedBaseVw * userMultiplier

  const estimatedLines = Math.max(
    rawLineCount,
    Math.ceil(totalChars / Math.max(12, availVw / (finalVw * charRatio)))
  )
  const maxLineVh = Math.max(4.0, availVh / (Math.max(1, estimatedLines) * 1.18))

  // En monitor compacto (vista previa en el LiveDock de cabina):
  const compactPx = Math.max(9, Math.min(24, Math.round((finalVw / 5.5) * 16)))

  return {
    vw: finalVw,
    compactPx,
    maxLineVh,
    estimatedLines
  }
}

function renderHighlightedLine(text: string, highlightWord?: string): ReactNode {
  const kw = (highlightWord ?? '').trim()
  if (!kw) return text
  const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'))
  return parts.map((part, idx) =>
    part.toLowerCase() === kw.toLowerCase() ? (
      <mark
        key={idx}
        style={{
          background: 'rgba(250, 204, 21, 0.35)',
          color: '#fde047',
          padding: '0 0.16em',
          borderRadius: 4
        }}
      >
        {part}
      </mark>
    ) : (
      part
    )
  )
}

/**
 * Lienzo de renderizado compartido entre la ventana de proyección real y el
 * monitor de vista previa en la ventana principal.
 * Soporta todos los modos avanzados de Holyrics: Freeze, Stage Monitor, Lower-Thirds,
 * Croma, Marquesina de Alerta, Cuenta Regresiva, Bilingüe Paralelo y Filtros de Fondo.
 */
export function SlidePreviewStage({
  live,
  clock,
  displayCount,
  compact = false,
  windowOpen = false,
  onVideoProgress
}: SlidePreviewStageProps) {
  const { mode, slides, currentIndex, theme, churchName, welcomeSubtitle, showClockOnLogo } = live
  const currentSlide = slides[currentIndex] ?? slides[0]
  const nextSlide = slides[currentIndex + 1]

  const [countdownText, setCountdownText] = useState<string | null>(null)
  const [localClock, setLocalClock] = useState<string>(() =>
    new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  )

  useEffect(() => {
    const timer = setInterval(() => {
      setLocalClock(
        new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      )
      if (live.theme.countdownEndIso) {
        const diffMs = new Date(live.theme.countdownEndIso).getTime() - Date.now()
        if (diffMs <= 0) {
          setCountdownText('00:00')
        } else {
          const totalSec = Math.ceil(diffMs / 1000)
          const mins = String(Math.floor(totalSec / 60)).padStart(2, '0')
          const secs = String(totalSec % 60).padStart(2, '0')
          setCountdownText(`${mins}:${secs}`)
        }
      } else {
        setCountdownText(null)
      }
    }, 500)
    return () => clearInterval(timer)
  }, [live.theme.countdownEndIso])

  const activeClock = clock ?? localClock
  const slideVideoRef = useRef<HTMLVideoElement | null>(null)
  const isSlideVideo = Boolean(currentSlide?.imageUrl && isVideoUrl(currentSlide.imageUrl))
  const slideVideoSrc = isSlideVideo && currentSlide?.imageUrl ? resolveMediaVideoUrl(currentSlide.imageUrl) : ''

  const lastSlideRestartRef = useRef<number | undefined>(theme.videoRestartTime)
  const lastSlideSeekRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    const vid = slideVideoRef.current
    if (!vid || !isSlideVideo) return
    if (theme.videoPlaying === false) {
      vid.pause()
    } else {
      void vid.play().catch(() => {
        vid.muted = true
        void vid.play().catch(() => undefined)
      })
    }
  }, [theme.videoPlaying, isSlideVideo, slideVideoSrc])

  useEffect(() => {
    const vid = slideVideoRef.current
    if (!vid || theme.videoRestartTime === undefined) return
    if (theme.videoRestartTime === lastSlideRestartRef.current) return
    lastSlideRestartRef.current = theme.videoRestartTime
    vid.currentTime = 0
    if (theme.videoPlaying !== false) {
      void vid.play().catch(() => {
        vid.muted = true
        void vid.play().catch(() => undefined)
      })
    }
  }, [theme.videoRestartTime, theme.videoPlaying])

  useEffect(() => {
    const vid = slideVideoRef.current
    if (!vid || theme.videoSeekTrigger === undefined || theme.videoSeekSeconds === undefined) return
    if (theme.videoSeekTrigger === lastSlideSeekRef.current) return
    lastSlideSeekRef.current = theme.videoSeekTrigger
    vid.currentTime = theme.videoSeekSeconds
  }, [theme.videoSeekTrigger, theme.videoSeekSeconds])

  const rawLines = currentSlide?.lines ?? []
  const isBible = currentSlide?.sourceKind === 'bible'
  const hasExtraHeader = isBible || Boolean(live.theme.countdownEndIso)
  const isUppercase = Boolean(theme.uppercase)
  const userScalePct = theme.fontScale ?? 100
  const isAutoFit = theme.autoFit !== false

  // Cálculo analítico óptimo inicial / fallback para SSR y JSDOM
  const optimalFont = useMemo(() => {
    return computeHolyricsOptimalFontSize({
      lines: rawLines,
      isUppercase,
      hasHeader: hasExtraHeader,
      userScalePct
    })
  }, [rawLines, isUppercase, hasExtraHeader, userScalePct])

  const isExtraLong = optimalFont.estimatedLines >= 5
  const paddingPct = isExtraLong ? 3.5 : (theme.paddingPct ?? 4.5)

  const stageRef = useRef<HTMLDivElement | null>(null)
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const [measuredFontSizePx, setMeasuredFontSizePx] = useState<number | null>(null)
  const [resizeTick, setResizeTick] = useState(0)

  // Observador de cambio de tamaño de ventana / resolución / monitor de proyección
  // y re-adjunte cuando cambia el modo (de logo/clear/black/imagen a texto en vivo)
  useEffect(() => {
    const stage = stageRef.current
    const onWinResize = (): void => setResizeTick((t) => t + 1)
    window.addEventListener('resize', onWinResize)
    if (!stage || typeof ResizeObserver === 'undefined') {
      return () => window.removeEventListener('resize', onWinResize)
    }
    const ro = new ResizeObserver(() => {
      setResizeTick((t) => t + 1)
    })
    ro.observe(stage)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', onWinResize)
    }
  }, [mode, currentSlide?.imageUrl, live.theme.stageViewMode])

  // Motor Inteligente de Auto Fit de Texto con Medición Real en el DOM:
  // Mide directamente el renderizado en pantalla para encontrar el MAYOR TAMAÑO DE FUENTE POSIBLE
  // que aproveche al máximo el espacio disponible (alto y ancho), sin cortar palabras ni desbordar líneas.
  useLayoutEffect(() => {
    if (!isAutoFit) {
      setMeasuredFontSizePx(null)
      return
    }

    const stage = stageRef.current
    const body = bodyRef.current
    if (!stage || !body) return

    const stageRect = stage.getBoundingClientRect()
    const stageW = stageRect.width
    const stageH = stageRect.height
    if (stageW <= 30 || stageH <= 30) return

    // Obtener padding real computado del escenario
    let padTop = 0
    let padBottom = 0
    let padLeft = 0
    let padRight = 0
    try {
      const stageStyle = window.getComputedStyle(stage)
      padTop = parseFloat(stageStyle.paddingTop) || 0
      padBottom = parseFloat(stageStyle.paddingBottom) || 0
      padLeft = parseFloat(stageStyle.paddingLeft) || 0
      padRight = parseFloat(stageStyle.paddingRight) || 0
    } catch {
      const fallbackPadX = (paddingPct / 100) * stageW
      const fallbackPadY = ((paddingPct * 0.85) / 100) * stageH
      padTop = fallbackPadY
      padBottom = fallbackPadY
      padLeft = fallbackPadX
      padRight = fallbackPadX
    }

    // Cinta de alerta flotante si está activa
    const tickerEl = stage.querySelector('.slide-stage__ticker') as HTMLElement | null
    const tickerH = tickerEl ? tickerEl.offsetHeight + (compact ? 2 : 10) : 0

    // Alto y ancho útiles reales para el contenedor de texto (con 97% de margen de seguridad vertical)
    const maxAvailH = Math.max(20, (stageH - padTop - padBottom - tickerH) * 0.97)
    const maxAvailW = Math.max(20, stageW - padLeft - padRight)

    // Rango de búsqueda proporcional a la altura real del escenario (idéntico en vista previa y proyección)
    let low = Math.max(7, Math.floor(stageH * 0.022))
    let high = Math.max(low + 4, Math.floor(stageH * 0.24))
    let best = low

    // Guardar estilos originales antes de medir
    const origMaxHeight = body.style.maxHeight
    const origOverflow = body.style.overflow
    const origJustifyContent = body.style.justifyContent
    const origAlignItems = body.style.alignItems
    const origTextAlign = body.style.textAlign
    const origTextShadow = body.style.textShadow
    const origFlexShrink = body.style.flexShrink

    const headerEl = body.querySelector('.slide-stage__bible-header') as HTMLElement | null
    const origHeaderShadow = headerEl ? headerEl.style.textShadow : ''

    // Preparar contenedor para medición pura de flujo (top-left origin (0,0), sin blur de text-shadow
    // que infla scrollWidth en Chromium, y sin centrado flexbox que oculta desborde hacia coordenadas negativas)
    body.style.maxHeight = 'none'
    body.style.flexShrink = '0'
    body.style.justifyContent = 'flex-start'
    body.style.alignItems = 'flex-start'
    body.style.textAlign = 'left'
    body.style.textShadow = 'none'
    body.style.overflow = 'hidden'
    if (headerEl) headerEl.style.textShadow = 'none'

    for (let step = 0; step < 10; step++) {
      const mid = Math.floor((low + high) / 2)
      body.style.fontSize = `${mid}px`

      const contentH = Math.max(body.scrollHeight, body.offsetHeight)
      const contentW = body.scrollWidth
      const boxW = body.clientWidth || maxAvailW

      // Con justify-content: flex-start, align-items: flex-start y text-shadow: none:
      // - contentH mide el alto exacto de todas las líneas envueltas + encabezados.
      // - contentW > boxW + 2 detecta únicamente si una palabra individual es más ancha que el contenedor.
      const fitsHeight = contentH <= maxAvailH
      const fitsWidth = contentW <= boxW + 2

      if (fitsHeight && fitsWidth) {
        best = mid
        low = mid + 1 // Cabe completo sin cortar palabras ni líneas, probamos un tamaño mayor
      } else {
        high = mid - 1 // Desborda en alto o ancho, reducimos
      }
    }

    // Si el usuario aplicó un multiplicador en el slider manual
    // En modo Auto Fit (isAutoFit = true), el tamaño óptimo 'best' YA es el tamaño máximo perfecto medido en el DOM.
    // Solo permitimos que el slider escale hacia arriba o hacia abajo si NO está en modo Auto-Fit automático puro.
    const userMult = (theme.fontScale ?? 100) / 100
    const minAllowedPx = Math.max(7, Math.floor(stageH * 0.02))
    const targetPx = (userMult !== 1 && !isAutoFit) ? Math.max(minAllowedPx, Math.round(best * userMult)) : best

    // Restaurar todos los estilos visuales y aplicar el tamaño óptimo medido
    if (headerEl) headerEl.style.textShadow = origHeaderShadow
    body.style.maxHeight = origMaxHeight
    body.style.flexShrink = origFlexShrink
    body.style.justifyContent = origJustifyContent
    body.style.alignItems = origAlignItems
    body.style.textAlign = origTextAlign
    body.style.textShadow = origTextShadow
    body.style.overflow = origOverflow
    body.style.fontSize = `${targetPx}px`

    setMeasuredFontSizePx((prev) => (prev === targetPx ? prev : targetPx))
  }, [
    currentSlide?.id,
    currentSlide?.lines?.join('\n'),
    currentSlide?.sourceKind,
    currentSlide?.sourceTitle,
    theme.fontFamily,
    theme.uppercase,
    theme.fontScale,
    theme.autoFit,
    theme.paddingPct,
    paddingPct,
    live.theme.tickerActive,
    live.theme.tickerText,
    live.theme.lowerThirds,
    live.theme.textBoxBg,
    live.theme.countdownEndIso,
    mode,
    compact,
    isAutoFit,
    resizeTick
  ])

  if (mode === 'test-pattern') {
    return (
      <div className="projection" data-testid="projection-test-pattern">
        <div className="projection__bars" aria-hidden="true">
          {BARS.map((color) => (
            <span key={color} style={{ background: color }} />
          ))}
        </div>
        <div className="projection__center">
          <img src={lumenLogo} alt="Lumen Studio" style={{ width: 48, height: 48, objectFit: 'contain', marginBottom: 8 }} />
          <div className="projection__badge">LUMEN STUDIO</div>
          <h1 className="projection__title">{churchName}</h1>
          <p className="projection__subtitle">Ventana de proyección — pantalla de prueba</p>
          {activeClock && <p className="projection__clock">{activeClock}</p>}
          {displayCount !== undefined && (
            <p className="projection__meta">Monitores detectados: {displayCount}</p>
          )}
        </div>
        <div className="projection__footer">Patrón de calibración activo · Pulsa Esc para cerrar</div>
      </div>
    )
  }

  if (mode === 'black') {
    return (
      <div
        className="slide-stage slide-stage--black"
        data-testid="projection-stage-black"
        style={{ background: '#000000' }}
      >
        {compact && <span className="slide-stage__badge">PANTALLA NEGRA</span>}
      </div>
    )
  }

  // Modo Vista de Escenario / Retorno para púlpito y músicos (Mejora 32)
  if (live.theme.stageViewMode && mode === 'live') {
    return (
      <div
        className="slide-stage"
        data-testid="projection-stage-live"
        style={{
          background: '#09090b',
          padding: compact ? '4%' : '3%',
          justifyContent: 'space-between',
          alignItems: 'stretch'
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid #27272a',
            paddingBottom: compact ? 4 : 10,
            fontSize: compact ? 11 : 'clamp(16px, 2.2vw, 32px)',
            fontWeight: 800,
            color: '#a1a1aa'
          }}
        >
          <span>RETORNO · {currentSlide?.sourceTitle ?? churchName}</span>
          <span style={{ color: '#22c55e', fontVariantNumeric: 'tabular-nums' }}>{activeClock}</span>
        </div>

        {live.theme.stageMessage && (
          <div
            style={{
              background: '#7f1d1d',
              color: '#fecaca',
              padding: compact ? '3px 8px' : '8px 16px',
              borderRadius: 6,
              fontWeight: 800,
              textAlign: 'center',
              fontSize: compact ? 10.5 : 'clamp(15px, 2vw, 28px)'
            }}
          >
            ⚠ MENSAJE DE CABINA: {live.theme.stageMessage}
          </div>
        )}

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '0.25em' }}>
          <div style={{ fontSize: compact ? 9.5 : 14, color: '#22c55e', fontWeight: 800 }}>
            ACTUAL ({currentIndex + 1}/{slides.length} · {currentSlide?.label ?? '—'})
          </div>
          {currentSlide?.lines.map((line, idx) => (
            <p
              key={idx}
              className="slide-stage__line"
              style={{
                fontSize: compact ? 13 : 'clamp(22px, 3.8vw, 64px)',
                color: '#ffffff',
                textAlign: 'left'
              }}
            >
              {line}
            </p>
          ))}
        </div>

        <div
          style={{
            borderTop: '1px solid #27272a',
            paddingTop: compact ? 4 : 10,
            color: '#facc15',
            opacity: 0.9
          }}
        >
          <div style={{ fontSize: compact ? 9 : 13, fontWeight: 800, textTransform: 'uppercase' }}>
            SIGUIENTE: {nextSlide ? nextSlide.label : 'Fin del elemento'}
          </div>
          <div style={{ fontSize: compact ? 10.5 : 'clamp(15px, 2.2vw, 34px)', fontWeight: 600 }}>
            {nextSlide ? nextSlide.lines.slice(0, 2).join(' / ') : '—'}
          </div>
        </div>
      </div>
    )
  }

  const dimmerAlpha = Math.max(0, Math.min(0.88, (theme.bgDimmer ?? 0) / 100))
  const bgStyle: CSSProperties = live.theme.chromaKey
    ? { background: '#00ff00' }
    : theme.background.kind === 'image'
      ? {
          backgroundImage: `linear-gradient(rgba(0,0,0,${(0.45 + dimmerAlpha * 0.5).toFixed(2)}), rgba(0,0,0,${(0.55 + dimmerAlpha * 0.4).toFixed(2)})), url(${theme.background.value})`,
          backgroundSize: theme.mediaFit === 'contain' ? 'contain' : '100% 100%',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center'
        }
      : {
          background: theme.background.value
        }

  const justifyMap: Record<'top' | 'center' | 'bottom', CSSProperties['justifyContent']> = {
    top: 'flex-start',
    center: 'center',
    bottom: 'flex-end'
  }
  const verticalJustify = live.theme.lowerThirds
    ? 'flex-end'
    : justifyMap[theme.verticalAlign ?? 'center']

  let effectiveFontSize: string
  if (!isAutoFit) {
    // Modo Manual (Auto-Fit desactivado): el slider manual (60%-200%) controla el tamaño
    // usando la base tipográfica óptima como referencia de escala
    const manualMult = (theme.fontScale ?? 100) / 100
    effectiveFontSize = compact
      ? `${Math.max(8, Math.round(optimalFont.compactPx * manualMult))}px`
      : `min(${(optimalFont.vw * manualMult).toFixed(2)}vw, ${(optimalFont.maxLineVh * manualMult).toFixed(2)}vh)`
  } else if (measuredFontSizePx !== null) {
    // Modo Auto-Fit: tamaño exacto medido en el DOM
    effectiveFontSize = `${measuredFontSizePx}px`
  } else {
    // Fallback inicial / JSDOM:
    effectiveFontSize = compact
      ? `${optimalFont.compactPx}px`
      : `min(${optimalFont.vw.toFixed(2)}vw, ${optimalFont.maxLineVh.toFixed(2)}vh)`
  }

  const textStyle: CSSProperties = {
    fontFamily: FONT_MAP[theme.fontFamily],
    fontWeight: 700,
    textAlign: theme.textAlign,
    textTransform: theme.uppercase ? 'uppercase' : 'none',
    textShadow: theme.textStroke
      ? '-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 0 4px 16px rgba(0,0,0,0.9)'
      : theme.textShadow
        ? '0 3px 16px rgba(0, 0, 0, 0.85)'
        : 'none',
    fontSize: effectiveFontSize,
    lineHeight: 1.2,
    justifyContent: verticalJustify,
    maxHeight: '100%',
    overflow: 'hidden',
    boxSizing: 'border-box',
    transition: `opacity ${theme.transitionMs ?? 180}ms ease`
  }

  const isVideoBg = theme.background.kind === 'video' && !live.theme.chromaKey
  const safeBgStyle: CSSProperties = isVideoBg ? { background: '#050814' } : bgStyle

  if (mode === 'clear') {
    return (
      <div className="slide-stage" data-testid="projection-stage-clear" style={safeBgStyle}>
        {isVideoBg && (
          <MotionVideoBackground
            value={theme.background.value}
            blurPx={theme.bgBlur ?? 0}
            playing={theme.videoPlaying !== false}
            muted={theme.videoMuted ?? true}
            loop={theme.videoLoop !== false}
            restartTrigger={theme.videoRestartTime}
            seekTrigger={theme.videoSeekTrigger}
            seekSeconds={theme.videoSeekSeconds}
          />
        )}
        {compact && (
          <span className="slide-stage__badge" style={{ position: 'relative', zIndex: 2 }}>
            TEXTO OCULTO
          </span>
        )}
      </div>
    )
  }

  if (mode === 'logo') {
    return (
      <div className="slide-stage slide-stage--logo" data-testid="projection-stage-logo" style={safeBgStyle}>
        {isVideoBg && (
          <MotionVideoBackground
            value={theme.background.value}
            blurPx={theme.bgBlur ?? 0}
            playing={theme.videoPlaying !== false}
            muted={theme.videoMuted ?? true}
            loop={theme.videoLoop !== false}
            restartTrigger={theme.videoRestartTime}
            seekTrigger={theme.videoSeekTrigger}
            seekSeconds={theme.videoSeekSeconds}
          />
        )}
        <div className="slide-stage__logo-box" style={{ position: 'relative', zIndex: 2 }}>
          <img
            src={lumenLogo}
            alt={churchName}
            style={{ maxHeight: 110, width: 'auto', objectFit: 'contain', marginBottom: 14 }}
          />
          <h2 className="slide-stage__logo-title">{churchName}</h2>
          {welcomeSubtitle && <p className="slide-stage__logo-subtitle">{welcomeSubtitle}</p>}
          {showClockOnLogo && activeClock && <p className="slide-stage__logo-clock">{activeClock}</p>}
        </div>
      </div>
    )
  }

  // Si la diapositiva activa es una Imagen o Vídeo del Culto a pantalla completa
  if (currentSlide?.imageUrl) {
    // Modo de ajuste:
    // - 'contain' (predeterminado): La imagen o vídeo se acomoda al 100% visible dentro de la pantalla,
    //   respetando su proporción original.
    // - 'fill' / 'cover': Estira el medio al ancho completo de la pantalla respetando el 100% del alto,
    //   garantizando que ninguna parte quede fuera del área de proyección visible.
    const isFill = theme.mediaFit === 'fill' || theme.mediaFit === 'cover'
    const fitMode: CSSProperties['objectFit'] = isFill ? 'fill' : 'contain'

    if (currentSlide.imageUrl.startsWith('motion:')) {
      return (
        <div
          className="slide-stage"
          data-testid="projection-stage-live"
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            background: '#000',
            padding: 0,
            margin: 0,
            overflow: 'hidden'
          }}
        >
          <MotionVideoBackground
            value={currentSlide.imageUrl}
            playing={theme.videoPlaying !== false}
            muted={theme.videoMuted ?? true}
            loop={theme.videoLoop !== false}
            restartTrigger={theme.videoRestartTime}
            seekTrigger={theme.videoSeekTrigger}
            seekSeconds={theme.videoSeekSeconds}
            fitMode={fitMode}
          />
        </div>
      )
    }

    if (isSlideVideo && slideVideoSrc) {
      return (
        <div
          className="slide-stage"
          data-testid="projection-stage-live"
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            background: '#000',
            padding: 0,
            margin: 0,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <video
            ref={slideVideoRef}
            key={slideVideoSrc}
            src={slideVideoSrc}
            autoPlay={theme.videoPlaying !== false}
            loop={theme.videoLoop !== false}
            muted={compact ? (windowOpen ? true : Boolean(theme.videoMuted)) : Boolean(theme.videoMuted)}
            playsInline
            preload="auto"
            onTimeUpdate={(e) => {
              const v = e.currentTarget
              if (onVideoProgress && !isNaN(v.duration) && v.duration > 0) {
                onVideoProgress(v.currentTime, v.duration)
              }
            }}
            onLoadedMetadata={(e) => {
              const v = e.currentTarget
              if (onVideoProgress && !isNaN(v.duration) && v.duration > 0) {
                onVideoProgress(v.currentTime, v.duration)
              }
            }}
            onCanPlay={(e) => {
              if (theme.videoPlaying !== false) {
                const v = e.currentTarget
                void v.play().catch(() => {
                  v.muted = true
                  void v.play().catch(() => undefined)
                })
              }
            }}
            style={{
              width: '100%',
              height: '100%',
              objectFit: fitMode,
              display: 'block'
            }}
          />
        </div>
      )
    }
    return (
      <div
        className="slide-stage"
        data-testid="projection-stage-live"
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          background: '#000',
          padding: 0,
          margin: 0,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <img
          src={currentSlide.imageUrl}
          alt={currentSlide.label}
          style={{
            width: '100%',
            height: '100%',
            objectFit: fitMode,
            display: 'block'
          }}
        />
      </div>
    )
  }

  return (
    <div
      ref={stageRef}
      className="slide-stage"
      data-testid="projection-stage-live"
      style={{
        ...safeBgStyle,
        padding: `${(paddingPct * 0.85).toFixed(2)}% ${paddingPct}%`,
        boxSizing: 'border-box'
      }}
    >
      {/* Fondo de vídeo en movimiento (predeterminado animado o archivo .mp4/.webm) */}
      {isVideoBg && (
        <MotionVideoBackground
          value={theme.background.value}
          blurPx={theme.bgBlur ?? 0}
          playing={theme.videoPlaying !== false}
          muted={theme.videoMuted ?? true}
          loop={theme.videoLoop !== false}
          restartTrigger={theme.videoRestartTime}
          seekTrigger={theme.videoSeekTrigger}
          seekSeconds={theme.videoSeekSeconds}
          fitMode={theme.mediaFit === 'contain' ? 'contain' : 'fill'}
        />
      )}

      {/* Capa de oscurecimiento y desenfoque configurable (Mejora 53) */}
      {(dimmerAlpha > 0 || (theme.bgBlur ?? 0) > 0) && !live.theme.chromaKey && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            background: `rgba(0,0,0,${dimmerAlpha.toFixed(2)})`,
            backdropFilter: theme.bgBlur ? `blur(${theme.bgBlur}px)` : undefined,
            zIndex: 0
          }}
        />
      )}

      {/* Reloj digital superpuesto en esquina superior derecha (Mejora 44) */}
      {live.theme.showOverlayClock && (
        <div
          style={{
            position: 'absolute',
            top: '3.5%',
            right: '4%',
            zIndex: 2,
            background: 'rgba(0,0,0,0.62)',
            padding: compact ? '2px 6px' : '5px 12px',
            borderRadius: 6,
            fontSize: compact ? 10 : 'clamp(14px, 1.6vw, 24px)',
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums'
          }}
        >
          {activeClock}
        </div>
      )}

      {/* Indicador de pantalla congelada en el monitor compacto (Mejora 3) */}
      {compact && live.theme.frozen && (
        <div
          style={{
            position: 'absolute',
            top: 6,
            left: 6,
            zIndex: 3,
            background: '#0284c7',
            color: '#fff',
            padding: '2px 6px',
            borderRadius: 4,
            fontSize: 9.5,
            fontWeight: 800
          }}
        >
          ❄ CONGELADO (F)
        </div>
      )}

      {/* Superposición de Cuenta Regresiva en vivo (Mejora 42) */}
      {countdownText && (
        <div
          style={{
            position: 'absolute',
            top: '4%',
            left: '4%',
            zIndex: 2,
            background: 'rgba(9, 9, 11, 0.82)',
            border: '1px solid rgba(255,255,255,0.22)',
            padding: compact ? '3px 8px' : '8px 16px',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          <span style={{ fontSize: compact ? 9.5 : 14, color: '#d4d4d8', fontWeight: 700 }}>
            {live.theme.countdownLabel || 'Iniciamos en:'}
          </span>
          <strong
            style={{
              fontSize: compact ? 13 : 'clamp(20px, 2.8vw, 44px)',
              color: '#facc15',
              fontVariantNumeric: 'tabular-nums'
            }}
          >
            {countdownText}
          </strong>
        </div>
      )}

      <div
        ref={bodyRef}
        className="slide-stage__body"
        style={{
          ...textStyle,
          position: 'relative',
          zIndex: 1,
          gap: '0.12em',
          maxHeight: '100%',
          overflow: 'hidden',
          boxSizing: 'border-box',
          ...(theme.textBoxBg || live.theme.lowerThirds
            ? {
                background: 'rgba(0, 0, 0, 0.68)',
                padding: compact ? '4px 8px' : '18px 28px',
                borderRadius: 8
              }
            : {})
        }}
      >
        {/* Cita bíblica destacada y grande en proyección para saber por dónde vamos */}
        {currentSlide && currentSlide.sourceKind === 'bible' && (
          <div
            className="slide-stage__bible-header"
            style={{
              fontSize: compact ? '10px' : 'clamp(18px, 2.2vw, 36px)',
              fontWeight: 900,
              color: '#facc15',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: compact ? '2px' : '0.8vh',
              textShadow: '0 2px 10px rgba(0,0,0,0.95)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>📖 {currentSlide.sourceTitle || currentSlide.label}</span>
          </div>
        )}

        {currentSlide ? (
          currentSlide.parallelLines && currentSlide.parallelLines.length > 0 ? (
            /* Comparación bilingüe / paralela de 2 columnas (Mejora 21) */
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4%' }}>
              <div>
                {currentSlide.lines.map((line, idx) => (
                  <p key={idx} className="slide-stage__line">
                    {renderHighlightedLine(line, live.theme.highlightWord)}
                  </p>
                ))}
              </div>
              <div style={{ borderLeft: '2px solid rgba(255,255,255,0.25)', paddingLeft: '4%', opacity: 0.92 }}>
                {currentSlide.parallelLines.map((line, idx) => (
                  <p key={idx} className="slide-stage__line">
                    {line}
                  </p>
                ))}
              </div>
            </div>
          ) : (
            (live.theme.lowerThirds ? currentSlide.lines.slice(0, 2) : currentSlide.lines).map((line, idx) => (
              <p key={idx} className="slide-stage__line">
                {renderHighlightedLine(line, live.theme.highlightWord)}
              </p>
            ))
          )
        ) : (
          <p className="slide-stage__line">Sin diapositiva seleccionada</p>
        )}
      </div>

      {/* Cinta de Alerta / Marquesina flotante en vivo (Mejora 41) */}
      {live.theme.tickerActive && live.theme.tickerText && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 3,
            background: '#991b1b',
            color: '#ffffff',
            padding: compact ? '2px 8px' : '7px 18px',
            fontSize: compact ? 10 : 'clamp(14px, 1.8vw, 28px)',
            fontWeight: 700,
            borderTop: '2px solid #f87171',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            textAlign: 'center'
          }}
        >
          📢 ALERTA: {live.theme.tickerText}
        </div>
      )}
    </div>
  )
}
