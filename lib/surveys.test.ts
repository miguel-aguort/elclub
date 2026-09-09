import { describe, it, expect, beforeEach } from 'vitest'
import type Database from 'better-sqlite3'
import { createDb } from './db'
import { validateSurveyInput, createSurvey, getSurveyBySlug, getSurveyById, listSurveys, updateSurvey, deleteSurvey } from './surveys'

const validInput = {
  title: 'Horario de otoño',
  questions: [
    { prompt: '¿Prefieres sábado o domingo?', type: 'single_choice' as const, options: ['Sábado', 'Domingo'] },
    { prompt: 'Comentarios', type: 'text' as const },
  ],
}

describe('validateSurveyInput', () => {
  it('accepts a valid survey', () => {
    expect(validateSurveyInput(validInput)).toBeNull()
  })

  it('rejects a missing title', () => {
    expect(validateSurveyInput({ ...validInput, title: '  ' })).toEqual({ field: 'title' })
  })

  it('rejects a survey with no questions', () => {
    expect(validateSurveyInput({ title: 'X', questions: [] })).toEqual({ field: 'questions' })
  })

  it('rejects a question with no prompt', () => {
    const input = { ...validInput, questions: [{ prompt: ' ', type: 'text' as const }] }
    expect(validateSurveyInput(input)).toEqual({ field: 'question', index: 0, reason: 'prompt' })
  })

  it('rejects a single_choice question with fewer than 2 options', () => {
    const input = { ...validInput, questions: [{ prompt: 'X', type: 'single_choice' as const, options: ['Solo una'] }] }
    expect(validateSurveyInput(input)).toEqual({ field: 'question', index: 0, reason: 'options' })
  })
})

describe('createSurvey / getSurveyBySlug / getSurveyById / listSurveys', () => {
  let db: Database.Database

  beforeEach(() => {
    db = createDb(':memory:')
  })

  it('creates a survey with a slug derived from the title', () => {
    const result = createSurvey(db, validInput)
    expect(result).toEqual({ status: 'ok', id: expect.any(Number), slug: 'horario-de-otono' })
  })

  it('disambiguates a slug collision', () => {
    createSurvey(db, validInput)
    const second = createSurvey(db, validInput)
    expect(second.status === 'ok' && second.slug).toBe('horario-de-otono-2')
  })

  it('returns an invalid result instead of writing anything', () => {
    const result = createSurvey(db, { title: '', questions: [] })
    expect(result).toEqual({ status: 'invalid', error: { field: 'title' } })
    expect(listSurveys(db)).toEqual([])
  })

  it('fetches a survey with its ordered questions and options by slug', () => {
    createSurvey(db, validInput)
    const survey = getSurveyBySlug(db, 'horario-de-otono')
    expect(survey?.title).toBe('Horario de otoño')
    expect(survey?.questions).toHaveLength(2)
    expect(survey?.questions[0]).toMatchObject({
      prompt: '¿Prefieres sábado o domingo?',
      type: 'single_choice',
      required: true,
    })
    expect(survey?.questions[0].options.map((o) => o.label)).toEqual(['Sábado', 'Domingo'])
    expect(survey?.questions[1]).toMatchObject({ prompt: 'Comentarios', type: 'text', options: [] })
  })

  it('returns null for an unknown slug', () => {
    expect(getSurveyBySlug(db, 'nope')).toBeNull()
  })

  it('fetches a survey by id', () => {
    const created = createSurvey(db, validInput)
    const survey = getSurveyById(db, (created as { id: number }).id)
    expect(survey?.title).toBe('Horario de otoño')
  })

  it('lists surveys newest first', () => {
    createSurvey(db, { title: 'Primera', questions: [{ prompt: 'X', type: 'text' as const }] })
    createSurvey(db, { title: 'Segunda', questions: [{ prompt: 'X', type: 'text' as const }] })
    const surveys = listSurveys(db)
    expect(surveys.map((s) => s.title)).toEqual(['Segunda', 'Primera'])
  })
})

describe('updateSurvey / deleteSurvey', () => {
  let db: Database.Database

  beforeEach(() => {
    db = createDb(':memory:')
  })

  it('replaces the title and questions', () => {
    const created = createSurvey(db, validInput)
    const id = (created as { id: number }).id

    const result = updateSurvey(db, id, {
      title: 'Horario actualizado',
      questions: [{ prompt: '¿Vienes?', type: 'text' }],
    })

    expect(result).toEqual({ status: 'ok' })
    const survey = getSurveyById(db, id)
    expect(survey?.title).toBe('Horario actualizado')
    expect(survey?.questions).toHaveLength(1)
    expect(survey?.questions[0].prompt).toBe('¿Vienes?')
  })

  it('returns not_found for an unknown id', () => {
    const result = updateSurvey(db, 999, validInput)
    expect(result).toEqual({ status: 'not_found' })
  })

  it('returns invalid without writing when the input fails validation', () => {
    const created = createSurvey(db, validInput)
    const id = (created as { id: number }).id
    const result = updateSurvey(db, id, { title: '', questions: [] })
    expect(result).toEqual({ status: 'invalid', error: { field: 'title' } })
    expect(getSurveyById(db, id)?.title).toBe('Horario de otoño')
  })

  it('deletes a survey and its questions, options, and responses', () => {
    const created = createSurvey(db, validInput)
    const id = (created as { id: number }).id
    deleteSurvey(db, id)
    expect(getSurveyById(db, id)).toBeNull()
    expect(db.prepare('SELECT COUNT(*) as n FROM survey_questions WHERE survey_id = ?').get(id)).toEqual({ n: 0 })
  })
})
