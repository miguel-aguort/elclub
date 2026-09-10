import type Database from 'better-sqlite3'

export interface ScheduleSessionInput {
  day: string
  time: string
  title: string
  place: string
}

export type ScheduleSessionValidationError =
  | { field: 'day' }
  | { field: 'time' }
  | { field: 'title' }
  | { field: 'place' }

export interface ScheduleSession {
  id: number
  day: string
  time: string
  title: string
  place: string
  createdAt: string
}

export function validateScheduleSessionInput(
  input: Partial<ScheduleSessionInput>
): ScheduleSessionValidationError | null {
  if (!input.day || !input.day.trim()) return { field: 'day' }
  if (!input.time || !input.time.trim()) return { field: 'time' }
  if (!input.title || !input.title.trim()) return { field: 'title' }
  if (!input.place || !input.place.trim()) return { field: 'place' }
  return null
}

export type CreateScheduleSessionResult =
  | { status: 'ok'; id: number }
  | { status: 'invalid'; error: ScheduleSessionValidationError }

export function createScheduleSession(
  db: Database.Database,
  input: ScheduleSessionInput
): CreateScheduleSessionResult {
  const error = validateScheduleSessionInput(input)
  if (error) {
    return { status: 'invalid', error }
  }
  const result = db
    .prepare('INSERT INTO schedule_sessions (day, time, title, place) VALUES (?, ?, ?, ?)')
    .run(input.day.trim(), input.time.trim(), input.title.trim(), input.place.trim())
  return { status: 'ok', id: Number(result.lastInsertRowid) }
}

interface ScheduleSessionRow {
  id: number
  day: string
  time: string
  title: string
  place: string
  created_at: string
}

function mapRow(row: ScheduleSessionRow): ScheduleSession {
  return {
    id: row.id,
    day: row.day,
    time: row.time,
    title: row.title,
    place: row.place,
    createdAt: row.created_at,
  }
}

export function getScheduleSessionById(db: Database.Database, id: number): ScheduleSession | null {
  const row = db.prepare('SELECT * FROM schedule_sessions WHERE id = ?').get(id) as ScheduleSessionRow | undefined
  return row ? mapRow(row) : null
}

export function listScheduleSessions(db: Database.Database): ScheduleSession[] {
  const rows = db.prepare('SELECT * FROM schedule_sessions ORDER BY id ASC').all() as ScheduleSessionRow[]
  return rows.map(mapRow)
}

export type UpdateScheduleSessionResult =
  | { status: 'ok' }
  | { status: 'invalid'; error: ScheduleSessionValidationError }
  | { status: 'not_found' }

export function updateScheduleSession(
  db: Database.Database,
  id: number,
  input: ScheduleSessionInput
): UpdateScheduleSessionResult {
  const existing = db.prepare('SELECT id FROM schedule_sessions WHERE id = ?').get(id)
  if (!existing) {
    return { status: 'not_found' }
  }
  const error = validateScheduleSessionInput(input)
  if (error) {
    return { status: 'invalid', error }
  }
  db.prepare('UPDATE schedule_sessions SET day = ?, time = ?, title = ?, place = ? WHERE id = ?').run(
    input.day.trim(),
    input.time.trim(),
    input.title.trim(),
    input.place.trim(),
    id
  )
  return { status: 'ok' }
}

export function deleteScheduleSession(db: Database.Database, id: number): void {
  db.prepare('DELETE FROM schedule_sessions WHERE id = ?').run(id)
}
