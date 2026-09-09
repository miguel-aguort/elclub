import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { createDb } from '@/lib/db'
import { createSurvey } from '@/lib/surveys'

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

function createTestSurvey() {
  const result = createSurvey(getDb(), { title: 'Horario', questions: [{ prompt: '¿Vienes?', type: 'text' }] })
  return (result as { id: number }).id
}

describe('GET/PATCH/DELETE /api/admin/surveys/[id]', () => {
  it('rejects an unauthenticated request', async () => {
    const id = createTestSurvey()
    const response = await GET(new Request(`http://localhost/api/admin/surveys/${id}`), {
      params: Promise.resolve({ id: String(id) }),
    })
    expect(response.status).toBe(401)
  })

  it('fetches a survey by id', async () => {
    const id = createTestSurvey()
    const response = await GET(authedRequest(`http://localhost/api/admin/surveys/${id}`), {
      params: Promise.resolve({ id: String(id) }),
    })
    expect(response.status).toBe(200)
    const { survey } = await response.json()
    expect(survey.title).toBe('Horario')
  })

  it('returns 404 for an unknown id', async () => {
    const response = await GET(authedRequest('http://localhost/api/admin/surveys/999999'), {
      params: Promise.resolve({ id: '999999' }),
    })
    expect(response.status).toBe(404)
  })

  it('updates a survey', async () => {
    const id = createTestSurvey()
    const response = await PATCH(
      authedRequest(`http://localhost/api/admin/surveys/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Horario nuevo', questions: [{ prompt: '¿Vienes?', type: 'text' }] }),
      }),
      { params: Promise.resolve({ id: String(id) }) }
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok' })
  })

  it('deletes a survey', async () => {
    const id = createTestSurvey()
    const response = await DELETE(authedRequest(`http://localhost/api/admin/surveys/${id}`, { method: 'DELETE' }), {
      params: Promise.resolve({ id: String(id) }),
    })
    expect(response.status).toBe(200)
    const getResponse = await GET(authedRequest(`http://localhost/api/admin/surveys/${id}`), {
      params: Promise.resolve({ id: String(id) }),
    })
    expect(getResponse.status).toBe(404)
  })
})
