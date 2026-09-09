import type Database from 'better-sqlite3'

export interface SubscribeInput {
  name: string
  email: string
  phone?: string
}

export type ValidationError = { field: 'name' | 'email' }

export type SubscribeResult = { status: 'ok' } | { status: 'duplicate' }

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateSubscribeInput(input: Partial<SubscribeInput>): ValidationError | null {
  if (!input.name || !input.name.trim()) {
    return { field: 'name' }
  }
  if (!input.email || !EMAIL_PATTERN.test(input.email)) {
    return { field: 'email' }
  }
  return null
}

export function addSubscriber(db: Database.Database, input: SubscribeInput): SubscribeResult {
  try {
    db.prepare('INSERT INTO subscribers (name, email, phone) VALUES (?, ?, ?)').run(
      input.name.trim(),
      input.email.trim(),
      input.phone?.trim() || null
    )
    return { status: 'ok' }
  } catch (err) {
    if (err instanceof Error && err.message.includes('UNIQUE constraint failed')) {
      return { status: 'duplicate' }
    }
    throw err
  }
}

export function isSubscribedEmail(db: Database.Database, email: string): boolean {
  const row = db.prepare('SELECT 1 FROM subscribers WHERE email = ?').get(email.trim())
  return !!row
}
