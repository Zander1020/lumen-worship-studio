import { resolve } from 'node:path'
import { _electron as electron, expect, test } from '@playwright/test'
import { LUMEN_API_KEYS, LUMEN_PROJECTION_API_KEYS } from '../src/shared/api'
import { SECTIONS } from '../src/shared/sections'

test('abre y cierra ambas ventanas, proyecta diapositivas en vivo, patrón de prueba y mantiene la seguridad', async () => {
  delete process.env['ELECTRON_RUN_AS_NODE']
  const mainEntry = resolve(__dirname, '../out/main/index.js')
  const app = await electron.launch({
    args: [mainEntry]
  })

  try {
    const mainWin = await app.firstWindow()
    await mainWin.waitForLoadState('domcontentloaded')

    await expect(mainWin).toHaveTitle('Lumen Worship Studio')

    // Verificar aislamiento de contexto y superficie mínima de API en ventana principal
    const mainGlobals = await mainWin.evaluate(() => {
      const g = globalThis as Record<string, unknown>
      const lumen = g['lumen'] as Record<string, unknown> | undefined
      return {
        hasRequire: typeof g['require'] !== 'undefined',
        hasProcess: typeof g['process'] !== 'undefined',
        lumenKeys: Object.keys(lumen ?? {})
      }
    })
    expect(mainGlobals.hasRequire).toBe(false)
    expect(mainGlobals.hasProcess).toBe(false)
    expect(mainGlobals.lumenKeys).toEqual([...LUMEN_API_KEYS])

    // Verificar las 9 secciones del menú lateral
    const nav = mainWin.getByRole('navigation', { name: 'Secciones principales' })
    for (const section of SECTIONS) {
      await expect(nav.getByRole('button', { name: section.label })).toBeVisible()
    }

    // Verificar estado inicial de proyección y móvil
    await expect(mainWin.getByTestId('status-projection')).toContainText('Cerrada')
    await expect(mainWin.getByTestId('status-mobile')).toContainText('Servicio no iniciado')

    // Abrir la ventana de proyección en modo ventana
    const windowPromise = app.waitForEvent('window')
    await mainWin.getByRole('button', { name: 'Abrir en ventana' }).click()
    const projWin = await windowPromise
    await projWin.waitForLoadState('domcontentloaded')

    await expect(projWin).toHaveTitle('Lumen — Proyección (prueba)')
    await expect(projWin.getByTestId('projection-stage-live')).toBeVisible()
    await expect(projWin.getByText('Sublime gracia del Señor')).toBeVisible()
    await expect(mainWin.getByTestId('status-projection')).toContainText('Abierta (en ventana, en vivo)')
    expect(app.windows().length).toBe(2)

    // Ir a la sección Proyección y activar el Patrón de prueba
    await nav.getByRole('button', { name: 'Proyección' }).click()
    await mainWin.getByRole('button', { name: 'Patrón de prueba' }).click()
    await expect(projWin.getByText('CONTENIDO DE PRUEBA')).toBeVisible()
    await expect(mainWin.getByTestId('status-projection')).toContainText('Abierta (en ventana, prueba)')

    // Verificar aislamiento en ventana de proyección
    const projGlobals = await projWin.evaluate(() => {
      const g = globalThis as Record<string, unknown>
      const proj = g['lumenProjection'] as Record<string, unknown> | undefined
      return {
        hasRequire: typeof g['require'] !== 'undefined',
        hasLumenMain: typeof g['lumen'] !== 'undefined',
        projKeys: Object.keys(proj ?? {})
      }
    })
    expect(projGlobals.hasRequire).toBe(false)
    expect(projGlobals.hasLumenMain).toBe(false)
    expect(projGlobals.projKeys).toEqual([...LUMEN_PROJECTION_API_KEYS])

    // Cerrar la ventana de proyección desde la ventana principal
    const closePromise = projWin.waitForEvent('close')
    await mainWin.getByRole('button', { name: 'Cerrar proyección' }).click()
    await closePromise

    await expect(mainWin.getByTestId('status-projection')).toContainText('Cerrada')
    expect(app.windows().length).toBe(1)
  } finally {
    await app.close()
  }
})
