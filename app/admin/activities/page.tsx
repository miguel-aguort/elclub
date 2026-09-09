export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getDb } from '@/lib/db'
import { listEvents } from '@/lib/events'
import { isValidSessionCookie, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth'

export default async function ActivitiesListPage() {
  const cookieStore = await cookies()
  if (!isValidSessionCookie(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)) {
    redirect('/admin/login')
  }

  const events = listEvents(getDb())

  return (
    <main className="signup-section">
      <div className="signup-inner">
        <h2>Actividades</h2>
        <Link href="/admin/surveys">Encuestas</Link>
        <Link href="/admin/activities/new" className="cta-button">
          Nueva actividad
        </Link>
        <ul>
          {events.map((event) => (
            <li key={event.id}>
              <Link href={`/admin/activities/${event.id}`}>{event.title}</Link>
              {' — '}
              {new Date(event.eventAt).toLocaleString('es-ES')}
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}
