import { notFound } from 'next/navigation'
import { getDb } from '@/lib/db'
import { getSurveyBySlug } from '@/lib/surveys'
import { SurveyResponseForm } from '@/components/SurveyResponseForm'

export default async function EncuestaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const survey = getSurveyBySlug(getDb(), slug)
  if (!survey) {
    notFound()
  }

  return (
    <main>
      <section className="signup-section">
        <div className="signup-inner">
          <p className="eyebrow">Encuesta</p>
          <h2>{survey.title}</h2>
          <SurveyResponseForm survey={survey} />
        </div>
      </section>
    </main>
  )
}
