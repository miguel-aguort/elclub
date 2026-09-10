import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { hasValidSession } from '@/lib/admin-auth'
import { createScheduleSession, listScheduleSessions } from '@/lib/schedule-sessions'

export async function GET(request: Request) {
  if (!hasValidSession(request)) {
    return NextResponse.json({ status: 'unauthorized' }, { status: 401 })
  }
  return NextResponse.json({ sessions: listScheduleSessions(getDb()) })
}

export async function POST(request: Request) {
  if (!hasValidSession(request)) {
    return NextResponse.json({ status: 'unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ status: 'invalid', error: { field: 'day' } }, { status: 400 })
  }

  const result = createScheduleSession(getDb(), body)
  if (result.status === 'invalid') {
    return NextResponse.json(result, { status: 400 })
  }
  return NextResponse.json(result, { status: 200 })
}
