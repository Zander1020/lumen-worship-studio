# Lumen Worship Studio

Aplicación de escritorio para Windows orientada a la proyección de alabanzas, pasajes bíblicos y contenido multimedia durante servicios de adoración, construida con **Electron**, **React**, **TypeScript** y **Vite** (`electron-vite`).

---

## Módulos incluidos

1. **Panel En Vivo Persistente (`LiveDock` estilo Holyrics moderno):**
   - Acoplado permanentemente a la derecha en todas las secciones con monitor 16:9 en tiempo real, controles de ventana de proyección, modos rápidos (*En vivo*, *Negro `B`*, *Sin texto `C`*, *Logo `L`*, *Prueba*), tira de diapositivas activas (*Anterior* / *Siguiente*) y acceso directo al orden del culto.
2. **Inicio (Panel de Control):**
   - Resumen de biblioteca, Biblia de 66 libros y orden del culto, con acceso rápido a cada módulo.
3. **Alabanzas (Biblioteca y Catálogo compatible con Holyrics):**
   - Creación, edición, eliminación y búsqueda instantánea por título, autor, tonalidad, etiquetas o letra, con vista dividida para lanzar estrofas en vivo con un clic.
   - **Importación y exportación compatible con Holyrics:** importa catálogos completos o canciones individuales en formato **Holyrics JSON (`.json` / `.hly`)**, **OpenLyrics / Holyrics XML (`.xml`)** y **Texto estructurado (`.txt`)**, o pegando lotes directamente, además de exportar toda la biblioteca a JSON compatible con Holyrics.
4. **Biblia Completa (Reina-Valera 66 libros sin conexión):**
   - Incluye los **66 libros completos** (39 del Antiguo Testamento y 27 del Nuevo Testamento, 1.189 capítulos y 31.104 versículos) integrados localmente.
   - Navegador de 3 columnas estilo Holyrics (Libro con filtro AT/NT → Cuadrícula de capítulos → Versículos con proyección en 1 clic), además de búsqueda por cita (`Juan 3:16`, `Salmos 23:1-6`, `Gn 1:1`) o palabras clave.
5. **Programación (Orden del Servicio):**
   - Gestión de la lista del culto (alabanzas, lecturas bíblicas y anuncios personalizados), reordenación arriba/abajo y proyección de cualquier bloque o diapositiva con un clic.
6. **Proyección (Motor en Vivo):**
   - Ventana independiente de proyección con soporte multimonitor (pantalla completa automática en monitor secundario o modo ventana).
   - Cinco modos de salida en tiempo real: **En vivo**, **Pantalla negra (`B`)**, **Sin texto (`C`)**, **Logo del culto (`L`)** y **Patrón de prueba**.
   - Personalización en caliente de tipografía (*Sans*, *Serif*, *Mono*), escala de fuente y alineación.
7. **Multimedia (Fondos y Temas):**
   - Galería de fondos degradados atmosféricos, colores sólidos de alto contraste e importación de imágenes locales desde el equipo sin conexión a Internet.
8. **Control Remoto Móvil (Red Local LAN):**
   - Servidor HTTP + Server-Sent Events (SSE) en red local protegido por PIN de 4 dígitos, con interfaz web móvil integrada para cambiar diapositivas y modos desde un teléfono o tableta en la misma red Wi-Fi.
9. **Inteligencia Artificial (Asistente Semántico Local):**
   - Sugeridor temático 100 % local (sin enviar datos a Internet) que recomienda alabanzas de la biblioteca, versículos bíblicos y diapositiva de bienvenida según el tema del sermón, además de un estructurador automático de letras.
10. **Configuración y Persistencia:**
    - Guardado automático en disco (`lumen-workspace.json` en `userData`) de canciones, programación, fondos y ajustes de la iglesia.

---

## Requisitos previos

- **Sistema operativo:** Windows 10 / 11 (x64)
- **Node.js:** `>= 22.12.0` (probado con Node.js `v22.18.0`)
- **npm:** `>= 10.x`

---

## Instalación

```powershell
cd lumen-worship-studio
npm install
```

El script `postinstall` ejecuta automáticamente `install-electron` para asegurar que el binario local de Electron esté descargado en `node_modules/electron/dist`.

---

## Comandos disponibles

| Comando | Descripción |
| --- | --- |
| `npm run dev` | Inicia la aplicación en modo desarrollo con recarga en caliente (Vite + Electron). |
| `npm start` | Ejecuta la aplicación compilada en modo vista previa (`electron-vite preview`). |
| `npm run typecheck` | Ejecuta la verificación estricta de tipos de TypeScript para Node (`main`/`preload`) y Web (`renderer`). |
| `npm run lint` | Analiza el código con ESLint (`strictTypeChecked` + reglas de React Hooks). |
| `npm test` | Ejecuta las pruebas unitarias y de componentes con Vitest (proyectos `node` y `renderer`). |
| `npm run test:e2e` | Compila la aplicación y ejecuta la prueba E2E sobre Electron real con Playwright. |
| `npm run build` | Verifica tipos y genera la compilación de producción en `out/` (`out/main`, `out/preload`, `out/renderer`). |
| `npm run check` | Ejecuta en cadena `typecheck`, `lint` y `test`. |
| `npm run dist:dir` | Compila y genera el empaquetado sin instalador para Windows en `release/`. |
| `npm run dist:win` | Compila y genera el instalador NSIS para Windows en `release/`. |

---

## Estructura del proyecto

```text
lumen-worship-studio/
├── e2e/
│   └── app.e2e.spec.ts                # Prueba E2E con Playwright + Electron real
├── src/
│   ├── shared/                        # Contratos y utilidades puras compartidas
│   │   ├── api.ts                     # Tipos de las APIs expuestas por contextBridge
│   │   ├── ipc.ts                     # Nombres de canales IPC y tipos de peticiones/estado
│   │   ├── models.ts                  # Modelos de dominio (Song, BibleVerse, ScheduleItem, etc.)
│   │   ├── sections.ts                # Definición de las 9 secciones del menú lateral
│   │   ├── sections.test.ts
│   │   ├── slideHelpers.ts            # Conversión de canciones/versículos a diapositivas y parser de letras
│   │   ├── slideHelpers.test.ts
│   │   ├── validation.ts              # Validación estricta de cargas IPC y orígenes URL
│   │   └── validation.test.ts
│   ├── main/                          # Proceso principal de Electron
│   │   ├── index.ts                   # Punto de entrada, ciclo de vida y bloqueo de instancia única
│   │   ├── data/
│   │   │   └── defaultSeeds.ts        # Himnos iniciales, versículos RV1909, fondos y ajustes por defecto
│   │   ├── ipc/
│   │   │   └── registerIpcHandlers.ts # Registro de canales IPC con verificación de remitente y carga
│   │   ├── remote/
│   │   │   ├── remoteControlServer.ts # Servidor LAN HTTP + SSE con PIN para control móvil
│   │   │   └── remoteControlServer.test.ts
│   │   ├── security/
│   │   │   ├── appSecurity.ts         # Bloqueo de navegación externa, popups, webview y permisos
│   │   │   ├── senderPolicy.ts        # Política de autorización de remitentes IPC
│   │   │   ├── senderPolicy.test.ts
│   │   │   ├── webPreferences.ts      # Preferencias seguras de BrowserWindow
│   │   │   └── webPreferences.test.ts
│   │   ├── state/
│   │   │   ├── statusStore.ts         # Estado en tiempo real de proyección en vivo y conexión móvil
│   │   │   ├── statusStore.test.ts
│   │   │   ├── workspaceStore.ts      # Almacén persistente de canciones, Biblia, programación y ajustes
│   │   │   └── workspaceStore.test.ts
│   │   └── windows/
│   │       ├── mainWindow.ts          # Creación de la ventana principal de control
│   │       ├── placement.ts           # Cálculo de posición/monitor para la proyección
│   │       ├── placement.test.ts
│   │       └── projectionWindow.ts    # Gestor de la ventana independiente de proyección
│   ├── preload/                       # Scripts preload aislados y ejecutados en sandbox
│   │   ├── mainWindow.ts              # Expone window.lumen a la ventana principal
│   │   └── projectionWindow.ts        # Expone window.lumenProjection a la ventana de proyección
│   └── renderer/                      # Interfaces de usuario en React + TypeScript
│       ├── index.html                 # Entrada HTML de la ventana principal (con CSP estricta)
│       ├── projection.html            # Entrada HTML de la ventana de proyección (con CSP estricta)
│       └── src/
│           ├── env.d.ts               # Declaración de tipos globales (window.lumen / lumenProjection)
│           ├── app/                   # Aplicación de la ventana principal
│           │   ├── App.tsx
│           │   ├── App.test.tsx
│           │   └── main.tsx
│           ├── projection/            # Aplicación de la ventana de proyección en vivo
│           │   ├── ProjectionApp.tsx
│           │   ├── ProjectionApp.test.tsx
│           │   └── main.tsx
│           ├── components/            # Componentes reutilizables y lienzo de diapositivas
│           │   ├── PlaceholderPage.tsx
│           │   ├── SlidePreviewStage.tsx
│           │   └── layout/
│           │       ├── Sidebar.tsx
│           │       └── StatusBar.tsx
│           ├── features/              # Módulos completos por sección funcional
│           │   ├── sectionRegistry.tsx
│           │   ├── home/HomePage.tsx
│           │   ├── songs/SongsPage.tsx
│           │   ├── bible/BiblePage.tsx
│           │   ├── schedule/SchedulePage.tsx
│           │   ├── projection/
│           │   │   ├── ProjectionControls.tsx
│           │   │   └── ProjectionPage.tsx
│           │   ├── media/MediaPage.tsx
│           │   ├── remote/RemoteControlPage.tsx
│           │   ├── ai/AiAssistantPage.tsx
│           │   └── settings/SettingsPage.tsx
│           ├── hooks/
│           │   └── useAppStatus.ts    # Sincronización del estado y acciones vía IPC
│           ├── lib/
│           │   └── statusLabels.ts    # Formateo legible del estado de proyección y móvil
│           ├── styles/
│           │   ├── app.css
│           │   └── projection.css
│           └── test/
│               └── setup.ts
├── electron.vite.config.mts           # Configuración de compilación para main, preload y renderer
├── electron-builder.yml               # Configuración de empaquetado para Windows
├── eslint.config.mjs                  # Configuración de ESLint (flat config)
├── playwright.config.ts               # Configuración de pruebas E2E
├── tsconfig.base.json                 # Opciones estrictas comunes de TypeScript
├── tsconfig.node.json                 # Proyecto TS para main, preload, shared y configs
├── tsconfig.web.json                  # Proyecto TS para renderer y shared
└── vitest.config.mts                  # Configuración de pruebas unitarias (node + jsdom)
```

---

## Arquitectura de seguridad

1. **Sandbox global:** `app.enableSandbox()` se invoca antes de que la aplicación esté lista y cada `BrowserWindow` se crea con `sandbox: true`.
2. **Aislamiento de contexto y sin Node en el renderer:** `contextIsolation: true`, `nodeIntegration: false`, `nodeIntegrationInWorker: false`, `nodeIntegrationInSubFrames: false` y `webviewTag: false`.
3. **Preloads mínimos por ventana:**
   - La ventana principal recibe únicamente `window.lumen`.
   - La ventana de proyección recibe únicamente `window.lumenProjection` (`getStatus`, `onStatusChanged`, `close`), sin capacidad de abrir ventanas ni invocar canales administrativos.
4. **Validación de IPC y remitentes:** cada canal `ipcMain.handle` verifica que el mensaje provenga del `mainFrame`, de un `webContents.id` autorizado para ese canal y de una URL local confiable (`file://` o el servidor local de Vite en desarrollo), además de validar el esquema de los argumentos recibidos.
5. **Sin carga de código remoto:** CSP estricta en ambos archivos HTML y bloqueo global de `setWindowOpenHandler`, `will-navigate`, `will-redirect`, `will-attach-webview` y solicitudes de permisos de sesión.
