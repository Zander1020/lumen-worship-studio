export type AiRole = 'user' | 'assistant' | 'system'

export interface AiMessage {
  role: AiRole
  content: string
}

const ENDPOINT = 'https://text.pollinations.ai/openai'
const DEFAULT_MODEL = 'openai'

export async function askPollinations(messages: AiMessage[]): Promise<string> {
  try {
    const api = (window as unknown as { lumen?: { chatWithAI?: (m: { role: string; content: string }[]) => Promise<string> } }).lumen
    if (api?.chatWithAI) {
      return await api.chatWithAI(messages)
    }
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, model: DEFAULT_MODEL })
    })
    if (!res.ok) {
      return `No se pudo obtener respuesta (HTTP ${res.status}). Intenta de nuevo.`
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
    const content = data.choices?.[0]?.message?.content
    if (typeof content === 'string' && content.trim()) {
      return content.trim()
    }
    return 'La IA no devolvió contenido. Intenta reformular la pregunta.'
  } catch (err) {
    return `Error de conexión: ${err instanceof Error ? err.message : String(err)}. Verifica tu conexión a internet.`
  }
}
