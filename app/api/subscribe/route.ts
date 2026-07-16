import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { validateSubscribeInput, addSubscriber } from '@/lib/subscribers'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ status: 'invalid', field: 'name' }, { status: 400 })
  }

  const error = validateSubscribeInput(body)
  if (error) {
    return NextResponse.json({ status: 'invalid', field: error.field }, { status: 400 })
  }

  const result = addSubscriber(getDb(), {
    name: body.name,
    email: body.email,
    phone: body.phone,
  })

  return NextResponse.json(result, { status: 200 })
}
