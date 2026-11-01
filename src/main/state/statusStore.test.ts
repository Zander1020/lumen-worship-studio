import { describe, expect, it, vi } from 'vitest'
import { StatusStore, createInitialStatus } from './statusStore'

describe('StatusStore', () => {
 it('inicia con la proyección cerrada, diapositivas iniciales cargadas y conexión móvil no iniciada', () => {
 const store = new StatusStore(createInitialStatus(2))
 const status = store.get()
 expect(status.projection.windowOpen).toBe(false)
 expect(status.projection.displayCount).toBe(2)
 expect(status.projection.live.mode).toBe('live')
 expect(status.projection.live.slides.length).toBeGreaterThan(0)
 expect(status.mobile).toEqual({
 state: 'not-started',
 connectedClients: 0
 })
 })

 it('permite navegar entre diapositivas, cambiar de modo y notificar a suscriptores', () => {
 const store = new StatusStore()
 const listener = vi.fn()
 const unsubscribe = store.subscribe(listener)

 store.updateProjection({ windowOpen: true, displayId: 10 })
 expect(listener).toHaveBeenCalledTimes(1)
 expect(store.get().projection.windowOpen).toBe(true)

 store.goToSlide({ direction: 'next' })
 expect(store.get().projection.live.currentIndex).toBe(1)

 store.goToSlide({ direction: 'prev' })
 expect(store.get().projection.live.currentIndex).toBe(0)

 store.setMode('test-pattern')
 expect(store.get().projection.content).toBe('test-pattern')
 expect(store.get().projection.live.mode).toBe('test-pattern')

 unsubscribe()
 store.updateMobile({ state: 'waiting' })
 expect(listener).toHaveBeenCalledTimes(4)
 })
})
