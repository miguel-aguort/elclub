import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type Database from 'better-sqlite3'
import { createDb } from './db'
import {
  validateEventInput,
  createEvent,
  getEventById,
  listEvents,
  listUpcomingEvents,
  updateEvent,
  deleteEvent,
} from './events'
import { addSubscriber } from './subscribers'
import { createEventSignup, listEventSignups } from './event-signups'

const validInput = {
  title: 'Salida a La Pedriza',
  description: 'Ruta tranquila para todos los niveles.',
  location: 'Parking de Canto Cochino',
  eventAt: '2026-10-04T09:00',
}

describe('validateEventInput', () => {
  it('accepts a valid event', () => {
    expect(validateEventInput(validInput)).toBeNull()
  })

  it('rejects a missing title', () => {
    expect(validateEventInput({ ...validInput, title: '  ' })).toEqual({ field: 'title' })
  })

  it('rejects a missing description', () => {
    expect(validateEventInput({ ...validInput, description: '' })).toEqual({ field: 'description' })
  })

  it('rejects a missing location', () => {
    expect(validateEventInput({ ...validInput, location: '' })).toEqual({ field: 'location' })
  })

  it('rejects a missing eventAt', () => {
    expect(validateEventInput({ ...validInput, eventAt: '' })).toEqual({ field: 'eventAt' })
  })

  it('rejects an unparseable eventAt', () => {
    expect(validateEventInput({ ...validInput, eventAt: 'not-a-date' })).toEqual({ field: 'eventAt' })
  })
})

describe('createEvent / getEventById / listEvents', () => {
  let db: Database.Database

  beforeEach(() => {
    db = createDb(':memory:')
  })

  it('creates an event and fetches it by id', () => {
    const result = createEvent(db, validInput)
    expect(result.status).toBe('ok')
    const id = (result as { id: number }).id
    const event = getEventById(db, id)
    expect(event).toMatchObject({
      title: 'Salida a La Pedriza',
      description: 'Ruta tranquila para todos los niveles.',
      location: 'Parking de Canto Cochino',
      eventAt: '2026-10-04T09:00',
      link: null,
    })
  })

  it('stores an optional link', () => {
    const result = createEvent(db, { ...validInput, link: 'https://instagram.com/p/example' })
    const id = (result as { id: number }).id
    expect(getEventById(db, id)?.link).toBe('https://instagram.com/p/example')
  })

  it('returns invalid without writing anything', () => {
    const result = createEvent(db, { ...validInput, title: '' })
    expect(result).toEqual({ status: 'invalid', error: { field: 'title' } })
    expect(listEvents(db)).toEqual([])
  })

  it('returns null for an unknown id', () => {
    expect(getEventById(db, 999)).toBeNull()
  })

  it('lists all events ordered by event_at descending', () => {
    createEvent(db, { ...validInput, title: 'Antes', eventAt: '2026-09-10T09:00' })
    createEvent(db, { ...validInput, title: 'Después', eventAt: '2026-11-20T09:00' })
    const events = listEvents(db)
    expect(events.map((e) => e.title)).toEqual(['Después', 'Antes'])
  })
})

describe('listUpcomingEvents', () => {
  let db: Database.Database

  beforeEach(() => {
    db = createDb(':memory:')
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-15T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('excludes past events and sorts soonest first', () => {
    createEvent(db, { ...validInput, title: 'Ya pasó', eventAt: '2026-09-01T09:00' })
    createEvent(db, { ...validInput, title: 'Más lejos', eventAt: '2026-12-01T09:00' })
    createEvent(db, { ...validInput, title: 'Más cerca', eventAt: '2026-10-01T09:00' })

    const upcoming = listUpcomingEvents(db)
    expect(upcoming.map((e) => e.title)).toEqual(['Más cerca', 'Más lejos'])
  })

  it('returns an empty list when there are no upcoming events', () => {
    createEvent(db, { ...validInput, title: 'Ya pasó', eventAt: '2026-09-01T09:00' })
    expect(listUpcomingEvents(db)).toEqual([])
  })
})

describe('updateEvent / deleteEvent', () => {
  let db: Database.Database

  beforeEach(() => {
    db = createDb(':memory:')
  })

  it('updates an existing event', () => {
    const created = createEvent(db, validInput)
    const id = (created as { id: number }).id
    const result = updateEvent(db, id, { ...validInput, title: 'Título actualizado' })
    expect(result).toEqual({ status: 'ok' })
    expect(getEventById(db, id)?.title).toBe('Título actualizado')
  })

  it('returns not_found for an unknown id', () => {
    expect(updateEvent(db, 999, validInput)).toEqual({ status: 'not_found' })
  })

  it('returns invalid without writing when the input fails validation', () => {
    const created = createEvent(db, validInput)
    const id = (created as { id: number }).id
    const result = updateEvent(db, id, { ...validInput, title: '' })
    expect(result).toEqual({ status: 'invalid', error: { field: 'title' } })
    expect(getEventById(db, id)?.title).toBe('Salida a La Pedriza')
  })

  it('deletes an event', () => {
    const created = createEvent(db, validInput)
    const id = (created as { id: number }).id
    deleteEvent(db, id)
    expect(getEventById(db, id)).toBeNull()
  })

  it('is a no-op deleting an id that does not exist', () => {
    expect(() => deleteEvent(db, 999)).not.toThrow()
  })

  it('cascades to delete the event signups', () => {
    const created = createEvent(db, validInput)
    const id = (created as { id: number }).id
    addSubscriber(db, { name: 'Ana', email: 'ana@example.com' })
    createEventSignup(db, id, { email: 'ana@example.com' })
    expect(listEventSignups(db, id)).toHaveLength(1)

    deleteEvent(db, id)

    expect(listEventSignups(db, id)).toEqual([])
  })
})
