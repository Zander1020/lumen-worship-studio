import { describe, expect, it } from 'vitest'
import { AiService, PASTORAL_SYSTEM_PROMPT } from './aiService'

describe('AiService', () => {
  describe('resolveEndpoint', () => {
    it('resuelve el endpoint por defecto (free) hacia LLM7 de forma 100% gratuita y sin claves', () => {
      const endpoint = AiService.resolveEndpoint({ provider: 'free' })
      expect(endpoint.url).toBe('https://api.llm7.io/v1/chat/completions')
      expect(endpoint.model).toBe('default')
      expect(endpoint.headers['Content-Type']).toBe('application/json')
      expect(endpoint.headers['Authorization']).toBeUndefined()
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

  describe('generateLocalPastoralFallback', () => {
    it('genera un bosquejo de sermón homilético ante consultas de predicación', () => {
      const result = AiService.generateLocalPastoralFallback('Quiero un bosquejo de sermón')
      expect(result).toContain('Bosquejo Homilético')
      expect(result).toContain('Efesios 2:8')
      expect(result).toContain('Conclusión')
    })

    it('genera un orden de culto estructurado ante consultas de liturgia', () => {
      const result = AiService.generateLocalPastoralFallback('Dame el orden de culto dominical')
      expect(result).toContain('Orden de Culto Dinámico')
      expect(result).toContain('Alabanza y Júbilo')
      expect(result).toContain('Mensaje de la Palabra')
    })

    it('sugiere canciones cristianas ante consultas de alabanza', () => {
      const result = AiService.generateLocalPastoralFallback('Sugerir alabanzas para el domingo')
      expect(result).toContain('Repertorio de Alabanzas')
      expect(result).toContain('Apertura y Júbilo')
      expect(result).toContain('Hermoso Nombre')
    })

    it('redacta una oración pastoral ante peticiones de oración', () => {
      const result = AiService.generateLocalPastoralFallback('Escribe una oración pastoral')
      expect(result).toContain('Oración Pastoral')
      expect(result).toContain('Padre Celestial')
      expect(result).toContain('Amén y Amén')
    })

    it('proporciona palabras de fe y aliento bíblico para cualquier otra consulta', () => {
      const result = AiService.generateLocalPastoralFallback('palabra de Dios para hoy')
      expect(result).toContain('Palabra Pastoral de Fe y Aliento')
      expect(result).toContain('Isaías 41:10')
      expect(result).toContain('Salmos 23:1')
    })
  })
})
