# Encuestas (Member Surveys) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the club's admin build surveys (single-choice or free-text questions) through a password-protected panel, share a link per survey, and collect member responses (identified by an email that must already exist in `subscribers`), with resubmission overwriting the previous answer.

**Architecture:** Extends the existing single Next.js (App Router, TypeScript) app — no new services. New SQLite tables (`surveys`, `survey_questions`, `survey_question_options`, `survey_responses`) alongside the existing `subscribers` table, in the same `better-sqlite3` file. A password-gated `/admin/*` area (session via a signed HMAC cookie, no user accounts) for building/reviewing surveys, and a public `/encuestas/[slug]` page for members to respond.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript (strict), better-sqlite3, Node's built-in `node:crypto`, Vitest + Testing Library (already configured).

**Spec:** `docs/superpowers/specs/2026-09-09-encuestas-design.md`

## Global Constraints

- Run `npm install` first if `node_modules` isn't present — `npm test` requires it.
- Next.js 15 dynamic route handlers receive `params` as a `Promise` — every dynamic API route must `await params`, not destructure it directly.
- No new npm dependencies — password hashing/session signing uses Node's built-in `node:crypto` (`createHmac`, `timingSafeEqual`), matching the codebase's zero-extra-dependency style.
- `ADMIN_PASSWORD` (env var, no default) gates the admin panel — if unset, `checkPassword` must always return `false` (fail closed, never fail open).
- Lib modules stay framework-agnostic pure functions consuming a `better-sqlite3` `Database` instance (matching `lib/subscribers.ts`); route handlers stay thin — validate via the lib function, translate the result to a `NextResponse`. Route handler tests import the DB via `process.env.DB_PATH = ':memory:'` set in `beforeAll`, exactly like `app/api/subscribe/route.test.ts`.
- UI copy is in Spanish, matching the rest of the site; forms reuse the existing `.signup-form`, `.form-field`, `.form-error`, `.cta-button` CSS classes from `globals.css` rather than inventing new ones.
- Server Components that fetch data directly from `lib/` (the admin list/edit pages, the public survey page) are thin wiring with no independent logic of their own — the lib functions and interactive form components underneath them carry the test coverage instead of the pages themselves (there's no existing pattern in this repo for testing async Server Components, and inventing one here would be its own unreviewed risk).

---

### Task 1: Survey schema in the database

**Files:**
- Modify: `lib/db.ts`
- Test: `lib/db.test.ts` (new file)

**Interfaces:**
- Consumes: nothing new — reuses the existing `createDb(path)` / `getDb()` exports.
- Produces: four new tables (`surveys`, `survey_questions`, `survey_question_options`, `survey_responses`) that every later task's SQL depends on. Exact columns:
  - `surveys(id, slug UNIQUE, title, created_at)`
  - `survey_questions(id, survey_id, prompt, type CHECK IN ('single_choice','text'), required, position)`
  - `survey_question_options(id, question_id, label, position)`
  - `survey_responses(id, survey_id, email, answers_json, created_at, updated_at, UNIQUE(survey_id, email))`

- [ ] **Step 1: Write the failing test**

```ts
// lib/db.test.ts
import { describe, it, expect } from 'vitest'
import { createDb } from './db'

describe('createDb', () => {
  it('creates the subscribers and survey tables', () => {
    const db = createDb(':memory:')
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((row) => (row as { name: string }).name)
    expect(tables).toEqual([
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
Expected: FAIL — only `subscribers` exists yet.

- [ ] **Step 3: Add the new tables to `initSchema`**

In `lib/db.ts`, extend the `initSchema` function (keep the existing `subscribers` table exactly as-is, add a second `.exec(...)` call below it):

```ts
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

  database.exec(`
    CREATE TABLE IF NOT EXISTS surveys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS survey_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      survey_id INTEGER NOT NULL REFERENCES surveys(id),
      prompt TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('single_choice', 'text')),
      required INTEGER NOT NULL DEFAULT 1,
      position INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS survey_question_options (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_id INTEGER NOT NULL REFERENCES survey_questions(id),
      label TEXT NOT NULL,
      position INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS survey_responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      survey_id INTEGER NOT NULL REFERENCES surveys(id),
      email TEXT NOT NULL,
      answers_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (survey_id, email)
    )
  `)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/db.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/db.ts lib/db.test.ts
git commit -m "feat: add survey tables to the database schema"
```

---

### Task 2: Survey validation, creation, and reads

**Files:**
- Create: `lib/surveys.ts`
- Test: `lib/surveys.test.ts`

**Interfaces:**
- Consumes: `createDb` from `lib/db.ts` (Task 1) for test fixtures; `better-sqlite3`'s `Database` type.
- Produces (used by every later task that touches surveys):
  - `type QuestionType = 'single_choice' | 'text'`
  - `interface QuestionInput { prompt: string; type: QuestionType; options?: string[] }`
  - `interface SurveyInput { title: string; questions: QuestionInput[] }`
  - `type SurveyValidationError = { field: 'title' } | { field: 'questions' } | { field: 'question'; index: number; reason: 'prompt' | 'options' }`
  - `interface QuestionOption { id: number; label: string }`
  - `interface Question { id: number; prompt: string; type: QuestionType; required: boolean; options: QuestionOption[] }`
  - `interface Survey { id: number; slug: string; title: string; createdAt: string; questions: Question[] }`
  - `interface SurveySummary { id: number; slug: string; title: string; createdAt: string }`
  - `function validateSurveyInput(input: Partial<SurveyInput>): SurveyValidationError | null`
  - `type CreateSurveyResult = { status: 'ok'; id: number; slug: string } | { status: 'invalid'; error: SurveyValidationError }`
  - `function createSurvey(db: Database.Database, input: SurveyInput): CreateSurveyResult`
  - `function getSurveyBySlug(db: Database.Database, slug: string): Survey | null`
  - `function getSurveyById(db: Database.Database, id: number): Survey | null`
  - `function listSurveys(db: Database.Database): SurveySummary[]`

- [ ] **Step 1: Write the failing tests**

```ts
// lib/surveys.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import type Database from 'better-sqlite3'
import { createDb } from './db'
import { validateSurveyInput, createSurvey, getSurveyBySlug, getSurveyById, listSurveys } from './surveys'

const validInput = {
  title: 'Horario de otoño',
  questions: [
    { prompt: '¿Prefieres sábado o domingo?', type: 'single_choice' as const, options: ['Sábado', 'Domingo'] },
    { prompt: 'Comentarios', type: 'text' as const },
  ],
}

describe('validateSurveyInput', () => {
  it('accepts a valid survey', () => {
    expect(validateSurveyInput(validInput)).toBeNull()
  })

  it('rejects a missing title', () => {
    expect(validateSurveyInput({ ...validInput, title: '  ' })).toEqual({ field: 'title' })
  })

  it('rejects a survey with no questions', () => {
    expect(validateSurveyInput({ title: 'X', questions: [] })).toEqual({ field: 'questions' })
  })

  it('rejects a question with no prompt', () => {
    const input = { ...validInput, questions: [{ prompt: ' ', type: 'text' as const }] }
    expect(validateSurveyInput(input)).toEqual({ field: 'question', index: 0, reason: 'prompt' })
  })

  it('rejects a single_choice question with fewer than 2 options', () => {
    const input = { ...validInput, questions: [{ prompt: 'X', type: 'single_choice' as const, options: ['Solo una'] }] }
    expect(validateSurveyInput(input)).toEqual({ field: 'question', index: 0, reason: 'options' })
  })
})

describe('createSurvey / getSurveyBySlug / getSurveyById / listSurveys', () => {
  let db: Database.Database

  beforeEach(() => {
    db = createDb(':memory:')
  })

  it('creates a survey with a slug derived from the title', () => {
    const result = createSurvey(db, validInput)
    expect(result).toEqual({ status: 'ok', id: expect.any(Number), slug: 'horario-de-otono' })
  })

  it('disambiguates a slug collision', () => {
    createSurvey(db, validInput)
    const second = createSurvey(db, validInput)
    expect(second.status === 'ok' && second.slug).toBe('horario-de-otono-2')
  })

  it('returns an invalid result instead of writing anything', () => {
    const result = createSurvey(db, { title: '', questions: [] })
    expect(result).toEqual({ status: 'invalid', error: { field: 'title' } })
    expect(listSurveys(db)).toEqual([])
  })

  it('fetches a survey with its ordered questions and options by slug', () => {
    createSurvey(db, validInput)
    const survey = getSurveyBySlug(db, 'horario-de-otono')
    expect(survey?.title).toBe('Horario de otoño')
    expect(survey?.questions).toHaveLength(2)
    expect(survey?.questions[0]).toMatchObject({
      prompt: '¿Prefieres sábado o domingo?',
      type: 'single_choice',
      required: true,
    })
    expect(survey?.questions[0].options.map((o) => o.label)).toEqual(['Sábado', 'Domingo'])
    expect(survey?.questions[1]).toMatchObject({ prompt: 'Comentarios', type: 'text', options: [] })
  })

  it('returns null for an unknown slug', () => {
    expect(getSurveyBySlug(db, 'nope')).toBeNull()
  })

  it('fetches a survey by id', () => {
    const created = createSurvey(db, validInput)
    const survey = getSurveyById(db, (created as { id: number }).id)
    expect(survey?.title).toBe('Horario de otoño')
  })

  it('lists surveys newest first', () => {
    createSurvey(db, { title: 'Primera', questions: [{ prompt: 'X', type: 'text' as const }] })
    createSurvey(db, { title: 'Segunda', questions: [{ prompt: 'X', type: 'text' as const }] })
    const surveys = listSurveys(db)
    expect(surveys.map((s) => s.title)).toEqual(['Segunda', 'Primera'])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/surveys.test.ts`
Expected: FAIL — `lib/surveys.ts` doesn't exist yet.

- [ ] **Step 3: Implement `lib/surveys.ts`**

```ts
import type Database from 'better-sqlite3'

export type QuestionType = 'single_choice' | 'text'

export interface QuestionInput {
  prompt: string
  type: QuestionType
  options?: string[]
}

export interface SurveyInput {
  title: string
  questions: QuestionInput[]
}

export type SurveyValidationError =
  | { field: 'title' }
  | { field: 'questions' }
  | { field: 'question'; index: number; reason: 'prompt' | 'options' }

export interface QuestionOption {
  id: number
  label: string
}

export interface Question {
  id: number
  prompt: string
  type: QuestionType
  required: boolean
  options: QuestionOption[]
}

export interface Survey {
  id: number
  slug: string
  title: string
  createdAt: string
  questions: Question[]
}

export interface SurveySummary {
  id: number
  slug: string
  title: string
  createdAt: string
}

export function validateSurveyInput(input: Partial<SurveyInput>): SurveyValidationError | null {
  if (!input.title || !input.title.trim()) {
    return { field: 'title' }
  }
  if (!input.questions || input.questions.length === 0) {
    return { field: 'questions' }
  }
  for (let i = 0; i < input.questions.length; i++) {
    const question = input.questions[i]
    if (!question.prompt || !question.prompt.trim()) {
      return { field: 'question', index: i, reason: 'prompt' }
    }
    if (question.type === 'single_choice') {
      const options = (question.options ?? []).filter((o) => o.trim())
      if (options.length < 2) {
        return { field: 'question', index: i, reason: 'options' }
      }
    }
  }
  return null
}

function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'encuesta'
}

function uniqueSlug(db: Database.Database, base: string): string {
  const exists = db.prepare('SELECT 1 FROM surveys WHERE slug = ?')
  let slug = base
  let suffix = 2
  while (exists.get(slug)) {
    slug = `${base}-${suffix}`
    suffix += 1
  }
  return slug
}

export type CreateSurveyResult =
  | { status: 'ok'; id: number; slug: string }
  | { status: 'invalid'; error: SurveyValidationError }

export function createSurvey(db: Database.Database, input: SurveyInput): CreateSurveyResult {
  const error = validateSurveyInput(input)
  if (error) {
    return { status: 'invalid', error }
  }

  const slug = uniqueSlug(db, slugify(input.title))
  const insertSurvey = db.prepare('INSERT INTO surveys (slug, title) VALUES (?, ?)')
  const insertQuestion = db.prepare(
    'INSERT INTO survey_questions (survey_id, prompt, type, required, position) VALUES (?, ?, ?, 1, ?)'
  )
  const insertOption = db.prepare(
    'INSERT INTO survey_question_options (question_id, label, position) VALUES (?, ?, ?)'
  )

  const id = db.transaction(() => {
    const surveyId = Number(insertSurvey.run(slug, input.title.trim()).lastInsertRowid)
    input.questions.forEach((question, index) => {
      const questionId = Number(
        insertQuestion.run(surveyId, question.prompt.trim(), question.type, index).lastInsertRowid
      )
      if (question.type === 'single_choice') {
        ;(question.options ?? [])
          .filter((o) => o.trim())
          .forEach((label, optionIndex) => insertOption.run(questionId, label.trim(), optionIndex))
      }
    })
    return surveyId
  })()

  return { status: 'ok', id, slug }
}

function loadQuestions(db: Database.Database, surveyId: number): Question[] {
  const questionRows = db
    .prepare('SELECT id, prompt, type, required FROM survey_questions WHERE survey_id = ? ORDER BY position')
    .all(surveyId) as Array<{ id: number; prompt: string; type: QuestionType; required: number }>

  const optionStatement = db.prepare(
    'SELECT id, label FROM survey_question_options WHERE question_id = ? ORDER BY position'
  )

  return questionRows.map((row) => ({
    id: row.id,
    prompt: row.prompt,
    type: row.type,
    required: row.required === 1,
    options: optionStatement.all(row.id) as QuestionOption[],
  }))
}

function loadSurveyRow(db: Database.Database, where: string, value: string | number) {
  return db.prepare(`SELECT id, slug, title, created_at FROM surveys WHERE ${where} = ?`).get(value) as
    | { id: number; slug: string; title: string; created_at: string }
    | undefined
}

export function getSurveyBySlug(db: Database.Database, slug: string): Survey | null {
  const row = loadSurveyRow(db, 'slug', slug)
  if (!row) return null
  return { id: row.id, slug: row.slug, title: row.title, createdAt: row.created_at, questions: loadQuestions(db, row.id) }
}

export function getSurveyById(db: Database.Database, id: number): Survey | null {
  const row = loadSurveyRow(db, 'id', id)
  if (!row) return null
  return { id: row.id, slug: row.slug, title: row.title, createdAt: row.created_at, questions: loadQuestions(db, row.id) }
}

export function listSurveys(db: Database.Database): SurveySummary[] {
  const rows = db.prepare('SELECT id, slug, title, created_at FROM surveys ORDER BY created_at DESC, id DESC').all() as Array<{
    id: number
    slug: string
    title: string
    created_at: string
  }>
  return rows.map((row) => ({ id: row.id, slug: row.slug, title: row.title, createdAt: row.created_at }))
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/surveys.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/surveys.ts lib/surveys.test.ts
git commit -m "feat: add survey validation, creation, and read helpers"
```

---

### Task 3: Survey updates and deletion

**Files:**
- Modify: `lib/surveys.ts`
- Modify: `lib/surveys.test.ts`

**Interfaces:**
- Consumes: everything from Task 2 (`SurveyInput`, `validateSurveyInput`, table schema from Task 1).
- Produces:
  - `type UpdateSurveyResult = { status: 'ok' } | { status: 'invalid'; error: SurveyValidationError } | { status: 'not_found' }`
  - `function updateSurvey(db: Database.Database, id: number, input: SurveyInput): UpdateSurveyResult`
  - `function deleteSurvey(db: Database.Database, id: number): void`

- [ ] **Step 1: Write the failing tests**

Append to `lib/surveys.test.ts`:

```ts
import { updateSurvey, deleteSurvey } from './surveys'

describe('updateSurvey / deleteSurvey', () => {
  let db: Database.Database

  beforeEach(() => {
    db = createDb(':memory:')
  })

  it('replaces the title and questions', () => {
    const created = createSurvey(db, validInput)
    const id = (created as { id: number }).id

    const result = updateSurvey(db, id, {
      title: 'Horario actualizado',
      questions: [{ prompt: '¿Vienes?', type: 'text' }],
    })

    expect(result).toEqual({ status: 'ok' })
    const survey = getSurveyById(db, id)
    expect(survey?.title).toBe('Horario actualizado')
    expect(survey?.questions).toHaveLength(1)
    expect(survey?.questions[0].prompt).toBe('¿Vienes?')
  })

  it('returns not_found for an unknown id', () => {
    const result = updateSurvey(db, 999, validInput)
    expect(result).toEqual({ status: 'not_found' })
  })

  it('returns invalid without writing when the input fails validation', () => {
    const created = createSurvey(db, validInput)
    const id = (created as { id: number }).id
    const result = updateSurvey(db, id, { title: '', questions: [] })
    expect(result).toEqual({ status: 'invalid', error: { field: 'title' } })
    expect(getSurveyById(db, id)?.title).toBe('Horario de otoño')
  })

  it('deletes a survey and its questions, options, and responses', () => {
    const created = createSurvey(db, validInput)
    const id = (created as { id: number }).id
    deleteSurvey(db, id)
    expect(getSurveyById(db, id)).toBeNull()
    expect(db.prepare('SELECT COUNT(*) as n FROM survey_questions WHERE survey_id = ?').get(id)).toEqual({ n: 0 })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/surveys.test.ts`
Expected: FAIL — `updateSurvey`/`deleteSurvey` not defined.

- [ ] **Step 3: Implement `updateSurvey` and `deleteSurvey`**

Append to `lib/surveys.ts`:

```ts
export type UpdateSurveyResult =
  | { status: 'ok' }
  | { status: 'invalid'; error: SurveyValidationError }
  | { status: 'not_found' }

export function updateSurvey(db: Database.Database, id: number, input: SurveyInput): UpdateSurveyResult {
  const existing = db.prepare('SELECT id FROM surveys WHERE id = ?').get(id)
  if (!existing) {
    return { status: 'not_found' }
  }

  const error = validateSurveyInput(input)
  if (error) {
    return { status: 'invalid', error }
  }

  const deleteOptions = db.prepare(
    'DELETE FROM survey_question_options WHERE question_id IN (SELECT id FROM survey_questions WHERE survey_id = ?)'
  )
  const deleteQuestions = db.prepare('DELETE FROM survey_questions WHERE survey_id = ?')
  const updateTitle = db.prepare('UPDATE surveys SET title = ? WHERE id = ?')
  const insertQuestion = db.prepare(
    'INSERT INTO survey_questions (survey_id, prompt, type, required, position) VALUES (?, ?, ?, 1, ?)'
  )
  const insertOption = db.prepare(
    'INSERT INTO survey_question_options (question_id, label, position) VALUES (?, ?, ?)'
  )

  db.transaction(() => {
    deleteOptions.run(id)
    deleteQuestions.run(id)
    updateTitle.run(input.title.trim(), id)
    input.questions.forEach((question, index) => {
      const questionId = Number(
        insertQuestion.run(id, question.prompt.trim(), question.type, index).lastInsertRowid
      )
      if (question.type === 'single_choice') {
        ;(question.options ?? [])
          .filter((o) => o.trim())
          .forEach((label, optionIndex) => insertOption.run(questionId, label.trim(), optionIndex))
      }
    })
  })()

  return { status: 'ok' }
}

export function deleteSurvey(db: Database.Database, id: number): void {
  db.transaction(() => {
    db.prepare(
      'DELETE FROM survey_question_options WHERE question_id IN (SELECT id FROM survey_questions WHERE survey_id = ?)'
    ).run(id)
    db.prepare('DELETE FROM survey_responses WHERE survey_id = ?').run(id)
    db.prepare('DELETE FROM survey_questions WHERE survey_id = ?').run(id)
    db.prepare('DELETE FROM surveys WHERE id = ?').run(id)
  })()
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/surveys.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/surveys.ts lib/surveys.test.ts
git commit -m "feat: add survey update and delete"
```

---

### Task 4: Member-email check

**Files:**
- Modify: `lib/subscribers.ts`
- Modify: `lib/subscribers.test.ts`

**Interfaces:**
- Produces: `function isSubscribedEmail(db: Database.Database, email: string): boolean` — used by Task 5 to enforce that only known members can submit a survey response.

- [ ] **Step 1: Write the failing test**

Append to `lib/subscribers.test.ts`:

```ts
import { isSubscribedEmail } from './subscribers'

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/subscribers.test.ts`
Expected: FAIL — `isSubscribedEmail` not defined.

- [ ] **Step 3: Implement it**

Append to `lib/subscribers.ts`:

```ts
export function isSubscribedEmail(db: Database.Database, email: string): boolean {
  const row = db.prepare('SELECT 1 FROM subscribers WHERE email = ?').get(email.trim())
  return !!row
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/subscribers.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/subscribers.ts lib/subscribers.test.ts
git commit -m "feat: add subscriber email membership check"
```

---

### Task 5: Response validation and submission

**Files:**
- Create: `lib/survey-responses.ts`
- Test: `lib/survey-responses.test.ts`

**Interfaces:**
- Consumes: `Survey`, `Question` types and `createSurvey`/`getSurveyBySlug` from `lib/surveys.ts` (Task 2/3); `isSubscribedEmail` from `lib/subscribers.ts` (Task 4).
- Produces:
  - `interface ResponseInput { email: string; answers: Record<string, string> }`
  - `type ResponseValidationError = { field: 'email'; reason: 'invalid' | 'not_member' } | { field: 'question'; questionId: number }`
  - `type SubmitResponseResult = { status: 'ok' } | { status: 'invalid'; error: ResponseValidationError }`
  - `function validateResponseInput(survey: Survey, input: Partial<ResponseInput>): ResponseValidationError | null`
  - `function submitResponse(db: Database.Database, survey: Survey, input: ResponseInput): SubmitResponseResult`

- [ ] **Step 1: Write the failing tests**

```ts
// lib/survey-responses.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import type Database from 'better-sqlite3'
import { createDb } from './db'
import { addSubscriber } from './subscribers'
import { createSurvey, getSurveyBySlug, type Survey } from './surveys'
import { validateResponseInput, submitResponse } from './survey-responses'

describe('validateResponseInput / submitResponse', () => {
  let db: Database.Database
  let survey: Survey

  beforeEach(() => {
    db = createDb(':memory:')
    addSubscriber(db, { name: 'Ana', email: 'ana@example.com' })
    createSurvey(db, {
      title: 'Horario',
      questions: [
        { prompt: '¿Sábado o domingo?', type: 'single_choice', options: ['Sábado', 'Domingo'] },
        { prompt: 'Comentarios', type: 'text' },
      ],
    })
    survey = getSurveyBySlug(db, 'horario')!
  })

  it('rejects a malformed email', () => {
    const questionId = survey.questions[0].id
    const error = validateResponseInput(survey, { email: 'not-an-email', answers: { [questionId]: 'Sábado' } })
    expect(error).toEqual({ field: 'email', reason: 'invalid' })
  })

  it('rejects a missing answer to a required question', () => {
    const error = validateResponseInput(survey, { email: 'ana@example.com', answers: {} })
    expect(error).toEqual({ field: 'question', questionId: survey.questions[0].id })
  })

  it('accepts a fully answered valid input', () => {
    const [q1, q2] = survey.questions
    const error = validateResponseInput(survey, {
      email: 'ana@example.com',
      answers: { [q1.id]: 'Sábado', [q2.id]: 'Todo bien' },
    })
    expect(error).toBeNull()
  })

  it('rejects an email that is not a known subscriber', () => {
    const [q1, q2] = survey.questions
    const result = submitResponse(db, survey, {
      email: 'stranger@example.com',
      answers: { [q1.id]: 'Sábado', [q2.id]: 'Hola' },
    })
    expect(result).toEqual({ status: 'invalid', error: { field: 'email', reason: 'not_member' } })
  })

  it('stores a response for a known subscriber', () => {
    const [q1, q2] = survey.questions
    const result = submitResponse(db, survey, {
      email: 'ana@example.com',
      answers: { [q1.id]: 'Sábado', [q2.id]: 'Hola' },
    })
    expect(result).toEqual({ status: 'ok' })
    const row = db.prepare('SELECT answers_json FROM survey_responses WHERE email = ?').get('ana@example.com') as {
      answers_json: string
    }
    expect(JSON.parse(row.answers_json)).toEqual({ [q1.id]: 'Sábado', [q2.id]: 'Hola' })
  })

  it('overwrites a previous response from the same email', () => {
    const [q1, q2] = survey.questions
    submitResponse(db, survey, { email: 'ana@example.com', answers: { [q1.id]: 'Sábado', [q2.id]: 'Primero' } })
    submitResponse(db, survey, { email: 'ana@example.com', answers: { [q1.id]: 'Domingo', [q2.id]: 'Segundo' } })

    const rows = db.prepare('SELECT answers_json FROM survey_responses WHERE email = ?').all('ana@example.com')
    expect(rows).toHaveLength(1)
    const answers = JSON.parse((rows[0] as { answers_json: string }).answers_json)
    expect(answers[q1.id]).toBe('Domingo')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/survey-responses.test.ts`
Expected: FAIL — `lib/survey-responses.ts` doesn't exist yet.

- [ ] **Step 3: Implement `lib/survey-responses.ts`**

```ts
import type Database from 'better-sqlite3'
import { isSubscribedEmail } from './subscribers'
import type { Survey } from './surveys'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export interface ResponseInput {
  email: string
  answers: Record<string, string>
}

export type ResponseValidationError =
  | { field: 'email'; reason: 'invalid' | 'not_member' }
  | { field: 'question'; questionId: number }

export type SubmitResponseResult = { status: 'ok' } | { status: 'invalid'; error: ResponseValidationError }

export function validateResponseInput(
  survey: Survey,
  input: Partial<ResponseInput>
): ResponseValidationError | null {
  if (!input.email || !EMAIL_PATTERN.test(input.email)) {
    return { field: 'email', reason: 'invalid' }
  }
  const answers = input.answers ?? {}
  for (const question of survey.questions) {
    if (!question.required) continue
    const answer = answers[String(question.id)]
    if (!answer || !answer.trim()) {
      return { field: 'question', questionId: question.id }
    }
  }
  return null
}

export function submitResponse(db: Database.Database, survey: Survey, input: ResponseInput): SubmitResponseResult {
  const formatError = validateResponseInput(survey, input)
  if (formatError) {
    return { status: 'invalid', error: formatError }
  }

  const email = input.email.trim()
  if (!isSubscribedEmail(db, email)) {
    return { status: 'invalid', error: { field: 'email', reason: 'not_member' } }
  }

  db.prepare(
    `INSERT INTO survey_responses (survey_id, email, answers_json)
     VALUES (?, ?, ?)
     ON CONFLICT(survey_id, email)
     DO UPDATE SET answers_json = excluded.answers_json, updated_at = datetime('now')`
  ).run(survey.id, email, JSON.stringify(input.answers))

  return { status: 'ok' }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/survey-responses.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/survey-responses.ts lib/survey-responses.test.ts
git commit -m "feat: add survey response validation and upsert"
```

---

### Task 6: Response reads and tallying

**Files:**
- Modify: `lib/survey-responses.ts`
- Modify: `lib/survey-responses.test.ts`

**Interfaces:**
- Consumes: everything from Task 5, plus `Survey`/`Question` from `lib/surveys.ts`.
- Produces:
  - `interface ResponseRow { email: string; answers: Record<string, string>; updatedAt: string }`
  - `function getResponses(db: Database.Database, surveyId: number): ResponseRow[]`
  - `interface QuestionTally { questionId: number; prompt: string; type: QuestionType; optionCounts?: { label: string; count: number }[]; textAnswers?: { email: string; answer: string }[] }`
  - `function tallyResponses(survey: Survey, responses: ResponseRow[]): QuestionTally[]`

- [ ] **Step 1: Write the failing tests**

Append to `lib/survey-responses.test.ts`:

```ts
import { getResponses, tallyResponses } from './survey-responses'

describe('getResponses / tallyResponses', () => {
  let db: Database.Database
  let survey: Survey

  beforeEach(() => {
    db = createDb(':memory:')
    addSubscriber(db, { name: 'Ana', email: 'ana@example.com' })
    addSubscriber(db, { name: 'Bea', email: 'bea@example.com' })
    createSurvey(db, {
      title: 'Horario',
      questions: [
        { prompt: '¿Sábado o domingo?', type: 'single_choice', options: ['Sábado', 'Domingo'] },
        { prompt: 'Comentarios', type: 'text' },
      ],
    })
    survey = getSurveyBySlug(db, 'horario')!
    const [q1, q2] = survey.questions
    submitResponse(db, survey, { email: 'ana@example.com', answers: { [q1.id]: 'Sábado', [q2.id]: 'Genial' } })
    submitResponse(db, survey, { email: 'bea@example.com', answers: { [q1.id]: 'Sábado', [q2.id]: 'Perfecto' } })
  })

  it('lists all responses for a survey', () => {
    const responses = getResponses(db, survey.id)
    expect(responses).toHaveLength(2)
    expect(responses.map((r) => r.email).sort()).toEqual(['ana@example.com', 'bea@example.com'])
  })

  it('tallies single_choice answers and lists text answers', () => {
    const responses = getResponses(db, survey.id)
    const tallies = tallyResponses(survey, responses)

    const choiceTally = tallies[0]
    expect(choiceTally.optionCounts).toEqual([
      { label: 'Sábado', count: 2 },
      { label: 'Domingo', count: 0 },
    ])

    const textTally = tallies[1]
    expect(textTally.textAnswers).toHaveLength(2)
    expect(textTally.textAnswers?.map((a) => a.answer).sort()).toEqual(['Genial', 'Perfecto'])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/survey-responses.test.ts`
Expected: FAIL — `getResponses`/`tallyResponses` not defined.

- [ ] **Step 3: Implement them**

Append to `lib/survey-responses.ts` (add `QuestionType` to the existing `import type { Survey } from './surveys'` line):

```ts
import type { QuestionType, Survey } from './surveys'

export interface ResponseRow {
  email: string
  answers: Record<string, string>
  updatedAt: string
}

export function getResponses(db: Database.Database, surveyId: number): ResponseRow[] {
  const rows = db
    .prepare('SELECT email, answers_json, updated_at FROM survey_responses WHERE survey_id = ? ORDER BY updated_at DESC')
    .all(surveyId) as Array<{ email: string; answers_json: string; updated_at: string }>
  return rows.map((row) => ({ email: row.email, answers: JSON.parse(row.answers_json), updatedAt: row.updated_at }))
}

export interface QuestionTally {
  questionId: number
  prompt: string
  type: QuestionType
  optionCounts?: { label: string; count: number }[]
  textAnswers?: { email: string; answer: string }[]
}

export function tallyResponses(survey: Survey, responses: ResponseRow[]): QuestionTally[] {
  return survey.questions.map((question) => {
    if (question.type === 'single_choice') {
      const optionCounts = question.options.map((option) => ({
        label: option.label,
        count: responses.filter((r) => r.answers[String(question.id)] === option.label).length,
      }))
      return { questionId: question.id, prompt: question.prompt, type: question.type, optionCounts }
    }
    const textAnswers = responses
      .filter((r) => r.answers[String(question.id)])
      .map((r) => ({ email: r.email, answer: r.answers[String(question.id)] }))
    return { questionId: question.id, prompt: question.prompt, type: question.type, textAnswers }
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/survey-responses.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/survey-responses.ts lib/survey-responses.test.ts
git commit -m "feat: add response listing and tallying"
```

---

### Task 7: Admin password and session

**Files:**
- Create: `lib/admin-auth.ts`
- Test: `lib/admin-auth.test.ts`

**Interfaces:**
- Consumes: `process.env.ADMIN_PASSWORD`.
- Produces (used by Task 8 middleware and every admin API route task):
  - `const ADMIN_SESSION_COOKIE = 'admin_session'`
  - `function checkPassword(input: string): boolean`
  - `function createSessionCookieValue(): string`
  - `function isValidSessionCookie(value: string | undefined | null): boolean`
  - `function hasValidSession(request: Request): boolean`

- [ ] **Step 1: Write the failing tests**

```ts
// lib/admin-auth.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import {
  checkPassword,
  createSessionCookieValue,
  isValidSessionCookie,
  hasValidSession,
  ADMIN_SESSION_COOKIE,
} from './admin-auth'

describe('admin-auth', () => {
  beforeEach(() => {
    process.env.ADMIN_PASSWORD = 'club-secret'
  })

  it('accepts the correct password', () => {
    expect(checkPassword('club-secret')).toBe(true)
  })

  it('rejects an incorrect password', () => {
    expect(checkPassword('wrong')).toBe(false)
  })

  it('rejects any password when ADMIN_PASSWORD is unset', () => {
    delete process.env.ADMIN_PASSWORD
    expect(checkPassword('')).toBe(false)
    expect(checkPassword('anything')).toBe(false)
  })

  it('validates a cookie value created for the current password', () => {
    const value = createSessionCookieValue()
    expect(isValidSessionCookie(value)).toBe(true)
  })

  it('rejects a garbage cookie value', () => {
    expect(isValidSessionCookie('not-a-real-token')).toBe(false)
  })

  it('rejects a missing cookie value', () => {
    expect(isValidSessionCookie(undefined)).toBe(false)
  })

  it('reads a valid session out of a request cookie header', () => {
    const value = createSessionCookieValue()
    const request = new Request('http://localhost/admin/surveys', {
      headers: { cookie: `${ADMIN_SESSION_COOKIE}=${value}` },
    })
    expect(hasValidSession(request)).toBe(true)
  })

  it('rejects a request with no cookie header', () => {
    const request = new Request('http://localhost/admin/surveys')
    expect(hasValidSession(request)).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/admin-auth.test.ts`
Expected: FAIL — `lib/admin-auth.ts` doesn't exist yet.

- [ ] **Step 3: Implement `lib/admin-auth.ts`**

```ts
import { createHmac, timingSafeEqual } from 'node:crypto'

export const ADMIN_SESSION_COOKIE = 'admin_session'

function adminPassword(): string {
  return process.env.ADMIN_PASSWORD || ''
}

export function checkPassword(input: string): boolean {
  const expected = adminPassword()
  return expected.length > 0 && input === expected
}

export function createSessionCookieValue(): string {
  return createHmac('sha256', adminPassword()).update('elclub-admin-session').digest('hex')
}

export function isValidSessionCookie(value: string | undefined | null): boolean {
  if (!value) return false
  const expected = createSessionCookieValue()
  const a = Buffer.from(value)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function hasValidSession(request: Request): boolean {
  const header = request.headers.get('cookie')
  if (!header) return false
  const cookie = header
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ADMIN_SESSION_COOKIE}=`))
  if (!cookie) return false
  return isValidSessionCookie(cookie.slice(ADMIN_SESSION_COOKIE.length + 1))
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/admin-auth.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/admin-auth.ts lib/admin-auth.test.ts
git commit -m "feat: add admin password check and session cookie"
```

---

### Task 8: Route protection middleware

**Files:**
- Create: `middleware.ts` (repo root, alongside `package.json`)
- Test: `middleware.test.ts` (repo root)

**Interfaces:**
- Consumes: `hasValidSession`, `createSessionCookieValue`, `ADMIN_SESSION_COOKIE` from `lib/admin-auth.ts` (Task 7).
- Produces: `middleware(request: NextRequest)` and `config.matcher`, wired by Next.js itself — no other task imports from this file.

- [ ] **Step 1: Write the failing tests**

```ts
// middleware.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { middleware } from './middleware'
import { createSessionCookieValue, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth'

describe('middleware', () => {
  beforeEach(() => {
    process.env.ADMIN_PASSWORD = 'club-secret'
  })

  it('lets the login page through unauthenticated', () => {
    const response = middleware(new NextRequest('http://localhost/admin/login'))
    expect(response.status).toBe(200)
  })

  it('redirects an unauthenticated admin page request to login', () => {
    const response = middleware(new NextRequest('http://localhost/admin/surveys'))
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost/admin/login')
  })

  it('returns 401 json for an unauthenticated admin api request', async () => {
    const response = middleware(new NextRequest('http://localhost/api/admin/surveys'))
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ status: 'unauthorized' })
  })

  it('lets an authenticated request through', () => {
    const request = new NextRequest('http://localhost/admin/surveys', {
      headers: { cookie: `${ADMIN_SESSION_COOKIE}=${createSessionCookieValue()}` },
    })
    expect(middleware(request).status).toBe(200)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run middleware.test.ts`
Expected: FAIL — `middleware.ts` doesn't exist yet.

- [ ] **Step 3: Implement `middleware.ts`**

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { hasValidSession } from '@/lib/admin-auth'

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
}

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === '/admin/login') {
    return NextResponse.next()
  }

  if (hasValidSession(request)) {
    return NextResponse.next()
  }

  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ status: 'unauthorized' }, { status: 401 })
  }

  return NextResponse.redirect(new URL('/admin/login', request.url))
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run middleware.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add middleware.ts middleware.test.ts
git commit -m "feat: protect admin routes with a session-checking middleware"
```

---

### Task 9: Admin login API route

**Files:**
- Create: `app/api/admin/login/route.ts`
- Test: `app/api/admin/login/route.test.ts`

**Interfaces:**
- Consumes: `checkPassword`, `createSessionCookieValue`, `ADMIN_SESSION_COOKIE` from `lib/admin-auth.ts` (Task 7).
- Produces: `POST(request: Request): Promise<Response>` — sets the `admin_session` cookie on success.

- [ ] **Step 1: Write the failing tests**

```ts
// app/api/admin/login/route.test.ts
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'

let POST: typeof import('./route').POST

beforeAll(async () => {
  ;({ POST } = await import('./route'))
})

beforeEach(() => {
  process.env.ADMIN_PASSWORD = 'club-secret'
})

function jsonRequest(body: unknown) {
  return new Request('http://localhost/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/login', () => {
  it('accepts the correct password and sets a session cookie', async () => {
    const response = await POST(jsonRequest({ password: 'club-secret' }))
    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie')).toContain('admin_session=')
  })

  it('rejects an incorrect password', async () => {
    const response = await POST(jsonRequest({ password: 'wrong' }))
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ status: 'invalid' })
  })

  it('rejects a malformed body', async () => {
    const response = await POST(new Request('http://localhost/api/admin/login', { method: 'POST', body: 'not json' }))
    expect(response.status).toBe(401)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run app/api/admin/login/route.test.ts`
Expected: FAIL — route doesn't exist yet.

- [ ] **Step 3: Implement the route**

```ts
// app/api/admin/login/route.ts
import { NextResponse } from 'next/server'
import { checkPassword, createSessionCookieValue, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)

  if (!body || typeof body !== 'object' || typeof body.password !== 'string' || !checkPassword(body.password)) {
    return NextResponse.json({ status: 'invalid' }, { status: 401 })
  }

  const response = NextResponse.json({ status: 'ok' })
  response.cookies.set(ADMIN_SESSION_COOKIE, createSessionCookieValue(), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  })
  return response
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run app/api/admin/login/route.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/login/route.ts app/api/admin/login/route.test.ts
git commit -m "feat: add admin login API route"
```

---

### Task 10: Admin surveys list/create API route

**Files:**
- Create: `app/api/admin/surveys/route.ts`
- Test: `app/api/admin/surveys/route.test.ts`

**Interfaces:**
- Consumes: `getDb` (`lib/db.ts`), `hasValidSession`/`createSessionCookieValue`/`ADMIN_SESSION_COOKIE` (`lib/admin-auth.ts`), `listSurveys`/`createSurvey` (`lib/surveys.ts`).
- Produces: `GET(request: Request)`, `POST(request: Request)`.

- [ ] **Step 1: Write the failing tests**

```ts
// app/api/admin/surveys/route.test.ts
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

describe('GET/POST /api/admin/surveys', () => {
  it('rejects an unauthenticated request', async () => {
    const response = await GET(new Request('http://localhost/api/admin/surveys'))
    expect(response.status).toBe(401)
  })

  it('creates a survey and lists it', async () => {
    const createResponse = await POST(
      authedRequest('http://localhost/api/admin/surveys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Horario de otoño',
          questions: [{ prompt: '¿Vienes?', type: 'text' }],
        }),
      })
    )
    expect(createResponse.status).toBe(200)
    expect(await createResponse.json()).toMatchObject({ status: 'ok', slug: 'horario-de-otono' })

    const listResponse = await GET(authedRequest('http://localhost/api/admin/surveys'))
    const { surveys } = await listResponse.json()
    expect(surveys).toHaveLength(1)
    expect(surveys[0].title).toBe('Horario de otoño')
  })

  it('rejects an invalid survey', async () => {
    const response = await POST(
      authedRequest('http://localhost/api/admin/surveys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '', questions: [] }),
      })
    )
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ status: 'invalid', error: { field: 'title' } })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run app/api/admin/surveys/route.test.ts`
Expected: FAIL — route doesn't exist yet.

- [ ] **Step 3: Implement the route**

```ts
// app/api/admin/surveys/route.ts
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { hasValidSession } from '@/lib/admin-auth'
import { createSurvey, listSurveys } from '@/lib/surveys'

export async function GET(request: Request) {
  if (!hasValidSession(request)) {
    return NextResponse.json({ status: 'unauthorized' }, { status: 401 })
  }
  return NextResponse.json({ surveys: listSurveys(getDb()) })
}

export async function POST(request: Request) {
  if (!hasValidSession(request)) {
    return NextResponse.json({ status: 'unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ status: 'invalid', error: { field: 'title' } }, { status: 400 })
  }

  const result = createSurvey(getDb(), body)
  if (result.status === 'invalid') {
    return NextResponse.json(result, { status: 400 })
  }
  return NextResponse.json(result, { status: 200 })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run app/api/admin/surveys/route.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/surveys/route.ts app/api/admin/surveys/route.test.ts
git commit -m "feat: add admin surveys list/create API route"
```

---

### Task 11: Admin survey detail API route

**Files:**
- Create: `app/api/admin/surveys/[id]/route.ts`
- Test: `app/api/admin/surveys/[id]/route.test.ts`

**Interfaces:**
- Consumes: `getDb`, `hasValidSession`/`createSessionCookieValue`/`ADMIN_SESSION_COOKIE`, `getSurveyById`/`updateSurvey`/`deleteSurvey`, `createSurvey` (for test setup).
- Produces: `GET`, `PATCH`, `DELETE`, each `(request: Request, { params }: { params: Promise<{ id: string }> })`.

- [ ] **Step 1: Write the failing tests**

```ts
// app/api/admin/surveys/[id]/route.test.ts
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { createDb } from '@/lib/db'
import { createSurvey } from '@/lib/surveys'

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

function createTestSurvey() {
  const result = createSurvey(getDb(), { title: 'Horario', questions: [{ prompt: '¿Vienes?', type: 'text' }] })
  return (result as { id: number }).id
}

describe('GET/PATCH/DELETE /api/admin/surveys/[id]', () => {
  it('rejects an unauthenticated request', async () => {
    const id = createTestSurvey()
    const response = await GET(new Request(`http://localhost/api/admin/surveys/${id}`), {
      params: Promise.resolve({ id: String(id) }),
    })
    expect(response.status).toBe(401)
  })

  it('fetches a survey by id', async () => {
    const id = createTestSurvey()
    const response = await GET(authedRequest(`http://localhost/api/admin/surveys/${id}`), {
      params: Promise.resolve({ id: String(id) }),
    })
    expect(response.status).toBe(200)
    const { survey } = await response.json()
    expect(survey.title).toBe('Horario')
  })

  it('returns 404 for an unknown id', async () => {
    const response = await GET(authedRequest('http://localhost/api/admin/surveys/999999'), {
      params: Promise.resolve({ id: '999999' }),
    })
    expect(response.status).toBe(404)
  })

  it('updates a survey', async () => {
    const id = createTestSurvey()
    const response = await PATCH(
      authedRequest(`http://localhost/api/admin/surveys/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Horario nuevo', questions: [{ prompt: '¿Vienes?', type: 'text' }] }),
      }),
      { params: Promise.resolve({ id: String(id) }) }
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok' })
  })

  it('deletes a survey', async () => {
    const id = createTestSurvey()
    const response = await DELETE(authedRequest(`http://localhost/api/admin/surveys/${id}`, { method: 'DELETE' }), {
      params: Promise.resolve({ id: String(id) }),
    })
    expect(response.status).toBe(200)
    const getResponse = await GET(authedRequest(`http://localhost/api/admin/surveys/${id}`), {
      params: Promise.resolve({ id: String(id) }),
    })
    expect(getResponse.status).toBe(404)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run "app/api/admin/surveys/[id]/route.test.ts"`
Expected: FAIL — route doesn't exist yet.

- [ ] **Step 3: Implement the route**

```ts
// app/api/admin/surveys/[id]/route.ts
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { hasValidSession } from '@/lib/admin-auth'
import { getSurveyById, updateSurvey, deleteSurvey } from '@/lib/surveys'

type Params = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: Params) {
  if (!hasValidSession(request)) {
    return NextResponse.json({ status: 'unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const survey = getSurveyById(getDb(), Number(id))
  if (!survey) {
    return NextResponse.json({ status: 'not_found' }, { status: 404 })
  }
  return NextResponse.json({ survey })
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
  const result = updateSurvey(getDb(), Number(id), body)
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
  deleteSurvey(getDb(), Number(id))
  return NextResponse.json({ status: 'ok' })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run "app/api/admin/surveys/[id]/route.test.ts"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "app/api/admin/surveys/[id]/route.ts" "app/api/admin/surveys/[id]/route.test.ts"
git commit -m "feat: add admin survey detail API route"
```

---

### Task 12: Admin survey responses API route

**Files:**
- Create: `app/api/admin/surveys/[id]/responses/route.ts`
- Test: `app/api/admin/surveys/[id]/responses/route.test.ts`

**Interfaces:**
- Consumes: `getDb`, `hasValidSession`/`createSessionCookieValue`/`ADMIN_SESSION_COOKIE`, `getSurveyById`, `createSurvey` (test setup), `getResponses`/`tallyResponses`, `submitResponse`/`addSubscriber` (test setup).
- Produces: `GET(request: Request, { params }: { params: Promise<{ id: string }> })`.

- [ ] **Step 1: Write the failing tests**

```ts
// app/api/admin/surveys/[id]/responses/route.test.ts
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { addSubscriber } from '@/lib/subscribers'
import { createSurvey, getSurveyById } from '@/lib/surveys'
import { submitResponse } from '@/lib/survey-responses'

let GET: typeof import('./route').GET
let createSessionCookieValue: typeof import('@/lib/admin-auth').createSessionCookieValue
let ADMIN_SESSION_COOKIE: typeof import('@/lib/admin-auth').ADMIN_SESSION_COOKIE
let getDb: typeof import('@/lib/db').getDb

beforeAll(async () => {
  process.env.DB_PATH = ':memory:'
  ;({ GET } = await import('./route'))
  ;({ createSessionCookieValue, ADMIN_SESSION_COOKIE } = await import('@/lib/admin-auth'))
  ;({ getDb } = await import('@/lib/db'))
})

beforeEach(() => {
  process.env.ADMIN_PASSWORD = 'club-secret'
})

function authedRequest(url: string) {
  return new Request(url, { headers: { cookie: `${ADMIN_SESSION_COOKIE}=${createSessionCookieValue()}` } })
}

describe('GET /api/admin/surveys/[id]/responses', () => {
  it('returns tallies for a survey with responses', async () => {
    const db = getDb()
    addSubscriber(db, { name: 'Ana', email: 'ana@example.com' })
    const created = createSurvey(db, { title: 'Horario', questions: [{ prompt: '¿Vienes?', type: 'text' }] })
    const id = (created as { id: number }).id
    const survey = getSurveyById(db, id)!
    submitResponse(db, survey, { email: 'ana@example.com', answers: { [survey.questions[0].id]: 'Sí' } })

    const response = await GET(authedRequest(`http://localhost/api/admin/surveys/${id}/responses`), {
      params: Promise.resolve({ id: String(id) }),
    })
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.count).toBe(1)
    expect(data.tallies[0].textAnswers).toEqual([{ email: 'ana@example.com', answer: 'Sí' }])
  })

  it('returns 404 for an unknown survey', async () => {
    const response = await GET(authedRequest('http://localhost/api/admin/surveys/999999/responses'), {
      params: Promise.resolve({ id: '999999' }),
    })
    expect(response.status).toBe(404)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run "app/api/admin/surveys/[id]/responses/route.test.ts"`
Expected: FAIL — route doesn't exist yet.

- [ ] **Step 3: Implement the route**

```ts
// app/api/admin/surveys/[id]/responses/route.ts
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { hasValidSession } from '@/lib/admin-auth'
import { getSurveyById } from '@/lib/surveys'
import { getResponses, tallyResponses } from '@/lib/survey-responses'

type Params = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: Params) {
  if (!hasValidSession(request)) {
    return NextResponse.json({ status: 'unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const db = getDb()
  const survey = getSurveyById(db, Number(id))
  if (!survey) {
    return NextResponse.json({ status: 'not_found' }, { status: 404 })
  }
  const responses = getResponses(db, survey.id)
  return NextResponse.json({ tallies: tallyResponses(survey, responses), count: responses.length })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run "app/api/admin/surveys/[id]/responses/route.test.ts"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "app/api/admin/surveys/[id]/responses/route.ts" "app/api/admin/surveys/[id]/responses/route.test.ts"
git commit -m "feat: add admin survey results API route"
```

---

### Task 13: Public survey definition API route

**Files:**
- Create: `app/api/surveys/[slug]/route.ts`
- Test: `app/api/surveys/[slug]/route.test.ts`

**Interfaces:**
- Consumes: `getDb`, `createSurvey`/`getSurveyBySlug` from `lib/surveys.ts`.
- Produces: `GET(request: Request, { params }: { params: Promise<{ slug: string }> })` — no auth required.

- [ ] **Step 1: Write the failing tests**

```ts
// app/api/surveys/[slug]/route.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import { createSurvey } from '@/lib/surveys'

let GET: typeof import('./route').GET
let getDb: typeof import('@/lib/db').getDb

beforeAll(async () => {
  process.env.DB_PATH = ':memory:'
  ;({ GET } = await import('./route'))
  ;({ getDb } = await import('@/lib/db'))
  createSurvey(getDb(), { title: 'Horario de otoño', questions: [{ prompt: '¿Vienes?', type: 'text' }] })
})

describe('GET /api/surveys/[slug]', () => {
  it('returns the survey definition for a known slug', async () => {
    const response = await GET(new Request('http://localhost/api/surveys/horario-de-otono'), {
      params: Promise.resolve({ slug: 'horario-de-otono' }),
    })
    expect(response.status).toBe(200)
    const { survey } = await response.json()
    expect(survey.title).toBe('Horario de otoño')
  })

  it('returns 404 for an unknown slug', async () => {
    const response = await GET(new Request('http://localhost/api/surveys/nope'), {
      params: Promise.resolve({ slug: 'nope' }),
    })
    expect(response.status).toBe(404)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run "app/api/surveys/[slug]/route.test.ts"`
Expected: FAIL — route doesn't exist yet.

- [ ] **Step 3: Implement the route**

```ts
// app/api/surveys/[slug]/route.ts
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getSurveyBySlug } from '@/lib/surveys'

type Params = { params: Promise<{ slug: string }> }

export async function GET(request: Request, { params }: Params) {
  const { slug } = await params
  const survey = getSurveyBySlug(getDb(), slug)
  if (!survey) {
    return NextResponse.json({ status: 'not_found' }, { status: 404 })
  }
  return NextResponse.json({ survey })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run "app/api/surveys/[slug]/route.test.ts"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "app/api/surveys/[slug]/route.ts" "app/api/surveys/[slug]/route.test.ts"
git commit -m "feat: add public survey definition API route"
```

---

### Task 14: Public survey submission API route

**Files:**
- Create: `app/api/surveys/[slug]/responses/route.ts`
- Test: `app/api/surveys/[slug]/responses/route.test.ts`

**Interfaces:**
- Consumes: `getDb`, `getSurveyBySlug` (`lib/surveys.ts`), `submitResponse` (`lib/survey-responses.ts`), `addSubscriber` (test setup).
- Produces: `POST(request: Request, { params }: { params: Promise<{ slug: string }> })` — no auth required, but enforces subscriber-email membership via `submitResponse`.

- [ ] **Step 1: Write the failing tests**

```ts
// app/api/surveys/[slug]/responses/route.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import { addSubscriber } from '@/lib/subscribers'
import { createSurvey, getSurveyBySlug } from '@/lib/surveys'

let POST: typeof import('./route').POST
let getDb: typeof import('@/lib/db').getDb

beforeAll(async () => {
  process.env.DB_PATH = ':memory:'
  ;({ POST } = await import('./route'))
  ;({ getDb } = await import('@/lib/db'))
  addSubscriber(getDb(), { name: 'Ana', email: 'ana@example.com' })
  createSurvey(getDb(), { title: 'Horario', questions: [{ prompt: '¿Vienes?', type: 'text' }] })
})

function jsonRequest(body: unknown) {
  return new Request('http://localhost/api/surveys/horario/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/surveys/[slug]/responses', () => {
  it('accepts a response from a known member', async () => {
    const survey = getSurveyBySlug(getDb(), 'horario')!
    const response = await POST(jsonRequest({ email: 'ana@example.com', answers: { [survey.questions[0].id]: 'Sí' } }), {
      params: Promise.resolve({ slug: 'horario' }),
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok' })
  })

  it('rejects an email that is not a member', async () => {
    const survey = getSurveyBySlug(getDb(), 'horario')!
    const response = await POST(
      jsonRequest({ email: 'stranger@example.com', answers: { [survey.questions[0].id]: 'Sí' } }),
      { params: Promise.resolve({ slug: 'horario' }) }
    )
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ status: 'invalid', error: { field: 'email', reason: 'not_member' } })
  })

  it('returns 404 for an unknown survey slug', async () => {
    const response = await POST(jsonRequest({ email: 'ana@example.com', answers: {} }), {
      params: Promise.resolve({ slug: 'nope' }),
    })
    expect(response.status).toBe(404)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run "app/api/surveys/[slug]/responses/route.test.ts"`
Expected: FAIL — route doesn't exist yet.

- [ ] **Step 3: Implement the route**

```ts
// app/api/surveys/[slug]/responses/route.ts
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getSurveyBySlug } from '@/lib/surveys'
import { submitResponse } from '@/lib/survey-responses'

type Params = { params: Promise<{ slug: string }> }

export async function POST(request: Request, { params }: Params) {
  const { slug } = await params
  const survey = getSurveyBySlug(getDb(), slug)
  if (!survey) {
    return NextResponse.json({ status: 'not_found' }, { status: 404 })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ status: 'invalid', error: { field: 'email', reason: 'invalid' } }, { status: 400 })
  }

  const result = submitResponse(getDb(), survey, body)
  if (result.status === 'invalid') {
    return NextResponse.json(result, { status: 400 })
  }
  return NextResponse.json(result, { status: 200 })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run "app/api/surveys/[slug]/responses/route.test.ts"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "app/api/surveys/[slug]/responses/route.ts" "app/api/surveys/[slug]/responses/route.test.ts"
git commit -m "feat: add public survey submission API route"
```

---

### Task 15: Public survey response form and page

**Files:**
- Create: `components/SurveyResponseForm.tsx`
- Test: `components/SurveyResponseForm.test.tsx`
- Create: `app/encuestas/[slug]/page.tsx`

**Interfaces:**
- Consumes: `Survey` type from `lib/surveys.ts`; `getDb`/`getSurveyBySlug` for the page.
- Produces: `SurveyResponseForm({ survey }: { survey: Survey })`, used only by the new page.

- [ ] **Step 1: Write the failing tests**

```tsx
// components/SurveyResponseForm.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SurveyResponseForm } from './SurveyResponseForm'
import type { Survey } from '@/lib/surveys'

const survey: Survey = {
  id: 1,
  slug: 'horario',
  title: 'Horario',
  createdAt: '2026-09-09T00:00:00.000Z',
  questions: [
    {
      id: 10,
      prompt: '¿Sábado o domingo?',
      type: 'single_choice',
      required: true,
      options: [
        { id: 100, label: 'Sábado' },
        { id: 101, label: 'Domingo' },
      ],
    },
    { id: 11, prompt: 'Comentarios', type: 'text', required: true, options: [] },
  ],
}

describe('SurveyResponseForm', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('submits the chosen option and text answer, then shows a success message', async () => {
    ;(fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok' }),
    })
    const user = userEvent.setup()
    render(<SurveyResponseForm survey={survey} />)

    await user.type(screen.getByLabelText(/email/i), 'ana@example.com')
    await user.click(screen.getByLabelText('Sábado'))
    await user.type(screen.getByRole('textbox', { name: /comentarios/i }), 'Todo bien')
    await user.click(screen.getByRole('button', { name: /enviar/i }))

    await waitFor(() => {
      expect(screen.getByText(/gracias por responder/i)).toBeInTheDocument()
    })
    expect(fetch).toHaveBeenCalledWith('/api/surveys/horario/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'ana@example.com', answers: { '10': 'Sábado', '11': 'Todo bien' } }),
    })
  })

  it('shows a not-a-member message', async () => {
    ;(fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({ status: 'invalid', error: { field: 'email', reason: 'not_member' } }),
    })
    const user = userEvent.setup()
    render(<SurveyResponseForm survey={survey} />)

    await user.type(screen.getByLabelText(/email/i), 'stranger@example.com')
    await user.click(screen.getByLabelText('Sábado'))
    await user.type(screen.getByRole('textbox', { name: /comentarios/i }), 'Hola')
    await user.click(screen.getByRole('button', { name: /enviar/i }))

    await waitFor(() => {
      expect(screen.getByText(/no encontramos ese email/i)).toBeInTheDocument()
    })
  })

  it('shows a generic error message when the request fails', async () => {
    ;(fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network down'))
    const user = userEvent.setup()
    render(<SurveyResponseForm survey={survey} />)

    await user.type(screen.getByLabelText(/email/i), 'ana@example.com')
    await user.click(screen.getByLabelText('Sábado'))
    await user.type(screen.getByRole('textbox', { name: /comentarios/i }), 'Hola')
    await user.click(screen.getByRole('button', { name: /enviar/i }))

    await waitFor(() => {
      expect(screen.getByText(/inténtalo de nuevo/i)).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run components/SurveyResponseForm.test.tsx`
Expected: FAIL — component doesn't exist yet.

- [ ] **Step 3: Implement `SurveyResponseForm`**

```tsx
// components/SurveyResponseForm.tsx
'use client'

import { useState, type FormEvent } from 'react'
import type { Survey } from '@/lib/surveys'

type FormState = 'idle' | 'submitting' | 'ok' | 'invalid' | 'not_member' | 'error'

export function SurveyResponseForm({ survey }: { survey: Survey }) {
  const [email, setEmail] = useState('')
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [state, setState] = useState<FormState>('idle')

  function setAnswer(questionId: number, value: string) {
    setAnswers((prev) => ({ ...prev, [String(questionId)]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setState('submitting')

    try {
      const response = await fetch(`/api/surveys/${survey.slug}/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, answers }),
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
        <p className="signup-message-title">¡Gracias por responder!</p>
        <p className="signup-message-body">Ya hemos guardado tus respuestas.</p>
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

      {survey.questions.map((question) => (
        <fieldset key={question.id} className="form-field">
          <legend>{question.prompt}</legend>
          {question.type === 'single_choice' ? (
            question.options.map((option) => (
              <label key={option.id}>
                <input
                  type="radio"
                  name={`question-${question.id}`}
                  aria-label={option.label}
                  value={option.label}
                  checked={answers[String(question.id)] === option.label}
                  onChange={(e) => setAnswer(question.id, e.target.value)}
                />
                {option.label}
              </label>
            ))
          ) : (
            <textarea
              aria-label={question.prompt}
              value={answers[String(question.id)] ?? ''}
              onChange={(e) => setAnswer(question.id, e.target.value)}
            />
          )}
        </fieldset>
      ))}

      {state === 'not_member' && (
        <p role="alert" className="form-error">
          No encontramos ese email entre los socios.
        </p>
      )}
      {state === 'invalid' && (
        <p role="alert" className="form-error">
          Revisa tu email y responde todas las preguntas.
        </p>
      )}
      {state === 'error' && (
        <p role="alert" className="form-error">
          Algo ha fallado, inténtalo de nuevo.
        </p>
      )}

      <button type="submit" className="cta-button" disabled={state === 'submitting'}>
        {state === 'submitting' ? 'Enviando…' : 'Enviar respuestas'}
      </button>
    </form>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run components/SurveyResponseForm.test.tsx`
Expected: PASS

- [ ] **Step 5: Add the public page (no dedicated test — see Global Constraints)**

```tsx
// app/encuestas/[slug]/page.tsx
import { notFound } from 'next/navigation'
import { getDb } from '@/lib/db'
import { getSurveyBySlug } from '@/lib/surveys'
import { SurveyResponseForm } from '@/components/SurveyResponseForm'

export default async function EncuestaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const survey = getSurveyBySlug(getDb(), slug)
  if (!survey) {
    notFound()
  }

  return (
    <main>
      <section className="signup-section">
        <div className="signup-inner">
          <p className="eyebrow">Encuesta</p>
          <h2>{survey.title}</h2>
          <SurveyResponseForm survey={survey} />
        </div>
      </section>
    </main>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add components/SurveyResponseForm.tsx components/SurveyResponseForm.test.tsx "app/encuestas/[slug]/page.tsx"
git commit -m "feat: add public survey response form and page"
```

---

### Task 16: Admin survey builder form

**Files:**
- Create: `components/SurveyBuilderForm.tsx`
- Test: `components/SurveyBuilderForm.test.tsx`

**Interfaces:**
- Consumes: `Survey`, `QuestionType` from `lib/surveys.ts`; `useRouter` from `next/navigation`.
- Produces: `SurveyBuilderForm({ survey }: { survey?: Survey })` — `POST /api/admin/surveys` when `survey` is absent, `PATCH /api/admin/surveys/:id` when present. Used by Task 17's `/admin/surveys/new` and `/admin/surveys/[id]` pages.

- [ ] **Step 1: Write the failing tests**

```tsx
// components/SurveyBuilderForm.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SurveyBuilderForm } from './SurveyBuilderForm'
import type { Survey } from '@/lib/surveys'

const push = vi.fn()
const refresh = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
}))

describe('SurveyBuilderForm', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    push.mockClear()
    refresh.mockClear()
  })

  it('creates a new survey with a single_choice question', async () => {
    ;(fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok', id: 1, slug: 'horario' }),
    })
    const user = userEvent.setup()
    render(<SurveyBuilderForm />)

    await user.type(screen.getByLabelText(/título/i), 'Horario')
    await user.type(screen.getByPlaceholderText('Texto de la pregunta'), '¿Vienes?')
    await user.type(screen.getByPlaceholderText('Opción 1'), 'Sí')
    await user.type(screen.getByPlaceholderText('Opción 2'), 'No')
    await user.click(screen.getByRole('button', { name: /guardar encuesta/i }))

    expect(fetch).toHaveBeenCalledWith(
      '/api/admin/surveys',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          title: 'Horario',
          questions: [{ prompt: '¿Vienes?', type: 'single_choice', options: ['Sí', 'No'] }],
        }),
      })
    )
  })

  it('updates an existing survey via PATCH, prefilled from props', async () => {
    ;(fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok' }),
    })
    const survey: Survey = {
      id: 7,
      slug: 'horario',
      title: 'Horario',
      createdAt: '2026-09-09T00:00:00.000Z',
      questions: [{ id: 1, prompt: '¿Vienes?', type: 'text', required: true, options: [] }],
    }
    const user = userEvent.setup()
    render(<SurveyBuilderForm survey={survey} />)

    expect(screen.getByLabelText(/título/i)).toHaveValue('Horario')
    await user.click(screen.getByRole('button', { name: /guardar encuesta/i }))

    expect(fetch).toHaveBeenCalledWith('/api/admin/surveys/7', expect.objectContaining({ method: 'PATCH' }))
  })

  it('shows an error message when the save fails', async () => {
    ;(fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({ status: 'invalid', error: { field: 'title' } }),
    })
    const user = userEvent.setup()
    render(<SurveyBuilderForm />)

    await user.type(screen.getByLabelText(/título/i), 'X')
    await user.type(screen.getByPlaceholderText('Texto de la pregunta'), '¿Vienes?')
    await user.type(screen.getByPlaceholderText('Opción 1'), 'Sí')
    await user.type(screen.getByPlaceholderText('Opción 2'), 'No')
    await user.click(screen.getByRole('button', { name: /guardar encuesta/i }))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run components/SurveyBuilderForm.test.tsx`
Expected: FAIL — component doesn't exist yet.

- [ ] **Step 3: Implement `SurveyBuilderForm`**

```tsx
// components/SurveyBuilderForm.tsx
'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import type { QuestionType, Survey } from '@/lib/surveys'

interface BuilderQuestion {
  prompt: string
  type: QuestionType
  options: string[]
}

function initialQuestions(survey?: Survey): BuilderQuestion[] {
  if (!survey || survey.questions.length === 0) {
    return [{ prompt: '', type: 'single_choice', options: ['', ''] }]
  }
  return survey.questions.map((q) => ({
    prompt: q.prompt,
    type: q.type,
    options: q.options.length ? q.options.map((o) => o.label) : ['', ''],
  }))
}

export function SurveyBuilderForm({ survey }: { survey?: Survey }) {
  const router = useRouter()
  const [title, setTitle] = useState(survey?.title ?? '')
  const [questions, setQuestions] = useState<BuilderQuestion[]>(initialQuestions(survey))
  const [error, setError] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  function updateQuestion(index: number, patch: Partial<BuilderQuestion>) {
    setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, ...patch } : q)))
  }

  function updateOption(qIndex: number, oIndex: number, value: string) {
    setQuestions((prev) =>
      prev.map((q, i) => (i === qIndex ? { ...q, options: q.options.map((o, j) => (j === oIndex ? value : o)) } : q))
    )
  }

  function addQuestion() {
    setQuestions((prev) => [...prev, { prompt: '', type: 'single_choice', options: ['', ''] }])
  }

  function addOption(qIndex: number) {
    setQuestions((prev) => prev.map((q, i) => (i === qIndex ? { ...q, options: [...q.options, ''] } : q)))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(false)

    const payload = {
      title,
      questions: questions.map((q) => ({
        prompt: q.prompt,
        type: q.type,
        options: q.type === 'single_choice' ? q.options : undefined,
      })),
    }
    const url = survey ? `/api/admin/surveys/${survey.id}` : '/api/admin/surveys'
    const method = survey ? 'PATCH' : 'POST'

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json()
      if (response.ok && data.status === 'ok') {
        router.push('/admin/surveys')
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

      {questions.map((question, qIndex) => (
        <fieldset key={qIndex} className="form-field">
          <legend>Pregunta {qIndex + 1}</legend>
          <input
            value={question.prompt}
            onChange={(e) => updateQuestion(qIndex, { prompt: e.target.value })}
            placeholder="Texto de la pregunta"
            required
          />
          <select
            value={question.type}
            onChange={(e) => updateQuestion(qIndex, { type: e.target.value as QuestionType })}
          >
            <option value="single_choice">Opción múltiple</option>
            <option value="text">Texto libre</option>
          </select>
          {question.type === 'single_choice' && (
            <div>
              {question.options.map((option, oIndex) => (
                <input
                  key={oIndex}
                  value={option}
                  onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                  placeholder={`Opción ${oIndex + 1}`}
                />
              ))}
              <button type="button" onClick={() => addOption(qIndex)}>
                + Opción
              </button>
            </div>
          )}
        </fieldset>
      ))}

      <button type="button" onClick={addQuestion}>
        + Pregunta
      </button>

      {error && (
        <p role="alert" className="form-error">
          Revisa el título y las preguntas: todas necesitan texto, y las de opción múltiple al menos dos opciones.
        </p>
      )}

      <button type="submit" className="cta-button" disabled={submitting}>
        {submitting ? 'Guardando…' : 'Guardar encuesta'}
      </button>
    </form>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run components/SurveyBuilderForm.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/SurveyBuilderForm.tsx components/SurveyBuilderForm.test.tsx
git commit -m "feat: add admin survey builder form"
```

---

### Task 17: Admin pages (login, list, new, edit+results)

**Files:**
- Create: `app/admin/login/page.tsx`
- Create: `app/admin/surveys/page.tsx`
- Create: `app/admin/surveys/new/page.tsx`
- Create: `app/admin/surveys/[id]/page.tsx`

**Interfaces:**
- Consumes: `getDb` (`lib/db.ts`); `listSurveys`/`getSurveyById` (`lib/surveys.ts`); `getResponses`/`tallyResponses` (`lib/survey-responses.ts`); `SurveyBuilderForm` (Task 16). The login page posts to `/api/admin/login` (Task 9) directly with `fetch`, same pattern as `SignupForm`.
- Produces: nothing consumed by other tasks — these are the outermost pages. No dedicated automated tests (see Global Constraints); verify manually with `npm run dev` per Step 3 below.

- [ ] **Step 1: Implement the login page**

```tsx
// app/admin/login/page.tsx
'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminLoginPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(false)

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (response.ok) {
        router.push('/admin/surveys')
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
    <main className="signup-section">
      <div className="signup-inner">
        <h2>Acceso admin</h2>
        <form onSubmit={handleSubmit} className="signup-form">
          <label className="form-field">
            Contraseña
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          {error && (
            <p role="alert" className="form-error">
              Contraseña incorrecta.
            </p>
          )}
          <button type="submit" className="cta-button" disabled={submitting}>
            {submitting ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Implement the list, new, and edit+results pages**

```tsx
// app/admin/surveys/page.tsx
import Link from 'next/link'
import { getDb } from '@/lib/db'
import { listSurveys } from '@/lib/surveys'

export default function SurveysListPage() {
  const surveys = listSurveys(getDb())

  return (
    <main className="signup-section">
      <div className="signup-inner">
        <h2>Encuestas</h2>
        <Link href="/admin/surveys/new" className="cta-button">
          Nueva encuesta
        </Link>
        <ul>
          {surveys.map((survey) => (
            <li key={survey.id}>
              <Link href={`/admin/surveys/${survey.id}`}>{survey.title}</Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}
```

```tsx
// app/admin/surveys/new/page.tsx
import { SurveyBuilderForm } from '@/components/SurveyBuilderForm'

export default function NewSurveyPage() {
  return (
    <main className="signup-section">
      <div className="signup-inner">
        <h2>Nueva encuesta</h2>
        <SurveyBuilderForm />
      </div>
    </main>
  )
}
```

```tsx
// app/admin/surveys/[id]/page.tsx
import { notFound } from 'next/navigation'
import { getDb } from '@/lib/db'
import { getSurveyById } from '@/lib/surveys'
import { getResponses, tallyResponses } from '@/lib/survey-responses'
import { SurveyBuilderForm } from '@/components/SurveyBuilderForm'

export default async function EditSurveyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()
  const survey = getSurveyById(db, Number(id))
  if (!survey) {
    notFound()
  }
  const responses = getResponses(db, survey.id)
  const tallies = tallyResponses(survey, responses)

  return (
    <main className="signup-section">
      <div className="signup-inner">
        <h2>{survey.title}</h2>
        <p>{responses.length} respuesta(s)</p>
        <SurveyBuilderForm survey={survey} />
        <section>
          <h3>Resultados</h3>
          {tallies.map((tally) => (
            <div key={tally.questionId}>
              <p>{tally.prompt}</p>
              {tally.type === 'single_choice'
                ? tally.optionCounts?.map((oc) => (
                    <p key={oc.label}>
                      {oc.label}: {oc.count}
                    </p>
                  ))
                : tally.textAnswers?.map((ta) => (
                    <p key={ta.email}>
                      {ta.email}: {ta.answer}
                    </p>
                  ))}
            </div>
          ))}
        </section>
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Manually verify the admin flow end to end**

Run: `ADMIN_PASSWORD=test-local npm run dev`, then in a browser:
1. Visit `/admin/surveys` → should redirect to `/admin/login`.
2. Log in with `test-local` → should land on `/admin/surveys`.
3. Create a survey with one `single_choice` and one `text` question.
4. Visit `/encuestas/<slug>` in an incognito window, submit with a `subscribers` email (add one via the homepage signup form first) → should see the success message.
5. Back in `/admin/surveys/<id>`, confirm the tally reflects the submitted answer.

- [ ] **Step 4: Commit**

```bash
git add app/admin
git commit -m "feat: add admin login, survey list, builder, and results pages"
```

---

### Task 18: Document `ADMIN_PASSWORD`

**Files:**
- Modify: `.env.local.example`
- Modify: `README.md`

**Interfaces:** none — documentation only.

- [ ] **Step 1: Add the env var to the example file**

```
INSTAGRAM_URL=https://instagram.com/elclubmanzanareselreal
ADMIN_PASSWORD=change-me
```

- [ ] **Step 2: Document it in the README's Configuration section**

Add a line after the existing `INSTAGRAM_URL` paragraph in `README.md`:

```markdown
Also set `ADMIN_PASSWORD` to a password of your choice — it protects
`/admin` (survey builder and results) and `/api/admin/*`. There's no
per-admin account, just this one shared password.
```

And add `-e ADMIN_PASSWORD=<password>` next to the existing `-e INSTAGRAM_URL=...` flag in both `docker run` examples ("One-time setup" and "Updating the app").

- [ ] **Step 3: Commit**

```bash
git add .env.local.example README.md
git commit -m "docs: document ADMIN_PASSWORD for the survey admin panel"
```

---

## Self-Review Notes

- **Spec coverage:** every success-criterion and error-handling line in the spec maps to a task above — schema (Task 1), builder validation (Tasks 2-3), member-only submission with overwrite (Tasks 4-6), password gate (Tasks 7-9), full CRUD + results API (Tasks 10-14), the two user-facing forms (Tasks 15-16), the pages tying it together (Task 17), and the `ADMIN_PASSWORD` doc gap this plan introduces (Task 18).
- **Type consistency:** `Survey`/`Question`/`QuestionOption`/`SurveySummary` (Task 2) are reused verbatim by Tasks 5, 6, 9-17 with no renaming; `ResponseInput`/`ResponseRow`/`QuestionTally` (Tasks 5-6) likewise flow unchanged into Tasks 12 and 15; `ADMIN_SESSION_COOKIE`/`hasValidSession`/`createSessionCookieValue` (Task 7) are the only auth primitives referenced anywhere later, including Task 8's middleware and every admin route.
- **No placeholders:** every step above has literal code, not a description of code.
