import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AiService,
  GROQ_CHAT_COMPLETIONS_URL,
  GROQ_DEFAULT_MODEL,
  GROQ_SYSTEM_PROMPT
} from './aiService'

const TEST_GROQ_KEY = 'test-groq-api-key'

describe('AiService (Groq)', () => {
  const prevGroqEnv = process.env['GROQ_API_KEY']

  beforeEach(() => {
    process.env['GROQ_API_KEY'] = TEST_GROQ_KEY
  })

  afterEach(() => {
    if (prevGroqEnv === undefined) {
      delete process.env['GROQ_API_KEY']
    } else {
      process.env['GROQ_API_KEY'] = prevGroqEnv
    }
    vi.restoreAllMocks()
  })

  describe('resolveEndpoint', () => {
    it('resuelve el endpoint y clave configurada de Groq por defecto', () => {
      const endpoint = AiService.resolveEndpoint()
      expect(endpoint.url).toBe(GROQ_CHAT_COMPLETIONS_URL)
      expect(endpoint.model).toBe(GROQ_DEFAULT_MODEL)
      expect(endpoint.headers['Content-Type']).toBe('application/json')
      expect(endpoint.headers['Authorization']).toBe(`Bearer ${TEST_GROQ_KEY}`)
    })

    it('permite sobrescribir clave y modelo si se pasan en config', () => {
      const endpoint = AiService.resolveEndpoint({
        apiKey: 'custom-groq-key',
        model: 'openai/gpt-oss-20b'
      })
      expect(endpoint.headers['Authorization']).toBe('Bearer custom-groq-key')
      expect(endpoint.model).toBe('openai/gpt-oss-20b')
    })

    it('lanza error claro si falta la clave API de Groq', () => {
      delete process.env['GROQ_API_KEY']
      expect(() => AiService.resolveEndpoint()).toThrow(/Falta la clave API de Groq/i)
    })
  })

  describe('prepareMessages', () => {
    it('agrega el prompt del asistente si no hay mensaje de sistema', () => {
      const prepared = AiService.prepareMessages([{ role: 'user', content: 'Hola Groq' }])
      expect(prepared[0]?.role).toBe('system')
      expect(prepared[0]?.content).toBe(GROQ_SYSTEM_PROMPT)
      expect(prepared[1]?.content).toBe('Hola Groq')
    })

    it('conserva el mensaje de sistema existente si ya fue provisto', () => {
      const prepared = AiService.prepareMessages([
        { role: 'system', content: 'Instrucción previa' },
        { role: 'user', content: 'Hola' }
      ])
      expect(prepared).toHaveLength(2)
      expect(prepared[0]?.content).toBe('Instrucción previa')
    })
  })

  describe('chat y streamChat', () => {
    it('envía la petición a Groq y devuelve la respuesta de texto', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: 'Hola desde Groq' } }]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )

      const reply = await AiService.chat({}, [{ role: 'user', content: 'Hola' }])
      expect(reply).toBe('Hola desde Groq')
      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [calledUrl, calledInit] = fetchMock.mock.calls[0] ?? []
      expect(calledUrl).toBe(GROQ_CHAT_COMPLETIONS_URL)
      expect(calledInit?.method).toBe('POST')
      expect((calledInit?.headers as Record<string, string>)['Authorization']).toBe(
        `Bearer ${TEST_GROQ_KEY}`
      )
    })

    it('procesa streaming SSE emitiendo solo delta.content y omitiendo delta.reasoning', async () => {
      const encoder = new TextEncoder()
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              'data: {"choices":[{"delta":{"reasoning":"pensando..."}}]}\n\n' +
                'data: {"choices":[{"delta":{"content":"Hola "}}]}\n\n' +
                'data: {"choices":[{"delta":{"content":"iglesia"}}]}\n\n' +
                'data: [DONE]\n\n'
            )
          )
          controller.close()
        }
      })

      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
      )

      const chunks: string[] = []
      await AiService.streamChat({}, [{ role: 'user', content: 'Saluda' }], (chunk) => {
        chunks.push(chunk)
      })

      expect(chunks.join('')).toBe('Hola iglesia')
    })

    it('lanza error claro si Groq responde HTTP 401', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ error: { message: 'Invalid API Key' } }), { status: 401 })
      )

      await expect(AiService.chat({}, [{ role: 'user', content: 'Hola' }])).rejects.toThrow(
        /Clave API de Groq/i
      )
    })
  })
})
