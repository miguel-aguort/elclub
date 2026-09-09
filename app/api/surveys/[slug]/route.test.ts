import { describe, it, expect, beforeAll } from 'vitest'
import { createSurvey } from '@/lib/surveys'

let GET: typeof import('./route').GET
let getDb: typeof import('@/lib/db').getDb

beforeAll(async () => {
  process.env.DB_PATH = ':memory:'
  ;({ GET } = await import('./route'))
  ;({ getDb } = await import('@/lib/db'))
  createSurvey(getDb(), { title: 'Horario de otoño', questions: [{ prompt: '¿Vienes?', type: 'text' }] })
})

describe('GET /api/surveys/[slug]', () => {
  it('returns the survey definition for a known slug', async () => {
    const response = await GET(new Request('http://localhost/api/surveys/horario-de-otono'), {
      params: Promise.resolve({ slug: 'horario-de-otono' }),
    })
    expect(response.status).toBe(200)
    const { survey } = await response.json()
    expect(survey.title).toBe('Horario de otoño')
  })

  it('returns 404 for an unknown slug', async () => {
    const response = await GET(new Request('http://localhost/api/surveys/nope'), {
      params: Promise.resolve({ slug: 'nope' }),
    })
    expect(response.status).toBe(404)
  })
})
