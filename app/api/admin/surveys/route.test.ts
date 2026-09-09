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

describe('GET/POST /api/admin/surveys', () => {
  it('rejects an unauthenticated request', async () => {
    const response = await GET(new Request('http://localhost/api/admin/surveys'))
    expect(response.status).toBe(401)
  })

  it('creates a survey and lists it', async () => {
    const createResponse = await POST(
      authedRequest('http://localhost/api/admin/surveys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Horario de otoño',
          questions: [{ prompt: '¿Vienes?', type: 'text' }],
        }),
      })
    )
    expect(createResponse.status).toBe(200)
    expect(await createResponse.json()).toMatchObject({ status: 'ok', slug: 'horario-de-otono' })

    const listResponse = await GET(authedRequest('http://localhost/api/admin/surveys'))
    const { surveys } = await listResponse.json()
    expect(surveys).toHaveLength(1)
    expect(surveys[0].title).toBe('Horario de otoño')
  })

  it('rejects an invalid survey', async () => {
    const response = await POST(
      authedRequest('http://localhost/api/admin/surveys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '', questions: [] }),
      })
    )
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ status: 'invalid', error: { field: 'title' } })
  })
})
