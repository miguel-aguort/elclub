import { describe, it, expect, beforeAll } from 'vitest'
import { addSubscriber } from '@/lib/subscribers'
import { createSurvey, getSurveyBySlug } from '@/lib/surveys'

let POST: typeof import('./route').POST
let getDb: typeof import('@/lib/db').getDb

beforeAll(async () => {
  process.env.DB_PATH = ':memory:'
  ;({ POST } = await import('./route'))
  ;({ getDb } = await import('@/lib/db'))
  addSubscriber(getDb(), { name: 'Ana', email: 'ana@example.com' })
  createSurvey(getDb(), { title: 'Horario', questions: [{ prompt: '¿Vienes?', type: 'text' }] })
})

function jsonRequest(body: unknown) {
  return new Request('http://localhost/api/surveys/horario/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/surveys/[slug]/responses', () => {
  it('accepts a response from a known member', async () => {
    const survey = getSurveyBySlug(getDb(), 'horario')!
    const response = await POST(jsonRequest({ email: 'ana@example.com', answers: { [survey.questions[0].id]: 'Sí' } }), {
      params: Promise.resolve({ slug: 'horario' }),
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok' })
  })

  it('rejects an email that is not a member', async () => {
    const survey = getSurveyBySlug(getDb(), 'horario')!
    const response = await POST(
      jsonRequest({ email: 'stranger@example.com', answers: { [survey.questions[0].id]: 'Sí' } }),
      { params: Promise.resolve({ slug: 'horario' }) }
    )
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ status: 'invalid', error: { field: 'email', reason: 'not_member' } })
  })

  it('returns 404 for an unknown survey slug', async () => {
    const response = await POST(jsonRequest({ email: 'ana@example.com', answers: {} }), {
      params: Promise.resolve({ slug: 'nope' }),
    })
    expect(response.status).toBe(404)
  })
})
