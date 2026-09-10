import { describe, it, expect, beforeEach } from 'vitest'
import type Database from 'better-sqlite3'
import { createDb } from './db'
import {
  validateScheduleSessionInput,
  createScheduleSession,
  getScheduleSessionById,
  listScheduleSessions,
  updateScheduleSession,
  deleteScheduleSession,
} from './schedule-sessions'

const validInput = { day: 'Miércoles', time: '20:00', title: 'Yoga', place: 'Parque' }

describe('validateScheduleSessionInput', () => {
  it('accepts a valid session', () => {
    expect(validateScheduleSessionInput(validInput)).toBeNull()
  })

  it('rejects a missing day', () => {
    expect(validateScheduleSessionInput({ ...validInput, day: '  ' })).toEqual({ field: 'day' })
  })

  it('rejects a missing time', () => {
    expect(validateScheduleSessionInput({ ...validInput, time: '' })).toEqual({ field: 'time' })
  })

  it('rejects a missing title', () => {
    expect(validateScheduleSessionInput({ ...validInput, title: '' })).toEqual({ field: 'title' })
  })

  it('rejects a missing place', () => {
    expect(validateScheduleSessionInput({ ...validInput, place: '' })).toEqual({ field: 'place' })
  })
})

describe('createScheduleSession / getScheduleSessionById / listScheduleSessions', () => {
  let db: Database.Database

  beforeEach(() => {
    db = createDb(':memory:')
    db.exec('DELETE FROM schedule_sessions')
  })

  it('creates a session and fetches it by id', () => {
    const result = createScheduleSession(db, validInput)
    expect(result.status).toBe('ok')
    const id = (result as { id: number }).id
    const session = getScheduleSessionById(db, id)
    expect(session).toMatchObject(validInput)
  })

  it('returns invalid without writing anything', () => {
    const result = createScheduleSession(db, { ...validInput, title: '' })
    expect(result).toEqual({ status: 'invalid', error: { field: 'title' } })
    expect(listScheduleSessions(db)).toEqual([])
  })

  it('returns null for an unknown id', () => {
    expect(getScheduleSessionById(db, 999)).toBeNull()
  })

  it('lists sessions in creation order', () => {
    createScheduleSession(db, { ...validInput, title: 'Primero' })
    createScheduleSession(db, { ...validInput, title: 'Segundo' })
    const sessions = listScheduleSessions(db)
    expect(sessions.map((s) => s.title)).toEqual(['Primero', 'Segundo'])
  })
})

describe('updateScheduleSession / deleteScheduleSession', () => {
  let db: Database.Database

  beforeEach(() => {
    db = createDb(':memory:')
    db.exec('DELETE FROM schedule_sessions')
  })

  it('updates an existing session', () => {
    const created = createScheduleSession(db, validInput)
    const id = (created as { id: number }).id
    const result = updateScheduleSession(db, id, { ...validInput, title: 'Título nuevo' })
    expect(result).toEqual({ status: 'ok' })
    expect(getScheduleSessionById(db, id)?.title).toBe('Título nuevo')
  })

  it('returns not_found for an unknown id', () => {
    expect(updateScheduleSession(db, 999, validInput)).toEqual({ status: 'not_found' })
  })

  it('returns invalid without writing when the input fails validation', () => {
    const created = createScheduleSession(db, validInput)
    const id = (created as { id: number }).id
    const result = updateScheduleSession(db, id, { ...validInput, day: '' })
    expect(result).toEqual({ status: 'invalid', error: { field: 'day' } })
    expect(getScheduleSessionById(db, id)?.day).toBe('Miércoles')
  })

  it('deletes a session', () => {
    const created = createScheduleSession(db, validInput)
    const id = (created as { id: number }).id
    deleteScheduleSession(db, id)
    expect(getScheduleSessionById(db, id)).toBeNull()
  })

  it('is a no-op deleting an id that does not exist', () => {
    expect(() => deleteScheduleSession(db, 999)).not.toThrow()
  })
})
