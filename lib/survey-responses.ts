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
