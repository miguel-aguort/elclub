'use client'

import { useState, type FormEvent } from 'react'

type FormState = 'idle' | 'submitting' | 'ok' | 'invalid' | 'not_member' | 'error'

export function EventSignupForm({ eventId, eventTitle }: { eventId: number; eventTitle: string }) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<FormState>('idle')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setState('submitting')

    try {
      const response = await fetch(`/api/actividades/${eventId}/apuntarse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
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
        <p className="signup-message-title">¡Apuntado!</p>
        <p className="signup-message-body">Nos vemos en {eventTitle}.</p>
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

      {state === 'not_member' && (
        <p role="alert" className="form-error">
          Ese email no pertenece a la comunidad. <a href="/#unete">Únete aquí</a> primero.
        </p>
      )}
      {state === 'invalid' && (
        <p role="alert" className="form-error">
          Revisa tu email.
        </p>
      )}
      {state === 'error' && (
        <p role="alert" className="form-error">
          Algo ha fallado, inténtalo de nuevo.
        </p>
      )}

      <button type="submit" className="cta-button" disabled={state === 'submitting'}>
        {state === 'submitting' ? 'Enviando…' : 'Apuntarme'}
      </button>
    </form>
  )
}
