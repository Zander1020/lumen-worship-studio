import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

// Garantiza que Electron no se ejecute en modo Node puro cuando se lanza desde
// terminales integradas de IDEs basados en Electron (VS Code / Antigravity).
delete process.env['ELECTRON_RUN_AS_NODE']

const root = import.meta.dirname

export default defineConfig({
  main: {
    plugins: [
      {
        name: 'copy-bible-json',
        writeBundle() {
          const src = resolve(root, 'src/main/data/es_rvr.json')
          const outDir = resolve(root, 'out/main')
          if (existsSync(src)) {
            mkdirSync(outDir, { recursive: true })
            copyFileSync(src, resolve(outDir, 'es_rvr.json'))
          }
        }
      }
    ],
    build: {
      rolldownOptions: {
        input: { index: resolve(root, 'src/main/index.ts') }
      }
    }
  },
  preload: {
    build: {
      // Los preloads en sandbox no pueden cargar fragmentos compartidos:
      // cada preload se genera como un único archivo autónomo.
      isolatedEntries: true,
      externalizeDeps: false,
      rolldownOptions: {
        input: {
          mainWindow: resolve(root, 'src/preload/mainWindow.ts'),
          projectionWindow: resolve(root, 'src/preload/projectionWindow.ts')
        }
      }
    }
  },
  renderer: {
    root: resolve(root, 'src/renderer'),
    plugins: [react()],
    build: {
      rolldownOptions: {
        input: {
          index: resolve(root, 'src/renderer/index.html'),
          projection: resolve(root, 'src/renderer/projection.html')
        }
      }
    }
  }
})

