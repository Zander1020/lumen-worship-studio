import type { ReactNode } from 'react'

export interface PlaceholderPageProps {
 title: string
 description: string
 children?: ReactNode
}

/** Página provisional para secciones aún no implementadas. */
export function PlaceholderPage({ title, description, children }: PlaceholderPageProps) {
 return (
 <section className="page" aria-labelledby="page-title">
 <header className="page__header">
 <h1 id="page-title">{title}</h1>
 <p className="page__description">{description}</p>
 </header>
 <div className="card card--muted">
 <strong>Próximamente.</strong> Esta sección aún no está implementada en esta versión inicial.
 </div>
 {children}
 </section>
 )
}

