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
