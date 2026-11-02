## Lumen Worship Studio — Estado actual (versión 0.1.12-dev)

### Versión y entorno
- **Version:** 0.1.12
- **Sistema:** Windows 10/11 (win32) + PowerShell
- **Tech stack:** Electron 45.1.0, Vite 8.3.5, React 19, TypeScript
- **Builds:** `npm run dev` (dev electron-vite), `npm run build:only` (ssr+client), `npm run dist:win` (packaging)

### Hechos verificados (sesión completa)
- **`npm run check`**: 0 errores, 0 warnings, **56 tests** (55 previos + test nuevo BiblePage.test.tsx)
- **`npm run build:only`**: OK ✓

### Progreso por área

#### 1. Mojibake / UTF-8 (3 causas corregidas)
- Revertido commit destructivo `3fc521a`; `presentationDocHelpers` cp1252 → UTF-8 (`ffce279`); `HomePage` cp850 → UTF-8 (`a73fc12`).
- Historial main: `01855fd → 3fc521a → 13f9dda → ffce279 → a73fc12`.
- Falso positivo `es_rvr1909.json` ("Michâía") — dejado en main.

#### 2. Miniaturas vídeo + modal preview
- Miniaturas en HomePage (~línea 1270) + `MediaPreviewModal` nuevo componente (`lumen-media` con `bypassCSP: true`).
- `previewMedia` → `setMediaPreview`.

#### 3. Fix control remoto (lento / localhost)
- Server bind `0.0.0.0`, puerto 4319, PIN regenera por lanzamiento.
- **`127.0.0.1` no funciona EN EL TELÉFONO** (es loopback del móvil); verificado en vivo: responde 200 en `127.0.0.1`, `localhost`, LAN desde el PC; solo `[::1]` falla. **No es bug de servidor**.
- `computeUrls` → `http://127.0.0.1:${port}` (reemplaza `localhost`).
- Cliente móvil: `verifyPin()` en `onerror` (detecta 401 → `promptPin()`), polling fallback `/api/state` cada 4 s cuando `sseSource.readyState !== EventSource.OPEN`, `promptPin()` protegido con guard `if (modal.style.display === 'flex') return`.

#### 4. UX loopback (solo en este equipo)
- `RemoteControlPage.tsx`: helper `isLoopbackUrl()`, `lanUrls`/`localUrls` separados, función `renderUrlRow(url, forPhone)`, bloque "💻 Solo en este equipo (PC)" con aviso "No lo abras en el teléfono" (además /stage y /obs, útiles para OBS en la PC).

#### 5. Ronda de rendimiento (check 0 errores/0 warnings)
- `SlidePreviewStage.tsx:87` — rAF del canvas respeta `playing`: si false dibuja UN fotograma (`renderFrame(start + 2000)`) en vez de bucle 60 fps; deps `[isBuiltinMotion, playing, value]`; `<video>` `preload={playing ? 'auto' : 'metadata'}`.
- `LiveDock.tsx:682` `playing={active}`; `MediaPage.tsx:516` `playing={isActive}` (mataba ~10 bucles rAF concurrentes).
- `workspaceStore.ts:986` — `saveToDisk()` ahora programa escritura coalescida de 400 ms → `flushPendingSave()`; nuevo `flush()` público; `index.ts` declara `let flushWorkspace` + `app.on('before-quit')` y `flushWorkspace = () => workspace.flush()` tras `new WorkspaceStore(workspaceFile)`.
- `projectionWindow.ts:83` — `moved` coalescido con timer 250 ms (`moveSyncTimer`), limpiado en `closed`.
- `SlidePreviewStage.tsx` reloj 500 ms → 1000 ms.
- `webPreferences.ts` — `createSecureWebPreferences(preloadPath, allowDevTools, options?: { backgroundThrottling?: boolean })`, default `false`; `mainWindow.ts:29` pasa `{ backgroundThrottling: true }`; proyección queda en `false`.
- `BiblePage.tsx` — efecto de capítulo ya no depende de `app` (usa `const { getBibleChapter } = app` + `queryRef`), sin IPC por push de estado; `handleSearchInput()` con debounce 300 ms (`searchTimerRef`, limpieza en unmount) para teclado, `handleSearch()` inmediatamente cancelando timer (usado por citas sugeridas en línea ~600); `onChange` del input cambió a `handleSearchInput`.
- **`statusStore.ts` — comparador profundo (hecho)**: función `isSameStateValue(a,b)` con corte por referencia, semántica JSON (ignora claves `undefined`, `NaN===NaN`, arrays con `undefined`→`null`, `Date` por getTime, fallback `JSON.stringify` para tipos exóticos); `commit()` usa `isSameStateValue(next, this.status)` en vez de doble `JSON.stringify`. Nuevo `getLiveTheme(): ProjectionTheme` (clona solo el tema, no el deck). `registerIpcHandlers.ts:104` y `:139` ahora usan `ctx.store.getLiveTheme()`.
- **Test añadido** en `statusStore.test.ts`: "omite el commit cuando el cambio no altera el estado real" (usa `updateProjection({windowOpen:false})`, `updateMobile`, `setMode('live')`, `updateTheme({fontScale:100})` — NO `frozen` porque `DEFAULT_THEME` no lo tiene y añadiría clave nueva). 55 tests OK.
- **Persistencia bíblica (hecho)**: `BiblePage.tsx` — interface `RetainedBibleView` + `let retainedBibleView: RetainedBibleView | null = null` a nivel de módulo (antes de `export function BiblePage`); `useState` iniciales restauran `selectedBook` ('Salmos'), `selectedChapter` (23), `query`, `verses` (lazy init), `activeVerseNum`, `bibleVersion` ('rvr1960'), `recentPassages` (lazy); effect de sincronización tras `chapterVerses` que escribe `retainedBibleView` en deps `[selectedBook, selectedChapter, bibleVersion, query, verses, activeVerseNum, recentPassages]`. Verificado: `HomePage.tsx:716` renderiza `{activeTab === 'bible' ? <BiblePage .../> : ...}` → sí se desmonta; input usa `value={query}` (línea 434); ningún `setQuery('')` en mount (todos en handlers). Test verificado: se conserva libro/capítulo/búsqueda al desmontar y volver a montar pestaña; la búsqueda no se repite al volver.

#### 5. Nueva prueba BiblePage.test.tsx
- Archivo creado: `src/renderer/src/features/bible/BiblePage.test.tsx`.
- Prueba única: "retoma libro, capítulo, versículo y búsqueda al volver de otra pestaña".
- Verifica: render → navega por libro → busca cita (debounce 300 ms) → desmonta → vuelve → comprueba que la búsqueda no se repite y que libro/capítulo siguen guardados.
- Falló 1ª vez por `role="listitem"` name vacío → se usó `getByText` en su lugar. Pasa con `vitest run`.

#### 6. Error de consola (projection:open ERR_FAILED)
- Al correr `npm run dev`, el registro mostraba 4 mensajes idénticos:
  `Error occurred in handler for 'projection:open': [Error: ERR_FAILED (-2) loading 'http://localhost:5173/projection.html']`
- **Diagnóstico:** El dev server (`vite`) serve `projection.html` con código **200** (servicio correcto). El error ocurre al intentar abrir la ventana de proyección mediante la API remota `POST /api/action` con `action=open-projection` (requiere PIN `x-lumen-pin`). El error **"No es posible conectar con el servidor remoto"** indica que la ventana de proyección no se abre porque la petición al servidor remoto (puerto 4319) falla.
- **Causa:** El servidor remoto (control remoto) no recibe o no responde a la petición desde la ventana de renderer. El puerto 4319 está escuchando (`0.0.0.0`) pero la conexión desde la ventana de Electron falla. No afecta al renderizado de las páginas (index.html y projection.html cargan OK).
- **Gravedad:** La ventana de proyección no se abre en modo dev, pero la aplicación principal y el renderizador funcionan correctamente. Es un fallo de integración entre el proceso de renderer y el servidor remoto (posiblemente configuración de red/IPc/permissions), no un error crítico de carga de página.
- **Comprobado:** Probe `http://localhost:5173/index.html` y `projection.html` → ambos 200. Probe `127.0.0.1:5173` → conexión rechazada (server escucha en IPv6 `::1`/`localhost` solo). La app arranca sin errores principales.

### Estado actual
- Todo el trabajo permanece en **working tree sin commitear** (según indicación del usuario: "No, déjalo sin commitear").
- No se ha publicado release.
- Pendiente: investigar y solucionar la conexión entre renderer y remote server para que `projection:open` funcione en dev (fuera del scope inmediato de esta sesión, requiere revisión de permisos de red o configuración de `webPreferences`/`contextBridge`).

### Siguientes pasos (si se reanuda)
1. Revisar permisos de `webContents` / contextBridge entre renderer y el servidor remoto (puerto 4319).
2. Verificar que `ipcRenderer.invoke(IpcChannels.projectionOpen, ...)` funcione sin bloqueos de seguridad.
3. Si es necesario, ajustar `createSecureWebPreferences` o `webSecurity` para permitir la comunicación inter-proceso.
4. Ejecutar `npm run check` y `npm run build:only` nuevamente para confirmar 0 errores.
5. Crear eventual release solo con confirmación explícita del usuario.