import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { createScheduleSession } from '@/lib/schedule-sessions'

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
  getDb().exec('DELETE FROM schedule_sessions')
})

function authedRequest(url: string, init: RequestInit = {}) {
  return new Request(url, {
    ...init,
    headers: { ...init.headers, cookie: `${ADMIN_SESSION_COOKIE}=${createSessionCookieValue()}` },
  })
}

function createTestScheduleSession() {
  const result = createScheduleSession(getDb(), {
    day: 'Martes',
    time: '19:00',
    title: 'Entrenamiento',
    place: 'Polideportivo municipal',
  })
  return (result as { id: number }).id
}

describe('GET/PATCH/DELETE /api/admin/schedule/[id]', () => {
  it('rejects an unauthenticated request', async () => {
    const id = createTestScheduleSession()
    const response = await GET(new Request(`http://localhost/api/admin/schedule/${id}`), {
      params: Promise.resolve({ id: String(id) }),
    })
    expect(response.status).toBe(401)
  })

  it('fetches a schedule session by id', async () => {
    const id = createTestScheduleSession()
    const response = await GET(authedRequest(`http://localhost/api/admin/schedule/${id}`), {
      params: Promise.resolve({ id: String(id) }),
    })
    expect(response.status).toBe(200)
    const { session } = await response.json()
    expect(session.title).toBe('Entrenamiento')
  })

  it('returns 404 for an unknown id', async () => {
    const response = await GET(authedRequest('http://localhost/api/admin/schedule/999999'), {
      params: Promise.resolve({ id: '999999' }),
    })
    expect(response.status).toBe(404)
  })

  it('updates a schedule session', async () => {
    const id = createTestScheduleSession()
    const response = await PATCH(
      authedRequest(`http://localhost/api/admin/schedule/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          day: 'Miércoles',
          time: '19:00',
          title: 'Entrenamiento',
          place: 'Polideportivo municipal',
        }),
      }),
      { params: Promise.resolve({ id: String(id) }) }
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok' })
  })

  it('deletes a schedule session', async () => {
    const id = createTestScheduleSession()
    const response = await DELETE(authedRequest(`http://localhost/api/admin/schedule/${id}`, { method: 'DELETE' }), {
      params: Promise.resolve({ id: String(id) }),
    })
    expect(response.status).toBe(200)
    const getResponse = await GET(authedRequest(`http://localhost/api/admin/schedule/${id}`), {
      params: Promise.resolve({ id: String(id) }),
    })
    expect(getResponse.status).toBe(404)
  })
})
