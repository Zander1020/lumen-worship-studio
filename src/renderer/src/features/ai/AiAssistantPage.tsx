import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
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
  isError?: boolean
}

const STORAGE_KEY = 'lumen-groq-chat-history'

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
        ((m as ChatMessage).role === 'user' || (m as ChatMessage).role === 'assistant') &&
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
    // Ignorar errores de cuota/almacenamiento
  }
}

export function AiAssistantPage({ app }: AiAssistantPageProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadHistory())
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [projectedId, setProjectedId] = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)

  const chatContainerRef = useRef<HTMLDivElement>(null)
  const unsubscribeRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    saveHistory(messages)
  }, [messages])

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [messages, loading])

  useEffect(() => {
    if (!confirmClear) return
    const timer = setTimeout(() => setConfirmClear(false), 3000)
    return () => clearTimeout(timer)
  }, [confirmClear])

  useEffect(() => {
    return () => {
      unsubscribeRef.current?.()
      unsubscribeRef.current = null
    }
  }, [])

  const handleSendPrompt = async (textToSend: string): Promise<void> => {
    const text = textToSend.trim()
    if (!text || loading) return

    const now = Date.now()
    const userMsgId = `user-${now}`
    const assistantMsgId = `ai-${now + 1}`

    const nextMessages: ChatMessage[] = [
      ...messages,
      { id: userMsgId, role: 'user', content: text, timestamp: now }
    ]

    setMessages(nextMessages)
    setInput('')
    setLoading(true)

    const payloadMessages = nextMessages
      .filter((m) => !m.isError && m.content.trim().length > 0)
      .map((m) => ({
        role: m.role,
        content: m.content
      }))

    const api = (
      window as unknown as {
        lumen?: {
          chatWithAI?: (m: { role: string; content: string }[]) => Promise<string>
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

    const updateAssistantMessage = (
      updater: (current: ChatMessage) => ChatMessage
    ): void => {
      setMessages((prev) =>
        prev.map((msg) => (msg.id === assistantMsgId ? updater(msg) : msg))
      )
    }

    if (api?.chatWithAIStream && api.onAIChatChunk) {
      const requestId =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : String(Date.now())

      setMessages([
        ...nextMessages,
        { id: assistantMsgId, role: 'assistant', content: '', timestamp: Date.now() }
      ])

      const cleanupStream = (): void => {
        unsubscribeRef.current?.()
        unsubscribeRef.current = null
      }

      const unsubscribe = api.onAIChatChunk((payload) => {
        if (payload.requestId !== requestId) return

        if (payload.error) {
          const errText = payload.error || 'Error desconocido al consultar Groq.'
          updateAssistantMessage((current) => ({
            ...current,
            content: current.content ? `${current.content}\n\n${errText}` : errText,
            isError: true
          }))
          setLoading(false)
          cleanupStream()
          return
        }

        if (payload.chunk) {
          updateAssistantMessage((current) => ({
            ...current,
            content: current.content + payload.chunk
          }))
        }

        if (payload.done) {
          setLoading(false)
          cleanupStream()
        }
      })

      unsubscribeRef.current = unsubscribe

      try {
        await api.chatWithAIStream({ messages: payloadMessages, requestId })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        updateAssistantMessage((current) => ({
          ...current,
          content: `Error: ${msg}`,
          isError: true
        }))
        setLoading(false)
        cleanupStream()
      }
      return
    }

    if (api?.chatWithAI) {
      try {
        const reply = await api.chatWithAI(payloadMessages)
        setMessages([
          ...nextMessages,
          { id: assistantMsgId, role: 'assistant', content: reply, timestamp: Date.now() }
        ])
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setMessages([
          ...nextMessages,
          { id: assistantMsgId, role: 'assistant', content: `Error: ${msg}`, timestamp: Date.now(), isError: true }
        ])
      } finally {
        setLoading(false)
      }
      return
    }

    setMessages([
      ...nextMessages,
      {
        id: assistantMsgId,
        role: 'assistant',
        content: 'No se encontró conexión con el proceso principal de Electron.',
        timestamp: Date.now(),
        isError: true
      }
    ])
    setLoading(false)
  }

  const handleClear = (): void => {
    if (!confirmClear) {
      setConfirmClear(true)
      return
    }
    setConfirmClear(false)
    setMessages([])
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignorar
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
        sourceTitle: 'Groq AI',
        label: `Diapositiva ${idx + 1}`,
        lines: cleanLines,
        footer: 'Lumen Worship Studio'
      }
    })

    await app.loadProjectionDeck({
      deckTitle: 'Chat Groq AI',
      slides,
      startIndex: 0,
      openWindow: true
    })
    await app.setProjectionMode('live')

    setProjectedId(id)
    setTimeout(() => setProjectedId(null), 2500)
  }

  const lastMessage = messages[messages.length - 1]
  const waitingFirstChunk =
    loading && !(lastMessage?.role === 'assistant' && lastMessage.content.length > 0)

  return (
    <section className="page hly-page" aria-labelledby="ai-page-title" style={{ padding: 16 }}>
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
            Chat directo conectado con Groq AI.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
            ⚡ Groq AI
          </div>

          <button
            type="button"
            className="button"
            onClick={handleClear}
            disabled={messages.length === 0 || loading}
            style={{ fontSize: 13 }}
            title="Borrar conversación actual"
          >
            {confirmClear ? '¿Confirmar limpiar?' : '🗑️ Limpiar'}
          </button>
        </div>
      </header>

      <div
        className="card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: 'calc(100vh - 235px)',
          minHeight: 400,
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
                maxWidth: 460,
                padding: 24,
                color: 'var(--text-muted, #94a3b8)'
              }}
            >
              <div style={{ fontSize: 38, marginBottom: 12 }}>✦</div>
              <h2 style={{ fontSize: 18, color: '#f8fafc', marginBottom: 8, fontWeight: 600 }}>
                Chat con Groq AI
              </h2>
              <p style={{ fontSize: 13, lineHeight: 1.5, margin: 0 }}>
                Escribe tu mensaje abajo para comenzar a conversar.
              </p>
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
                    background: isUser
                      ? 'var(--accent, #2563eb)'
                      : m.isError
                        ? 'rgba(239, 68, 68, 0.14)'
                        : '#1a2234',
                    color: isUser ? '#ffffff' : m.isError ? '#fca5a5' : '#f1f5f9',
                    fontSize: 14,
                    lineHeight: 1.6,
                    border: isUser
                      ? 'none'
                      : m.isError
                        ? '1px solid rgba(239, 68, 68, 0.4)'
                        : '1px solid #2d3748',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                  }}
                >
                  {m.content || (loading && !isUser ? '…' : '')}
                </div>

                {!isUser && !m.isError && m.content && (
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

          {waitingFirstChunk && (
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
              <span>Esperando respuesta de Groq…</span>
            </div>
          )}
        </div>

        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              aria-label="Mensaje para Groq AI"
              placeholder="Escribe tu mensaje para Groq… (Enter para enviar)"
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
            <span>Motor: Groq • openai/gpt-oss-120b</span>
            <span>
              Atajo: Presiona <strong>Enter</strong> para enviar
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
