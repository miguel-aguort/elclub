// app/api/admin/surveys/[id]/responses/route.test.ts
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { addSubscriber } from '@/lib/subscribers'
import { createSurvey, getSurveyById } from '@/lib/surveys'
import { submitResponse } from '@/lib/survey-responses'

let GET: typeof import('./route').GET
let createSessionCookieValue: typeof import('@/lib/admin-auth').createSessionCookieValue
let ADMIN_SESSION_COOKIE: typeof import('@/lib/admin-auth').ADMIN_SESSION_COOKIE
let getDb: typeof import('@/lib/db').getDb

beforeAll(async () => {
  process.env.DB_PATH = ':memory:'
  ;({ GET } = await import('./route'))
  ;({ createSessionCookieValue, ADMIN_SESSION_COOKIE } = await import('@/lib/admin-auth'))
  ;({ getDb } = await import('@/lib/db'))
})

beforeEach(() => {
  process.env.ADMIN_PASSWORD = 'club-secret'
})

function authedRequest(url: string) {
  return new Request(url, { headers: { cookie: `${ADMIN_SESSION_COOKIE}=${createSessionCookieValue()}` } })
}

describe('GET /api/admin/surveys/[id]/responses', () => {
  it('returns tallies for a survey with responses', async () => {
    const db = getDb()
    addSubscriber(db, { name: 'Ana', email: 'ana@example.com' })
    const created = createSurvey(db, { title: 'Horario', questions: [{ prompt: '¿Vienes?', type: 'text' }] })
    const id = (created as { id: number }).id
    const survey = getSurveyById(db, id)!
    submitResponse(db, survey, { email: 'ana@example.com', answers: { [survey.questions[0].id]: 'Sí' } })

    const response = await GET(authedRequest(`http://localhost/api/admin/surveys/${id}/responses`), {
      params: Promise.resolve({ id: String(id) }),
    })
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.count).toBe(1)
    expect(data.tallies[0].textAnswers).toEqual([{ email: 'ana@example.com', answer: 'Sí' }])
  })

  it('returns 404 for an unknown survey', async () => {
    const response = await GET(authedRequest('http://localhost/api/admin/surveys/999999/responses'), {
      params: Promise.resolve({ id: '999999' }),
    })
    expect(response.status).toBe(404)
  })
})
