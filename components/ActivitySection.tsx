import type { Activity } from '@/lib/activities'

export function ActivitySection({ activity }: { activity: Activity }) {
  return (
    <section id={activity.slug} aria-labelledby={`${activity.slug}-heading`} className="activity-card">
      {activity.icon && (
        <span className="activity-icon" aria-hidden="true">
          {activity.icon}
        </span>
      )}
      <h3 id={`${activity.slug}-heading`}>{activity.title}</h3>
      <p>{activity.description}</p>
    </section>
  )
}
