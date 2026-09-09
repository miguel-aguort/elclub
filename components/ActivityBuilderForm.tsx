'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import type { Event } from '@/lib/events'

function splitDateTime(eventAt?: string): { date: string; time: string } {
  if (!eventAt) return { date: '', time: '' }
  const [date, time] = eventAt.split('T')
  return { date: date ?? '', time: (time ?? '').slice(0, 5) }
}

export function ActivityBuilderForm({ activity }: { activity?: Event }) {
  const router = useRouter()
  const initial = splitDateTime(activity?.eventAt)
  const [title, setTitle] = useState(activity?.title ?? '')
  const [description, setDescription] = useState(activity?.description ?? '')
  const [location, setLocation] = useState(activity?.location ?? '')
  const [date, setDate] = useState(initial.date)
  const [time, setTime] = useState(initial.time)
  const [link, setLink] = useState(activity?.link ?? '')
  const [error, setError] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(false)

    const payload = {
      title,
      description,
      location,
      eventAt: `${date}T${time}`,
      link: link || undefined,
    }
    const url = activity ? `/api/admin/activities/${activity.id}` : '/api/admin/activities'
    const method = activity ? 'PATCH' : 'POST'

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json()
      if (response.ok && data.status === 'ok') {
        router.push('/admin/activities')
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
      <label className="form-field">
        Descripción
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} required />
      </label>
      <label className="form-field">
        Ubicación
        <input value={location} onChange={(e) => setLocation(e.target.value)} required />
      </label>
      <label className="form-field">
        Fecha
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </label>
      <label className="form-field">
        Hora
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
      </label>
      <label className="form-field">
        Enlace (opcional)
        <input type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..." />
      </label>

      {error && (
        <p role="alert" className="form-error">
          Revisa los campos: título, descripción, ubicación y fecha/hora son obligatorios.
        </p>
      )}

      <button type="submit" className="cta-button" disabled={submitting}>
        {submitting ? 'Guardando…' : 'Guardar actividad'}
      </button>
    </form>
  )
}
