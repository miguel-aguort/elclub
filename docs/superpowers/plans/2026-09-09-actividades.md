# Actividades (Scheduled Activity Posts) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the club's admin publish dated, one-off activities (title, description, location, date+time, optional link) through the existing password-gated admin panel, shown on the public homepage under a "Próximas actividades" section that drops an activity automatically once its time has passed.

**Architecture:** Extends the existing Next.js app with one new SQLite table (`events`), an admin CRUD area (`/admin/activities/*`, reusing the existing `lib/admin-auth.ts` session and `middleware.ts`'s already-broad matcher — no middleware changes needed), and a homepage change: `app/page.tsx` becomes `force-dynamic` and gains a section reading `listUpcomingEvents` directly (no public API route, mirroring how `/encuestas/[slug]` reads surveys directly rather than through its own fetch).

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript (strict), better-sqlite3, Vitest + Testing Library (already configured) — no new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-09-actividades-design.md`

## Global Constraints

- Run `npm install` first if `node_modules` isn't present.
- Next.js 15 dynamic route handlers receive `params` as a `Promise` — every dynamic API route and dynamic page must `await params`.
- Lib modules stay framework-agnostic pure functions consuming a `better-sqlite3` `Database` instance, matching `lib/surveys.ts`'s style; route handlers stay thin (validate via the lib function, translate the result to a `NextResponse`).
- `listUpcomingEvents` filters/sorts by date in **application code** (`new Date(...)` comparisons), never via a SQL string comparison against `datetime('now')` — SQLite's `datetime('now')` output format (`YYYY-MM-DD HH:MM:SS`) does not lexicographically compare correctly against the stored `T`-separated ISO value.
- Every admin page checks `isValidSessionCookie`/`ADMIN_SESSION_COOKIE` itself via `cookies()` (Next.js 15 async API) and `redirect('/admin/login')` if invalid — in addition to `middleware.ts`. This is not optional defense-in-depth to skip: the encuestas feature shipped without it and had to add it in a late fix.
- Any React Testing Library test file where a component's `it()` blocks all leave the same form mounted (no full-DOM-replacing "success" state) needs `afterEach(() => cleanup())` — this project's `vitest.config.ts` has no `globals: true`, so RTL's automatic cleanup never registers itself. Two prior tasks in the encuestas feature needed this; it's a known, real requirement here, not a maybe.
- UI copy is in Spanish, matching the rest of the site; forms reuse the existing `.signup-form`, `.form-field`, `.form-error`, `.cta-button`, `.cta-ghost` CSS classes and (for the homepage list) `.schedule-section`/`.schedule-list`/`.schedule-row`/`.schedule-when`/`.schedule-day`/`.schedule-time`/`.schedule-title`/`.schedule-place`/`.schedule-note` classes already in `globals.css` — no new CSS classes.
- Any task that changes a Server Component page with no Dynamic API use must include an explicit `npm run build` step confirming the affected route is marked `ƒ (Dynamic)` in the build output, not `○ (Static)` — this is exactly the check that would have caught encuestas' Critical static-prerendering bug immediately instead of at final review.

---

### Task 1: `events` table in the database schema

**Files:**
- Modify: `lib/db.ts`
- Modify: `lib/db.test.ts`

**Interfaces:**
- Consumes: nothing new — reuses `createDb(path)` / `getDb()`.
- Produces: an `events` table that Task 2 depends on. Columns: `id, title, description, location, event_at, link (nullable), created_at`.

- [ ] **Step 1: Write the failing test**

Update the expected table list in `lib/db.test.ts` (add `'events'`, keep alphabetical order):

```ts
// lib/db.test.ts
import { describe, it, expect } from 'vitest'
import { createDb } from './db'

describe('createDb', () => {
  it('creates the subscribers, survey, and event tables', () => {
    const db = createDb(':memory:')
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((row) => (row as { name: string }).name)
    expect(tables).toEqual([
      'events',
      'subscribers',
      'survey_question_options',
      'survey_questions',
      'survey_responses',
      'surveys',
    ])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/db.test.ts`
Expected: FAIL — `events` table doesn't exist yet, actual list is missing it.

- [ ] **Step 3: Add the `events` table to `initSchema`**

In `lib/db.ts`, add a third `.exec(...)` call inside `initSchema`, after the existing `subscribers` and `surveys` blocks (leave both untouched):

```ts
  database.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      location TEXT NOT NULL,
      event_at TEXT NOT NULL,
      link TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/db.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/db.ts lib/db.test.ts
git commit -m "feat: add events table to the database schema"
```

---

### Task 2: Event validation and CRUD

**Files:**
- Create: `lib/events.ts`
- Test: `lib/events.test.ts`

**Interfaces:**
- Consumes: `createDb` from `lib/db.ts` (Task 1) for test fixtures.
- Produces (used by every later task):
  - `interface EventInput { title: string; description: string; location: string; eventAt: string; link?: string }`
  - `type EventValidationError = { field: 'title' } | { field: 'description' } | { field: 'location' } | { field: 'eventAt' }`
  - `interface Event { id: number; title: string; description: string; location: string; eventAt: string; link: string | null; createdAt: string }`
  - `function validateEventInput(input: Partial<EventInput>): EventValidationError | null`
  - `type CreateEventResult = { status: 'ok'; id: number } | { status: 'invalid'; error: EventValidationError }`
  - `function createEvent(db: Database.Database, input: EventInput): CreateEventResult`
  - `function getEventById(db: Database.Database, id: number): Event | null`
  - `function listEvents(db: Database.Database): Event[]` — all events, `event_at` descending
  - `function listUpcomingEvents(db: Database.Database): Event[]` — only events with `eventAt` in the future, ascending (soonest first)
  - `type UpdateEventResult = { status: 'ok' } | { status: 'invalid'; error: EventValidationError } | { status: 'not_found' }`
  - `function updateEvent(db: Database.Database, id: number, input: EventInput): UpdateEventResult`
  - `function deleteEvent(db: Database.Database, id: number): void`

- [ ] **Step 1: Write the failing tests**

```ts
// lib/events.test.ts
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
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/events.test.ts`
Expected: FAIL — `lib/events.ts` doesn't exist yet.

- [ ] **Step 3: Implement `lib/events.ts`**

```ts
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
  db.prepare('DELETE FROM events WHERE id = ?').run(id)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/events.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/events.ts lib/events.test.ts
git commit -m "feat: add event validation and CRUD"
```

---

### Task 3: Admin activities list/create API route

**Files:**
- Create: `app/api/admin/activities/route.ts`
- Test: `app/api/admin/activities/route.test.ts`

**Interfaces:**
- Consumes: `getDb` (`lib/db.ts`); `hasValidSession` (`lib/admin-auth.ts` — already exists from the encuestas feature, no changes); `createEvent`/`listEvents` (`lib/events.ts`, Task 2).
- Produces: `GET(request: Request)`, `POST(request: Request)`.

- [ ] **Step 1: Write the failing tests**

```ts
// app/api/admin/activities/route.test.ts
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'

let GET: typeof import('./route').GET
let POST: typeof import('./route').POST
let createSessionCookieValue: typeof import('@/lib/admin-auth').createSessionCookieValue
let ADMIN_SESSION_COOKIE: typeof import('@/lib/admin-auth').ADMIN_SESSION_COOKIE

beforeAll(async () => {
  process.env.DB_PATH = ':memory:'
  ;({ GET, POST } = await import('./route'))
  ;({ createSessionCookieValue, ADMIN_SESSION_COOKIE } = await import('@/lib/admin-auth'))
})

beforeEach(() => {
  process.env.ADMIN_PASSWORD = 'club-secret'
})

function authedRequest(url: string, init: RequestInit = {}) {
  return new Request(url, {
    ...init,
    headers: { ...init.headers, cookie: `${ADMIN_SESSION_COOKIE}=${createSessionCookieValue()}` },
  })
}

describe('GET/POST /api/admin/activities', () => {
  it('rejects an unauthenticated request', async () => {
    const response = await GET(new Request('http://localhost/api/admin/activities'))
    expect(response.status).toBe(401)
  })

  it('creates an activity and lists it', async () => {
    const createResponse = await POST(
      authedRequest('http://localhost/api/admin/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Salida a La Pedriza',
          description: 'Ruta tranquila',
          location: 'Parking de Canto Cochino',
          eventAt: '2026-10-04T09:00',
        }),
      })
    )
    expect(createResponse.status).toBe(200)
    expect(await createResponse.json()).toMatchObject({ status: 'ok' })

    const listResponse = await GET(authedRequest('http://localhost/api/admin/activities'))
    const { events } = await listResponse.json()
    expect(events).toHaveLength(1)
    expect(events[0].title).toBe('Salida a La Pedriza')
  })

  it('rejects an invalid activity', async () => {
    const response = await POST(
      authedRequest('http://localhost/api/admin/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '' }),
      })
    )
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ status: 'invalid', error: { field: 'title' } })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run app/api/admin/activities/route.test.ts`
Expected: FAIL — route doesn't exist yet.

- [ ] **Step 3: Implement the route**

```ts
// app/api/admin/activities/route.ts
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { hasValidSession } from '@/lib/admin-auth'
import { createEvent, listEvents } from '@/lib/events'

export async function GET(request: Request) {
  if (!hasValidSession(request)) {
    return NextResponse.json({ status: 'unauthorized' }, { status: 401 })
  }
  return NextResponse.json({ events: listEvents(getDb()) })
}

export async function POST(request: Request) {
  if (!hasValidSession(request)) {
    return NextResponse.json({ status: 'unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ status: 'invalid', error: { field: 'title' } }, { status: 400 })
  }

  const result = createEvent(getDb(), body)
  if (result.status === 'invalid') {
    return NextResponse.json(result, { status: 400 })
  }
  return NextResponse.json(result, { status: 200 })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run app/api/admin/activities/route.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/activities/route.ts app/api/admin/activities/route.test.ts
git commit -m "feat: add admin activities list/create API route"
```

---

### Task 4: Admin activity detail API route

**Files:**
- Create: `app/api/admin/activities/[id]/route.ts`
- Test: `app/api/admin/activities/[id]/route.test.ts`

**Interfaces:**
- Consumes: `getDb`, `hasValidSession`, `getEventById`/`updateEvent`/`deleteEvent`, `createEvent` (test setup).
- Produces: `GET`, `PATCH`, `DELETE`, each `(request: Request, { params }: { params: Promise<{ id: string }> })`.

- [ ] **Step 1: Write the failing tests**

```ts
// app/api/admin/activities/[id]/route.test.ts
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { createEvent } from '@/lib/events'

let GET: typeof import('./route').GET
let PATCH: typeof import('./route').PATCH
let DELETE: typeof import('./route').DELETE
let createSessionCookieValue: typeof import('@/lib/admin-auth').createSessionCookieValue
let ADMIN_SESSION_COOKIE: typeof import('@/lib/admin-auth').ADMIN_SESSION_COOKIE
let getDb: typeof import('@/lib/db').getDb

beforeAll(async () => {
  process.env.DB_PATH = ':memory:'
  ;({ GET, PATCH, DELETE } = await import('./route'))
  ;({ createSessionCookieValue, ADMIN_SESSION_COOKIE } = await import('@/lib/admin-auth'))
  ;({ getDb } = await import('@/lib/db'))
})

beforeEach(() => {
  process.env.ADMIN_PASSWORD = 'club-secret'
})

function authedRequest(url: string, init: RequestInit = {}) {
  return new Request(url, {
    ...init,
    headers: { ...init.headers, cookie: `${ADMIN_SESSION_COOKIE}=${createSessionCookieValue()}` },
  })
}

function createTestEvent() {
  const result = createEvent(getDb(), {
    title: 'Salida a La Pedriza',
    description: 'Ruta tranquila',
    location: 'Parking de Canto Cochino',
    eventAt: '2026-10-04T09:00',
  })
  return (result as { id: number }).id
}

describe('GET/PATCH/DELETE /api/admin/activities/[id]', () => {
  it('rejects an unauthenticated request', async () => {
    const id = createTestEvent()
    const response = await GET(new Request(`http://localhost/api/admin/activities/${id}`), {
      params: Promise.resolve({ id: String(id) }),
    })
    expect(response.status).toBe(401)
  })

  it('fetches an activity by id', async () => {
    const id = createTestEvent()
    const response = await GET(authedRequest(`http://localhost/api/admin/activities/${id}`), {
      params: Promise.resolve({ id: String(id) }),
    })
    expect(response.status).toBe(200)
    const { event } = await response.json()
    expect(event.title).toBe('Salida a La Pedriza')
  })

  it('returns 404 for an unknown id', async () => {
    const response = await GET(authedRequest('http://localhost/api/admin/activities/999999'), {
      params: Promise.resolve({ id: '999999' }),
    })
    expect(response.status).toBe(404)
  })

  it('updates an activity', async () => {
    const id = createTestEvent()
    const response = await PATCH(
      authedRequest(`http://localhost/api/admin/activities/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Título nuevo',
          description: 'Ruta tranquila',
          location: 'Parking de Canto Cochino',
          eventAt: '2026-10-04T09:00',
        }),
      }),
      { params: Promise.resolve({ id: String(id) }) }
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok' })
  })

  it('deletes an activity', async () => {
    const id = createTestEvent()
    const response = await DELETE(authedRequest(`http://localhost/api/admin/activities/${id}`, { method: 'DELETE' }), {
      params: Promise.resolve({ id: String(id) }),
    })
    expect(response.status).toBe(200)
    const getResponse = await GET(authedRequest(`http://localhost/api/admin/activities/${id}`), {
      params: Promise.resolve({ id: String(id) }),
    })
    expect(getResponse.status).toBe(404)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run "app/api/admin/activities/[id]/route.test.ts"`
Expected: FAIL — route doesn't exist yet.

- [ ] **Step 3: Implement the route**

```ts
// app/api/admin/activities/[id]/route.ts
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { hasValidSession } from '@/lib/admin-auth'
import { getEventById, updateEvent, deleteEvent } from '@/lib/events'

type Params = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: Params) {
  if (!hasValidSession(request)) {
    return NextResponse.json({ status: 'unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const event = getEventById(getDb(), Number(id))
  if (!event) {
    return NextResponse.json({ status: 'not_found' }, { status: 404 })
  }
  return NextResponse.json({ event })
}

export async function PATCH(request: Request, { params }: Params) {
  if (!hasValidSession(request)) {
    return NextResponse.json({ status: 'unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ status: 'invalid', error: { field: 'title' } }, { status: 400 })
  }
  const result = updateEvent(getDb(), Number(id), body)
  if (result.status === 'not_found') {
    return NextResponse.json(result, { status: 404 })
  }
  if (result.status === 'invalid') {
    return NextResponse.json(result, { status: 400 })
  }
  return NextResponse.json(result, { status: 200 })
}

export async function DELETE(request: Request, { params }: Params) {
  if (!hasValidSession(request)) {
    return NextResponse.json({ status: 'unauthorized' }, { status: 401 })
  }
  const { id } = await params
  deleteEvent(getDb(), Number(id))
  return NextResponse.json({ status: 'ok' })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run "app/api/admin/activities/[id]/route.test.ts"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "app/api/admin/activities/[id]/route.ts" "app/api/admin/activities/[id]/route.test.ts"
git commit -m "feat: add admin activity detail API route"
```

---

### Task 5: Admin activity builder form

**Files:**
- Create: `components/ActivityBuilderForm.tsx`
- Test: `components/ActivityBuilderForm.test.tsx`

**Interfaces:**
- Consumes: `Event` from `lib/events.ts` (Task 2); `useRouter` from `next/navigation`.
- Produces: `ActivityBuilderForm({ activity }: { activity?: Event })` — `POST /api/admin/activities` (Task 3) when `activity` is absent, `PATCH /api/admin/activities/:id` (Task 4) when present. Used by Task 6's pages.

- [ ] **Step 1: Write the failing tests**

```tsx
// components/ActivityBuilderForm.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ActivityBuilderForm } from './ActivityBuilderForm'
import type { Event } from '@/lib/events'

const push = vi.fn()
const refresh = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
}))

describe('ActivityBuilderForm', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    push.mockClear()
    refresh.mockClear()
  })

  afterEach(() => cleanup())

  it('creates a new activity', async () => {
    ;(fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok', id: 1 }),
    })
    const user = userEvent.setup()
    render(<ActivityBuilderForm />)

    await user.type(screen.getByLabelText(/título/i), 'Salida a La Pedriza')
    await user.type(screen.getByLabelText(/descripción/i), 'Ruta tranquila')
    await user.type(screen.getByLabelText(/ubicación/i), 'Parking de Canto Cochino')
    await user.type(screen.getByLabelText(/fecha/i), '2026-10-04')
    await user.type(screen.getByLabelText(/hora/i), '09:00')
    await user.click(screen.getByRole('button', { name: /guardar actividad/i }))

    expect(fetch).toHaveBeenCalledWith(
      '/api/admin/activities',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          title: 'Salida a La Pedriza',
          description: 'Ruta tranquila',
          location: 'Parking de Canto Cochino',
          eventAt: '2026-10-04T09:00',
          link: undefined,
        }),
      })
    )
  })

  it('updates an existing activity via PATCH, prefilled from props', async () => {
    ;(fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok' }),
    })
    const activity: Event = {
      id: 7,
      title: 'Salida a La Pedriza',
      description: 'Ruta tranquila',
      location: 'Parking de Canto Cochino',
      eventAt: '2026-10-04T09:00',
      link: null,
      createdAt: '2026-09-09T00:00:00.000Z',
    }
    const user = userEvent.setup()
    render(<ActivityBuilderForm activity={activity} />)

    expect(screen.getByLabelText(/título/i)).toHaveValue('Salida a La Pedriza')
    expect(screen.getByLabelText(/fecha/i)).toHaveValue('2026-10-04')
    expect(screen.getByLabelText(/hora/i)).toHaveValue('09:00')
    await user.click(screen.getByRole('button', { name: /guardar actividad/i }))

    expect(fetch).toHaveBeenCalledWith('/api/admin/activities/7', expect.objectContaining({ method: 'PATCH' }))
  })

  it('shows an error message when the save fails', async () => {
    ;(fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({ status: 'invalid', error: { field: 'title' } }),
    })
    const user = userEvent.setup()
    render(<ActivityBuilderForm />)

    await user.type(screen.getByLabelText(/título/i), 'X')
    await user.type(screen.getByLabelText(/descripción/i), 'Y')
    await user.type(screen.getByLabelText(/ubicación/i), 'Z')
    await user.type(screen.getByLabelText(/fecha/i), '2026-10-04')
    await user.type(screen.getByLabelText(/hora/i), '09:00')
    await user.click(screen.getByRole('button', { name: /guardar actividad/i }))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run components/ActivityBuilderForm.test.tsx`
Expected: FAIL — component doesn't exist yet.

- [ ] **Step 3: Implement `ActivityBuilderForm`**

```tsx
// components/ActivityBuilderForm.tsx
'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import type { Event } from '@/lib/events'

function splitDateTime(eventAt?: string): { date: string; time: string } {
  if (!eventAt) return { date: '', time: '' }
  const [date, time] = eventAt.split('T')
  return { date: date ?? '', time: (time ?? '').slice(0, 5) }
}

export function ActivityBuilderForm({ activity }: { activity?: Event }) {
  const router = useRouter()
  const initial = splitDateTime(activity?.eventAt)
  const [title, setTitle] = useState(activity?.title ?? '')
  const [description, setDescription] = useState(activity?.description ?? '')
  const [location, setLocation] = useState(activity?.location ?? '')
  const [date, setDate] = useState(initial.date)
  const [time, setTime] = useState(initial.time)
  const [link, setLink] = useState(activity?.link ?? '')
  const [error, setError] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(false)

    const payload = {
      title,
      description,
      location,
      eventAt: `${date}T${time}`,
      link: link || undefined,
    }
    const url = activity ? `/api/admin/activities/${activity.id}` : '/api/admin/activities'
    const method = activity ? 'PATCH' : 'POST'

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json()
      if (response.ok && data.status === 'ok') {
        router.push('/admin/activities')
        router.refresh()
      } else {
        setError(true)
      }
    } catch {
      setError(true)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="signup-form">
      <label className="form-field">
        Título
        <input value={title} onChange={(e) => setTitle(e.target.value)} required />
      </label>
      <label className="form-field">
        Descripción
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} required />
      </label>
      <label className="form-field">
        Ubicación
        <input value={location} onChange={(e) => setLocation(e.target.value)} required />
      </label>
      <label className="form-field">
        Fecha
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </label>
      <label className="form-field">
        Hora
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
      </label>
      <label className="form-field">
        Enlace (opcional)
        <input type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..." />
      </label>

      {error && (
        <p role="alert" className="form-error">
          Revisa los campos: título, descripción, ubicación y fecha/hora son obligatorios.
        </p>
      )}

      <button type="submit" className="cta-button" disabled={submitting}>
        {submitting ? 'Guardando…' : 'Guardar actividad'}
      </button>
    </form>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run components/ActivityBuilderForm.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/ActivityBuilderForm.tsx components/ActivityBuilderForm.test.tsx
git commit -m "feat: add admin activity builder form"
```

---

### Task 6: Admin activity pages (list, new, edit+delete)

**Files:**
- Create: `components/DeleteActivityButton.tsx`
- Create: `app/admin/activities/page.tsx`
- Create: `app/admin/activities/new/page.tsx`
- Create: `app/admin/activities/[id]/page.tsx`

**Interfaces:**
- Consumes: `getDb` (`lib/db.ts`); `listEvents`/`getEventById` (`lib/events.ts`, Task 2); `isValidSessionCookie`/`ADMIN_SESSION_COOKIE` (`lib/admin-auth.ts`); `ActivityBuilderForm` (Task 5).
- Produces: nothing consumed by other tasks — these are outermost pages. No dedicated automated tests, per this project's established convention for Server Component pages (see Global Constraints) — verify manually with `npm run dev` per Step 4, and confirm dynamic rendering with `npm run build` per Step 5.

- [ ] **Step 1: Implement the delete button (client component)**

```tsx
// components/DeleteActivityButton.tsx
'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function DeleteActivityButton({ id }: { id: number }) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!confirm('¿Borrar esta actividad?')) return
    setDeleting(true)
    await fetch(`/api/admin/activities/${id}`, { method: 'DELETE' })
    router.push('/admin/activities')
    router.refresh()
  }

  return (
    <button type="button" className="cta-ghost" onClick={handleDelete} disabled={deleting}>
      {deleting ? 'Borrando…' : 'Borrar actividad'}
    </button>
  )
}
```

- [ ] **Step 2: Implement the list, new, and edit pages**

```tsx
// app/admin/activities/page.tsx
import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getDb } from '@/lib/db'
import { listEvents } from '@/lib/events'
import { isValidSessionCookie, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth'

export default async function ActivitiesListPage() {
  const cookieStore = await cookies()
  if (!isValidSessionCookie(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)) {
    redirect('/admin/login')
  }

  const events = listEvents(getDb())

  return (
    <main className="signup-section">
      <div className="signup-inner">
        <h2>Actividades</h2>
        <Link href="/admin/activities/new" className="cta-button">
          Nueva actividad
        </Link>
        <ul>
          {events.map((event) => (
            <li key={event.id}>
              <Link href={`/admin/activities/${event.id}`}>{event.title}</Link>
              {' — '}
              {new Date(event.eventAt).toLocaleString('es-ES')}
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}
```

```tsx
// app/admin/activities/new/page.tsx
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { isValidSessionCookie, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth'
import { ActivityBuilderForm } from '@/components/ActivityBuilderForm'

export default async function NewActivityPage() {
  const cookieStore = await cookies()
  if (!isValidSessionCookie(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)) {
    redirect('/admin/login')
  }

  return (
    <main className="signup-section">
      <div className="signup-inner">
        <h2>Nueva actividad</h2>
        <ActivityBuilderForm />
      </div>
    </main>
  )
}
```

```tsx
// app/admin/activities/[id]/page.tsx
import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getDb } from '@/lib/db'
import { getEventById } from '@/lib/events'
import { isValidSessionCookie, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth'
import { ActivityBuilderForm } from '@/components/ActivityBuilderForm'
import { DeleteActivityButton } from '@/components/DeleteActivityButton'

export default async function EditActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies()
  if (!isValidSessionCookie(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)) {
    redirect('/admin/login')
  }

  const { id } = await params
  const event = getEventById(getDb(), Number(id))
  if (!event) {
    notFound()
  }

  return (
    <main className="signup-section">
      <div className="signup-inner">
        <h2>{event.title}</h2>
        <ActivityBuilderForm activity={event} />
        <DeleteActivityButton id={event.id} />
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Run the full test suite to confirm nothing regressed**

Run: `npm test`
Expected: PASS (all prior tests, this task adds none)

- [ ] **Step 4: Manually verify the admin activity flow**

Run: `ADMIN_PASSWORD=test-local npm run dev`, then in a browser:
1. Log in at `/admin/login` with `test-local`.
2. Visit `/admin/activities` — should show an empty list plus a "Nueva actividad" button.
3. Create an activity with a future date/time.
4. Confirm it appears in the list, click into it, edit the title, save, confirm the change persisted.
5. Click "Borrar actividad", confirm the browser's confirm dialog, confirm it's removed from the list.

- [ ] **Step 5: Commit**

```bash
git add components/DeleteActivityButton.tsx app/admin/activities
git commit -m "feat: add admin activity list, builder, and delete pages"
```

---

### Task 7: Homepage "Próximas actividades" section

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/page.test.tsx`

**Interfaces:**
- Consumes: `getDb` (`lib/db.ts`); `listUpcomingEvents` (`lib/events.ts`, Task 2).
- Produces: nothing consumed elsewhere — this is the final integration point.

- [ ] **Step 1: Update `app/page.test.tsx` for the new DB dependency and empty-state**

`Home` will now call `getDb()`/`listUpcomingEvents` at render time, so tests need `DB_PATH` set before rendering. Add `beforeAll` and a new test:

```tsx
// app/page.test.tsx
import { describe, it, expect, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import Home from './page'

beforeAll(() => {
  process.env.DB_PATH = ':memory:'
})

describe('Home page', () => {
  it('renders the activity sections and the signup form', () => {
    render(<Home />)
    expect(screen.getByRole('heading', { name: 'Carrera de Montaña' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Escalada' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Bici' })).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
  })

  it('links out to Instagram', () => {
    render(<Home />)
    const links = screen.getAllByRole('link', { name: /instagram/i })
    expect(links.length).toBeGreaterThan(0)
    for (const link of links) {
      expect(link).toHaveAttribute('target', '_blank')
    }
  })

  it('shows an empty-state message when there are no upcoming activities', () => {
    render(<Home />)
    expect(screen.getByText(/aún no hay actividades programadas/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify the new one fails**

Run: `npx vitest run app/page.test.tsx`
Expected: FAIL — `Home` doesn't render any upcoming-activities section yet (and doesn't yet call the DB, so this is the right moment to also confirm the first two tests still pass unmodified — they should, since they don't touch new content).

- [ ] **Step 3: Update `app/page.tsx`**

Add `export const dynamic = 'force-dynamic'`, the new data fetch, and a new section between `ScheduleSection` and the signup section:

```tsx
export const dynamic = 'force-dynamic'

import { Hero } from '@/components/Hero'
import { ActivitySection } from '@/components/ActivitySection'
import { MountainSection } from '@/components/MountainSection'
import { ScheduleSection } from '@/components/ScheduleSection'
import { SignupForm } from '@/components/SignupForm'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { activities } from '@/lib/activities'
import { getDb } from '@/lib/db'
import { listUpcomingEvents } from '@/lib/events'

export default function Home() {
  const upcomingEvents = listUpcomingEvents(getDb())

  return (
    <>
      <div className="grain" aria-hidden="true" />
      <Header />
      <main>
        <Hero />

        <section id="actividades" className="activities-section">
          <div className="activities-head">
            <div>
              <p className="eyebrow">Qué hacemos</p>
              <h2>Tres formas de subir a la montaña</h2>
            </div>
            <p className="activities-lead">
              Sin cuotas, sin presión. Solo un horario, un punto de encuentro y gente que aparece.
            </p>
          </div>
          <div className="activities-grid">
            {activities.map((activity) => (
              <ActivitySection key={activity.slug} activity={activity} />
            ))}
          </div>
        </section>

        <MountainSection />
        <ScheduleSection />

        <section id="proximas-actividades" className="schedule-section">
          <div className="schedule-head">
            <p className="eyebrow">Agenda</p>
            <h2>Próximas actividades</h2>
          </div>
          {upcomingEvents.length === 0 ? (
            <p className="schedule-note">Aún no hay actividades programadas. Vuelve pronto.</p>
          ) : (
            <div className="schedule-list">
              {upcomingEvents.map((event) => (
                <div key={event.id} className="schedule-row">
                  <div className="schedule-when">
                    <span className="schedule-day">
                      {new Date(event.eventAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                    </span>
                    <span className="schedule-time">
                      {new Date(event.eventAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <span className="schedule-title">{event.title}</span>
                  <span className="schedule-place">{event.location}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section id="unete" className="signup-section">
          <div className="signup-inner">
            <p className="eyebrow">Únete</p>
            <h2>Únete a la comunidad</h2>
            <p className="signup-lead">
              Déjanos tu contacto y te avisamos de la próxima salida. Sin spam, sin cuotas.
            </p>
            <SignupForm />
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run app/page.test.tsx`
Expected: PASS (all three tests)

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS — no regressions in any other file.

- [ ] **Step 6: Confirm the homepage is dynamically rendered**

Run: `npm run build`
Expected: the route table in the build output must mark `/` as `ƒ (Dynamic)`, not `○ (Static)`. This is the exact check that would have caught encuestas' Critical bug immediately — do not skip it. If `/` still shows as static, the `export const dynamic = 'force-dynamic'` line is missing or misplaced (it must be a top-level export in `app/page.tsx`, not inside the component function).

- [ ] **Step 7: Commit**

```bash
git add app/page.tsx app/page.test.tsx
git commit -m "feat: show upcoming activities on the homepage"
```

---

## Self-Review Notes

- **Spec coverage:** schema (Task 1), full CRUD + validation (Task 2), admin API (Tasks 3-4), admin UI including the create/edit-reuse pattern and delete (Tasks 5-6), homepage integration with the force-dynamic fix baked in from the start rather than as a follow-up (Task 7). The spec's explicit call-out of the SQL-string-comparison footgun and the defense-in-depth session check are both reflected in Global Constraints and enforced in Tasks 2 and 6 respectively.
- **Type consistency:** `Event`/`EventInput`/`EventValidationError`/`CreateEventResult`/`UpdateEventResult` (Task 2) are reused unchanged by Tasks 3, 4, 5, 6, 7 — no renaming across tasks. `ADMIN_SESSION_COOKIE`/`isValidSessionCookie`/`hasValidSession` are the same encuestas-era exports, imported verbatim, not redefined.
- **No placeholders:** every step has literal code.
