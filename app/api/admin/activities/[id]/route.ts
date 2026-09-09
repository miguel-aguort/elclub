import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { hasValidSession } from '@/lib/admin-auth'
import { getEventById, updateEvent, deleteEvent } from '@/lib/events'

type Params = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: Params) {
  if (!hasValidSession(request)) {
    return NextResponse.json({ status: 'unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const event = getEventById(getDb(), Number(id))
  if (!event) {
    return NextResponse.json({ status: 'not_found' }, { status: 404 })
  }
  return NextResponse.json({ event })
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
  const result = updateEvent(getDb(), Number(id), body)
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
  deleteEvent(getDb(), Number(id))
  return NextResponse.json({ status: 'ok' })
}
