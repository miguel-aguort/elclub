'use client'

import { useState, type FormEvent } from 'react'

type FormState = 'idle' | 'submitting' | 'ok' | 'duplicate' | 'invalid' | 'error'

export function SignupForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [state, setState] = useState<FormState>('idle')
  const [invalidField, setInvalidField] = useState<'name' | 'email' | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setState('submitting')
    setInvalidField(null)

    try {
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone: phone || undefined }),
      })
      const data = await response.json()

      if (response.ok && data.status === 'ok') {
        setState('ok')
      } else if (data.status === 'duplicate') {
        setState('duplicate')
      } else if (data.status === 'invalid') {
        setState('invalid')
        setInvalidField(data.field)
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
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
        <p className="signup-message-title">¡Ya estás dentro!</p>
        <p className="signup-message-body">Nos vemos en la montaña. Te escribimos pronto.</p>
      </div>
    )
  }

  if (state === 'duplicate') {
    return (
      <div role="status" className="signup-message signup-message--success">
        <p className="signup-message-title">Ya estabas en la lista</p>
        <p className="signup-message-body">Te avisamos de la próxima salida.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="signup-form">
      <label className="form-field">
        Nombre
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tu nombre"
          required
        />
      </label>

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

      <label className="form-field">
        Teléfono (opcional)
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+34 600 000 000"
        />
      </label>

      {state === 'invalid' && (
        <p role="alert" className="form-error">
          {invalidField === 'email'
            ? 'Introduce un email válido.'
            : 'Introduce tu nombre.'}
        </p>
      )}
      {state === 'error' && (
        <p role="alert" className="form-error">
          Algo ha fallado, inténtalo de nuevo.
        </p>
      )}

      <button type="submit" className="cta-button" disabled={state === 'submitting'}>
        {state === 'submitting' ? 'Enviando…' : 'Únete a la comunidad'}
      </button>
    </form>
  )
}
