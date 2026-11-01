import { useEffect, useState } from 'react'
import { DEFAULT_SECTION, type SectionId } from '../../../shared/sections'
import { HolyricsLeftDock } from '../components/layout/HolyricsLeftDock'
import { LiveDock } from '../components/layout/LiveDock'
import { Sidebar } from '../components/layout/Sidebar'
import { StatusBar } from '../components/layout/StatusBar'
import { TitleBar } from '../components/layout/TitleBar'
import { UpdateNotifierModal } from '../components/UpdateNotifierModal'
import { renderSection } from '../features/sectionRegistry'
import { useAppStatus } from '../hooks/useAppStatus'

export function App() {
  const [section, setSection] = useState<SectionId>(DEFAULT_SECTION)
  const app = useAppStatus()
  const isEditorWorkspace = section === 'design'

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        if (app.status?.projection.windowOpen) {
          void app.closeProjection()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [app])

  return (
    <div className="shell">
      <TitleBar subtitle={app.status?.projection.live.churchName ?? 'Cabina Profesional'} />
      <Sidebar active={section} onSelect={setSection} app={app} />
      <div className={`hly-workbench${isEditorWorkspace ? ' hly-workbench--fullscreen' : ''}`}>
        {!isEditorWorkspace && <HolyricsLeftDock app={app} />}
        <main className={`content${isEditorWorkspace ? ' content--fullscreen' : ''}`}>
          {renderSection(section, app)}
        </main>
        {!isEditorWorkspace && <LiveDock app={app} />}
      </div>
      <StatusBar status={app.status} />
      <UpdateNotifierModal />
    </div>
  )
}
