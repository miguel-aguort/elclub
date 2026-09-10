'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import type { ScheduleSession } from '@/lib/schedule-sessions'

export function ScheduleSessionForm({ session }: { session?: ScheduleSession }) {
  const router = useRouter()
  const [day, setDay] = useState(session?.day ?? '')
  const [time, setTime] = useState(session?.time ?? '')
  const [title, setTitle] = useState(session?.title ?? '')
  const [place, setPlace] = useState(session?.place ?? '')
  const [error, setError] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(false)

    const payload = { day, time, title, place }
    const url = session ? `/api/admin/schedule/${session.id}` : '/api/admin/schedule'
    const method = session ? 'PATCH' : 'POST'

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json()
      if (response.ok && data.status === 'ok') {
        router.push('/admin/schedule')
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
        Día
        <input value={day} onChange={(e) => setDay(e.target.value)} required />
      </label>
      <label className="form-field">
        Hora
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
      </label>
      <label className="form-field">
        Título
        <input value={title} onChange={(e) => setTitle(e.target.value)} required />
      </label>
      <label className="form-field">
        Lugar
        <input value={place} onChange={(e) => setPlace(e.target.value)} required />
      </label>

      {error && (
        <p role="alert" className="form-error">
          Revisa los campos: día, hora, título y lugar son obligatorios.
        </p>
      )}

      <button type="submit" className="cta-button" disabled={submitting}>
        {submitting ? 'Guardando…' : 'Guardar sesión'}
      </button>
    </form>
  )
}
