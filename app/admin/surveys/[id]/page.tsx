export const dynamic = 'force-dynamic'

import { notFound, redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getDb } from '@/lib/db'
import { getSurveyById } from '@/lib/surveys'
import { getResponses, tallyResponses } from '@/lib/survey-responses'
import { SurveyBuilderForm } from '@/components/SurveyBuilderForm'
import { isValidSessionCookie, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth'

export default async function EditSurveyPage({ params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies()
  if (!isValidSessionCookie(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)) {
    redirect('/admin/login')
  }

  const { id } = await params
  const db = getDb()
  const survey = getSurveyById(db, Number(id))
  if (!survey) {
    notFound()
  }
  const responses = getResponses(db, survey.id)
  const tallies = tallyResponses(survey, responses)

  return (
    <main className="signup-section">
      <div className="signup-inner">
        <h2>{survey.title}</h2>
        <p>
          Enlace público: <a href={`/encuestas/${survey.slug}`}>/encuestas/{survey.slug}</a>
        </p>
        <p>{responses.length} respuesta(s)</p>
        <SurveyBuilderForm survey={survey} />
        <section>
          <h3>Resultados</h3>
          {tallies.map((tally) => (
            <div key={tally.questionId}>
              <p>{tally.prompt}</p>
              {tally.type === 'single_choice'
                ? tally.optionCounts?.map((oc, i) => (
                    <p key={i}>
                      {oc.label}: {oc.count}
                    </p>
                  ))
                : tally.textAnswers?.map((ta) => (
                    <p key={ta.email}>
                      {ta.email}: {ta.answer}
                    </p>
                  ))}
            </div>
          ))}
        </section>
      </div>
    </main>
  )
}
