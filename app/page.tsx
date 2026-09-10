export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { Hero } from '@/components/Hero'
import { ActivitySection } from '@/components/ActivitySection'
import { MountainSection } from '@/components/MountainSection'
import { ScheduleSection } from '@/components/ScheduleSection'
import { SignupForm } from '@/components/SignupForm'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { activities } from '@/lib/activities'
import { getDb } from '@/lib/db'
import { listUpcomingEvents, listPastEvents } from '@/lib/events'
import { listScheduleSessions } from '@/lib/schedule-sessions'

export default function Home() {
  const db = getDb()
  const upcomingEvents = listUpcomingEvents(db)
  const pastEvents = listPastEvents(db)
  const scheduleSessions = listScheduleSessions(db)

  return (
    <>
      <div className="grain" aria-hidden="true" />
      <Header />
      <main>
        <Hero />

        <section id="actividades" className="activities-section">
          <div className="activities-head">
            <div>
              <p className="eyebrow">Qué hacemos</p>
              <h2>Tres formas de subir a la montaña</h2>
            </div>
            <p className="activities-lead">
              Sin cuotas, sin presión. Solo un horario, un punto de encuentro y gente que aparece.
            </p>
          </div>
          <div className="activities-grid">
            {activities.map((activity) => (
              <ActivitySection key={activity.slug} activity={activity} />
            ))}
          </div>
        </section>

        <MountainSection />

        <section id="proximas-actividades" className="schedule-section">
          <div className="schedule-head">
            <p className="eyebrow">Agenda</p>
            <h2>Próximas actividades</h2>
          </div>
          {upcomingEvents.length === 0 ? (
            <p className="schedule-note">Aún no hay actividades programadas. Vuelve pronto.</p>
          ) : (
            <div className="schedule-list">
              {upcomingEvents.map((event) => {
                const eventDate = new Date(event.eventAt)
                return (
                  <div key={event.id} className="schedule-row">
                    <div className="schedule-when">
                      <span className="schedule-day">
                        {eventDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                      </span>
                      <span className="schedule-time">
                        {eventDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <span className="schedule-title">
                      <Link href={`/actividades/${event.id}`}>{event.title}</Link>
                    </span>
                    <span className="schedule-place">{event.location}</span>
                    <p className="schedule-note">
                      {event.description}
                      {event.link && (
                        <>
                          {' '}
                          <a href={event.link} target="_blank" rel="noopener noreferrer">
                            Más información
                          </a>
                        </>
                      )}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {pastEvents.length > 0 && (
          <section id="actividades-pasadas" className="schedule-section">
            <div className="schedule-head">
              <p className="eyebrow">Historial</p>
              <h2>Actividades pasadas</h2>
            </div>
            <div className="schedule-list">
              {pastEvents.map((event) => {
                const eventDate = new Date(event.eventAt)
                return (
                  <div key={event.id} className="schedule-row">
                    <div className="schedule-when">
                      <span className="schedule-day">
                        {eventDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                      </span>
                      <span className="schedule-time">
                        {eventDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <span className="schedule-title">{event.title}</span>
                    <span className="schedule-place">{event.location}</span>
                    <p className="schedule-note">
                      {event.description}
                      {event.link && (
                        <>
                          {' '}
                          <a href={event.link} target="_blank" rel="noopener noreferrer">
                            Más información
                          </a>
                        </>
                      )}
                    </p>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        <ScheduleSection sessions={scheduleSessions} />

        <section id="unete" className="signup-section">
          <div className="signup-inner">
            <p className="eyebrow">Únete</p>
            <h2>Únete a la comunidad</h2>
            <p className="signup-lead">
              Déjanos tu contacto y te avisamos de la próxima salida. Sin spam, sin cuotas.
            </p>
            <SignupForm />
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
