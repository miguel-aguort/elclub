import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { createEvent } from '@/lib/events'

let GET: typeof import('./route').GET
let PATCH: typeof import('./route').PATCH
let DELETE: typeof import('./route').DELETE
let createSessionCookieValue: typeof import('@/lib/admin-auth').createSessionCookieValue
let ADMIN_SESSION_COOKIE: typeof import('@/lib/admin-auth').ADMIN_SESSION_COOKIE
let getDb: typeof import('@/lib/db').getDb

beforeAll(async () => {
  process.env.DB_PATH = ':memory:'
  ;({ GET, PATCH, DELETE } = await import('./route'))
  ;({ createSessionCookieValue, ADMIN_SESSION_COOKIE } = await import('@/lib/admin-auth'))
  ;({ getDb } = await import('@/lib/db'))
})

beforeEach(() => {
  process.env.ADMIN_PASSWORD = 'club-secret'
})

function authedRequest(url: string, init: RequestInit = {}) {
  return new Request(url, {
    ...init,
    headers: { ...init.headers, cookie: `${ADMIN_SESSION_COOKIE}=${createSessionCookieValue()}` },
  })
}

function createTestEvent() {
  const result = createEvent(getDb(), {
    title: 'Salida a La Pedriza',
    description: 'Ruta tranquila',
    location: 'Parking de Canto Cochino',
    eventAt: '2026-10-04T09:00',
  })
  return (result as { id: number }).id
}

describe('GET/PATCH/DELETE /api/admin/activities/[id]', () => {
  it('rejects an unauthenticated request', async () => {
    const id = createTestEvent()
    const response = await GET(new Request(`http://localhost/api/admin/activities/${id}`), {
      params: Promise.resolve({ id: String(id) }),
    })
    expect(response.status).toBe(401)
  })

  it('fetches an activity by id', async () => {
    const id = createTestEvent()
    const response = await GET(authedRequest(`http://localhost/api/admin/activities/${id}`), {
      params: Promise.resolve({ id: String(id) }),
    })
    expect(response.status).toBe(200)
    const { event } = await response.json()
    expect(event.title).toBe('Salida a La Pedriza')
  })

  it('returns 404 for an unknown id', async () => {
    const response = await GET(authedRequest('http://localhost/api/admin/activities/999999'), {
      params: Promise.resolve({ id: '999999' }),
    })
    expect(response.status).toBe(404)
  })

  it('updates an activity', async () => {
    const id = createTestEvent()
    const response = await PATCH(
      authedRequest(`http://localhost/api/admin/activities/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Título nuevo',
          description: 'Ruta tranquila',
          location: 'Parking de Canto Cochino',
          eventAt: '2026-10-04T09:00',
        }),
      }),
      { params: Promise.resolve({ id: String(id) }) }
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok' })
  })

  it('deletes an activity', async () => {
    const id = createTestEvent()
    const response = await DELETE(authedRequest(`http://localhost/api/admin/activities/${id}`, { method: 'DELETE' }), {
      params: Promise.resolve({ id: String(id) }),
    })
    expect(response.status).toBe(200)
    const getResponse = await GET(authedRequest(`http://localhost/api/admin/activities/${id}`), {
      params: Promise.resolve({ id: String(id) }),
    })
    expect(getResponse.status).toBe(404)
  })
})
