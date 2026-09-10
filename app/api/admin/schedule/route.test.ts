import { describe, it, expect, beforeAll, beforeEach } from 'vitest'

let GET: typeof import('./route').GET
let POST: typeof import('./route').POST
let createSessionCookieValue: typeof import('@/lib/admin-auth').createSessionCookieValue
let ADMIN_SESSION_COOKIE: typeof import('@/lib/admin-auth').ADMIN_SESSION_COOKIE
let getDb: typeof import('@/lib/db').getDb

beforeAll(async () => {
  process.env.DB_PATH = ':memory:'
  ;({ GET, POST } = await import('./route'))
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

describe('GET/POST /api/admin/schedule', () => {
  it('rejects an unauthenticated request', async () => {
    const response = await GET(new Request('http://localhost/api/admin/schedule'))
    expect(response.status).toBe(401)
  })

  it('creates a schedule session and lists it', async () => {
    const createResponse = await POST(
      authedRequest('http://localhost/api/admin/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          day: 'Martes',
          time: '19:00',
          title: 'Entrenamiento',
          place: 'Polideportivo municipal',
        }),
      })
    )
    expect(createResponse.status).toBe(200)
    expect(await createResponse.json()).toMatchObject({ status: 'ok' })

    const listResponse = await GET(authedRequest('http://localhost/api/admin/schedule'))
    const { sessions } = await listResponse.json()
    expect(sessions).toHaveLength(1)
    expect(sessions[0].title).toBe('Entrenamiento')
  })

  it('rejects an invalid schedule session', async () => {
    const response = await POST(
      authedRequest('http://localhost/api/admin/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ day: '' }),
      })
    )
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ status: 'invalid', error: { field: 'day' } })
  })
})
