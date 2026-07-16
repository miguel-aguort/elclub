import { Hero } from '@/components/Hero'
import { ActivitySection } from '@/components/ActivitySection'
import { SignupForm } from '@/components/SignupForm'
import { Footer } from '@/components/Footer'
import { InstagramLink } from '@/components/InstagramLink'
import { activities } from '@/lib/activities'

export default function Home() {
  return (
    <>
      <header>
        <InstagramLink />
      </header>
      <main>
        <Hero />
        <section aria-label="Activities">
          {activities.map((activity) => (
            <ActivitySection key={activity.slug} activity={activity} />
          ))}
        </section>
        <section id="signup">
          <h2>Join the community</h2>
          <SignupForm />
        </section>
      </main>
      <Footer />
    </>
  )
}
