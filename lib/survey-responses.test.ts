import { describe, it, expect, beforeEach } from 'vitest'
import type Database from 'better-sqlite3'
import { createDb } from './db'
import { addSubscriber } from './subscribers'
import { createSurvey, getSurveyBySlug, type Survey } from './surveys'
import { validateResponseInput, submitResponse } from './survey-responses'

describe('validateResponseInput / submitResponse', () => {
  let db: Database.Database
  let survey: Survey

  beforeEach(() => {
    db = createDb(':memory:')
    addSubscriber(db, { name: 'Ana', email: 'ana@example.com' })
    createSurvey(db, {
      title: 'Horario',
      questions: [
        { prompt: '¿Sábado o domingo?', type: 'single_choice', options: ['Sábado', 'Domingo'] },
        { prompt: 'Comentarios', type: 'text' },
      ],
    })
    survey = getSurveyBySlug(db, 'horario')!
  })

  it('rejects a malformed email', () => {
    const questionId = survey.questions[0].id
    const error = validateResponseInput(survey, { email: 'not-an-email', answers: { [questionId]: 'Sábado' } })
    expect(error).toEqual({ field: 'email', reason: 'invalid' })
  })

  it('rejects a missing answer to a required question', () => {
    const error = validateResponseInput(survey, { email: 'ana@example.com', answers: {} })
    expect(error).toEqual({ field: 'question', questionId: survey.questions[0].id })
  })

  it('accepts a fully answered valid input', () => {
    const [q1, q2] = survey.questions
    const error = validateResponseInput(survey, {
      email: 'ana@example.com',
      answers: { [q1.id]: 'Sábado', [q2.id]: 'Todo bien' },
    })
    expect(error).toBeNull()
  })

  it('rejects an email that is not a known subscriber', () => {
    const [q1, q2] = survey.questions
    const result = submitResponse(db, survey, {
      email: 'stranger@example.com',
      answers: { [q1.id]: 'Sábado', [q2.id]: 'Hola' },
    })
    expect(result).toEqual({ status: 'invalid', error: { field: 'email', reason: 'not_member' } })
  })

  it('stores a response for a known subscriber', () => {
    const [q1, q2] = survey.questions
    const result = submitResponse(db, survey, {
      email: 'ana@example.com',
      answers: { [q1.id]: 'Sábado', [q2.id]: 'Hola' },
    })
    expect(result).toEqual({ status: 'ok' })
    const row = db.prepare('SELECT answers_json FROM survey_responses WHERE email = ?').get('ana@example.com') as {
      answers_json: string
    }
    expect(JSON.parse(row.answers_json)).toEqual({ [q1.id]: 'Sábado', [q2.id]: 'Hola' })
  })

  it('overwrites a previous response from the same email', () => {
    const [q1, q2] = survey.questions
    submitResponse(db, survey, { email: 'ana@example.com', answers: { [q1.id]: 'Sábado', [q2.id]: 'Primero' } })
    submitResponse(db, survey, { email: 'ana@example.com', answers: { [q1.id]: 'Domingo', [q2.id]: 'Segundo' } })

    const rows = db.prepare('SELECT answers_json FROM survey_responses WHERE email = ?').all('ana@example.com')
    expect(rows).toHaveLength(1)
    const answers = JSON.parse((rows[0] as { answers_json: string }).answers_json)
    expect(answers[q1.id]).toBe('Domingo')
  })
})
