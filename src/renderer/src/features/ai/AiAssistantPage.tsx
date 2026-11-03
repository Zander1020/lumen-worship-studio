import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { AiProvider } from '../../../../shared/models'
import type { PresentationSlide } from '../../../../shared/models'
import type { UseAppStatus } from '../../hooks/useAppStatus'

export interface AiAssistantPageProps {
  app?: UseAppStatus
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

const STORAGE_KEY = 'lumen-ai-chat-history'

const QUICK_ACTIONS = [
  {
    icon: '📖',
    label: 'Versículos Bíblicos',
    prompt:
      'Dame 5 versículos clave de fe, fortaleza y consuelo con sus citas bíblicas de la versión Reina-Valera 1960 y una breve aplicación pastoral.'
  },
  {
    icon: '🎙️',
    label: 'Bosquejo de Sermón',
    prompt:
      'Crea un bosquejo homilético de sermón de 3 puntos sobre la gracia y el perdón de Dios, con texto bíblico base, proposición central, desarrollo y conclusión pastoral.'
  },
  {
    icon: '⛪',
    label: 'Orden de Culto',
    prompt:
      'Diseña un programa u orden de culto dominical equilibrado y dinámico de 90 minutos con tiempos sugeridos para alabanza, adoración, ofrendas, mensaje y llamado.'
  },
  {
    icon: '🎵',
    label: 'Sugerir Alabanzas',
    prompt:
      'Sugiéreme 6 alabanzas cristianas contemporáneas categorizadas para apertura/júbilo, adoración íntima y ministración/altar, indicando su tema central.'
  },
  {
    icon: '🙏',
    label: 'Oración Pastoral',
    prompt:
      'Escribe una oración pastoral reverente, bíblica y profunda para bendecir a la congregación al iniciar o concluir el servicio de adoración.'
  }
]

const PROVIDER_INFO: Record<AiProvider, { name: string; tag: string; description: string; url?: string }> = {
  free: {
    name: 'IA Gratuita Integrada (Automática)',
    tag: '🟢 100% Gratis',
    description:
      'Motor de IA gratuito de alta velocidad listo para usar. Funciona sin registro, sin claves y sin ninguna configuración requerida.'
  },
  gemini: {
    name: 'Google Gemini Flash (Recomendado)',
    tag: '⚡ Gemini Flash',
    description:
      'Clave gratuita en Google AI Studio (https://aistudio.google.com). Respuestas en menos de 0.4s, alta sabiduría bíblica y sin tarjeta de crédito.',
    url: 'https://aistudio.google.com'
  },
  groq: {
    name: 'Groq Cloud (LPU Ultra-rápido)',
    tag: '🚀 Groq Ultra-rápido',
    description:
      'Clave gratuita en Groq Console (https://console.groq.com). Velocidad de 500+ tokens por segundo con Llama 3.3 70B.',
    url: 'https://console.groq.com'
  },
  openai: {
    name: 'OpenAI (ChatGPT)',
    tag: '🤖 OpenAI',
    description: 'Requiere clave de OpenAI (https://platform.openai.com). Por defecto utiliza gpt-4o-mini.',
    url: 'https://platform.openai.com'
  },
  deepseek: {
    name: 'DeepSeek',
    tag: '🧠 DeepSeek',
    description: 'Requiere clave de DeepSeek API (https://platform.deepseek.com). Utiliza deepseek-chat.',
    url: 'https://platform.deepseek.com'
  },
  openrouter: {
    name: 'OpenRouter',
    tag: '🔀 OpenRouter',
    description: 'Acceso a múltiples modelos abiertos y gratuitos (https://openrouter.ai).',
    url: 'https://openrouter.ai'
  },
  ollama: {
    name: 'Ollama (Local / Sin Internet)',
    tag: '💻 Ollama Local',
    description:
      'Ejecuta modelos en tu computador localmente de forma privada y 100% offline (http://localhost:11434).'
  }
}

function loadHistory(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (m): m is ChatMessage =>
        !!m &&
        typeof m === 'object' &&
        typeof (m as ChatMessage).id === 'string' &&
        typeof (m as ChatMessage).role === 'string' &&
        typeof (m as ChatMessage).content === 'string'
    )
  } catch {
    return []
  }
}

function saveHistory(messages: ChatMessage[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
  } catch {
    // ignorar errores de almacenamiento
  }
}

export function AiAssistantPage({ app }: AiAssistantPageProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadHistory())
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [projectedId, setProjectedId] = useState<string | null>(null)
  const [isConfigOpen, setIsConfigOpen] = useState(false)
  const [showKey, setShowKey] = useState(false)

  // Estados locales para el modal de configuración
  const [selectedProvider, setSelectedProvider] = useState<AiProvider>(() => app?.settings?.aiProvider ?? 'free')
  const [apiKeyInput, setApiKeyInput] = useState<string>(() => app?.settings?.aiApiKey ?? '')
  const [modelInput, setModelInput] = useState<string>(() => app?.settings?.aiModel ?? '')
  const [customUrlInput, setCustomUrlInput] = useState<string>(() => app?.settings?.aiCustomUrl ?? '')

  const chatContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    saveHistory(messages)
  }, [messages])

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [messages, loading])

  // Sincronizar configuración actual si app.settings cambia
  useEffect(() => {
    if (app?.settings) {
      if (app.settings.aiProvider) setSelectedProvider(app.settings.aiProvider)
      if (app.settings.aiApiKey !== undefined) setApiKeyInput(app.settings.aiApiKey)
      if (app.settings.aiModel !== undefined) setModelInput(app.settings.aiModel)
      if (app.settings.aiCustomUrl !== undefined) setCustomUrlInput(app.settings.aiCustomUrl)
    }
  }, [app?.settings])

  const currentProvider: AiProvider = app?.settings?.aiProvider ?? 'free'
  const currentProviderInfo = PROVIDER_INFO[currentProvider]

  const handleSendPrompt = async (textToSend: string): Promise<void> => {
    const text = textToSend.trim()
    if (!text || loading) return

    const userMsgId = `user-${Date.now()}`
    const assistantMsgId = `ai-${Date.now() + 1}`

    const nextMessages: ChatMessage[] = [
      ...messages,
      { id: userMsgId, role: 'user', content: text, timestamp: Date.now() }
    ]

    setMessages(nextMessages)
    setInput('')
    setLoading(true)

    const api = (
      window as unknown as {
        lumen?: {
          chatWithAIStream?: (r: {
            messages: { role: string; content: string }[]
            requestId: string
          }) => Promise<void>
          onAIChatChunk?: (
            l: (p: { requestId: string; chunk: string; done: boolean; error?: string }) => void
          ) => () => void
        }
      }
    ).lumen

    const streamFn = api?.chatWithAIStream
    const listenFn = api?.onAIChatChunk

    if (streamFn && listenFn) {
      const requestId = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now())

      setMessages([
        ...nextMessages,
        { id: assistantMsgId, role: 'assistant', content: '', timestamp: Date.now() }
      ])

      const unsubscribe = listenFn((payload) => {
        if (payload.requestId !== requestId) return

        if (payload.error) {
          setMessages((prev) => {
            const copy = [...prev]
            const last = copy[copy.length - 1]
            if (last && last.role === 'assistant') {
              const errText = payload.error || 'Error desconocido'; last.content = last.content ? (last.content + '\n\n' + errText) : errText;
            }
            return copy
          })
          setLoading(false)
          unsubscribe()
          return
        }

        if (payload.chunk) {
          setMessages((prev) => {
            const copy = [...prev]
            const last = copy[copy.length - 1]
            if (last && last.role === 'assistant') {
              last.content += payload.chunk
            }
            return copy
          })
        }

        if (payload.done) {
          setLoading(false)
          unsubscribe()
        }
      })

      try {
        const payloadMessages = nextMessages.map((m) => ({
          role: m.role,
          content: m.content
        }))
        await streamFn({ messages: payloadMessages, requestId })
      } catch (err) {
        setMessages((prev) => {
          const copy = [...prev]
          const last = copy[copy.length - 1]
          if (last && last.role === 'assistant') {
            last.content = `Error: ${err instanceof Error ? err.message : String(err)}`
          }
          return copy
        })
        setLoading(false)
        unsubscribe()
      }
    } else {
      // Fallback
      setMessages([
        ...nextMessages,
        {
          id: assistantMsgId,
          role: 'assistant',
          content: 'No se pudo conectar con el canal de streaming del proceso principal.',
          timestamp: Date.now()
        }
      ])
      setLoading(false)
    }
  }

  const handleClear = (): void => {
    if (confirm('¿Deseas vaciar el historial de conversación con la IA?')) {
      setMessages([])
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch {
        // ignorar
      }
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSendPrompt(input)
    }
  }

  const handleCopy = async (id: string, text: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2500)
    } catch {
      // Ignorar fallo de portapapeles
    }
  }

  const handleProject = async (id: string, text: string): Promise<void> => {
    if (!app) return

    // Convertir el texto de la IA en diapositivas limpias dividiendo por párrafos o listas
    const blocks = text
      .split(/\n\s*\n+/)
      .map((b) => b.trim())
      .filter((b) => b.length > 0)

    if (blocks.length === 0) return

    const slides: PresentationSlide[] = blocks.map((block, idx) => {
      const cleanLines = block
        .split('\n')
        .map((l) => l.trim().replace(/^[*#-\s]+/, ''))
        .filter((l) => l.length > 0)

      return {
        id: `ai-slide-${Date.now()}-${idx + 1}`,
        sourceKind: 'custom',
        sourceTitle: 'Asistente Teológico / IA',
        label: `Diapositiva ${idx + 1}`,
        lines: cleanLines,
        footer: 'Lumen Worship Studio'
      }
    })

    await app.loadProjectionDeck({
      deckTitle: 'Mensaje Pastoral / IA',
      slides,
      startIndex: 0,
      openWindow: true
    })
    await app.setProjectionMode('live')

    setProjectedId(id)
    setTimeout(() => setProjectedId(null), 2500)
  }

  const handleSaveConfig = async (): Promise<void> => {
    if (!app) return
    await app.updateSettings({
      aiProvider: selectedProvider,
      aiApiKey: apiKeyInput.trim(),
      aiModel: modelInput.trim(),
      aiCustomUrl: customUrlInput.trim()
    })
    setIsConfigOpen(false)
  }

  return (
    <section className="page hly-page" aria-labelledby="ai-page-title" style={{ padding: 16 }}>
      {/* Barra de título y estado de la IA */}
      <header
        className="card"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
          padding: '12px 18px',
          background: 'var(--bg-panel, #121824)',
          borderRadius: 8,
          border: '1px solid var(--border, #2a3346)'
        }}
      >
        <div>
          <h1 id="ai-page-title" style={{ fontSize: 20, margin: '0 0 4px 0', fontWeight: 600 }}>
            Inteligencia artificial
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted, #94a3b8)' }}>
            Respuestas bíblicas, bosquejos de sermones, oraciones y liturgia al instante para tu iglesia.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Badge del proveedor activo */}
          <div
            style={{
              padding: '6px 12px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 600,
              background: 'rgba(16, 185, 129, 0.15)',
              color: '#10b981',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#10b981'
              }}
            />
            {currentProviderInfo.tag}
          </div>

          <button
            type="button"
            className="button button--secondary"
            onClick={() => setIsConfigOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
            title="Configurar proveedor y claves de IA"
          >
            ⚙️ Opciones avanzadas
          </button>

          <button
            type="button"
            className="button"
            onClick={handleClear}
            disabled={messages.length === 0}
            style={{ fontSize: 13 }}
            title="Borrar conversación actual"
          >
            🗑️ Limpiar
          </button>
        </div>
      </header>

      {/* Chips de Acción Rápida Teológica */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          paddingBottom: 8,
          marginBottom: 10
        }}
      >
        {QUICK_ACTIONS.map((action, idx) => (
          <button
            key={idx}
            type="button"
            className="hly-mini-btn"
            onClick={() => void handleSendPrompt(action.prompt)}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 16,
              background: 'var(--bg-panel, #161e2e)',
              border: '1px solid var(--border, #2a3346)',
              color: 'var(--text, #e2e8f0)',
              fontSize: 12,
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
            title={action.prompt}
          >
            <span>{action.icon}</span>
            <span>{action.label}</span>
          </button>
        ))}
      </div>

      {/* Contenedor principal de mensajes */}
      <div
        className="card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: 'calc(100vh - 290px)',
          minHeight: 380,
          background: 'var(--bg-panel, #0f1419)',
          border: '1px solid var(--border, #2a3346)',
          borderRadius: 8,
          padding: 12
        }}
      >
        <div
          ref={chatContainerRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            paddingRight: 6
          }}
        >
          {messages.length === 0 && (
            <div
              style={{
                margin: 'auto',
                textAlign: 'center',
                maxWidth: 520,
                padding: 24,
                color: 'var(--text-muted, #94a3b8)'
              }}
            >
              <div style={{ fontSize: 44, marginBottom: 12 }}>✝️</div>
              <h2 style={{ fontSize: 18, color: '#f8fafc', marginBottom: 8, fontWeight: 600 }}>
                ¿En qué puedo ayudarte en tu ministerio hoy?
              </h2>
              <p style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 16 }}>
                Pregunta por versículos por tema, pide un bosquejo para tu mensaje, diseña la liturgia del culto o
                sugiere cánticos de adoración. Selecciona una sugerencia arriba o escribe abajo.
              </p>
              {currentProvider === 'free' && (
                <div
                  style={{
                    background: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    borderRadius: 8,
                    padding: 12,
                    fontSize: 12,
                    textAlign: 'left',
                    color: '#93c5fd'
                  }}
                >
                  ✨ <strong>100% Gratuito y Listo:</strong> La IA está completamente configurada y lista para responder al instante, sin cuentas ni claves. ¡Haz cualquier consulta o usa los botones rápidos de arriba!
                </div>
              )}
            </div>
          )}

          {messages.map((m) => {
            const isUser = m.role === 'user'
            return (
              <div
                key={m.id}
                style={{
                  alignSelf: isUser ? 'flex-end' : 'flex-start',
                  maxWidth: isUser ? '75%' : '90%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4
                }}
              >
                <div
                  style={{
                    padding: isUser ? '10px 14px' : '14px 18px',
                    borderRadius: isUser ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                    background: isUser ? 'var(--accent, #2563eb)' : '#1a2234',
                    color: isUser ? '#ffffff' : '#f1f5f9',
                    fontSize: 14,
                    lineHeight: 1.6,
                    border: isUser ? 'none' : '1px solid #2d3748',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                  }}
                >
                  {m.content || (loading && !isUser ? '…' : '')}
                </div>

                {/* Acciones para mensajes del asistente */}
                {!isUser && m.content && (
                  <div style={{ display: 'flex', gap: 8, paddingLeft: 4, marginTop: 2 }}>
                    <button
                      type="button"
                      className="hly-mini-btn"
                      onClick={() => void handleCopy(m.id, m.content)}
                      style={{
                        fontSize: 11,
                        padding: '3px 8px',
                        borderRadius: 4,
                        background: copiedId === m.id ? '#10b981' : '#1e293b',
                        color: copiedId === m.id ? '#ffffff' : '#cbd5e1',
                        border: '1px solid #334155',
                        cursor: 'pointer'
                      }}
                      title="Copiar texto completo al portapapeles"
                    >
                      {copiedId === m.id ? '✓ ¡Copiado!' : '📋 Copiar'}
                    </button>

                    {app && (
                      <button
                        type="button"
                        className="hly-mini-btn"
                        onClick={() => void handleProject(m.id, m.content)}
                        style={{
                          fontSize: 11,
                          padding: '3px 8px',
                          borderRadius: 4,
                          background: projectedId === m.id ? '#2563eb' : '#1e293b',
                          color: projectedId === m.id ? '#ffffff' : '#cbd5e1',
                          border: '1px solid #334155',
                          cursor: 'pointer'
                        }}
                        title="Proyectar este contenido en la pantalla de la iglesia"
                      >
                        {projectedId === m.id ? '📺 ¡Proyectado!' : '📺 Proyectar'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {loading && (
            <div
              style={{
                alignSelf: 'flex-start',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 14px',
                borderRadius: 14,
                background: '#1a2234',
                color: 'var(--text-muted, #94a3b8)',
                fontSize: 13,
                border: '1px solid #2d3748'
              }}
            >
              <span className="hly-spinner" style={{ display: 'inline-block' }}>
                ⏳
              </span>
              <span>Preparando respuesta pastoral con IA…</span>
            </div>
          )}
        </div>

        {/* Barra de entrada de texto */}
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              aria-label="Pregunta pastoral o bíblica para la IA"
              placeholder="Haz una pregunta bíblica, pide un bosquejo o sugiere cánticos… (Enter para enviar)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: 6,
                background: '#161e2e',
                border: '1px solid var(--border, #2a3346)',
                color: '#f8fafc',
                fontSize: 14
              }}
            />
            <button
              type="button"
              className="button button--primary"
              onClick={() => void handleSendPrompt(input)}
              disabled={loading || !input.trim()}
              style={{ padding: '0 20px', fontWeight: 600, fontSize: 14 }}
            >
              {loading ? 'Pensando…' : 'Enviar'}
            </button>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 6,
              fontSize: 11,
              color: 'var(--text-muted, #64748b)'
            }}
          >
            <span>
              Proveedor: <strong>{currentProviderInfo.name}</strong> • Especializado en doctrina y predicación
            </span>
            <span>Atajo: Presiona <strong>Enter</strong> para enviar</span>
          </div>
        </div>
      </div>

      {/* Modal / Diálogo de Configuración de IA */}
      {isConfigOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ai-settings-dialog-title"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: 580,
              background: '#0f172a',
              borderRadius: 10,
              border: '1px solid #334155',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 16
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 id="ai-settings-dialog-title" style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#f8fafc' }}>
                ⚙️ Configuración del Motor de IA
              </h2>
              <button
                type="button"
                className="button button--secondary"
                onClick={() => setIsConfigOpen(false)}
                style={{ padding: '4px 8px', fontSize: 13 }}
              >
                ✕
              </button>
            </div>

            {/* Selector de Proveedor */}
            <div>
              <label htmlFor="ai-provider-select" style={{ display: 'block', fontSize: 13, marginBottom: 6, fontWeight: 500, color: '#e2e8f0' }}>
                Proveedor de Inteligencia Artificial:
              </label>
              <select
                id="ai-provider-select"
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value as AiProvider)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 6,
                  background: '#1e293b',
                  border: '1px solid #475569',
                  color: '#f8fafc',
                  fontSize: 14
                }}
              >
                <option value="gemini">⚡ Google Gemini Flash (Recomendado - Gratis, veloz &lt;400ms)</option>
                <option value="groq">🚀 Groq Cloud (Ultra-rápido 500 tok/s - Gratis)</option>
                <option value="free">🟢 Gratuito Integrado (Automático - Sin claves ni configuración)</option>
                <option value="openai">🤖 OpenAI (ChatGPT - gpt-4o-mini)</option>
                <option value="deepseek">🧠 DeepSeek (deepseek-chat)</option>
                <option value="openrouter">🔀 OpenRouter (Modelos universales)</option>
                <option value="ollama">💻 Ollama (Local en tu PC - 100% offline)</option>
              </select>
            </div>

            {/* Caja de Ayuda del Proveedor */}
            <div
              style={{
                background: 'rgba(30, 41, 59, 0.7)',
                border: '1px solid #334155',
                borderRadius: 6,
                padding: 12,
                fontSize: 12,
                color: '#cbd5e1',
                lineHeight: 1.5
              }}
            >
              <p style={{ margin: '0 0 6px 0' }}>{PROVIDER_INFO[selectedProvider].description}</p>
              {PROVIDER_INFO[selectedProvider].url && (
                <p style={{ margin: 0 }}>
                  👉 Puedes obtener tu clave en:{' '}
                  <a
                    href={PROVIDER_INFO[selectedProvider].url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: '#60a5fa', textDecoration: 'underline' }}
                  >
                    {PROVIDER_INFO[selectedProvider].url}
                  </a>
                </p>
              )}
            </div>

            {/* Campo Clave API (si aplica) */}
            {selectedProvider !== 'free' && selectedProvider !== 'ollama' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label htmlFor="ai-api-key-input" style={{ fontSize: 13, fontWeight: 500, color: '#e2e8f0' }}>
                    Clave API ({PROVIDER_INFO[selectedProvider].tag}):
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#60a5fa',
                      cursor: 'pointer',
                      fontSize: 12
                    }}
                  >
                    {showKey ? 'Ocultar' : 'Mostrar'}
                  </button>
                </div>
                <input
                  id="ai-api-key-input"
                  type={showKey ? 'text' : 'password'}
                  placeholder="Pega tu API Key aquí..."
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    background: '#1e293b',
                    border: '1px solid #475569',
                    color: '#f8fafc',
                    fontSize: 14,
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            )}

            {/* Campo URL personalizado para Ollama */}
            {selectedProvider === 'ollama' && (
              <div>
                <label htmlFor="ai-custom-url-input" style={{ display: 'block', fontSize: 13, marginBottom: 6, fontWeight: 500, color: '#e2e8f0' }}>
                  URL del servidor Ollama:
                </label>
                <input
                  id="ai-custom-url-input"
                  type="text"
                  placeholder="http://localhost:11434"
                  value={customUrlInput}
                  onChange={(e) => setCustomUrlInput(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    background: '#1e293b',
                    border: '1px solid #475569',
                    color: '#f8fafc',
                    fontSize: 14,
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            )}

            {/* Campo Modelo (Opcional) */}
            <div>
              <label htmlFor="ai-model-input" style={{ display: 'block', fontSize: 13, marginBottom: 6, fontWeight: 500, color: '#e2e8f0' }}>
                Modelo específico (opcional):
              </label>
              <input
                id="ai-model-input"
                type="text"
                placeholder={
                  selectedProvider === 'gemini'
                    ? 'gemini-2.0-flash (predeterminado)'
                    : selectedProvider === 'groq'
                      ? 'llama-3.3-70b-versatile (predeterminado)'
                      : selectedProvider === 'openai'
                        ? 'gpt-4o-mini (predeterminado)'
                        : selectedProvider === 'deepseek'
                          ? 'deepseek-chat'
                          : selectedProvider === 'ollama'
                            ? 'llama3.2'
                            : 'Automático'
                }
                value={modelInput}
                onChange={(e) => setModelInput(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 6,
                  background: '#1e293b',
                  border: '1px solid #475569',
                  color: '#f8fafc',
                  fontSize: 14,
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Botones de acción del diálogo */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
              <button
                type="button"
                className="button button--secondary"
                onClick={() => setIsConfigOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="button button--primary"
                onClick={() => void handleSaveConfig()}
              >
                Guardar Configuración
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
