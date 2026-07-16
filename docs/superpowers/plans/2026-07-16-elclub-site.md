# El Club Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the El Club marketing site — a Next.js app with activity sections, a community signup form backed by SQLite, and an Instagram link — deployable to a GCP e2-micro free-tier VM.

**Architecture:** A single Next.js (App Router, TypeScript) app serves both the page and the `/api/subscribe` endpoint. Signups are validated in `lib/subscribers.ts` and persisted to a SQLite file via `better-sqlite3` (`lib/db.ts`). The whole app ships as one Docker image, run on a persistent-disk VM so the SQLite file survives restarts.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, better-sqlite3, Vitest + @testing-library/react for tests, Docker.

## Global Constraints

- Signup fields: `name` (required), `email` (required, unique), `phone` (optional) — exact per spec.
- Storage is SQLite via `better-sqlite3`, one file on disk, `email` has a UNIQUE constraint.
- No admin dashboard, no auth/user accounts, no outbound email sending, no per-activity pages in v1 — spec explicitly marks these out of scope.
- Deployment target is a GCP Compute Engine `e2-micro` instance (Always Free tier), NOT serverless/ephemeral compute — SQLite requires a persistent disk.
- Package manager: npm.

---

### Task 1: Project Scaffolding & Tooling

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `next-env.d.ts`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Create: `.gitignore`
- Create: `app/layout.tsx`
- Create: `app/page.tsx` (placeholder, replaced in Task 6)

**Interfaces:**
- Produces: `npm run dev`, `npm run build`, `npm start`, `npm test`, `npm run test:watch` scripts that every later task relies on.
- Produces: path alias `@/*` → repo root, used by all later imports (e.g. `@/lib/activities`).

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "elclub-web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "better-sqlite3": "^11.5.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@types/better-sqlite3": "^7.6.11",
    "vitest": "^2.1.0",
    "@vitejs/plugin-react": "^4.3.0",
    "jsdom": "^25.0.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.5.0",
    "@testing-library/user-event": "^14.5.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`
Expected: installs succeed, `node_modules/` and `package-lock.json` are created.

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Create `next-env.d.ts`**

```ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />
```

- [ ] **Step 5: Create `next.config.ts`**

```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {}

export default nextConfig
```

- [ ] **Step 6: Create `.gitignore`**

```
node_modules/
.next/
data/*.db
data/*.db-journal
.env*.local
```

- [ ] **Step 7: Create `app/layout.tsx`**

```tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'El Club',
  description: 'Trail running, climbing, and biking community',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

- [ ] **Step 8: Create placeholder `app/page.tsx`**

```tsx
export default function Home() {
  return <main>Coming soon</main>
}
```

- [ ] **Step 9: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
```

- [ ] **Step 10: Create `vitest.setup.ts`**

```ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 11: Verify the app builds**

Run: `npm run build`
Expected: build completes with no errors (ends with a route summary listing `/`).

- [ ] **Step 12: Commit**

```bash
git add package.json package-lock.json tsconfig.json next.config.ts next-env.d.ts vitest.config.ts vitest.setup.ts .gitignore app
git commit -m "chore: scaffold Next.js app with Vitest tooling"
```

---

### Task 2: Activities Data & ActivitySection Component

**Files:**
- Create: `lib/activities.ts`
- Create: `lib/activities.test.ts`
- Create: `components/ActivitySection.tsx`
- Create: `components/ActivitySection.test.tsx`

**Interfaces:**
- Consumes: nothing (pure data + presentational component).
- Produces: `export interface Activity { slug: string; title: string; description: string }` and `export const activities: Activity[]` from `lib/activities.ts` — Task 6 imports both.
- Produces: `export function ActivitySection({ activity }: { activity: Activity })` from `components/ActivitySection.tsx` — Task 6 imports this.

- [ ] **Step 1: Write the failing tests for the activities data**

```ts
// lib/activities.test.ts
import { describe, it, expect } from 'vitest'
import { activities } from './activities'

describe('activities', () => {
  it('includes trail running, climbing, and biking', () => {
    const slugs = activities.map((a) => a.slug)
    expect(slugs).toEqual(expect.arrayContaining(['trail-running', 'climbing', 'biking']))
  })

  it('gives every activity a non-empty title and description', () => {
    for (const activity of activities) {
      expect(activity.title.length).toBeGreaterThan(0)
      expect(activity.description.length).toBeGreaterThan(0)
    }
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/activities.test.ts`
Expected: FAIL — cannot find module `./activities`

- [ ] **Step 3: Create `lib/activities.ts`**

```ts
export interface Activity {
  slug: string
  title: string
  description: string
}

export const activities: Activity[] = [
  {
    slug: 'trail-running',
    title: 'Trail Running',
    description: 'Weekly group runs on the trails around the mountain, for every pace.',
  },
  {
    slug: 'climbing',
    title: 'Climbing',
    description: 'Sport and trad routes, indoor sessions, and outdoor trips for all levels.',
  },
  {
    slug: 'biking',
    title: 'Biking',
    description: 'Road and mountain biking routes, from casual rides to longer climbs.',
  },
]
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/activities.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Write the failing test for ActivitySection**

```tsx
// components/ActivitySection.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ActivitySection } from './ActivitySection'

describe('ActivitySection', () => {
  it('renders the activity title and description', () => {
    render(
      <ActivitySection
        activity={{ slug: 'climbing', title: 'Climbing', description: 'Sport and trad routes for all levels.' }}
      />
    )
    expect(screen.getByRole('heading', { name: 'Climbing' })).toBeInTheDocument()
    expect(screen.getByText('Sport and trad routes for all levels.')).toBeInTheDocument()
  })
})
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npx vitest run components/ActivitySection.test.tsx`
Expected: FAIL — cannot find module `./ActivitySection`

- [ ] **Step 7: Create `components/ActivitySection.tsx`**

```tsx
import type { Activity } from '@/lib/activities'

export function ActivitySection({ activity }: { activity: Activity }) {
  return (
    <section id={activity.slug} aria-labelledby={`${activity.slug}-heading`}>
      <h3 id={`${activity.slug}-heading`}>{activity.title}</h3>
      <p>{activity.description}</p>
    </section>
  )
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npx vitest run components/ActivitySection.test.tsx`
Expected: PASS (1 test)

- [ ] **Step 9: Commit**

```bash
git add lib/activities.ts lib/activities.test.ts components/ActivitySection.tsx components/ActivitySection.test.tsx
git commit -m "feat: add activities data and ActivitySection component"
```

---

### Task 3: Subscriber Validation & SQLite Storage

**Files:**
- Create: `lib/db.ts`
- Create: `lib/subscribers.ts`
- Create: `lib/subscribers.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (from `lib/db.ts`): `export function createDb(path: string): Database.Database` and `export function getDb(): Database.Database` (singleton, reads `process.env.DB_PATH`, defaults to `data/subscribers.db`) — Task 4 uses `getDb()`, tests use `createDb(':memory:')`.
- Produces (from `lib/subscribers.ts`): `export interface SubscribeInput { name: string; email: string; phone?: string }`, `export type ValidationError = { field: 'name' | 'email' }`, `export type SubscribeResult = { status: 'ok' } | { status: 'duplicate' }`, `export function validateSubscribeInput(input: Partial<SubscribeInput>): ValidationError | null`, `export function addSubscriber(db: Database.Database, input: SubscribeInput): SubscribeResult` — Task 4 imports all of these.

- [ ] **Step 1: Write the failing tests**

```ts
// lib/subscribers.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { createDb } from './db'
import { validateSubscribeInput, addSubscriber } from './subscribers'
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/subscribers.test.ts`
Expected: FAIL — cannot find modules `./db` and `./subscribers`

- [ ] **Step 3: Create `lib/db.ts`**

```ts
import Database from 'better-sqlite3'

let db: Database.Database | null = null

function initSchema(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS subscribers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)
}

export function createDb(path: string): Database.Database {
  const database = new Database(path)
  initSchema(database)
  return database
}

export function getDb(): Database.Database {
  if (!db) {
    db = createDb(process.env.DB_PATH || 'data/subscribers.db')
  }
  return db
}
```

- [ ] **Step 4: Create `lib/subscribers.ts`**

```ts
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
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run lib/subscribers.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 6: Commit**

```bash
git add lib/db.ts lib/subscribers.ts lib/subscribers.test.ts
git commit -m "feat: add SQLite storage and subscriber validation"
```

---

### Task 4: Signup API Route

**Files:**
- Create: `app/api/subscribe/route.ts`
- Create: `app/api/subscribe/route.test.ts`

**Interfaces:**
- Consumes: `getDb` from `@/lib/db`; `validateSubscribeInput`, `addSubscriber` from `@/lib/subscribers` (Task 3).
- Produces: `export async function POST(request: Request): Promise<Response>` — Task 5's `SignupForm` calls this endpoint over HTTP as `POST /api/subscribe`.

- [ ] **Step 1: Write the failing tests**

```ts
// app/api/subscribe/route.test.ts
import { describe, it, expect, beforeAll } from 'vitest'

let POST: typeof import('./route').POST

beforeAll(async () => {
  process.env.DB_PATH = ':memory:'
  ;({ POST } = await import('./route'))
})

function jsonRequest(body: unknown) {
  return new Request('http://localhost/api/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/subscribe', () => {
  it('accepts a valid signup', async () => {
    const response = await POST(jsonRequest({ name: 'Ana', email: 'ana@example.com' }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok' })
  })

  it('rejects a missing name', async () => {
    const response = await POST(jsonRequest({ email: 'noname@example.com' }))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ status: 'invalid', field: 'name' })
  })

  it('rejects a malformed email', async () => {
    const response = await POST(jsonRequest({ name: 'Ana', email: 'not-an-email' }))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ status: 'invalid', field: 'email' })
  })

  it('reports a duplicate email on the second signup', async () => {
    await POST(jsonRequest({ name: 'Ana', email: 'dup@example.com' }))
    const response = await POST(jsonRequest({ name: 'Ana Again', email: 'dup@example.com' }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'duplicate' })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run app/api/subscribe/route.test.ts`
Expected: FAIL — cannot find module `./route`

- [ ] **Step 3: Create `app/api/subscribe/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { validateSubscribeInput, addSubscriber } from '@/lib/subscribers'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ status: 'invalid', field: 'name' }, { status: 400 })
  }

  const error = validateSubscribeInput(body)
  if (error) {
    return NextResponse.json({ status: 'invalid', field: error.field }, { status: 400 })
  }

  const result = addSubscriber(getDb(), {
    name: body.name,
    email: body.email,
    phone: body.phone,
  })

  return NextResponse.json(result, { status: 200 })
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run app/api/subscribe/route.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add app/api/subscribe/route.ts app/api/subscribe/route.test.ts
git commit -m "feat: add signup API route"
```

---

### Task 5: SignupForm Component

**Files:**
- Create: `components/SignupForm.tsx`
- Create: `components/SignupForm.test.tsx`

**Interfaces:**
- Consumes: `POST /api/subscribe` over `fetch`, expecting JSON responses shaped like `SubscribeResult` or `{ status: 'invalid', field }` from Task 4.
- Produces: `export function SignupForm()` — Task 6 renders this on the landing page.

- [ ] **Step 1: Write the failing tests**

```tsx
// components/SignupForm.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SignupForm } from './SignupForm'

describe('SignupForm', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('submits name, email, and phone and shows a success message', async () => {
    ;(fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok' }),
    })
    const user = userEvent.setup()
    render(<SignupForm />)

    await user.type(screen.getByLabelText(/name/i), 'Ana')
    await user.type(screen.getByLabelText(/email/i), 'ana@example.com')
    await user.type(screen.getByLabelText(/phone/i), '555-1234')
    await user.click(screen.getByRole('button', { name: /join/i }))

    await waitFor(() => {
      expect(screen.getByText(/you're on the list/i)).toBeInTheDocument()
    })
    expect(fetch).toHaveBeenCalledWith('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Ana', email: 'ana@example.com', phone: '555-1234' }),
    })
  })

  it('shows a friendly message for a duplicate email', async () => {
    ;(fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'duplicate' }),
    })
    const user = userEvent.setup()
    render(<SignupForm />)

    await user.type(screen.getByLabelText(/name/i), 'Ana')
    await user.type(screen.getByLabelText(/email/i), 'ana@example.com')
    await user.click(screen.getByRole('button', { name: /join/i }))

    await waitFor(() => {
      expect(screen.getByText(/already on the list/i)).toBeInTheDocument()
    })
  })

  it('shows a generic error message when the request fails', async () => {
    ;(fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network down'))
    const user = userEvent.setup()
    render(<SignupForm />)

    await user.type(screen.getByLabelText(/name/i), 'Ana')
    await user.type(screen.getByLabelText(/email/i), 'ana@example.com')
    await user.click(screen.getByRole('button', { name: /join/i }))

    await waitFor(() => {
      expect(screen.getByText(/please try again/i)).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run components/SignupForm.test.tsx`
Expected: FAIL — cannot find module `./SignupForm`

- [ ] **Step 3: Create `components/SignupForm.tsx`**

```tsx
'use client'

import { useState, type FormEvent } from 'react'

type FormState = 'idle' | 'submitting' | 'ok' | 'duplicate' | 'invalid' | 'error'

export function SignupForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [state, setState] = useState<FormState>('idle')
  const [invalidField, setInvalidField] = useState<'name' | 'email' | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setState('submitting')
    setInvalidField(null)

    try {
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone: phone || undefined }),
      })
      const data = await response.json()

      if (response.ok && data.status === 'ok') {
        setState('ok')
      } else if (data.status === 'duplicate') {
        setState('duplicate')
      } else if (data.status === 'invalid') {
        setState('invalid')
        setInvalidField(data.field)
      } else {
        setState('error')
      }
    } catch {
      setState('error')
    }
  }

  if (state === 'ok') {
    return <p role="status">You're on the list! We'll be in touch.</p>
  }

  if (state === 'duplicate') {
    return <p role="status">You're already on the list!</p>
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="signup-name">Name</label>
      <input id="signup-name" value={name} onChange={(e) => setName(e.target.value)} required />

      <label htmlFor="signup-email">Email</label>
      <input
        id="signup-email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />

      <label htmlFor="signup-phone">Phone (optional)</label>
      <input id="signup-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />

      {state === 'invalid' && (
        <p role="alert">
          {invalidField === 'email' ? 'Please enter a valid email address.' : 'Please enter your name.'}
        </p>
      )}
      {state === 'error' && <p role="alert">Something went wrong, please try again.</p>}

      <button type="submit" disabled={state === 'submitting'}>
        Join the community
      </button>
    </form>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run components/SignupForm.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add components/SignupForm.tsx components/SignupForm.test.tsx
git commit -m "feat: add SignupForm component"
```

---

### Task 6: Landing Page Composition

**Files:**
- Create: `lib/site-config.ts`
- Create: `.env.local.example`
- Create: `components/InstagramLink.tsx`
- Create: `components/Hero.tsx`
- Create: `components/Footer.tsx`
- Create: `app/globals.css`
- Modify: `app/layout.tsx` (import `./globals.css`)
- Modify: `app/page.tsx` (replace placeholder with full composition)
- Create: `app/page.test.tsx`

**Interfaces:**
- Consumes: `activities`/`Activity` (Task 2), `ActivitySection` (Task 2), `SignupForm` (Task 5).
- Produces: `export const INSTAGRAM_URL: string` from `lib/site-config.ts`; `export function InstagramLink({ className }: { className?: string })`, `export function Hero()`, `export function Footer()` — all consumed only by `app/page.tsx`.

- [ ] **Step 1: Create `lib/site-config.ts`**

```ts
export const INSTAGRAM_URL = process.env.NEXT_PUBLIC_INSTAGRAM_URL || 'https://instagram.com/elclub'
```

- [ ] **Step 2: Create `.env.local.example`**

```
NEXT_PUBLIC_INSTAGRAM_URL=https://instagram.com/your-real-handle
```

- [ ] **Step 3: Create `components/InstagramLink.tsx`**

```tsx
import { INSTAGRAM_URL } from '@/lib/site-config'

export function InstagramLink({ className }: { className?: string }) {
  return (
    <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className={className}>
      Follow us on Instagram
    </a>
  )
}
```

- [ ] **Step 4: Create `components/Hero.tsx`**

```tsx
export function Hero() {
  return (
    <section id="hero">
      <h1>El Club</h1>
      <p>Trail running. Climbing. Biking. Join the community.</p>
      <a href="#signup">Join the community</a>
    </section>
  )
}
```

- [ ] **Step 5: Create `components/Footer.tsx`**

```tsx
import { InstagramLink } from './InstagramLink'

export function Footer() {
  return (
    <footer>
      <InstagramLink />
      <p>© {new Date().getFullYear()} El Club</p>
    </footer>
  )
}
```

- [ ] **Step 6: Create `app/globals.css`**

```css
:root {
  color-scheme: light dark;
  font-family: system-ui, sans-serif;
}

body {
  margin: 0;
  line-height: 1.5;
}

section {
  padding: 2rem 1.5rem;
  max-width: 720px;
  margin: 0 auto;
}

form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-width: 360px;
}

input {
  padding: 0.5rem;
  font-size: 1rem;
}

button {
  padding: 0.6rem 1rem;
  font-size: 1rem;
  cursor: pointer;
}
```

- [ ] **Step 7: Update `app/layout.tsx` to import the stylesheet**

```tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'El Club',
  description: 'Trail running, climbing, and biking community',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

- [ ] **Step 8: Write the failing test for the composed page**

```tsx
// app/page.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Home from './page'

describe('Home page', () => {
  it('renders the activity sections and the signup form', () => {
    render(<Home />)
    expect(screen.getByRole('heading', { name: 'Trail Running' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Climbing' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Biking' })).toBeInTheDocument()
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
})
```

- [ ] **Step 9: Run the test to verify it fails**

Run: `npx vitest run app/page.test.tsx`
Expected: FAIL — the placeholder page has no headings or form

- [ ] **Step 10: Replace `app/page.tsx` with the full composition**

```tsx
import { Hero } from '@/components/Hero'
import { ActivitySection } from '@/components/ActivitySection'
import { SignupForm } from '@/components/SignupForm'
import { Footer } from '@/components/Footer'
import { InstagramLink } from '@/components/InstagramLink'
import { activities } from '@/lib/activities'

export default function Home() {
  return (
    <>
      <header>
        <InstagramLink />
      </header>
      <main>
        <Hero />
        <section aria-label="Activities">
          {activities.map((activity) => (
            <ActivitySection key={activity.slug} activity={activity} />
          ))}
        </section>
        <section id="signup">
          <h2>Join the community</h2>
          <SignupForm />
        </section>
      </main>
      <Footer />
    </>
  )
}
```

- [ ] **Step 11: Run the test to verify it passes**

Run: `npx vitest run app/page.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 12: Run the full test suite**

Run: `npm test`
Expected: all tests across every file PASS

- [ ] **Step 13: Commit**

```bash
git add lib/site-config.ts .env.local.example components/InstagramLink.tsx components/Hero.tsx components/Footer.tsx app/globals.css app/layout.tsx app/page.tsx app/page.test.tsx
git commit -m "feat: compose landing page with hero, activities, signup, and Instagram link"
```

---

### Task 7: Containerize & Deployment Runbook

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`
- Create: `README.md`

**Interfaces:**
- Consumes: the full app from Tasks 1–6 (`npm run build` / `npm start`), and `DB_PATH` env var from `lib/db.ts` (Task 3).
- Produces: a runnable Docker image exposing port 3000, reading/writing the SQLite file at `/app/data/subscribers.db`.

- [ ] **Step 1: Create `Dockerfile`**

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache python3 make g++
ENV NODE_ENV=production
ENV DB_PATH=/app/data/subscribers.db
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build
RUN mkdir -p /app/data
VOLUME /app/data
EXPOSE 3000
CMD ["npm", "start"]
```

- [ ] **Step 2: Create `.dockerignore`**

```
node_modules
.next
data
.git
docs
```

- [ ] **Step 3: Build the image**

Run: `docker build -t elclub-web .`
Expected: build completes, ending with `naming to docker.io/library/elclub-web`.
(If Docker isn't available in this environment, skip to Step 8 and note in the commit message that container verification is still pending on a machine with Docker.)

- [ ] **Step 4: Run the container**

Run: `docker run --rm -d -p 3000:3000 --name elclub-test -v "$(pwd)/data-docker-test:/app/data" elclub-web`
Expected: prints a container ID

- [ ] **Step 5: Verify the page loads**

Run: `curl -s http://localhost:3000 | grep -o "El Club"`
Expected output: `El Club`

- [ ] **Step 6: Verify the signup API end-to-end, including the duplicate path**

Run:
```bash
curl -s -X POST http://localhost:3000/api/subscribe \
  -H "Content-Type: application/json" \
  -d '{"name":"Docker Test","email":"docker-test@example.com"}'
```
Expected output: `{"status":"ok"}`

Run the same command again.
Expected output: `{"status":"duplicate"}`

- [ ] **Step 7: Clean up**

Run: `docker stop elclub-test && rm -rf data-docker-test`

- [ ] **Step 8: Create `README.md`**

```markdown
# El Club

Marketing site for the mountain club, with a community signup form.

## Development

    npm install
    npm run dev

Visit http://localhost:3000.

## Testing

    npm test

## Configuration

Copy `.env.local.example` to `.env.local` and set `NEXT_PUBLIC_INSTAGRAM_URL`
to the club's real Instagram profile URL before deploying.

## Deployment (GCP e2-micro, Always Free tier)

The app ships as a Docker image. SQLite needs a persistent disk, so this
runs on a Compute Engine VM rather than serverless/ephemeral compute.

1. Create the VM (one-time):

       gcloud compute instances create elclub-vm \
         --zone=us-central1-a \
         --machine-type=e2-micro \
         --image-family=debian-12 \
         --image-project=debian-cloud \
         --boot-disk-size=30GB

2. Install Docker on the VM:

       gcloud compute ssh elclub-vm --zone=us-central1-a \
         --command="curl -fsSL https://get.docker.com | sudo sh"

3. Build the image locally and push it to a registry (building on the
   VM's 1GB of RAM directly can be slow or run out of memory):

       docker build -t gcr.io/<PROJECT_ID>/elclub-web .
       docker push gcr.io/<PROJECT_ID>/elclub-web

4. Pull and run it on the VM, with a persistent volume for the SQLite file:

       gcloud compute ssh elclub-vm --zone=us-central1-a --command="\
         sudo docker pull gcr.io/<PROJECT_ID>/elclub-web && \
         sudo docker run -d --restart unless-stopped -p 80:3000 \
           -v /var/lib/elclub/data:/app/data \
           -e NEXT_PUBLIC_INSTAGRAM_URL=https://instagram.com/<handle> \
           gcr.io/<PROJECT_ID>/elclub-web"

5. Open port 80 in the firewall:

       gcloud compute firewall-rules create allow-http --allow=tcp:80 --target-tags=http-server
       gcloud compute instances add-tags elclub-vm --tags=http-server --zone=us-central1-a

Replace `<PROJECT_ID>` with your GCP project ID and `<handle>` with the
club's real Instagram handle.
```

- [ ] **Step 9: Commit**

```bash
git add Dockerfile .dockerignore README.md
git commit -m "feat: containerize app and document GCP e2-micro deployment"
```
