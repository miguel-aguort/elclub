import { describe, it, expect, beforeEach } from 'vitest'
import type Database from 'better-sqlite3'
import { createDb } from './db'
import { addSubscriber } from './subscribers'
import { createEvent } from './events'
import { validateSignupInput, createEventSignup, listEventSignups } from './event-signups'

describe('validateSignupInput', () => {
  it('accepts a valid email', () => {
    expect(validateSignupInput({ email: 'ana@example.com' })).toBeNull()
  })

  it('rejects a missing email', () => {
    expect(validateSignupInput({})).toEqual({ field: 'email', reason: 'invalid' })
  })

  it('rejects a malformed email', () => {
    expect(validateSignupInput({ email: 'not-an-email' })).toEqual({ field: 'email', reason: 'invalid' })
  })
})

describe('createEventSignup / listEventSignups', () => {
  let db: Database.Database
  let eventId: number

  beforeEach(() => {
    db = createDb(':memory:')
    addSubscriber(db, { name: 'Ana', email: 'ana@example.com' })
    const result = createEvent(db, {
      title: 'Cross al Yelmo',
      description: 'Ruta',
      location: 'Plaza de Manzanares el Real',
      eventAt: '2026-09-12T09:30',
    })
    eventId = (result as { id: number }).id
  })

  it('rejects an email that is not a known subscriber, without writing anything', () => {
    const result = createEventSignup(db, eventId, { email: 'stranger@example.com' })
    expect(result).toEqual({ status: 'invalid', error: { field: 'email', reason: 'not_member' } })
    expect(listEventSignups(db, eventId)).toEqual([])
  })

  it('records a signup for a known subscriber', () => {
    const result = createEventSignup(db, eventId, { email: 'ana@example.com' })
    expect(result).toEqual({ status: 'ok' })
    const signups = listEventSignups(db, eventId)
    expect(signups).toHaveLength(1)
    expect(signups[0].email).toBe('ana@example.com')
  })

  it('treats signing up twice as an idempotent success', () => {
    createEventSignup(db, eventId, { email: 'ana@example.com' })
    const result = createEventSignup(db, eventId, { email: 'ana@example.com' })
    expect(result).toEqual({ status: 'ok' })
    expect(listEventSignups(db, eventId)).toHaveLength(1)
  })

  it('rejects a malformed email without writing anything', () => {
    const result = createEventSignup(db, eventId, { email: 'not-an-email' })
    expect(result).toEqual({ status: 'invalid', error: { field: 'email', reason: 'invalid' } })
    expect(listEventSignups(db, eventId)).toEqual([])
  })

  it('lists signups oldest first', () => {
    addSubscriber(db, { name: 'Beto', email: 'beto@example.com' })
    createEventSignup(db, eventId, { email: 'ana@example.com' })
    createEventSignup(db, eventId, { email: 'beto@example.com' })
    const signups = listEventSignups(db, eventId)
    expect(signups.map((s) => s.email)).toEqual(['ana@example.com', 'beto@example.com'])
  })
})
