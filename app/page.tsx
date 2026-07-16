import { Hero } from '@/components/Hero'
import { ActivitySection } from '@/components/ActivitySection'
import { MountainSection } from '@/components/MountainSection'
import { ScheduleSection } from '@/components/ScheduleSection'
import { SignupForm } from '@/components/SignupForm'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { activities } from '@/lib/activities'

export default function Home() {
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
