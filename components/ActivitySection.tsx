import type { Activity } from '@/lib/activities'

const ICONS: Record<Activity['icon'], React.ReactNode> = {
  run: (
    <>
      <path d="M13 4a1.5 1.5 0 1 0 0-.01" />
      <path d="M4 17l3-1 2-4 3 2 1 5" />
      <path d="M9 12l-2-3 4-2 3 3 3-1" />
    </>
  ),
  climb: (
    <>
      <path d="M3 20l6-9 4 5 3-4 5 8Z" />
      <circle cx="15" cy="5" r="1.6" />
    </>
  ),
  bike: (
    <>
      <circle cx="6" cy="16" r="3.4" />
      <circle cx="18" cy="16" r="3.4" />
      <path d="M6 16l4-8h5l3 8M9 8h4" />
    </>
  ),
}

export function ActivitySection({ activity }: { activity: Activity }) {
  return (
    <article
      id={activity.slug}
      aria-labelledby={`${activity.slug}-heading`}
      className="activity-card"
    >
      <div className="activity-photo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={activity.image} alt={activity.title} loading="lazy" />
      </div>
      <div className="activity-body">
        <div className="activity-meta">
          <span className="activity-number">{activity.number}</span>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            {ICONS[activity.icon]}
          </svg>
        </div>
        <h3 id={`${activity.slug}-heading`}>{activity.title}</h3>
        <p>{activity.description}</p>
      </div>
    </article>
  )
}
