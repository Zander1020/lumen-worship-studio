import { useEffect, useState } from 'react'
import type { ScheduleItem } from '../../../shared/models'
import { DEFAULT_SECTION, type SectionId } from '../../../shared/sections'
import { HolyricsLeftDock } from '../components/layout/HolyricsLeftDock'
import { LiveDock } from '../components/layout/LiveDock'
import { Sidebar } from '../components/layout/Sidebar'
import { StatusBar } from '../components/layout/StatusBar'
import { TitleBar } from '../components/layout/TitleBar'
import { UpdateNotifierModal } from '../components/UpdateNotifierModal'
import { WhatsNewModal } from '../components/WhatsNewModal'
import type { ScheduleSelectionRequest } from '../features/home/HomePage'
import { renderSection } from '../features/sectionRegistry'
import { useAppStatus } from '../hooks/useAppStatus'

export function App() {
  const [section, setSection] = useState<SectionId>(DEFAULT_SECTION)
  const [selectedScheduleRequest, setSelectedScheduleRequest] =
    useState<ScheduleSelectionRequest | null>(null)
  const app = useAppStatus()
  const isEditorWorkspace = section === 'design'

  const handleSelectScheduleItem = (item: ScheduleItem): void => {
    setSelectedScheduleRequest((prev) => ({ item, seq: (prev?.seq ?? 0) + 1 }))
    if (section !== 'home') {
      setSection('home')
    }
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.defaultPrevented) return
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
        {!isEditorWorkspace && (
          <HolyricsLeftDock app={app} onSelectScheduleItem={handleSelectScheduleItem} />
        )}
        <main className={`content${isEditorWorkspace ? ' content--fullscreen' : ''}`}>
          {renderSection(section, app, selectedScheduleRequest)}
        </main>
        {!isEditorWorkspace && <LiveDock app={app} />}
      </div>
      <StatusBar status={app.status} />
      <UpdateNotifierModal />
      <WhatsNewModal onNavigateToAbout={() => setSection('about')} />
    </div>
  )
}
