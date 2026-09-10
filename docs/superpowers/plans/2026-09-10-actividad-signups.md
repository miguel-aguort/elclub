# Apuntarse a Actividades (Activity Signups) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a community member sign up with just their email to a specific scheduled activity via a public per-activity page/URL, restricted to emails already in `subscribers`; let the admin see who signed up.

**Architecture:** Extends the existing Next.js app with one new SQLite table (`event_signups`), a public detail+signup page per activity (`/actividades/[id]`), a public signup API route, an admin-visible signups list on the existing activity edit page, and two small nav/link additions (a "Agenda" header link, and linking each activity's title on the home page to its new detail page).

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript (strict), better-sqlite3, Vitest + Testing Library (already configured) — no new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-10-actividad-signups-design.md`

## Global Constraints

- Reuse `isSubscribedEmail` from `lib/subscribers.ts` (existing, unchanged) for community-membership checks — do not duplicate this logic. The email-format regex itself (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`) IS duplicated locally in the new lib module, matching this codebase's own established precedent in `lib/survey-responses.ts` (which duplicates the same regex rather than importing it from `lib/subscribers.ts`) — follow that precedent, don't "fix" it.
- New lib modules stay framework-agnostic pure functions over a `better-sqlite3` `Database` instance, matching `lib/survey-responses.ts`'s style; route handlers stay thin.
- Error shape for email validation matches the existing `lib/survey-responses.ts` precedent exactly: `{ status: 'invalid', error: { field: 'email', reason: 'invalid' | 'not_member' } }`, HTTP `400` for both reasons — do not invent a separate `403`/`not_community` status.
- A duplicate `(event_id, email)` signup is caught and treated as `{ status: 'ok' }`, never a thrown error or a distinct "already signed up" status — mirrors `addSubscriber`'s duplicate-handling pattern in `lib/subscribers.ts`.
- UI copy is in Spanish, matching the rest of the site; forms/pages reuse the existing `.signup-form`, `.form-field`, `.form-error`, `.signup-message`, `.signup-message--success`, `.signup-message-title`, `.signup-message-body`, `.cta-button`, `.eyebrow`, `.signup-section`, `.signup-inner`, `.schedule-note` CSS classes — no new CSS classes.
- Next.js 15 dynamic route handlers and pages receive `params` as a `Promise` — every one must `await params`.
- Any React Testing Library test file needs explicit `afterEach(() => cleanup())` — this project's `vitest.config.ts` has no `globals: true`, so RTL's automatic cleanup never registers itself.
- Any Server Component page with no other Dynamic API use must get `export const dynamic = 'force-dynamic'` as a top-level export (not nested in the component function) — verified via `npm run build`'s route table showing `ƒ`, not `○`, for that route.
- The "join the community first" link inside `EventSignupForm` must point to `/#unete` (absolute path + hash) — the form renders on `/actividades/[id]`, a different page than the home page section it links to, so a bare `#unete` would not navigate anywhere. This is different from `Header.tsx`'s own nav links, which stay bare hashes (`#proximas-actividades` etc.) since `Header` is only ever rendered on the home page itself.
- Shared `:memory:` SQLite databases inside a single Vitest test file persist across that file's `it()` blocks (the `getDb()` singleton in `lib/db.ts` is created once per test file, not once per test) — every test that needs specific event/subscriber rows must create its own via a per-test helper (e.g. `createTestEvent()`), never assume a fixture from an earlier test still has a known id.

---

### Task 1: `event_signups` table in the database schema

**Files:**
- Modify: `lib/db.ts`
- Modify: `lib/db.test.ts`

**Interfaces:**
- Consumes: nothing new — reuses `createDb(path)` / `getDb()`.
- Produces: an `event_signups` table that Task 2 depends on. Columns: `id, event_id, email, created_at`, `UNIQUE(event_id, email)`.

- [ ] **Step 1: Write the failing test**

Update the expected table list in `lib/db.test.ts` (add `'event_signups'` — it sorts before `'events'` alphabetically since `_` (0x5F) sorts before `s` (0x73)):

```ts
// lib/db.test.ts
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
Expected: FAIL — `event_signups` table doesn't exist yet.

- [ ] **Step 3: Add the `event_signups` table to `initSchema`**

In `lib/db.ts`, add a fourth `.exec(...)` call inside `initSchema`, after the existing `events` block (leave `subscribers`, `surveys`, and `events` untouched):

```ts
  database.exec(`
    CREATE TABLE IF NOT EXISTS event_signups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL REFERENCES events(id),
      email TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (event_id, email)
    )
  `)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/db.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/db.ts lib/db.test.ts
git commit -m "feat: add event_signups table to the database schema"
```

---

### Task 2: Signup validation and CRUD

**Files:**
- Create: `lib/event-signups.ts`
- Test: `lib/event-signups.test.ts`

**Interfaces:**
- Consumes: `createDb` (`lib/db.ts`, Task 1) for test fixtures; `isSubscribedEmail` from `lib/subscribers.ts` (existing, unchanged); `createEvent` from `lib/events.ts` (existing, unchanged) for test fixtures.
- Produces (used by Tasks 3 and 7):
  - `type SignupValidationError = { field: 'email'; reason: 'invalid' | 'not_member' }`
  - `type CreateSignupResult = { status: 'ok' } | { status: 'invalid'; error: SignupValidationError }`
  - `function validateSignupInput(input: { email?: unknown }): SignupValidationError | null`
  - `function createEventSignup(db: Database.Database, eventId: number, input: { email?: unknown }): CreateSignupResult`
  - `interface EventSignup { email: string; createdAt: string }`
  - `function listEventSignups(db: Database.Database, eventId: number): EventSignup[]` — oldest first

- [ ] **Step 1: Write the failing tests**

```ts
// lib/event-signups.test.ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/event-signups.test.ts`
Expected: FAIL — `lib/event-signups.ts` doesn't exist yet.

- [ ] **Step 3: Implement `lib/event-signups.ts`**

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/event-signups.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/event-signups.ts lib/event-signups.test.ts
git commit -m "feat: add event signup validation and CRUD"
```

---

### Task 3: Public signup API route

**Files:**
- Create: `app/api/actividades/[id]/apuntarse/route.ts`
- Test: `app/api/actividades/[id]/apuntarse/route.test.ts`

**Interfaces:**
- Consumes: `getDb` (`lib/db.ts`); `getEventById` (`lib/events.ts`, existing); `createEventSignup` (`lib/event-signups.ts`, Task 2).
- Produces: `POST(request: Request, { params }: { params: Promise<{ id: string }> })`. No auth — this route is intentionally public, unlike everything under `/api/admin/*`.

- [ ] **Step 1: Write the failing tests**

```ts
// app/api/actividades/[id]/apuntarse/route.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import { addSubscriber } from '@/lib/subscribers'
import { createEvent } from '@/lib/events'

let POST: typeof import('./route').POST
let getDb: typeof import('@/lib/db').getDb

beforeAll(async () => {
  process.env.DB_PATH = ':memory:'
  ;({ POST } = await import('./route'))
  ;({ getDb } = await import('@/lib/db'))
  addSubscriber(getDb(), { name: 'Ana', email: 'ana@example.com' })
})

function createTestEvent() {
  const result = createEvent(getDb(), {
    title: 'Cross al Yelmo',
    description: 'Ruta',
    location: 'Plaza de Manzanares el Real',
    eventAt: '2026-09-12T09:30',
  })
  return (result as { id: number }).id
}

function postSignup(id: number | string, body: unknown) {
  return POST(
    new Request(`http://localhost/api/actividades/${id}/apuntarse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: String(id) }) }
  )
}

describe('POST /api/actividades/[id]/apuntarse', () => {
  it('returns 404 for an unknown event', async () => {
    const response = await postSignup(999999, { email: 'ana@example.com' })
    expect(response.status).toBe(404)
  })

  it('signs up a known subscriber', async () => {
    const id = createTestEvent()
    const response = await postSignup(id, { email: 'ana@example.com' })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok' })
  })

  it('rejects an email that is not a community member', async () => {
    const id = createTestEvent()
    const response = await postSignup(id, { email: 'stranger@example.com' })
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ status: 'invalid', error: { field: 'email', reason: 'not_member' } })
  })

  it('rejects a malformed JSON body', async () => {
    const id = createTestEvent()
    const response = await POST(
      new Request(`http://localhost/api/actividades/${id}/apuntarse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
      }),
      { params: Promise.resolve({ id: String(id) }) }
    )
    expect(response.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run "app/api/actividades/[id]/apuntarse/route.test.ts"`
Expected: FAIL — route doesn't exist yet.

- [ ] **Step 3: Implement the route**

```ts
// app/api/actividades/[id]/apuntarse/route.ts
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getEventById } from '@/lib/events'
import { createEventSignup } from '@/lib/event-signups'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  const { id } = await params
  const db = getDb()
  const event = getEventById(db, Number(id))
  if (!event) {
    return NextResponse.json({ status: 'not_found' }, { status: 404 })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ status: 'invalid', error: { field: 'email', reason: 'invalid' } }, { status: 400 })
  }

  const result = createEventSignup(db, event.id, body)
  if (result.status === 'invalid') {
    return NextResponse.json(result, { status: 400 })
  }
  return NextResponse.json(result, { status: 200 })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run "app/api/actividades/[id]/apuntarse/route.test.ts"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "app/api/actividades/[id]/apuntarse/route.ts" "app/api/actividades/[id]/apuntarse/route.test.ts"
git commit -m "feat: add public activity signup API route"
```

---

### Task 4: `EventSignupForm` component

**Files:**
- Create: `components/EventSignupForm.tsx`
- Test: `components/EventSignupForm.test.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks directly (talks to Task 3's route by URL string, like `SurveyResponseForm` does with its route).
- Produces: `EventSignupForm({ eventId, eventTitle }: { eventId: number; eventTitle: string })`. Used by Task 5's page.

- [ ] **Step 1: Write the failing tests**

```tsx
// components/EventSignupForm.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EventSignupForm } from './EventSignupForm'

describe('EventSignupForm', () => {
  afterEach(() => {
    cleanup()
  })

  it('submits the email and shows a success message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'ok' }) }))
    const user = userEvent.setup()
    render(<EventSignupForm eventId={1} eventTitle="Cross al Yelmo" />)

    await user.type(screen.getByLabelText(/email/i), 'ana@example.com')
    await user.click(screen.getByRole('button', { name: /apuntarme/i }))

    await waitFor(() => {
      expect(screen.getByText(/apuntado/i)).toBeInTheDocument()
    })
    expect(fetch).toHaveBeenCalledWith('/api/actividades/1/apuntarse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'ana@example.com' }),
    })
  })

  it('shows a not-a-member message with a link to join the community', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ status: 'invalid', error: { field: 'email', reason: 'not_member' } }),
      })
    )
    const user = userEvent.setup()
    render(<EventSignupForm eventId={1} eventTitle="Cross al Yelmo" />)

    await user.type(screen.getByLabelText(/email/i), 'stranger@example.com')
    await user.click(screen.getByRole('button', { name: /apuntarme/i }))

    await waitFor(() => {
      expect(screen.getByText(/no pertenece a la comunidad/i)).toBeInTheDocument()
    })
    expect(screen.getByRole('link', { name: /únete aquí/i })).toHaveAttribute('href', '/#unete')
  })

  it('shows a generic error message when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    const user = userEvent.setup()
    render(<EventSignupForm eventId={1} eventTitle="Cross al Yelmo" />)

    await user.type(screen.getByLabelText(/email/i), 'ana@example.com')
    await user.click(screen.getByRole('button', { name: /apuntarme/i }))

    await waitFor(() => {
      expect(screen.getByText(/inténtalo de nuevo/i)).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run components/EventSignupForm.test.tsx`
Expected: FAIL — component doesn't exist yet.

- [ ] **Step 3: Implement `EventSignupForm`**

```tsx
// components/EventSignupForm.tsx
'use client'

import { useState, type FormEvent } from 'react'

type FormState = 'idle' | 'submitting' | 'ok' | 'invalid' | 'not_member' | 'error'

export function EventSignupForm({ eventId, eventTitle }: { eventId: number; eventTitle: string }) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<FormState>('idle')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setState('submitting')

    try {
      const response = await fetch(`/api/actividades/${eventId}/apuntarse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await response.json()

      if (response.ok && data.status === 'ok') {
        setState('ok')
      } else if (data.status === 'invalid' && data.error?.reason === 'not_member') {
        setState('not_member')
      } else if (data.status === 'invalid') {
        setState('invalid')
      } else {
        setState('error')
      }
    } catch {
      setState('error')
    }
  }

  if (state === 'ok') {
    return (
      <div role="status" className="signup-message signup-message--success">
        <p className="signup-message-title">¡Apuntado!</p>
        <p className="signup-message-body">Nos vemos en {eventTitle}.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="signup-form">
      <label className="form-field">
        Email
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@email.com"
          required
        />
      </label>

      {state === 'not_member' && (
        <p role="alert" className="form-error">
          Ese email no pertenece a la comunidad. <a href="/#unete">Únete aquí</a> primero.
        </p>
      )}
      {state === 'invalid' && (
        <p role="alert" className="form-error">
          Revisa tu email.
        </p>
      )}
      {state === 'error' && (
        <p role="alert" className="form-error">
          Algo ha fallado, inténtalo de nuevo.
        </p>
      )}

      <button type="submit" className="cta-button" disabled={state === 'submitting'}>
        {state === 'submitting' ? 'Enviando…' : 'Apuntarme'}
      </button>
    </form>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run components/EventSignupForm.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/EventSignupForm.tsx components/EventSignupForm.test.tsx
git commit -m "feat: add EventSignupForm component"
```

---

### Task 5: Public activity detail + signup page

**Files:**
- Create: `app/actividades/[id]/page.tsx`

**Interfaces:**
- Consumes: `getDb` (`lib/db.ts`); `getEventById` (`lib/events.ts`, existing); `EventSignupForm` (Task 4).
- Produces: nothing consumed by other tasks — this is the URL the admin shares. No dedicated automated test, per this project's established convention for Server Component pages — verified instead by the `npm run build` dynamic-route check in Step 3.

- [ ] **Step 1: Implement the page**

```tsx
// app/actividades/[id]/page.tsx
export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { getDb } from '@/lib/db'
import { getEventById } from '@/lib/events'
import { EventSignupForm } from '@/components/EventSignupForm'

export default async function ActividadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const event = getEventById(getDb(), Number(id))
  if (!event) {
    notFound()
  }

  const eventDate = new Date(event.eventAt)

  return (
    <main>
      <section className="signup-section">
        <div className="signup-inner">
          <p className="eyebrow">Actividad</p>
          <h2>{event.title}</h2>
          <p className="schedule-note">
            {eventDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })} ·{' '}
            {eventDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} · {event.location}
          </p>
          <p className="schedule-note">{event.description}</p>
          {event.link && (
            <p className="schedule-note">
              <a href={event.link} target="_blank" rel="noopener noreferrer">
                Más información
              </a>
            </p>
          )}
          <EventSignupForm eventId={event.id} eventTitle={event.title} />
        </div>
      </section>
    </main>
  )
}
```

- [ ] **Step 2: Run the full test suite to confirm nothing regressed**

Run: `npm test`
Expected: PASS (all prior tests, this task adds none)

- [ ] **Step 3: Confirm the page is dynamically rendered**

Run: `npm run build`
Expected: the route table in the build output must mark `/actividades/[id]` as `ƒ (Dynamic)`, not `○ (Static)`. If it shows static, the `export const dynamic = 'force-dynamic'` line is missing or misplaced (it must be a top-level export, not inside the component function).

- [ ] **Step 4: Manually verify the flow**

Run: `ADMIN_PASSWORD=test-local npm run dev`, then in a browser (after creating a test activity via `/admin/activities/new` and a test subscriber via the home page's signup form):
1. Visit `/actividades/<id>` for the test activity — confirm title, date, location, description render.
2. Submit the form with an email NOT in `subscribers` — confirm the "únete primero" message and link appear.
3. Submit the form with the subscriber email you just created — confirm the success message appears.
4. Submit the same email again — confirm it still shows success (idempotent), not an error.

- [ ] **Step 5: Commit**

```bash
git add "app/actividades/[id]/page.tsx"
git commit -m "feat: add public activity detail and signup page"
```

---

### Task 6: Home page and header links

**Files:**
- Modify: `app/page.tsx`
- Modify: `components/Header.tsx`

**Interfaces:**
- Consumes: nothing new — links to the URL pattern Task 5's page lives at (`/actividades/${event.id}`), and to the existing `#proximas-actividades`/`#unete` section ids already on the home page.
- Produces: nothing consumed by other tasks.

- [ ] **Step 1: Link each activity's title to its detail page, and move `event.link` into the description line**

In `app/page.tsx`, add the import:

```ts
import Link from 'next/link'
```

Replace the `schedule-title` and `schedule-note` lines inside the `upcomingEvents.map(...)` block with:

```tsx
                    <span className="schedule-title">
                      <Link href={`/actividades/${event.id}`}>{event.title}</Link>
                    </span>
                    <span className="schedule-place">{event.location}</span>
                    <p className="schedule-note">
                      {event.description}
                      {event.link && (
                        <>
                          {' '}
                          <a href={event.link} target="_blank" rel="noopener noreferrer">
                            Más información
                          </a>
                        </>
                      )}
                    </p>
```

(This replaces the previous version where `event.link` wrapped the title itself — the title's primary destination is now always the internal detail page; `event.link`, when present, becomes a secondary link appended to the description line, which already spans the full row width via the `.schedule-row .schedule-note` CSS rule, avoiding the grid-column bug that rule was added to fix.)

- [ ] **Step 2: Add the "Agenda" header link**

In `components/Header.tsx`, add one line to the nav, right after the existing "Actividades" link:

```tsx
      <nav className="site-nav">
        <a href="#actividades">Actividades</a>
        <a href="#proximas-actividades">Agenda</a>
        <a href="#montana">La Montaña</a>
        <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">
          Instagram
        </a>
        <a href="#unete" className="nav-cta">
          Únete
        </a>
      </nav>
```

- [ ] **Step 3: Run the full test suite to confirm nothing regressed**

Run: `npm test`
Expected: PASS — `app/page.test.tsx`'s three existing tests don't assert on the title's link structure or the header's nav links, so none should need changes.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx components/Header.tsx
git commit -m "feat: link activities to their detail page, add Agenda nav link"
```

---

### Task 7: Admin-visible signups list

**Files:**
- Modify: `app/admin/activities/[id]/page.tsx`

**Interfaces:**
- Consumes: `listEventSignups` (`lib/event-signups.ts`, Task 2).
- Produces: nothing consumed elsewhere — outermost page. No dedicated automated test, per this project's established convention for Server Component pages — verify manually with `npm run dev` per Step 2.

- [ ] **Step 1: Add the signups list and public link to the admin activity page**

Replace the full contents of `app/admin/activities/[id]/page.tsx`:

```tsx
export const dynamic = 'force-dynamic'

import { notFound, redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getDb } from '@/lib/db'
import { getEventById } from '@/lib/events'
import { listEventSignups } from '@/lib/event-signups'
import { isValidSessionCookie, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth'
import { ActivityBuilderForm } from '@/components/ActivityBuilderForm'
import { DeleteActivityButton } from '@/components/DeleteActivityButton'

export default async function EditActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies()
  if (!isValidSessionCookie(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)) {
    redirect('/admin/login')
  }

  const { id } = await params
  const db = getDb()
  const event = getEventById(db, Number(id))
  if (!event) {
    notFound()
  }
  const signups = listEventSignups(db, event.id)

  return (
    <main className="signup-section">
      <div className="signup-inner">
        <h2>{event.title}</h2>
        <p>
          Enlace público: <a href={`/actividades/${event.id}`}>/actividades/{event.id}</a>
        </p>
        <p>{signups.length} apuntado(s)</p>
        <ul>
          {signups.map((signup) => (
            <li key={signup.email}>{signup.email}</li>
          ))}
        </ul>
        <ActivityBuilderForm activity={event} />
        <DeleteActivityButton id={event.id} />
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Run the full test suite, then manually verify**

Run: `npm test`
Expected: PASS — no regressions.

Run: `ADMIN_PASSWORD=test-local npm run dev`, log in, visit `/admin/activities/<id>` for an activity someone has signed up for (from Task 5's manual test), and confirm the public link and the signup count/list render correctly.

- [ ] **Step 3: Commit**

```bash
git add "app/admin/activities/[id]/page.tsx"
git commit -m "feat: show signups and the public link on the admin activity page"
```

---

## Self-Review Notes

- **Spec coverage:** schema (Task 1), validation + community-membership check + idempotent duplicate handling (Task 2), public API (Task 3), public form component including the not-a-member message and join link (Task 4), the public detail+signup page (Task 5), home-page title link and header "Agenda" shortcut (Task 6), admin-visible signup list and public link (Task 7). Every Success Criteria bullet in the spec maps to a task.
- **Type consistency:** `SignupValidationError`/`CreateSignupResult`/`EventSignup` (Task 2) are reused unchanged by Tasks 3 and 7; the `{ status: 'invalid', error: { field: 'email', reason } }` shape is identical to the existing `lib/survey-responses.ts` precedent, reused verbatim in Task 3's route and Task 4's form's response handling — no renaming across tasks.
- **No placeholders:** every step has literal code.
