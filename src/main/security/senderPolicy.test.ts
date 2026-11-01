import { describe, expect, it } from 'vitest'
import { isSenderAllowed } from './senderPolicy'

describe('isSenderAllowed', () => {
  it('acepta un remitente autorizado en el frame principal con URL file://', () => {
    expect(
      isSenderAllowed(
        {
          webContentsId: 1,
          frameUrl: 'file:///C:/app/out/renderer/index.html',
          isMainFrame: true
        },
        [1, 2]
      )
    ).toBe(true)
  })

  it('rechaza subframes, ventanas no autorizadas y orígenes remotos', () => {
    expect(
      isSenderAllowed(
        {
          webContentsId: 1,
          frameUrl: 'file:///C:/app/out/renderer/index.html',
          isMainFrame: false
        },
        [1]
      )
    ).toBe(false)

    expect(
      isSenderAllowed(
        {
          webContentsId: 99,
          frameUrl: 'file:///C:/app/out/renderer/index.html',
          isMainFrame: true
        },
        [1]
      )
    ).toBe(false)

    expect(
      isSenderAllowed(
        {
          webContentsId: 1,
          frameUrl: 'https://malicious.example.com',
          isMainFrame: true
        },
        [1]
      )
    ).toBe(false)
  })
})

