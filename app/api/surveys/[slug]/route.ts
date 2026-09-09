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
