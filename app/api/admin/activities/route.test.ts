import { describe, it, expect, beforeAll, beforeEach } from 'vitest'

let GET: typeof import('./route').GET
let POST: typeof import('./route').POST
let createSessionCookieValue: typeof import('@/lib/admin-auth').createSessionCookieValue
let ADMIN_SESSION_COOKIE: typeof import('@/lib/admin-auth').ADMIN_SESSION_COOKIE

beforeAll(async () => {
  process.env.DB_PATH = ':memory:'
  ;({ GET, POST } = await import('./route'))
  ;({ createSessionCookieValue, ADMIN_SESSION_COOKIE } = await import('@/lib/admin-auth'))
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

describe('GET/POST /api/admin/activities', () => {
  it('rejects an unauthenticated request', async () => {
    const response = await GET(new Request('http://localhost/api/admin/activities'))
    expect(response.status).toBe(401)
  })

  it('creates an activity and lists it', async () => {
    const createResponse = await POST(
      authedRequest('http://localhost/api/admin/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Salida a La Pedriza',
          description: 'Ruta tranquila',
          location: 'Parking de Canto Cochino',
          eventAt: '2026-10-04T09:00',
        }),
      })
    )
    expect(createResponse.status).toBe(200)
    expect(await createResponse.json()).toMatchObject({ status: 'ok' })

    const listResponse = await GET(authedRequest('http://localhost/api/admin/activities'))
    const { events } = await listResponse.json()
    expect(events).toHaveLength(1)
    expect(events[0].title).toBe('Salida a La Pedriza')
  })

  it('rejects an invalid activity', async () => {
    const response = await POST(
      authedRequest('http://localhost/api/admin/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '' }),
      })
    )
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ status: 'invalid', error: { field: 'title' } })
  })
})
