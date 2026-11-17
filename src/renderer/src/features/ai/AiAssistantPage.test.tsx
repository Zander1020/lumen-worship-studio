import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AiAssistantPage } from './AiAssistantPage'

describe('AiAssistantPage', () => {
  afterEach(() => {
    localStorage.clear()
    delete (window as unknown as { lumen?: unknown }).lumen
    vi.restoreAllMocks()
  })

  it('muestra la interfaz limpia de Groq AI y transmite mensajes por streaming', async () => {
    const user = userEvent.setup()
    let emitChunk: ((p: { requestId: string; chunk: string; done: boolean; error?: string }) => void) | null = null

    const chatWithAIStream = vi.fn(({ requestId }: { requestId: string }) => {
      emitChunk?.({ requestId, chunk: 'Hola ', done: false })
      emitChunk?.({ requestId, chunk: 'desde Groq!', done: false })
      emitChunk?.({ requestId, chunk: '', done: true })
      return Promise.resolve()
    })

    const onAIChatChunk = vi.fn(
      (listener: (p: { requestId: string; chunk: string; done: boolean; error?: string }) => void) => {
        emitChunk = listener
        return () => {
          emitChunk = null
        }
      }
    )

    ;(window as unknown as { lumen: unknown }).lumen = {
      chatWithAIStream,
      onAIChatChunk
    }

    render(<AiAssistantPage />)

    expect(screen.getByRole('heading', { name: /Chat con Groq AI/i })).toBeInTheDocument()
    expect(screen.queryByText(/Opciones avanzadas/i)).not.toBeInTheDocument()

    const input = screen.getByRole('textbox', { name: 'Mensaje para Groq AI' })
    await user.type(input, 'Hola')
    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Enviar' }))
    })

    expect(chatWithAIStream).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Hola desde Groq!')).toBeInTheDocument()
  })
})

