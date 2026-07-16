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
    return <p role="status">You're on the list! We'll be in touch.</p>
  }

  if (state === 'duplicate') {
    return <p role="status">You're already on the list!</p>
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="signup-name">Name</label>
      <input id="signup-name" value={name} onChange={(e) => setName(e.target.value)} required />

      <label htmlFor="signup-email">Email</label>
      <input
        id="signup-email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />

      <label htmlFor="signup-phone">Phone (optional)</label>
      <input id="signup-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />

      {state === 'invalid' && (
        <p role="alert">
          {invalidField === 'email' ? 'Please enter a valid email address.' : 'Please enter your name.'}
        </p>
      )}
      {state === 'error' && <p role="alert">Something went wrong, please try again.</p>}

      <button type="submit" disabled={state === 'submitting'}>
        Join the community
      </button>
    </form>
  )
}
