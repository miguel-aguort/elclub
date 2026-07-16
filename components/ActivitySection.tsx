import type { Activity } from '@/lib/activities'

export function ActivitySection({ activity }: { activity: Activity }) {
  return (
    <section id={activity.slug} aria-labelledby={`${activity.slug}-heading`}>
      <h3 id={`${activity.slug}-heading`}>{activity.title}</h3>
      <p>{activity.description}</p>
    </section>
  )
}
