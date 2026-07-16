import { Hero } from '@/components/Hero'
import { ActivitySection } from '@/components/ActivitySection'
import { SignupForm } from '@/components/SignupForm'
import { Footer } from '@/components/Footer'
import { InstagramLink } from '@/components/InstagramLink'
import { activities } from '@/lib/activities'

export default function Home() {
  return (
    <>
      <header className="site-header">
        <span className="site-brand">El Club!</span>
        <InstagramLink className="header-instagram-link" />
      </header>
      <main>
        <Hero />
        <section className="activities-section">
          <h2>What we do</h2>
          <div className="activities-grid">
            {activities.map((activity) => (
              <ActivitySection key={activity.slug} activity={activity} />
            ))}
          </div>
        </section>
        <section id="signup" className="signup-section">
          <h2>Join the community</h2>
          <SignupForm />
        </section>
      </main>
      <Footer />
    </>
  )
}
