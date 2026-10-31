import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ProjectionApp } from './ProjectionApp'
import '../styles/projection.css'

const container = document.getElementById('root')
if (!container) throw new Error('No se encontró el elemento #root')

createRoot(container).render(
  <StrictMode>
    <ProjectionApp />
  </StrictMode>
)

