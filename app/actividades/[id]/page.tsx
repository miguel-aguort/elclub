export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { getDb } from '@/lib/db'
import { getEventById } from '@/lib/events'
import { EventSignupForm } from '@/components/EventSignupForm'

export default async function ActividadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const event = getEventById(getDb(), Number(id))
  if (!event) {
    notFound()
  }

  const eventDate = new Date(event.eventAt)

  return (
    <main>
      <section className="signup-section">
        <div className="signup-inner">
          <p className="eyebrow">Actividad</p>
          <h2>{event.title}</h2>
          <p className="schedule-note">
            {eventDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })} ·{' '}
            {eventDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} · {event.location}
          </p>
          <p className="schedule-note">{event.description}</p>
          {event.link && (
            <p className="schedule-note">
              <a href={event.link} target="_blank" rel="noopener noreferrer">
                Más información
              </a>
            </p>
          )}
          <EventSignupForm eventId={event.id} eventTitle={event.title} />
        </div>
      </section>
    </main>
  )
}
