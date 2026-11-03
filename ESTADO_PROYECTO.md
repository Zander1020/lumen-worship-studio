# ESTADO ACTUAL Y MEMORIA DEL PROYECTO: LUMEN STUDIO
**Fecha de corte:** 3 de Noviembre de 2026  
**Última versión en desarrollo:** `v0.1.16` (previa publicada: `v0.1.15`)
**Repositorio GitHub:** [https://github.com/Zander1020/lumen-worship-studio](https://github.com/Zander1020/lumen-worship-studio)  
**Release activo:** `v0.1.14` (incluye `latest.yml`, `Lumen-Studio-Setup-0.1.14.exe` y `Lumen-Studio-Setup-0.1.14.exe.blockmap`)  
**Rama principal:** `main` (al día con `origin/main` y tags `v0.1.8`, `v0.1.9`, `v0.1.10`, `v0.1.11`, `v0.1.12` y `v0.1.13`)

---

## 1. Visión General del Proyecto
**Lumen Worship Studio** es un software de escritorio para Windows desarrollado con **Electron**, **Vite**, **React**, **TypeScript** y **Tailwind / CSS personalizado**. Está diseñado para la proyección y gestión de cultos eclesiásticos:
- **Alabanzas:** Canciones con estrofas, coros, tonalidades, tags, importación desde Holyrics (`.mufl` y `.json`).
- **Biblia:** 66 libros completos indexados localmente, con **múltiples versiones**: 8 versiones clásicas con texto real incluido (RVR1960, RVR1909, NVI, DHH, LBLA, TLA, NTV, PDT) + importación de versiones propias en XML/XMM seleccionables en tiempo real.
- **Medios:** Imágenes y vídeos a pantalla completa con categoría `Culto` o `Fondo`.
- **Diapositivas y Presentaciones:** Compatibilidad con documentos PDF y PowerPoint (`.pptx`, `.ppt`, `.ppsx`, `.pps`, `.potx`) con renderizado Full HD (1080p).
- **Proyección de Pantalla:** Ventana secundaria independiente para proyector o pantalla de transmisión con soporte de audio en videos proyectados y mute en previsualización de cabina.
- **Control Remoto Móvil:** Servidor local HTTP y WebSocket con PIN para operar diapositivas y alabanzas desde smartphones en la misma red Wi-Fi.

---

## 2. Decisiones Arquitectónicas y Reglas Críticas del Usuario

### Aislamiento estricto entre Medios y Diapositivas (REGLA FUNDAMENTAL)
- **Carpeta de Medios:** Almacena imágenes (`.jpg`, `.png`, etc.) y vídeos (`.mp4`, etc.). Ubicación física: `AppData\Roaming\Lumen Studio\media`.
- **Carpeta de Diapositivas:** Almacena única y exclusivamente presentaciones y documentos (`.pdf`, `.pptx`, `.ppt`, etc.). Ubicación física: `AppData\Roaming\Lumen Studio\diapositivas`.
- **Regla estricta:** Los documentos (PDF y PowerPoint) **NUNCA** deben listarse ni importarse en el panel ni pestaña de **Medios**. Medios solo contiene imágenes y videos.

### Sincronización de Diapositivas con el Disco Físico (v0.1.9)
- **Causa del problema previo:** Las diapositivas cargadas en versiones antiguas guardaban solo las imágenes generadas en el JSON del workspace (`lumen-workspace.json`) con `filePath: undefined`, sin copiar el archivo fuente a `AppData\Roaming\Lumen Studio\diapositivas`. Al presionar el botón 📁 de la app, la carpeta estaba vacía pero en la app seguían apareciendo elementos huérfanos.
- **Comportamiento implementado en v0.1.9:**
  1. **En 🔄 (`reloadSlides`):** La app compara cada presentación con los archivos existentes en la carpeta física `diapositivas\`. Si la carpeta está vacía o el archivo fue eliminado, la presentación se purga automáticamente de la base de datos y de la interfaz, cerrando pestañas de previsualización asociadas.
  2. **Detección de nuevos archivos en carpeta:** Si el usuario coloca archivos `.pptx` o `.pdf` directamente en `diapositivas\`, al pulsar 🔄 se detectan (`scanSlidesFolderFiles`), se convierten y se añaden automáticamente al sistema.
  3. **Al cargar (`+ Cargar Diapositiva / PDF`):** El archivo original se copia físicamente a `diapositivas\` y se enlaza con su ruta absoluta en disco.
  4. **Al eliminar (✕):** Si el usuario confirma la eliminación con el modal de confirmación, se borra el registro de la app y el archivo físico de la carpeta `diapositivas\`.

### Alertas y Modales de Confirmación
- Todos los botones de eliminar (✕) muestran el componente `ConfirmDeleteModal.tsx` con la estética oscura y moderna de la app antes de borrar cualquier elemento.

### Panel de Lista de Alabanzas (HomePage, pestaña Música)
- **📥 Importar lote:** Botón en el header del panel que acepta archivos `.mufl`, `.json`, `.hly`, `.xml` y `.txt` (uno o varios). Usa el parser Holyrics existente (`parseHolyricsCatalogPayload` vía IPC `importHolyricsCatalog`); los `.mufl` se convierten a `base64:` antes de enviarse.
- **➕ Nueva canción:** Botón en el header del panel que abre el modal de alabanza en modo creación (mismo modal de edición rápida reutilizado, con título "➕ Nueva alabanza"). Guarda vía `upsertSong`.

### Editor Gráfico (Diseño)
- Todas las acciones de edición del lienzo (seleccionar, arrastrar, redimensionar, rotar) responden **únicamente al clic izquierdo** (`e.button === 0` en `handlePointerDownLayer` y `handlePointerDownHandle`).
- El clic derecho está suprimido en el lienzo (`onContextMenu` con `preventDefault` en `ge-canvas-stage`).

### Audio en Proyección
- Las previsualizaciones en la pantalla del operador (cabina) tienen `muted={true}` para evitar ruidos indeseados.
- La ventana de proyección en vivo (`projectionWindow`) tiene audio habilitado al 100%.

---

### Descarga e Integración de Vídeos de YouTube en Medios (v0.1.14)
- **Funcionalidad:** Permite agregar vídeos directamente a Medios pegando un enlace de YouTube (estándar, shorts, embebidos o compartir).
- **Servicio Principal (`src/main/services/youtubeDownloader.ts`):**
  - Motor basado en el ejecutable standalone de `yt-dlp`. Localiza el ejecutable en el sistema (PATH, resources o `userData/bin`) y lo descarga automáticamente de GitHub Releases en primer uso si el equipo no lo tiene.
  - Extracción ultrarrápida de metadatos (título, autor, miniatura) mediante oEmbed de YouTube (<200 ms).
  - Sanitización de nombres de archivo y empaquetado en MP4 Full HD.
  - Cancelación limpia de descargas mediante terminación de subprocesos.
- **Canales IPC y Validación:**
  - `media:youtube-get-info`: Consulta metadatos del video.
  - `media:youtube-download`: Ejecuta la descarga y registra el medio en `WorkspaceStore` en la categoría indicada.
  - `media:youtube-cancel`: Cancela la descarga activa y limpia archivos temporales.
  - `media:youtube-progress`: Emite porcentaje, velocidad y tiempo estimado en tiempo real.
- **Componente Modal (`src/renderer/src/components/YoutubeDownloadModal.tsx`):**
  - Botón de pegar desde el portapapeles con un clic.
  - Previsualización inmediata de carátula y canal de YouTube.
  - Campo editable para renombrar el título antes de guardar.
  - Selector de categoría (Culto, Fondo, Anuncios, Bienvenida, Sermón, General).
  - Barra de progreso en tiempo real con % y velocidad.
- **Aislamiento estricto:** El vídeo descargado se almacena exclusivamente en `AppData\Roaming\Lumen Studio\media`, jamás en `diapositivas/`.

---

## 3. Estado Técnico del Código
- **Verificación completa:** `npm run check` (typecheck + lint + tests) en verde.
- **Build:** `npm run build` compila con 0 errores (tanto Node/Electron como Vite/Web).
- **Lint:** `eslint .` con **0 errores** tras limpieza completa de ~85 errores pre-existentes de `strictTypeChecked`. Solo queda 1 warning conocido e intencional en `BiblePage.tsx` (dependencia `query` en un `useEffect`, para no re-cargar el capítulo en cada tecla).
- **Tests:** 54 pruebas unitarias pasando al 100% con `vitest run` (incluye las 6 del parser de importación bíblica Zefania).
- **Publicación:** Configurada mediante `electron-builder --win -p always` apuntando a GitHub (`Zander1020/lumen-worship-studio`).
- **Token de GitHub:** Para publicar nuevas versiones se utiliza un token personal de GitHub clásico con scope `repo`.

---

## 4. Archivos Clave del Proyecto
- `src/main/state/workspaceStore.ts`: Gestión de canciones, cronograma (schedule), medios, presentaciones y persistencia en disco (`lumen-workspace.json`, `slidesDir`, `mediaDir`).
- `src/main/ipc/registerIpcHandlers.ts`: Enrutamiento de llamadas IPC entre Electron y la interfaz de usuario.
- `src/renderer/src/features/home/HomePage.tsx`: Pantalla principal del operador (estilo Holyrics), docks laterales, tabs de Culto, Medios y Diapositivas, previsualización y control en vivo.
- `src/renderer/src/features/home/presentationDocHelpers.ts`: Motores de renderizado HD para PDF (`pdfjs-dist`) y PowerPoint (`jszip` + XML parsing a canvas).
- `src/renderer/src/components/ConfirmDeleteModal.tsx`: Modal genérico de confirmación para borrado seguro de elementos.
- `src/main/data/bibleRepository.ts` & `src/shared/bibleImport.ts`: Repositorio multi-versión de la Biblia y parser XML Zefania (formato Holyrics) con tests.
- `src/renderer/src/features/bible/BiblePage.tsx`: UI de Biblia con selector de versiones, importación y búsqueda por versión.
- `src/renderer/src/features/design/GraphicEditorPage.tsx` & `exportUtils.ts`: Editor gráfico con exportación a PNG y LUMEN (`.lumen`).
- `src/renderer/src/components/SlidePreviewStage.tsx` & `holyricsFontFit.ts`: Lienzo de proyección y motor de auto-ajuste de fuente (extraído a módulo propio).
- `src/renderer/src/components/layout/HolyricsLeftDock.tsx`: Dock izquierdo (ahora solo cronograma; la pestaña MEDIOS fue retirada).
- `package.json` & `electron-builder.yml`: Configuración de versiones, dependencias y empaquetado para instaladores de Windows NSIS.

---

## 5. Tareas Completadas (31/10/2026) y Próximos Pasos

### Completadas en esta sesión
1. **Biblia multi-versión con importación propia:**
   - Parser XML Zefania (`src/shared/bibleImport.ts`, formato Holyrics) con 6 tests.
   - `BibleRepository` multi-versión: 8 versiones con texto real incluido (RVR1960, RVR1909, NVI, DHH, LBLA, TLA, NTV, PDT), `listVersions`/`importVersion`/`deleteVersion`; versiones propias persistidas en `AppData\\Roaming\\Lumen Studio\\bible\\` (`versions.json` + `<id>.json`).
   - Importar XML (Zefania) o .xmm (Holyrics) con nombre de una versión clásica (o su abreviatura) **completa esa ranura** y la convierte en el texto real de esa versión (en lugar de crear una entrada duplicada).
   - `BiblePage`: selector de versión con optgroups (Clásicas / Mis versiones), versiones sin datos marcadas como "(sin datos)" y deshabilitadas con aviso + botón para importar; botón ➕ importar con modal, ✕ con `ConfirmDeleteModal`, búsqueda y proyección por versión.
   - API: `listBibleVersions`, `importBibleVersion`, `deleteBibleVersion`, `listBibleBooks(version)`, `searchBible(query, version)` (preload + `LumenApi` + validación IPC).
2. **Editor gráfico — formato LUMEN:** la extensión de proyecto se renombró de `.lumen-design` a `.lumen`; botón "LUMEN (Editable)", selector de formato PNG/LUMEN, acepta `.lumen,.lumen-design,.json` al abrir, calidad oculta para png/lumen.
3. **Pestaña MEDIOS retirada del `HolyricsLeftDock`:** el dock izquierdo quedó exclusivo del cronograma.
4. **Limpieza total de ESLint:** de ~85 errores a **0** (`eslint --fix` + correcciones manuales: `any`→tipos concretos, `unknown` en catches, condiciones redundantes de tipos, `queueMicrotask` para `set-state-in-effect`, extracción de `computeHolyricsOptimalFontSize` a `holyricsFontFit.ts` para `react-refresh`, `UpdateStatus` compartido en `src/shared/api.ts`).
5. **Panel culto (HomePage, pestaña Medios):** cada fila muestra solo la miniatura (imagen o primer frame del vídeo) y el nombre del archivo; se eliminaron índice, subtítulo, categoría y botones por fila.

### Próximos pasos
- El proyecto se encuentra estable: `npm run check` y `npm run build` en verde, con la versión `v0.1.10` lista para publicar (pendiente de autorización explícita del usuario).
- Si el usuario reporta mejoras adicionales sobre diseño, animaciones de diapositivas o transiciones de video, mantener siempre la regla de separación de carpetas y aislamiento estricto de documentos.



### v0.1.16 — Potenciación Extrema de Inteligencia Artificial y Limpieza de Barra Superior
- **Retiro del buscador rápido de biblia en la barra superior:** Se eliminó el formulario de cita rápida `[Cita rápida (ej. jn3:16)...] [ ▶ ]` en `Sidebar.tsx`. La barra superior ahora muestra exclusivamente los botones de navegación y los conmutadores de tono neutro, logrando una interfaz limpia y despejada.
- **Servicio de IA Multimodelo (`src/main/services/aiService.ts`):**
  - Soporte de claves API de ultra alta velocidad: **Google Gemini Flash** (gratuito, <400ms) y **Groq Cloud** (Llama 3.3 70B a 500 tokens/s, gratis).
  - Soporte para OpenAI, DeepSeek, OpenRouter, Ollama local (100% offline) y modo gratuito Pollinations.
  - Manejo amigable y claro de cuota/rate-limits (HTTP 402/429) con recomendaciones directas de activación de Gemini/Groq.
- **Prompt Teológico y Pastoral Experto:** Respuestas bíblicas fundamentadas en las Escrituras (Reina-Valera 1960), cálidas, estructuradas en Markdown y directas al grano sin preámbulos robóticos.
- **Renovación Completa de la Interfaz de IA (`AiAssistantPage.tsx`):**
  - Chips de acción rápida con 1 clic: 📖 Versículos Bíblicos, 🎙️ Bosquejo de Sermón, ⛪ Orden de Culto, 🎵 Sugerir Alabanzas, 🙏 Oración Pastoral.
  - Botón de **📋 Copiar** al portapapeles con confirmación visual rápida.
  - Botón de **📺 Proyectar** que convierte de inmediato las respuestas o versículos en diapositivas y las proyecta en vivo en la pantalla de la iglesia.
  - Modal de Ajustes de IA (⚙️) para elegir proveedor, ingresar claves y personalizar modelos.
