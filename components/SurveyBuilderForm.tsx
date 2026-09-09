'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import type { QuestionType, Survey } from '@/lib/surveys'

interface BuilderQuestion {
  id?: number
  prompt: string
  type: QuestionType
  options: string[]
}

function initialQuestions(survey?: Survey): BuilderQuestion[] {
  if (!survey || survey.questions.length === 0) {
    return [{ prompt: '', type: 'single_choice', options: ['', ''] }]
  }
  return survey.questions.map((q) => ({
    id: q.id,
    prompt: q.prompt,
    type: q.type,
    options: q.options.length ? q.options.map((o) => o.label) : ['', ''],
  }))
}

export function SurveyBuilderForm({ survey }: { survey?: Survey }) {
  const router = useRouter()
  const [title, setTitle] = useState(survey?.title ?? '')
  const [questions, setQuestions] = useState<BuilderQuestion[]>(initialQuestions(survey))
  const [error, setError] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  function updateQuestion(index: number, patch: Partial<BuilderQuestion>) {
    setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, ...patch } : q)))
  }

  function updateOption(qIndex: number, oIndex: number, value: string) {
    setQuestions((prev) =>
      prev.map((q, i) => (i === qIndex ? { ...q, options: q.options.map((o, j) => (j === oIndex ? value : o)) } : q))
    )
  }

  function addQuestion() {
    setQuestions((prev) => [...prev, { prompt: '', type: 'single_choice', options: ['', ''] }])
  }

  function addOption(qIndex: number) {
    setQuestions((prev) => prev.map((q, i) => (i === qIndex ? { ...q, options: [...q.options, ''] } : q)))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(false)

    const payload = {
      title,
      questions: questions.map((q) => ({
        id: q.id,
        prompt: q.prompt,
        type: q.type,
        options: q.type === 'single_choice' ? q.options : undefined,
      })),
    }
    const url = survey ? `/api/admin/surveys/${survey.id}` : '/api/admin/surveys'
    const method = survey ? 'PATCH' : 'POST'

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json()
      if (response.ok && data.status === 'ok') {
        router.push('/admin/surveys')
        router.refresh()
      } else {
        setError(true)
      }
    } catch {
      setError(true)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="signup-form">
      <label className="form-field">
        Título
        <input value={title} onChange={(e) => setTitle(e.target.value)} required />
      </label>

      {questions.map((question, qIndex) => (
        <fieldset key={qIndex} className="form-field">
          <legend>Pregunta {qIndex + 1}</legend>
          <input
            value={question.prompt}
            onChange={(e) => updateQuestion(qIndex, { prompt: e.target.value })}
            placeholder="Texto de la pregunta"
            required
          />
          <select
            value={question.type}
            onChange={(e) => updateQuestion(qIndex, { type: e.target.value as QuestionType })}
          >
            <option value="single_choice">Opción múltiple</option>
            <option value="text">Texto libre</option>
          </select>
          {question.type === 'single_choice' && (
            <div>
              {question.options.map((option, oIndex) => (
                <input
                  key={oIndex}
                  value={option}
                  onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                  placeholder={`Opción ${oIndex + 1}`}
                />
              ))}
              <button type="button" onClick={() => addOption(qIndex)}>
                + Opción
              </button>
            </div>
          )}
        </fieldset>
      ))}

      <button type="button" onClick={addQuestion}>
        + Pregunta
      </button>

      {error && (
        <p role="alert" className="form-error">
          Revisa el título y las preguntas: todas necesitan texto, y las de opción múltiple al menos dos opciones.
        </p>
      )}

      <button type="submit" className="cta-button" disabled={submitting}>
        {submitting ? 'Guardando…' : 'Guardar encuesta'}
      </button>
    </form>
  )
}
