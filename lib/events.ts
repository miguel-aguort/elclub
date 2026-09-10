import type Database from 'better-sqlite3'

export interface EventInput {
  title: string
  description: string
  location: string
  eventAt: string
  link?: string
}

export type EventValidationError =
  | { field: 'title' }
  | { field: 'description' }
  | { field: 'location' }
  | { field: 'eventAt' }

export interface Event {
  id: number
  title: string
  description: string
  location: string
  eventAt: string
  link: string | null
  createdAt: string
}

export function validateEventInput(input: Partial<EventInput>): EventValidationError | null {
  if (!input.title || !input.title.trim()) return { field: 'title' }
  if (!input.description || !input.description.trim()) return { field: 'description' }
  if (!input.location || !input.location.trim()) return { field: 'location' }
  if (!input.eventAt || Number.isNaN(new Date(input.eventAt).getTime())) return { field: 'eventAt' }
  return null
}

export type CreateEventResult = { status: 'ok'; id: number } | { status: 'invalid'; error: EventValidationError }

export function createEvent(db: Database.Database, input: EventInput): CreateEventResult {
  const error = validateEventInput(input)
  if (error) {
    return { status: 'invalid', error }
  }
  const result = db
    .prepare('INSERT INTO events (title, description, location, event_at, link) VALUES (?, ?, ?, ?, ?)')
    .run(
      input.title.trim(),
      input.description.trim(),
      input.location.trim(),
      input.eventAt,
      input.link?.trim() || null
    )
  return { status: 'ok', id: Number(result.lastInsertRowid) }
}

interface EventRow {
  id: number
  title: string
  description: string
  location: string
  event_at: string
  link: string | null
  created_at: string
}

function mapRow(row: EventRow): Event {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    location: row.location,
    eventAt: row.event_at,
    link: row.link,
    createdAt: row.created_at,
  }
}

export function getEventById(db: Database.Database, id: number): Event | null {
  const row = db.prepare('SELECT * FROM events WHERE id = ?').get(id) as EventRow | undefined
  return row ? mapRow(row) : null
}

export function listEvents(db: Database.Database): Event[] {
  const rows = db.prepare('SELECT * FROM events ORDER BY event_at DESC').all() as EventRow[]
  return rows.map(mapRow)
}

export function listUpcomingEvents(db: Database.Database): Event[] {
  const rows = db.prepare('SELECT * FROM events').all() as EventRow[]
  const now = new Date()
  return rows
    .map(mapRow)
    .filter((event) => new Date(event.eventAt) >= now)
    .sort((a, b) => new Date(a.eventAt).getTime() - new Date(b.eventAt).getTime())
}

export type UpdateEventResult =
  | { status: 'ok' }
  | { status: 'invalid'; error: EventValidationError }
  | { status: 'not_found' }

export function updateEvent(db: Database.Database, id: number, input: EventInput): UpdateEventResult {
  const existing = db.prepare('SELECT id FROM events WHERE id = ?').get(id)
  if (!existing) {
    return { status: 'not_found' }
  }
  const error = validateEventInput(input)
  if (error) {
    return { status: 'invalid', error }
  }
  db.prepare(
    'UPDATE events SET title = ?, description = ?, location = ?, event_at = ?, link = ? WHERE id = ?'
  ).run(input.title.trim(), input.description.trim(), input.location.trim(), input.eventAt, input.link?.trim() || null, id)
  return { status: 'ok' }
}

export function deleteEvent(db: Database.Database, id: number): void {
  db.prepare('DELETE FROM event_signups WHERE event_id = ?').run(id)
  db.prepare('DELETE FROM events WHERE id = ?').run(id)
}
