export const dynamic = 'force-dynamic'

import { Hero } from '@/components/Hero'
import { ActivitySection } from '@/components/ActivitySection'
import { MountainSection } from '@/components/MountainSection'
import { ScheduleSection } from '@/components/ScheduleSection'
import { SignupForm } from '@/components/SignupForm'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { activities } from '@/lib/activities'
import { getDb } from '@/lib/db'
import { listUpcomingEvents } from '@/lib/events'

export default function Home() {
  const upcomingEvents = listUpcomingEvents(getDb())

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
        <ScheduleSection />

        <section id="proximas-actividades" className="schedule-section">
          <div className="schedule-head">
            <p className="eyebrow">Agenda</p>
            <h2>Próximas actividades</h2>
          </div>
          {upcomingEvents.length === 0 ? (
            <p className="schedule-note">Aún no hay actividades programadas. Vuelve pronto.</p>
          ) : (
            <div className="schedule-list">
              {upcomingEvents.map((event) => (
                <div key={event.id} className="schedule-row">
                  <div className="schedule-when">
                    <span className="schedule-day">
                      {new Date(event.eventAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                    </span>
                    <span className="schedule-time">
                      {new Date(event.eventAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <span className="schedule-title">{event.title}</span>
                  <span className="schedule-place">{event.location}</span>
                </div>
              ))}
            </div>
          )}
        </section>

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
