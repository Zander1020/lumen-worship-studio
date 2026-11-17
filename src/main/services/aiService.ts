export interface AiChatConfig {
  apiKey?: string | undefined
  model?: string | undefined
}

export interface AiChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

declare const __LUMEN_BUILD_GROQ_API_KEY__: string | undefined

export const GROQ_CHAT_COMPLETIONS_URL = 'https://api.groq.com/openai/v1/chat/completions'
export const GROQ_DEFAULT_MODEL = 'openai/gpt-oss-120b'

export function getDefaultGroqApiKey(): string {
  const fromRuntime = process.env['GROQ_API_KEY']?.trim()
  if (fromRuntime) return fromRuntime
  return typeof __LUMEN_BUILD_GROQ_API_KEY__ === 'string'
    ? __LUMEN_BUILD_GROQ_API_KEY__.trim()
    : ''
}

export const GROQ_SYSTEM_PROMPT = `Eres un asistente útil, claro y amable integrado en "Lumen Worship Studio".
Responde de forma directa y precisa en el idioma del usuario (por defecto español).`

interface EndpointConfig {
  url: string
  headers: Record<string, string>
  model: string
}

/** Resuelve la URL, cabeceras y modelo para el API de Groq. */
export function resolveAiEndpoint(config: AiChatConfig = {}): EndpointConfig {
  const apiKey = (config.apiKey ?? getDefaultGroqApiKey()).trim()
  if (!apiKey) {
    throw new Error(
      'Falta la clave API de Groq. Configura GROQ_API_KEY en el archivo .env antes de compilar.'
    )
  }
  return {
    url: GROQ_CHAT_COMPLETIONS_URL,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    model: (config.model && config.model.trim()) || GROQ_DEFAULT_MODEL
  }
}

/** Prepara el historial garantizando que exista un mensaje de sistema al inicio. */
export function prepareAiMessages(messages: AiChatMessage[]): AiChatMessage[] {
  const list: AiChatMessage[] = []
  const hasSystem = messages.some((m) => m.role === 'system')
  if (!hasSystem) {
    list.push({ role: 'system', content: GROQ_SYSTEM_PROMPT })
  }
  for (const m of messages) {
    list.push({
      role: m.role,
      content: m.content.slice(0, 12000)
    })
  }
  return list
}

async function extractGroqErrorMessage(res: Response): Promise<string> {
  if (res.status === 401 || res.status === 403) {
    return `Clave API de Groq no válida o sin permisos (HTTP ${res.status}).`
  }
  if (res.status === 429) {
    return 'Límite de solicitudes de Groq alcanzado temporalmente. Intenta de nuevo en unos segundos.'
  }
  try {
    const raw = await res.text()
    const parsed = JSON.parse(raw) as { error?: { message?: string } } | null
    const msg = parsed?.error?.message?.trim()
    if (msg) return `Error de Groq (HTTP ${res.status}): ${msg}`
  } catch {
    // Usar mensaje genérico si el cuerpo no es JSON
  }
  return `Error de respuesta en Groq (HTTP ${res.status}).`
}

async function fetchGroqResponse(
  config: AiChatConfig,
  messages: AiChatMessage[],
  stream: boolean
): Promise<Response> {
  const endpoint = resolveAiEndpoint(config)
  const prepared = prepareAiMessages(messages)

  let res: Response
  try {
    res = await fetch(endpoint.url, {
      method: 'POST',
      headers: endpoint.headers,
      body: JSON.stringify({
        model: endpoint.model,
        messages: prepared,
        reasoning_effort: 'low',
        max_completion_tokens: 4096,
        stream
      }),
      signal: AbortSignal.timeout(30000)
    })
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    throw new Error(`No se pudo conectar con Groq: ${detail}`, { cause: err })
  }

  if (!res.ok) {
    throw new Error(await extractGroqErrorMessage(res))
  }

  return res
}

/** Envía una consulta sin streaming y devuelve la respuesta completa de Groq. */
export async function chatWithAi(
  config: AiChatConfig,
  messages: AiChatMessage[]
): Promise<string> {
  const res = await fetchGroqResponse(config, messages, false)
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = data.choices?.[0]?.message?.content?.trim()
  if (!content) {
    throw new Error('Groq devolvió una respuesta vacía.')
  }
  return content
}

/** Envía una consulta con streaming SSE y emite cada fragmento a través de onChunk. */
export async function streamAiChat(
  config: AiChatConfig,
  messages: AiChatMessage[],
  onChunk: (chunk: string) => void
): Promise<void> {
  const res = await fetchGroqResponse(config, messages, true)
  if (!res.body) {
    throw new Error('Groq no devolvió flujo de respuesta.')
  }

  const emitted = await parseSseStream(res.body, onChunk)
  if (!emitted) {
    throw new Error('Groq no generó contenido en la respuesta.')
  }
}

function consumeSseLines(lines: string[], onChunk: (chunk: string) => void): boolean {
  let emitted = false
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('data:')) continue
    const dataStr = trimmed.slice(5).trim()
    if (!dataStr || dataStr === '[DONE]') continue

    try {
      const json = JSON.parse(dataStr) as {
        choices?: Array<{
          delta?: { content?: string; text?: string }
          text?: string
        }>
      }
      const content =
        json.choices?.[0]?.delta?.content ??
        json.choices?.[0]?.text ??
        json.choices?.[0]?.delta?.text
      if (typeof content === 'string' && content.length > 0) {
        emitted = true
        onChunk(content)
      }
    } catch {
      // Ignorar líneas SSE incompletas
    }
  }
  return emitted
}

/** Procesa un stream SSE compatible con OpenAI/Groq. */
async function parseSseStream(
  body: ReadableStream<Uint8Array> | NodeJS.ReadableStream,
  onChunk: (chunk: string) => void
): Promise<boolean> {
  const decoder = new TextDecoder()
  let buffer = ''
  let emitted = false

  for await (const value of body as AsyncIterable<Uint8Array>) {
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() ?? ''
    if (consumeSseLines(lines, onChunk)) {
      emitted = true
    }
  }

  buffer += decoder.decode()
  if (buffer.trim() && consumeSseLines(buffer.split(/\r?\n/), onChunk)) {
    emitted = true
  }

  return emitted
}

export const AiService = {
  resolveEndpoint: resolveAiEndpoint,
  prepareMessages: prepareAiMessages,
  chat: chatWithAi,
  streamChat: streamAiChat
}
