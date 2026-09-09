import { describe, it, expect, beforeEach } from 'vitest'
import { createDb } from './db'
import { validateSubscribeInput, addSubscriber, isSubscribedEmail } from './subscribers'
import type Database from 'better-sqlite3'

describe('validateSubscribeInput', () => {
  it('accepts a valid name and email', () => {
    expect(validateSubscribeInput({ name: 'Ana', email: 'ana@example.com' })).toBeNull()
  })

  it('rejects a missing name', () => {
    expect(validateSubscribeInput({ email: 'ana@example.com' })).toEqual({ field: 'name' })
  })

  it('rejects a blank name', () => {
    expect(validateSubscribeInput({ name: '   ', email: 'ana@example.com' })).toEqual({ field: 'name' })
  })

  it('rejects a malformed email', () => {
    expect(validateSubscribeInput({ name: 'Ana', email: 'not-an-email' })).toEqual({ field: 'email' })
  })

  it('rejects a missing email', () => {
    expect(validateSubscribeInput({ name: 'Ana' })).toEqual({ field: 'email' })
  })
})

describe('addSubscriber', () => {
  let db: Database.Database

  beforeEach(() => {
    db = createDb(':memory:')
  })

  it('inserts a new subscriber', () => {
    const result = addSubscriber(db, { name: 'Ana', email: 'ana@example.com' })
    expect(result).toEqual({ status: 'ok' })
    const row = db.prepare('SELECT * FROM subscribers WHERE email = ?').get('ana@example.com')
    expect(row).toMatchObject({ name: 'Ana', email: 'ana@example.com', phone: null })
  })

  it('stores an optional phone number', () => {
    addSubscriber(db, { name: 'Ana', email: 'ana@example.com', phone: '555-1234' })
    const row = db.prepare('SELECT * FROM subscribers WHERE email = ?').get('ana@example.com')
    expect(row).toMatchObject({ phone: '555-1234' })
  })

  it('reports a duplicate email instead of throwing', () => {
    addSubscriber(db, { name: 'Ana', email: 'ana@example.com' })
    const result = addSubscriber(db, { name: 'Ana Again', email: 'ana@example.com' })
    expect(result).toEqual({ status: 'duplicate' })
  })
})

describe('isSubscribedEmail', () => {
  let db: Database.Database

  beforeEach(() => {
    db = createDb(':memory:')
  })

  it('returns true for a known subscriber email', () => {
    addSubscriber(db, { name: 'Ana', email: 'ana@example.com' })
    expect(isSubscribedEmail(db, 'ana@example.com')).toBe(true)
  })

  it('returns false for an unknown email', () => {
    expect(isSubscribedEmail(db, 'nobody@example.com')).toBe(false)
  })
})
