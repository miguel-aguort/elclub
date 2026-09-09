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
