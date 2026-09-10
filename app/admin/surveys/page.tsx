export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getDb } from '@/lib/db'
import { listSurveys } from '@/lib/surveys'
import { isValidSessionCookie, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth'

export default async function SurveysListPage() {
  const cookieStore = await cookies()
  if (!isValidSessionCookie(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)) {
    redirect('/admin/login')
  }

  const surveys = listSurveys(getDb())

  return (
    <main className="signup-section">
      <div className="signup-inner">
        <h2>Encuestas</h2>
        <Link href="/admin/activities">Actividades</Link>
        {' — '}
        <Link href="/admin/schedule">Horario</Link>
        <Link href="/admin/surveys/new" className="cta-button">
          Nueva encuesta
        </Link>
        <ul>
          {surveys.map((survey) => (
            <li key={survey.id}>
              <Link href={`/admin/surveys/${survey.id}`}>{survey.title}</Link>
              {' — '}
              <a href={`/encuestas/${survey.slug}`}>/encuestas/{survey.slug}</a>
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}
