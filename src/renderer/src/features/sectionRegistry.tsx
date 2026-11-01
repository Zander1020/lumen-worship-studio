import type { ReactNode } from 'react'
import type { SectionId } from '../../../shared/sections'
import type { UseAppStatus } from '../hooks/useAppStatus'
import { AiAssistantPage } from './ai/AiAssistantPage'
import { AboutPage } from './about/AboutPage'
import { BiblePage } from './bible/BiblePage'
import { GraphicEditorPage } from './design/GraphicEditorPage'
import { HomePage } from './home/HomePage'
import { MediaPage } from './media/MediaPage'
import { ProjectionPage } from './projection/ProjectionPage'
import { RemoteControlPage } from './remote/RemoteControlPage'
import { SettingsPage } from './settings/SettingsPage'
import { SongsPage } from './songs/SongsPage'

/**
 * Devuelve el contenido de cada sección. Cada módulo funcional vive en su
 * propia carpeta dentro de `features/`.
 */
export function renderSection(id: SectionId, app: UseAppStatus): ReactNode {
 switch (id) {
 case 'home':
 return <HomePage app={app} />
 case 'songs':
 return <SongsPage app={app} />
 case 'bible':
 return <BiblePage app={app} />
 case 'projection':
 return <ProjectionPage app={app} />
 case 'media':
 return <MediaPage app={app} />
 case 'design':
 return <GraphicEditorPage app={app} />
 case 'remote':
 return <RemoteControlPage app={app} />
 case 'ai':
 return <AiAssistantPage />
 case 'settings':
 return <SettingsPage app={app} />
 case 'about':
 return <AboutPage />
 }
}
