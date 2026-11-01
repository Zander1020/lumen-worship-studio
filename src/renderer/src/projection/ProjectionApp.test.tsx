import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createInitialLiveState } from '../../../main/state/statusStore'
import type { LumenProjectionApi } from '../../../shared/api'
import { ProjectionApp } from './ProjectionApp'

describe('ProjectionApp (ventana de proyección)', () => {
 let mockProjectionApi: LumenProjectionApi

 beforeEach(() => {
 const live = createInitialLiveState()
 live.mode = 'test-pattern'
 mockProjectionApi = {
 getStatus: vi.fn().mockResolvedValue({
 projection: {
 windowOpen: true,
 fullscreen: false,
 displayId: 1,
 displayCount: 1,
 content: 'test-pattern',
 live
 },
 mobile: {
 state: 'not-started',
 connectedClients: 0
 }
 }),
 onStatusChanged: vi.fn().mockReturnValue(() => undefined),
 close: vi.fn().mockResolvedValue({
 projection: {
 windowOpen: false,
 fullscreen: false,
 displayId: null,
 displayCount: 1,
 content: 'test-pattern',
 live
 },
 mobile: {
 state: 'not-started',
 connectedClients: 0
 }
 })
 }
 Object.defineProperty(window, 'lumenProjection', {
 value: mockProjectionApi,
 configurable: true,
 writable: true
 })
 })

 it('muestra contenido de prueba claramente identificado y permite cerrar con Escape', async () => {
 render(<ProjectionApp />)

 expect(screen.getByTestId('projection-test-pattern')).toBeInTheDocument()
 expect(screen.getByText('CONTENIDO DE PRUEBA')).toBeInTheDocument()
 expect(screen.getByText(/Ventana de proyección — pantalla de prueba/i)).toBeInTheDocument()
 expect(await screen.findByText(/Monitores detectados: 1/i)).toBeInTheDocument()

 fireEvent.keyDown(window, { key: 'Escape' })
 expect(mockProjectionApi.close).toHaveBeenCalledTimes(1)
 })
})
