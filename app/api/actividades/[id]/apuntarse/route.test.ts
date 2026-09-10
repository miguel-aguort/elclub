import { describe, it, expect, beforeAll } from 'vitest'
import { addSubscriber } from '@/lib/subscribers'
import { createEvent } from '@/lib/events'

let POST: typeof import('./route').POST
let getDb: typeof import('@/lib/db').getDb

beforeAll(async () => {
  process.env.DB_PATH = ':memory:'
  ;({ POST } = await import('./route'))
  ;({ getDb } = await import('@/lib/db'))
  addSubscriber(getDb(), { name: 'Ana', email: 'ana@example.com' })
})

function createTestEvent() {
  const result = createEvent(getDb(), {
    title: 'Cross al Yelmo',
    description: 'Ruta',
    location: 'Plaza de Manzanares el Real',
    eventAt: '2026-09-12T09:30',
  })
  return (result as { id: number }).id
}

function postSignup(id: number | string, body: unknown) {
  return POST(
    new Request(`http://localhost/api/actividades/${id}/apuntarse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: String(id) }) }
  )
}

describe('POST /api/actividades/[id]/apuntarse', () => {
  it('returns 404 for an unknown event', async () => {
    const response = await postSignup(999999, { email: 'ana@example.com' })
    expect(response.status).toBe(404)
  })

  it('signs up a known subscriber', async () => {
    const id = createTestEvent()
    const response = await postSignup(id, { email: 'ana@example.com' })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok' })
  })

  it('rejects an email that is not a community member', async () => {
    const id = createTestEvent()
    const response = await postSignup(id, { email: 'stranger@example.com' })
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ status: 'invalid', error: { field: 'email', reason: 'not_member' } })
  })

  it('rejects a malformed JSON body', async () => {
    const id = createTestEvent()
    const response = await POST(
      new Request(`http://localhost/api/actividades/${id}/apuntarse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
      }),
      { params: Promise.resolve({ id: String(id) }) }
    )
    expect(response.status).toBe(400)
  })
})
