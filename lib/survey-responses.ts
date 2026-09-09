import type Database from 'better-sqlite3'
import { isSubscribedEmail } from './subscribers'
import type { QuestionType, Survey } from './surveys'

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
  if (!input.email || typeof input.email !== 'string' || !EMAIL_PATTERN.test(input.email)) {
    return { field: 'email', reason: 'invalid' }
  }
  const answers = input.answers && typeof input.answers === 'object' ? input.answers : {}
  for (const question of survey.questions) {
    if (!question.required) continue
    const answer = (answers as Record<string, unknown>)[String(question.id)]
    if (typeof answer !== 'string' || !answer.trim()) {
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

  const sanitizedAnswers: Record<string, string> = {}
  for (const question of survey.questions) {
    const raw = (input.answers as Record<string, unknown> | undefined)?.[String(question.id)]
    if (typeof raw === 'string' && raw.trim()) {
      sanitizedAnswers[String(question.id)] = raw
    }
  }

  db.prepare(
    `INSERT INTO survey_responses (survey_id, email, answers_json)
     VALUES (?, ?, ?)
     ON CONFLICT(survey_id, email)
     DO UPDATE SET answers_json = excluded.answers_json, updated_at = datetime('now')`
  ).run(survey.id, email, JSON.stringify(sanitizedAnswers))

  return { status: 'ok' }
}

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
