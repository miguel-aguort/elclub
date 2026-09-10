import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { hasValidSession } from '@/lib/admin-auth'
import { getScheduleSessionById, updateScheduleSession, deleteScheduleSession } from '@/lib/schedule-sessions'

type Params = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: Params) {
  if (!hasValidSession(request)) {
    return NextResponse.json({ status: 'unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const session = getScheduleSessionById(getDb(), Number(id))
  if (!session) {
    return NextResponse.json({ status: 'not_found' }, { status: 404 })
  }
  return NextResponse.json({ session })
}

export async function PATCH(request: Request, { params }: Params) {
  if (!hasValidSession(request)) {
    return NextResponse.json({ status: 'unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ status: 'invalid', error: { field: 'day' } }, { status: 400 })
  }
  const result = updateScheduleSession(getDb(), Number(id), body)
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
  deleteScheduleSession(getDb(), Number(id))
  return NextResponse.json({ status: 'ok' })
}
