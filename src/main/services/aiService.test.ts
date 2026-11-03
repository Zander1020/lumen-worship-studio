import { describe, expect, it } from 'vitest'
import { AiService, PASTORAL_SYSTEM_PROMPT } from './aiService'

describe('AiService', () => {
  describe('resolveEndpoint', () => {
    it('resuelve el endpoint por defecto (free) hacia pollinations con modelo openai', () => {
      const endpoint = AiService.resolveEndpoint({ provider: 'free' })
      expect(endpoint.url).toBe('https://text.pollinations.ai/openai')
      expect(endpoint.model).toBe('openai')
      expect(endpoint.headers['Content-Type']).toBe('application/json')
    })

    it('resuelve el endpoint de gemini con clave y modelo por defecto', () => {
      const endpoint = AiService.resolveEndpoint({
        provider: 'gemini',
        apiKey: 'test-gemini-key'
      })
      expect(endpoint.url).toContain('googleapis.com')
      expect(endpoint.headers['Authorization']).toBe('Bearer test-gemini-key')
      expect(endpoint.model).toBe('gemini-2.0-flash')
    })

    it('permite sobrescribir el modelo en gemini', () => {
      const endpoint = AiService.resolveEndpoint({
        provider: 'gemini',
        apiKey: 'test-key',
        model: 'gemini-1.5-flash'
      })
      expect(endpoint.model).toBe('gemini-1.5-flash')
    })

    it('resuelve el endpoint de groq con modelo ultra-rápido por defecto', () => {
      const endpoint = AiService.resolveEndpoint({
        provider: 'groq',
        apiKey: 'test-groq-key'
      })
      expect(endpoint.url).toContain('api.groq.com')
      expect(endpoint.headers['Authorization']).toBe('Bearer test-groq-key')
      expect(endpoint.model).toBe('llama-3.3-70b-versatile')
    })

    it('resuelve el endpoint de ollama local', () => {
      const endpoint = AiService.resolveEndpoint({
        provider: 'ollama',
        customUrl: 'http://localhost:11434'
      })
      expect(endpoint.url).toBe('http://localhost:11434/v1/chat/completions')
      expect(endpoint.model).toBe('llama3.2')
    })

    it('arroja error descriptivo si falta la clave en gemini', () => {
      expect(() => AiService.resolveEndpoint({ provider: 'gemini' })).toThrow(/Google Gemini/)
    })

    it('arroja error descriptivo si falta la clave en groq', () => {
      expect(() => AiService.resolveEndpoint({ provider: 'groq' })).toThrow(/Groq/)
    })

    it('arroja error descriptivo si falta la clave en openai', () => {
      expect(() => AiService.resolveEndpoint({ provider: 'openai' })).toThrow(/OpenAI/)
    })
  })

  describe('prepareMessages', () => {
    it('agrega el prompt pastoral si no hay mensaje de sistema', () => {
      const prepared = AiService.prepareMessages([
        { role: 'user', content: '¿Qué dice Juan 3:16?' }
      ])
      expect(prepared[0]?.role).toBe('system')
      expect(prepared[0]?.content).toBe(PASTORAL_SYSTEM_PROMPT)
      expect(prepared[1]?.content).toBe('¿Qué dice Juan 3:16?')
    })

    it('conserva el mensaje de sistema existente si ya fue provisto', () => {
      const prepared = AiService.prepareMessages([
        { role: 'system', content: 'Instrucción previa' },
        { role: 'user', content: 'Hola' }
      ])
      expect(prepared.length).toBe(2)
      expect(prepared[0]?.content).toBe('Instrucción previa')
    })
  })
})
