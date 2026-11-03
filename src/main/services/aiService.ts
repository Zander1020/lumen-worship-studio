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
          'Falta la clave API de Google Gemini. Configúrala en Ajustes de IA (⚙️).'
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
        throw new Error('Falta la clave API de Groq. Configúrala en Ajustes de IA (⚙️).')
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
        url: 'https://api.llm7.io/v1/chat/completions',
        headers: {
          'Content-Type': 'application/json'
        },
        model: 'default'
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
 * Generador teológico y pastoral de respaldo instantáneo (0 ms).
 * Asegura que el usuario NUNCA se quede sin respuesta, incluso si no hay conexión a internet.
 */
export function generateLocalPastoralFallback(query: string): string {
  const q = query
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  if (q.includes('sermon') || q.includes('bosquejo') || q.includes('predica')) {
    return `### **Bosquejo Homilético: Caminando en la Fe y la Gracia de Dios**
**Texto Base:** Efesios 2:8-10 | Hebreos 11:1

**Tema Central:** La gracia inmerecida de Dios nos capacita para vivir victoriosamente cada día.

---

#### **1. La Gracia: El Regalo Inmerecido de Dios**
- *«Porque por gracia sois salvos por medio de la fe; y esto no de vosotros, pues es don de Dios»* (Efesios 2:8).
- La salvación no es el resultado del esfuerzo humano, sino de la infinita misericordia divina manifestada en la cruz de Cristo.
- **Aplicación:** Descansa hoy en el perdón de Dios; no necesitas ganar Su amor, ya te lo entregó por completo.

---

#### **2. La Fe: La Llave que Desata las Promesas**
- *«Es, pues, la fe la certeza de lo que se espera, la convicción de lo que no se ve»* (Hebreos 11:1).
- La fe no es ausencia de dudas, sino la decisión de creer en la fidelidad de Dios por encima de las circunstancias visibles.
- **Aplicación:** Entrega tus cargas y ansiedades al Señor en oración confiando en que Él ya está obrando a tu favor.

---

#### **3. Creados para Buenas Obras: El Fruto de una Vida Transformada**
- *«Porque somos hechura suya, creados en Cristo Jesús para buenas obras...»* (Efesios 2:10).
- La vida cristiana no es pasiva: somos embajadores del amor y la reconciliación en nuestras familias y comunidades.
- **Aplicación:** Que esta semana tus acciones reflejen la gracia que has recibido a través de actos de perdón, servicio y generosidad.

---

**Conclusión y Llamado Pastoral:**
Invitemos a la congregación a acercarse confiadamente al trono de la gracia, declarando que ninguna condenación hay para los que están en Cristo Jesús.`
  }

  if (q.includes('culto') || q.includes('orden') || q.includes('liturgia') || q.includes('programa')) {
    return `### **Orden de Culto Dinámico Sugerido (90 Minutos)**
**Enfoque:** Adoración congregacional, edificación por la Palabra y comunión.

| Tiempo | Min | Momento de la Reunión | Detalle / Dinámica |
|---|---|---|---|
| **00 - 05** | 5m | **Bienvenida y Oración Inicial** | Saludo pastoral y oración poniendo el servicio en manos de Dios. |
| **05 - 20** | 15m | **Alabanza y Júbilo** | 2 a 3 cánticos de fiesta, gratitud y victoria congregacional. |
| **20 - 35** | 15m | **Adoración e Intimidad** | 2 cánticos profundos de adoración al Espíritu Santo y entrega. |
| **35 - 45** | 10m | **Ofrendas, Anuncios y Testimonios** | Oración por las ofrendas y video/anuncios breves de la iglesia. |
| **45 - 80** | 35m | **Mensaje de la Palabra** | Predicación expositiva con aplicación práctica a la vida diaria. |
| **80 - 87** | 7m | **Ministración y Llamado al Altar** | Música suave de fondo, oración por necesidades y nuevos creyentes. |
| **87 - 90** | 3m | **Despedida y Bendición Apostólica** | Números 6:24-26 y saludo fraternal entre los hermanos. |`
  }

  if (q.includes('alabanza') || q.includes('cancion') || q.includes('canto') || q.includes('musica')) {
    return `### **Repertorio de Alabanzas Sugerido para el Servicio**

#### **1. Apertura y Júbilo (Celebración y Gratitud)**
- **«Grande y Fuerte»** (Miel San Marcos) — *Declaración de victoria y majestad de Dios.*
- **«A Danzar»** (Gateway Worship / Christine D'Clario) — *Celebración de la libertad en Cristo.*
- **«Cantamos Aleluya»** (Elevation Worship) — *Júbilo congregacional y reconocimiento.*

#### **2. Adoración Íntima (Reverencia y Comunión)**
- **«Hermoso Nombre»** (Hillsong Worship) — *Enfoque cristocéntrico en el poder de Jesús.*
- **«La Bondad de Dios»** (Bethel Music / Jenn Johnson) — *Gratitud profunda por Su fidelidad constante.*
- **«Ven Espíritu Ven»** (Marco Barrientos) — *Invocación reverente de la presencia de Dios.*

#### **3. Altar y Ministración (Respuesta y Entrega)**
- **«Way Maker (Aquí Estás)»** (Sinach / Leeland) — *Fe en los milagros y promesas de Dios.*
- **«Tumbas a Jardines»** (Elevation Worship) — *Sanidad, restauración y nuevos comienzos.*`
  }

  if (q.includes('oracion') || q.includes('orar') || q.includes('bendicion') || q.includes('clamor')) {
    return `### **Oración Pastoral de Bendición y Cobertura**

*«Padre Celestial, Dios de Abraham, de Isaac y de Jacob, nos acercamos hoy ante Tu santa presencia con corazones agradecidos y rendidos a Tus pies.*

*Te damos gracias por el don inmerecido de Tu gracia en Cristo Jesús. Te pedimos que hoy descienda Tu Santo Espíritu sobre cada vida, cada familia y cada hogar aquí reunido. Sana al que está enfermo, levanta al que ha caído, consuela al afligido y renueva las fuerzas del cansado.*

*Declaramos que sobre esta casa reposa Tu paz, que sobrepasa todo entendimiento humano. Que la luz de Tu rostro resplandezca sobre nosotros y que salgamos de este lugar llenos de Tu unción, Tu amor y Tu poder para ser luz en el mundo.*

*Todo esto te lo pedimos en el nombre que es sobre todo nombre, en el nombre precioso de Jesús.*

**Amén y Amén.»**`
  }

  return `### **Palabra Pastoral de Fe y Aliento**

*«No temas, porque yo estoy contigo; no desmayes, porque yo soy tu Dios que te esfuerzo; siempre te ayudaré, siempre te sustentaré con la diestra de mi justicia.»* — **Isaías 41:10 (RVR1960)**

Recuerda que Dios nunca llega tarde. Sus promesas son firmes en Cristo Jesús, y en medio de cualquier desafío, Su gracia es más que suficiente para darte victoria, paz y dirección.

**Versículos de Victoria y Esperanza para Meditar:**
- **Filipenses 4:6-7:** *«Por nada estéis afanosos, sino sean conocidas vuestras peticiones delante de Dios... y la paz de Dios guardará vuestros corazones.»*
- **Romanos 8:28:** *«Y sabemos que a los que aman a Dios, todas las cosas les ayudan a bien.»*
- **Salmos 23:1:** *«Jehová es mi pastor; nada me faltará.»*`
}

/**
 * Envía una consulta no-streaming y devuelve la respuesta en texto plano.
 */
export async function chatWithAi(
  config: AiChatConfig,
  messages: AiChatMessage[]
): Promise<string> {
  const provider = config.provider ?? 'free'

  // Si es un proveedor de pago/personal con clave
  if (provider !== 'free') {
    try {
      const endpoint = resolveAiEndpoint(config)
      const prepared = prepareAiMessages(messages)
      const res = await fetch(endpoint.url, {
        method: 'POST',
        headers: endpoint.headers,
        body: JSON.stringify({
          model: endpoint.model,
          messages: prepared
        }),
        signal: AbortSignal.timeout(20000)
      })

      if (res.ok) {
        const data = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>
        }
        const content = data.choices?.[0]?.message?.content
        if (typeof content === 'string' && content.trim()) return content.trim()
      }
    } catch {
      // continuar a respaldo
    }
  }

  // Motor Gratuito Automático: 1. LLM7
  const prepared = prepareAiMessages(messages)
  try {
    const resLLM7 = await fetch('https://api.llm7.io/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'default',
        messages: prepared
      }),
      signal: AbortSignal.timeout(12000)
    })
    if (resLLM7.ok) {
      const data = (await resLLM7.json()) as {
        choices?: Array<{ message?: { content?: string } }>
      }
      const content = data.choices?.[0]?.message?.content
      if (typeof content === 'string' && content.trim()) return content.trim()
    }
  } catch {
    // LLM7 falló, intentar Pollinations
  }

  // 2. Respaldo Pollinations
  try {
    const resPolli = await fetch('https://text.pollinations.ai/openai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai',
        messages: prepared
      }),
      signal: AbortSignal.timeout(12000)
    })
    if (resPolli.ok) {
      const data = (await resPolli.json()) as {
        choices?: Array<{ message?: { content?: string } }>
      }
      const content = data.choices?.[0]?.message?.content
      if (typeof content === 'string' && content.trim()) return content.trim()
    }
  } catch {
    // Pollinations falló
  }

  // 3. Respaldo Teológico Local (Garantía 100% Offline)
  const lastUser = messages.filter((m) => m.role === 'user').pop()?.content ?? ''
  return generateLocalPastoralFallback(lastUser)
}

/**
 * Envía una consulta con streaming en tiempo real emitiendo cada fragmento a través de onChunk.
 * Incorpora tolerancia a fallos automática para funcionar gratis siempre.
 */
export async function streamAiChat(
  config: AiChatConfig,
  messages: AiChatMessage[],
  onChunk: (chunk: string) => void
): Promise<void> {
  const provider = config.provider ?? 'free'
  const prepared = prepareAiMessages(messages)

  // 1. Si el usuario configuró un proveedor propio con clave (Gemini, Groq, etc.)
  if (provider !== 'free') {
    const endpoint = resolveAiEndpoint(config)
    let res: Response
    try {
      res = await fetch(endpoint.url, {
        method: 'POST',
        headers: endpoint.headers,
        body: JSON.stringify({
          model: endpoint.model,
          messages: prepared,
          stream: true
        }),
        signal: AbortSignal.timeout(25000)
      })
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      throw new Error(`Error al conectar con ${provider}: ${errorMsg}`, { cause: err })
    }

    if (!res.ok || !res.body) {
      throw new Error(`Error de respuesta en ${provider} (HTTP ${res.status}).`)
    }

    await parseSseStream(res.body, onChunk)
    return
  }

  // 2. MODO GRATUITO PREDETERMINADO: Intento Primario con LLM7 (Gratis, ultra-rápido, sin claves)
  try {
    const resLLM7 = await fetch('https://api.llm7.io/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'default',
        messages: prepared,
        stream: true
      }),
      signal: AbortSignal.timeout(12000)
    })

    if (resLLM7.ok && resLLM7.body) {
      const emitted = await parseSseStream(resLLM7.body, onChunk)
      if (emitted) return
    }
  } catch {
    // Si LLM7 falla o tarda, saltar de inmediato al siguiente respaldo
  }

  // 3. MODO GRATUITO: Respaldo Secundario con Pollinations.ai
  try {
    const resPolli = await fetch('https://text.pollinations.ai/openai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai',
        messages: prepared,
        stream: true
      }),
      signal: AbortSignal.timeout(15000)
    })

    if (resPolli.ok && resPolli.body) {
      const emitted = await parseSseStream(resPolli.body, onChunk)
      if (emitted) return
    }
  } catch {
    // Si Pollinations falla o tiene rate limit
  }

  // 4. MODO GRATUITO: Respaldo Local Instantáneo (Garantía de Funcionamiento 100% Permanente)
  const lastUser = messages.filter((m) => m.role === 'user').pop()?.content ?? ''
  const localFallback = generateLocalPastoralFallback(lastUser)

  // Emitir la respuesta local de forma progresiva y natural
  const words = localFallback.split(' ')
  for (let i = 0; i < words.length; i += 3) {
    const chunk = words.slice(i, i + 3).join(' ') + ' '
    onChunk(chunk)
    await new Promise((resolve) => setTimeout(resolve, 30))
  }
}

/**
 * Procesa un stream SSE compatible con OpenAI
 */
async function parseSseStream(
  body: ReadableStream<Uint8Array> | NodeJS.ReadableStream,
  onChunk: (chunk: string) => void
): Promise<boolean> {
  const decoder = new TextDecoder()
  let buffer = ''
  let emitted = false

  for await (const value of body as AsyncIterable<Uint8Array>) {
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
          emitted = true
          onChunk(content)
        }
      } catch {
        // Ignorar trozos SSE incompletos
      }
    }
  }

  return emitted
}

export const AiService = {
  resolveEndpoint: resolveAiEndpoint,
  prepareMessages: prepareAiMessages,
  generateLocalPastoralFallback,
  chat: chatWithAi,
  streamChat: streamAiChat
}
