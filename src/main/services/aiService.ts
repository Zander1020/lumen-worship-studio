import type { AiProvider } from '../../shared/models'

export interface AiChatConfig {
  provider?: AiProvider | undefined
  apiKey?: string | undefined
  model?: string | undefined
  customUrl?: string | undefined
}

export interface AiChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export const PASTORAL_SYSTEM_PROMPT = `Eres el asistente teológico, pastoral y audiovisual inteligente de "Lumen Worship Studio", diseñado para pastores, líderes de alabanza, predicadores y operadores de multimedia de la iglesia cristiana.

PRINCIPIOS FUNDAMENTALES:
1. Identidad: Eres sabio, pastoral, reverente, fundamentado en las Sagradas Escrituras (utiliza preferentemente la versión Reina-Valera 1960 para las citas bíblicas en español).
2. Tono: Cálido, inspirador, directo y edificante en la fe cristiana.
3. Formato: Utiliza Markdown limpio, con títulos destacados en negrita (**Título**), listas ordenadas o viñetas claras, y versículos bíblicos completos entrecomillados con su cita (Libro Capítulo:Versículo).
4. Eficiencia: Ve directamente al grano. NO incluyas introducciones vacías ni disculpas como "Como inteligencia artificial...". Comienza directamente con la respuesta o contenido solicitado.

DIRECTRICES POR TIPO DE CONSULTA:
- **Bosquejos de sermón**:
  1. Título sugerente y bíblico.
  2. Texto bíblico base (con cita).
  3. Proposición o tema central (1 oración clara).
  4. 3 o 4 puntos principales con desarrollo homilético breve, versículos de apoyo y aplicación práctica para la vida diaria.
  5. Conclusión y llamado pastoral a la oración o ministración.
- **Búsqueda de versículos**: Proporciona las citas exactas con el texto bíblico completo y una breve nota pastoral sobre cómo aplicarlo.
- **Orden de culto (Liturgia)**: Presenta un cronograma ordenado y dinámico (Bienvenida y oración, Alabanza de júbilo, Adoración íntima, Ofrendas, Mensaje de la Palabra, Ministración en el altar, Despedida y bendición).
- **Sugerencias de alabanzas**: Clasifícalas por momentos (Apertura/Júbilo, Adoración profunda, Ministración/Respuesta), indicando brevemente el tema teológico de la canción.
- **Oraciones**: Redacta oraciones profundas, sentidas, bíblicas y llenas de fe, apropiadas para ser leídas u oradas en público.`

interface EndpointConfig {
  url: string
  headers: Record<string, string>
  model: string
}

/**
 * Resuelve la URL de destino, encabezados HTTP y modelo según el proveedor configurado.
 */
export function resolveAiEndpoint(config: AiChatConfig): EndpointConfig {
  const provider = config.provider ?? 'free'
  const apiKey = (config.apiKey ?? '').trim()

  switch (provider) {
    case 'gemini': {
      if (!apiKey) {
        throw new Error(
          'Falta la clave API de Google Gemini. Configúrala en Ajustes de IA (⚙️). Puedes obtener una gratis en https://aistudio.google.com.'
        )
      }
      return {
        url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        model: (config.model && config.model.trim()) || 'gemini-2.0-flash'
      }
    }
    case 'groq': {
      if (!apiKey) {
        throw new Error(
          'Falta la clave API de Groq. Configúrala en Ajustes de IA (⚙️). Puedes obtener una gratis en https://console.groq.com.'
        )
      }
      return {
        url: 'https://api.groq.com/openai/v1/chat/completions',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        model: (config.model && config.model.trim()) || 'llama-3.3-70b-versatile'
      }
    }
    case 'openai': {
      if (!apiKey) {
        throw new Error('Falta la clave API de OpenAI. Configúrala en Ajustes de IA (⚙️).')
      }
      return {
        url: 'https://api.openai.com/v1/chat/completions',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        model: (config.model && config.model.trim()) || 'gpt-4o-mini'
      }
    }
    case 'deepseek': {
      if (!apiKey) {
        throw new Error('Falta la clave API de DeepSeek. Configúrala en Ajustes de IA (⚙️).')
      }
      return {
        url: 'https://api.deepseek.com/chat/completions',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        model: (config.model && config.model.trim()) || 'deepseek-chat'
      }
    }
    case 'openrouter': {
      if (!apiKey) {
        throw new Error('Falta la clave API de OpenRouter. Configúrala en Ajustes de IA (⚙️).')
      }
      return {
        url: 'https://openrouter.ai/api/v1/chat/completions',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        model: (config.model && config.model.trim()) || 'meta-llama/llama-3.3-70b-instruct:free'
      }
    }
    case 'ollama': {
      const baseUrl = (config.customUrl && config.customUrl.trim()) || 'http://localhost:11434'
      const normalized = baseUrl.replace(/\/+$/, '')
      const endpointUrl = normalized.endsWith('/v1/chat/completions')
        ? normalized
        : `${normalized}/v1/chat/completions`
      return {
        url: endpointUrl,
        headers: {
          'Content-Type': 'application/json'
        },
        model: (config.model && config.model.trim()) || 'llama3.2'
      }
    }
    case 'free':
    default: {
      return {
        url: 'https://text.pollinations.ai/openai',
        headers: {
          'Content-Type': 'application/json'
        },
        model: 'openai'
      }
    }
  }
}

/**
 * Prepara la lista de mensajes garantizando que el system prompt pastoral esté presente.
 */
export function prepareAiMessages(messages: AiChatMessage[]): AiChatMessage[] {
  const list: AiChatMessage[] = []
  const hasSystem = messages.some((m) => m.role === 'system')
  if (!hasSystem) {
    list.push({ role: 'system', content: PASTORAL_SYSTEM_PROMPT })
  }
  for (const m of messages) {
    list.push({
      role: m.role,
      content: m.content.slice(0, 8000)
    })
  }
  return list
}

/**
 * Mensajes de error amigables y con soluciones prácticas para el usuario.
 */
function formatHttpError(status: number, provider: AiProvider): string {
  if (status === 402 && provider === 'free') {
    return (
      '⚠️ Límite del servicio público alcanzado (máximo 1 consulta cada 45 segundos por IP).\n\n' +
      '⚡ **Para respuestas instantáneas y sin límites:**\n' +
      'Activa Google Gemini Flash o Groq Llama 3.3 en los Ajustes de IA (⚙️). Ambos ofrecen claves API 100% gratuitas, sin tarjeta de crédito, con respuestas en menos de 0.5 segundos.'
    )
  }
  if (status === 401) {
    return `⚠️ Error de autenticación (HTTP 401). La clave API para ${provider.toUpperCase()} es inválida o ha expirado. Por favor revísala en los Ajustes de IA (⚙️).`
  }
  if (status === 429) {
    return `⚠️ Límite de peticiones excedido (HTTP 429). El proveedor ${provider.toUpperCase()} ha alcanzado temporalmente la cuota por minuto. Espera un momento antes de volver a consultar.`
  }
  if (status === 404) {
    return `⚠️ Recurso o modelo no encontrado (HTTP 404). Verifica el nombre del modelo configurado para ${provider.toUpperCase()}.`
  }
  return `Error en el servicio de IA (HTTP ${status}). Intenta nuevamente o verifica la configuración.`
}

/**
 * Envía una consulta no-streaming y devuelve la respuesta en texto plano.
 */
export async function chatWithAi(
  config: AiChatConfig,
  messages: AiChatMessage[]
): Promise<string> {
  const endpoint = resolveAiEndpoint(config)
  const prepared = prepareAiMessages(messages)

  try {
    const res = await fetch(endpoint.url, {
      method: 'POST',
      headers: endpoint.headers,
      body: JSON.stringify({
        model: endpoint.model,
        messages: prepared
      })
    })

    if (!res.ok) {
      return formatHttpError(res.status, config.provider ?? 'free')
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const content = data.choices?.[0]?.message?.content
    if (typeof content === 'string' && content.trim()) {
      return content.trim()
    }
    return 'No se recibió contenido en la respuesta. Intenta reformular tu pregunta.'
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    return `Error al conectar con la IA: ${errorMsg}. Verifica tu conexión a internet o tus ajustes de IA.`
  }
}

/**
 * Envía una consulta con streaming en tiempo real emitiendo cada fragmento a través de onChunk.
 */
export async function streamAiChat(
  config: AiChatConfig,
  messages: AiChatMessage[],
  onChunk: (chunk: string) => void
): Promise<void> {
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
        stream: true
      })
    })
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    throw new Error(`Error de conexión con la IA (${errorMsg}).`, { cause: err })
  }

  if (!res.ok || !res.body) {
    const errorMsg = formatHttpError(res.status, config.provider ?? 'free')
    throw new Error(errorMsg)
  }

  const decoder = new TextDecoder()
  let buffer = ''
  for await (const value of res.body as AsyncIterable<Uint8Array>) {
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const dataStr = trimmed.slice(5).trim()
      if (dataStr === '[DONE]') continue
      try {
        const json = JSON.parse(dataStr) as {
          choices?: Array<{
            delta?: { content?: string; reasoning?: string; text?: string }
            text?: string
          }>
        }
        const content =
          json.choices?.[0]?.delta?.content ??
          json.choices?.[0]?.text ??
          json.choices?.[0]?.delta?.text
        if (typeof content === 'string' && content) {
          onChunk(content)
        }
      } catch {
        // Fragmentos SSE incompletos se ignoran hasta el siguiente trozo
      }
    }
  }
}

export const AiService = {
  resolveEndpoint: resolveAiEndpoint,
  prepareMessages: prepareAiMessages,
  chat: chatWithAi,
  streamChat: streamAiChat
}
