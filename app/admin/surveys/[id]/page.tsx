import { notFound } from 'next/navigation'
import { getDb } from '@/lib/db'
import { getSurveyById } from '@/lib/surveys'
import { getResponses, tallyResponses } from '@/lib/survey-responses'
import { SurveyBuilderForm } from '@/components/SurveyBuilderForm'

export default async function EditSurveyPage({ params }: { params: Promise<{ id: string }> }) {
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
        <p>{responses.length} respuesta(s)</p>
        <SurveyBuilderForm survey={survey} />
        <section>
          <h3>Resultados</h3>
          {tallies.map((tally) => (
            <div key={tally.questionId}>
              <p>{tally.prompt}</p>
              {tally.type === 'single_choice'
                ? tally.optionCounts?.map((oc) => (
                    <p key={oc.label}>
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
