import { describe, it, expect, beforeEach } from 'vitest'
import type Database from 'better-sqlite3'
import { createDb } from './db'
import { addSubscriber } from './subscribers'
import { createSurvey, getSurveyBySlug, type Survey } from './surveys'
import { validateResponseInput, submitResponse, getResponses, tallyResponses } from './survey-responses'

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

  it('rejects a non-string answer instead of throwing', () => {
    const error = validateResponseInput(survey, { email: 'ana@example.com', answers: { [survey.questions[0].id]: 42 as unknown as string } })
    expect(error).toEqual({ field: 'question', questionId: survey.questions[0].id })
  })

  it('rejects a non-string email instead of throwing', () => {
    const error = validateResponseInput(survey, { email: ['ana@example.com'] as unknown as string, answers: {} })
    expect(error).toEqual({ field: 'email', reason: 'invalid' })
  })

  it('drops answer keys that do not correspond to a real question', () => {
    const [q1, q2] = survey.questions
    submitResponse(db, survey, {
      email: 'ana@example.com',
      answers: { [q1.id]: 'Sábado', [q2.id]: 'Hola', '99999': 'inyectado', extra: 'basura' } as unknown as Record<string, string>,
    })
    const row = db.prepare('SELECT answers_json FROM survey_responses WHERE email = ?').get('ana@example.com') as { answers_json: string }
    const stored = JSON.parse(row.answers_json)
    expect(Object.keys(stored).sort()).toEqual([String(q1.id), String(q2.id)].sort())
  })
})

describe('getResponses / tallyResponses', () => {
  let db: Database.Database
  let survey: Survey

  beforeEach(() => {
    db = createDb(':memory:')
    addSubscriber(db, { name: 'Ana', email: 'ana@example.com' })
    addSubscriber(db, { name: 'Bea', email: 'bea@example.com' })
    createSurvey(db, {
      title: 'Horario',
      questions: [
        { prompt: '¿Sábado o domingo?', type: 'single_choice', options: ['Sábado', 'Domingo'] },
        { prompt: 'Comentarios', type: 'text' },
      ],
    })
    survey = getSurveyBySlug(db, 'horario')!
    const [q1, q2] = survey.questions
    submitResponse(db, survey, { email: 'ana@example.com', answers: { [q1.id]: 'Sábado', [q2.id]: 'Genial' } })
    submitResponse(db, survey, { email: 'bea@example.com', answers: { [q1.id]: 'Sábado', [q2.id]: 'Perfecto' } })
  })

  it('lists all responses for a survey', () => {
    const responses = getResponses(db, survey.id)
    expect(responses).toHaveLength(2)
    expect(responses.map((r) => r.email).sort()).toEqual(['ana@example.com', 'bea@example.com'])
  })

  it('tallies single_choice answers and lists text answers', () => {
    const responses = getResponses(db, survey.id)
    const tallies = tallyResponses(survey, responses)

    const choiceTally = tallies[0]
    expect(choiceTally.optionCounts).toEqual([
      { label: 'Sábado', count: 2 },
      { label: 'Domingo', count: 0 },
    ])

    const textTally = tallies[1]
    expect(textTally.textAnswers).toHaveLength(2)
    expect(textTally.textAnswers?.map((a) => a.answer).sort()).toEqual(['Genial', 'Perfecto'])
  })
})
