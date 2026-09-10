import type Database from 'better-sqlite3'
import { isSubscribedEmail } from './subscribers'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type SignupValidationError = { field: 'email'; reason: 'invalid' | 'not_member' }

export type CreateSignupResult = { status: 'ok' } | { status: 'invalid'; error: SignupValidationError }

export function validateSignupInput(input: { email?: unknown }): SignupValidationError | null {
  if (!input.email || typeof input.email !== 'string' || !EMAIL_PATTERN.test(input.email)) {
    return { field: 'email', reason: 'invalid' }
  }
  return null
}

export function createEventSignup(
  db: Database.Database,
  eventId: number,
  input: { email?: unknown }
): CreateSignupResult {
  const formatError = validateSignupInput(input)
  if (formatError) {
    return { status: 'invalid', error: formatError }
  }

  const email = (input.email as string).trim()
  if (!isSubscribedEmail(db, email)) {
    return { status: 'invalid', error: { field: 'email', reason: 'not_member' } }
  }

  try {
    db.prepare('INSERT INTO event_signups (event_id, email) VALUES (?, ?)').run(eventId, email)
  } catch (err) {
    if (!(err instanceof Error && err.message.includes('UNIQUE constraint failed'))) {
      throw err
    }
  }

  return { status: 'ok' }
}

export interface EventSignup {
  email: string
  createdAt: string
}

export function listEventSignups(db: Database.Database, eventId: number): EventSignup[] {
  const rows = db
    .prepare('SELECT email, created_at FROM event_signups WHERE event_id = ? ORDER BY created_at ASC')
    .all(eventId) as Array<{ email: string; created_at: string }>
  return rows.map((row) => ({ email: row.email, createdAt: row.created_at }))
}
