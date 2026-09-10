import { describe, it, expect } from 'vitest'
import { createDb } from './db'

describe('createDb', () => {
  it('creates the subscribers, survey, and event tables', () => {
    const db = createDb(':memory:')
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
      .all()
      .map((row) => (row as { name: string }).name)
    expect(tables).toEqual([
      'event_signups',
      'events',
      'schedule_sessions',
      'subscribers',
      'survey_question_options',
      'survey_questions',
      'survey_responses',
      'surveys',
    ])
  })

  it('seeds schedule_sessions with the current weekly schedule on first creation', () => {
    const db = createDb(':memory:')
    const rows = db.prepare('SELECT day, time, title, place FROM schedule_sessions ORDER BY id').all()
    expect(rows).toEqual([
      { day: 'Martes', time: '19:00', title: 'Carrera de montaña', place: 'Parking de Canto Cochino' },
      { day: 'Jueves', time: '18:30', title: 'Escalada indoor', place: 'Rocódromo (centro)' },
      { day: 'Sábado', time: '09:00', title: 'Salida a roca / BTT', place: 'La Pedriza' },
      { day: 'Domingo', time: '08:30', title: 'Salida larga', place: 'Sierra de Guadarrama' },
    ])
  })
})
