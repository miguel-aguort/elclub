'use client'

import { useState, type FormEvent } from 'react'
import type { Survey } from '@/lib/surveys'

type FormState = 'idle' | 'submitting' | 'ok' | 'invalid' | 'not_member' | 'error'

export function SurveyResponseForm({ survey }: { survey: Survey }) {
  const [email, setEmail] = useState('')
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [state, setState] = useState<FormState>('idle')

  function setAnswer(questionId: number, value: string) {
    setAnswers((prev) => ({ ...prev, [String(questionId)]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setState('submitting')

    try {
      const response = await fetch(`/api/surveys/${survey.slug}/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, answers }),
      })
      const data = await response.json()

      if (response.ok && data.status === 'ok') {
        setState('ok')
      } else if (data.status === 'invalid' && data.error?.reason === 'not_member') {
        setState('not_member')
      } else if (data.status === 'invalid') {
        setState('invalid')
      } else {
        setState('error')
      }
    } catch {
      setState('error')
    }
  }

  if (state === 'ok') {
    return (
      <div role="status" className="signup-message signup-message--success">
        <p className="signup-message-title">¡Gracias por responder!</p>
        <p className="signup-message-body">Ya hemos guardado tus respuestas.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="signup-form">
      <label className="form-field">
        Email
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@email.com"
          required
        />
      </label>

      {survey.questions.map((question) => (
        <fieldset key={question.id} className="form-field">
          <legend>{question.prompt}</legend>
          {question.type === 'single_choice' ? (
            question.options.map((option) => (
              <label key={option.id}>
                <input
                  type="radio"
                  name={`question-${question.id}`}
                  aria-label={option.label}
                  value={option.label}
                  checked={answers[String(question.id)] === option.label}
                  onChange={(e) => setAnswer(question.id, e.target.value)}
                />
                {option.label}
              </label>
            ))
          ) : (
            <textarea
              aria-label={question.prompt}
              value={answers[String(question.id)] ?? ''}
              onChange={(e) => setAnswer(question.id, e.target.value)}
            />
          )}
        </fieldset>
      ))}

      {state === 'not_member' && (
        <p role="alert" className="form-error">
          No encontramos ese email entre los socios.
        </p>
      )}
      {state === 'invalid' && (
        <p role="alert" className="form-error">
          Revisa tu email y responde todas las preguntas.
        </p>
      )}
      {state === 'error' && (
        <p role="alert" className="form-error">
          Algo ha fallado, inténtalo de nuevo.
        </p>
      )}

      <button type="submit" className="cta-button" disabled={state === 'submitting'}>
        {state === 'submitting' ? 'Enviando…' : 'Enviar respuestas'}
      </button>
    </form>
  )
}
