export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getDb } from '@/lib/db'
import { listScheduleSessions } from '@/lib/schedule-sessions'
import { isValidSessionCookie, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth'

export default async function ScheduleListPage() {
  const cookieStore = await cookies()
  if (!isValidSessionCookie(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)) {
    redirect('/admin/login')
  }

  const sessions = listScheduleSessions(getDb())

  return (
    <main className="signup-section">
      <div className="signup-inner">
        <h2>Horario semanal</h2>
        <Link href="/admin/activities">Actividades</Link>
        {' — '}
        <Link href="/admin/surveys">Encuestas</Link>
        <Link href="/admin/schedule/new" className="cta-button">
          Nueva sesión
        </Link>
        <ul>
          {sessions.map((session) => (
            <li key={session.id}>
              <Link href={`/admin/schedule/${session.id}`}>{session.title}</Link>
              {' — '}
              {session.day} {session.time}
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}
