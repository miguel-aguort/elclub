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
