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
