import { useEffect, useState, type KeyboardEvent } from 'react'
import type { UseAppStatus } from '../../hooks/useAppStatus'
import { askPollinations, type AiMessage } from '../../lib/aiChat'

export interface AiAssistantPageProps {
  app?: UseAppStatus
}

const STORAGE_KEY = 'lumen-ai-chat'

function loadHistory(): AiMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (m): m is AiMessage =>
        !!m &&
        typeof m === 'object' &&
        typeof (m as AiMessage).role === 'string' &&
        typeof (m as AiMessage).content === 'string'
    )
  } catch {
    return []
  }
}

function saveHistory(messages: AiMessage[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
  } catch {
    // ignore quota errors
  }
}

export function AiAssistantPage() {
  const [messages, setMessages] = useState<AiMessage[]>(() => loadHistory())
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    saveHistory(messages)
  }, [messages])

  const handleSend = async (): Promise<void> => {
    const text = input.trim()
    if (!text || loading) return
    const next: AiMessage[] = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setInput('')
    setLoading(true)

    const api = (window as unknown as { lumen?: { chatWithAIStream?: (r: { messages: { role: string; content: string }[]; requestId: string }) => Promise<void>; onAIChatChunk?: (l: (p: { requestId: string; chunk: string; done: boolean; error?: string }) => void) => () => void } }).lumen
    const streamFn = api?.chatWithAIStream
    const listenFn = api?.onAIChatChunk
    if (streamFn && listenFn) {
      const requestId = (typeof crypto !== 'undefined' && 'randomUUID' in crypto) ? crypto.randomUUID() : String(Date.now())
      setMessages([...next, { role: 'assistant', content: '' }])
      const unsubscribe = listenFn((payload) => {
        if (payload.requestId !== requestId) return
        if (payload.error) {
          setMessages((prev) => {
            const copy = [...prev]
            const last = copy[copy.length - 1]
            if (last && last.role === 'assistant') last.content = `Error: ${payload.error}`
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
            if (last && last.role === 'assistant') last.content += payload.chunk
            return copy
          })
        }
        if (payload.done) {
          setLoading(false)
          unsubscribe()
        }
      })
      try {
        await streamFn({ messages: next, requestId })
      } catch (err) {
        setMessages((prev) => {
          const copy = [...prev]
          const last = copy[copy.length - 1]
          if (last && last.role === 'assistant') last.content = `Error: ${err instanceof Error ? err.message : String(err)}`
          return copy
        })
        setLoading(false)
        unsubscribe()
      }
    } else {
      const reply = await askPollinations(next)
      setMessages([...next, { role: 'assistant', content: reply }])
      setLoading(false)
    }
  }

  const handleClear = (): void => {
    setMessages([])
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  return (
    <section className="page" aria-labelledby="page-title">
      <header className="page__header">
        <h1 id="page-title">Inteligencia artificial</h1>
        <p className="page__description">Chat gratuito con IA para responder tus preguntas.</p>
      </header>

      <div className="card">
        <div className="card__header-row" style={{ marginBottom: 12 }}>
          <h2 className="card__title" style={{ margin: 0 }}>Chat con IA</h2>
          <button type="button" className="button" onClick={handleClear} disabled={messages.length === 0}>
            Limpiar
          </button>
        </div>
        <div
          style={{
            height: 420,
            overflowY: 'auto',
            border: '1px solid var(--border, #2a2f3a)',
            borderRadius: 8,
            padding: 10,
            background: 'var(--bg-panel, #0f1419)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8
          }}
        >
          {messages.length === 0 && (
            <p className="hint" style={{ margin: 'auto', textAlign: 'center' }}>
              Haz una pregunta para comenzar.
            </p>
          )}
          {messages.map((m, idx) => (
            <div
              key={idx}
              style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                padding: '8px 12px',
                borderRadius: 10,
                background: m.role === 'user' ? 'var(--accent, #2563eb)' : 'var(--bg, #1a2234)',
                color: m.role === 'user' ? '#fff' : 'inherit',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontSize: 14
              }}
            >
              {m.content || (loading && m.role === 'assistant' ? '…' : '')}
            </div>
          ))}
        </div>
        <div className="button-row" style={{ marginTop: 10 }}>
          <input
            type="text"
            aria-label="Pregunta a la IA"
            placeholder="Escribe tu pregunta…"
            style={{ flex: 1 }}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
          />
          <button
            type="button"
            className="button button--primary"
            onClick={() => void handleSend()}
            disabled={loading || !input.trim()}
          >
            Enviar
          </button>
        </div>
        <p className="hint" style={{ marginTop: 6, marginBottom: 0, fontSize: 11 }}>
          Gratuito vía Pollinations.ai. Requiere conexión a internet.
        </p>
      </div>
    </section>
  )
}
