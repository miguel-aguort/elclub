import { describe, it, expect } from 'vitest'
import { createDb } from './db'

describe('createDb', () => {
  it('creates the subscribers and survey tables', () => {
    const db = createDb(':memory:')
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
      .all()
      .map((row) => (row as { name: string }).name)
    expect(tables).toEqual([
      'subscribers',
      'survey_question_options',
      'survey_questions',
      'survey_responses',
      'surveys',
    ])
  })
})
