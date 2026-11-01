import { useState } from 'react'
import type { ProjectionTarget } from '../../../../shared/ipc'
import type { UseAppStatus } from '../../hooks/useAppStatus'

export interface SettingsPageProps {
 app: UseAppStatus
}

export function SettingsPage({ app }: SettingsPageProps) {
 const current = app.settings
 const [churchName, setChurchName] = useState(current?.churchName ?? 'Lumen Worship Studio')
 const [welcomeSubtitle, setWelcomeSubtitle] = useState(
 current?.welcomeSubtitle ?? 'Bienvenidos al Servicio de Adoración'
 )
 const [defaultTarget, setDefaultTarget] = useState<ProjectionTarget>(
 current?.defaultProjectionTarget ?? 'auto'
 )
 const [showClockOnLogo, setShowClockOnLogo] = useState(current?.showClockOnLogo ?? true)
 const [remotePort, setRemotePort] = useState(String(current?.remotePort ?? 4319))

 const handleSave = async (): Promise<void> => {
 const parsedPort = Number(remotePort)
 await app.updateSettings({
 churchName: churchName.trim() || 'Lumen Worship Studio',
 welcomeSubtitle: welcomeSubtitle.trim(),
 defaultProjectionTarget: defaultTarget,
 showClockOnLogo,
 ...(Number.isInteger(parsedPort) && parsedPort >= 1024 && parsedPort <= 65535
 ? { remotePort: parsedPort }
 : {})
 })
 }

 const handleExportFullBackup = (): void => {
 const payload = {
 type: 'lumen-studio-backup',
 exportedAt: new Date().toISOString(),
 settings: app.settings,
 songs: app.songs,
 schedule: app.schedule,
 media: app.media
 }
 const blob = new Blob([JSON.stringify(payload, null, 2)], {
 type: 'application/json;charset=utf-8'
 })
 const url = URL.createObjectURL(blob)
 const link = document.createElement('a')
 link.href = url
 link.download = `respaldo-estudio-${new Date().toISOString().slice(0, 10)}.lumen-backup.json`
 link.click()
 URL.revokeObjectURL(url)
 }

 return (
 <section className="page" aria-labelledby="page-title">
 <header className="page__header">
 <h1 id="page-title">Configuración</h1>
 <p className="page__description">
 Ajustes generales de identidad de la iglesia, pantallas de proyección, red local y copia de seguridad.
 </p>
 </header>

 <div className="card">
 <h2 className="card__title">Identidad y pantalla de bienvenida (Modo Logo)</h2>
 <div className="form-grid">
 <label className="field">
 <span>Nombre de la iglesia o ministerio</span>
 <input
 type="text"
 aria-label="Nombre de la iglesia"
 value={churchName}
 onChange={(e) => setChurchName(e.target.value)}
 />
 </label>
 <label className="field">
 <span>Subtítulo de bienvenida</span>
 <input
 type="text"
 aria-label="Subtítulo de bienvenida"
 value={welcomeSubtitle}
 onChange={(e) => setWelcomeSubtitle(e.target.value)}
 />
 </label>
 <label className="field">
 <span>Modo de apertura predeterminado</span>
 <select
 aria-label="Modo de apertura predeterminado"
 value={defaultTarget}
 onChange={(e) => setDefaultTarget(e.target.value as ProjectionTarget)}
 >
 <option value="auto">Automático (Pantalla completa en 2.º monitor)</option>
 <option value="windowed">Siempre en ventana</option>
 </select>
 </label>
 <label className="field">
 <span>Puerto del control remoto LAN</span>
 <input
 type="number"
 min={1024}
 max={65535}
 value={remotePort}
 onChange={(e) => setRemotePort(e.target.value)}
 />
 </label>
 <label className="field field--checkbox">
 <input
 type="checkbox"
 checked={showClockOnLogo}
 onChange={(e) => setShowClockOnLogo(e.target.checked)}
 />
 <span>Mostrar reloj digital en la pantalla de Logo</span>
 </label>
 </div>

 <div className="button-row" style={{ marginTop: 14 }}>
 <button
 type="button"
 className="button button--primary"
 onClick={() => void handleSave()}
 >
 Guardar configuración
 </button>
 <button
 type="button"
 className="button"
 onClick={handleExportFullBackup}
 >
 💾 Exportar respaldo completo (.lumen-backup.json)
 </button>
 </div>
 </div>
 </section>
 )
}
