import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

// Garantiza que Electron no se ejecute en modo Node puro cuando se lanza desde
// terminales integradas de IDEs basados en Electron (VS Code / Antigravity).
delete process.env['ELECTRON_RUN_AS_NODE']

const root = import.meta.dirname

function readLocalEnvValue(key: string): string {
  const fromEnv = process.env[key]?.trim()
  if (fromEnv) return fromEnv
  const envPath = resolve(root, '.env')
  if (!existsSync(envPath)) return ''
  const lines = readFileSync(envPath, 'utf-8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    if (trimmed.slice(0, eq).trim() === key) {
      return trimmed
        .slice(eq + 1)
        .trim()
        .replace(/^["']|["']$/g, '')
    }
  }
  return ''
}

export default defineConfig({
  main: {
    define: {
      __LUMEN_BUILD_GROQ_API_KEY__: JSON.stringify(readLocalEnvValue('GROQ_API_KEY'))
    },
    plugins: [
      {
        name: 'copy-bible-json',
        writeBundle() {
          const outDir = resolve(root, 'out/main')
          mkdirSync(outDir, { recursive: true })
          for (const file of ['es_rvr.json', 'es_rvr1909.json', 'es_nvi.json', 'es_dhh.json', 'es_lbla.json', 'es_tla.json', 'es_ntv.json', 'es_pdt.json']) {
            const src = resolve(root, 'src/main/data', file)
            if (existsSync(src)) {
              copyFileSync(src, resolve(outDir, file))
            }
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

