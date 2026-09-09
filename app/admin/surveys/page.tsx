import Link from 'next/link'
import { getDb } from '@/lib/db'
import { listSurveys } from '@/lib/surveys'

export default function SurveysListPage() {
  const surveys = listSurveys(getDb())

  return (
    <main className="signup-section">
      <div className="signup-inner">
        <h2>Encuestas</h2>
        <Link href="/admin/surveys/new" className="cta-button">
          Nueva encuesta
        </Link>
        <ul>
          {surveys.map((survey) => (
            <li key={survey.id}>
              <Link href={`/admin/surveys/${survey.id}`}>{survey.title}</Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}
