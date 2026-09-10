export const dynamic = 'force-dynamic'

import { notFound, redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getDb } from '@/lib/db'
import { getEventById } from '@/lib/events'
import { listEventSignups } from '@/lib/event-signups'
import { isValidSessionCookie, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth'
import { ActivityBuilderForm } from '@/components/ActivityBuilderForm'
import { DeleteActivityButton } from '@/components/DeleteActivityButton'

export default async function EditActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies()
  if (!isValidSessionCookie(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)) {
    redirect('/admin/login')
  }

  const { id } = await params
  const db = getDb()
  const event = getEventById(db, Number(id))
  if (!event) {
    notFound()
  }
  const signups = listEventSignups(db, event.id)

  return (
    <main className="signup-section">
      <div className="signup-inner">
        <h2>{event.title}</h2>
        <p>
          Enlace público: <a href={`/actividades/${event.id}`}>/actividades/{event.id}</a>
        </p>
        <p>{signups.length} apuntado(s)</p>
        <ul>
          {signups.map((signup) => (
            <li key={signup.email}>{signup.email}</li>
          ))}
        </ul>
        <ActivityBuilderForm activity={event} />
        <DeleteActivityButton id={event.id} />
      </div>
    </main>
  )
}
