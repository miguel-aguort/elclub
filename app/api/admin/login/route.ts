import { NextResponse } from 'next/server'
import { checkPassword, createSessionCookieValue, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)

  if (!body || typeof body !== 'object' || typeof body.password !== 'string' || !checkPassword(body.password)) {
    return NextResponse.json({ status: 'invalid' }, { status: 401 })
  }

  const response = NextResponse.json({ status: 'ok' })
  response.cookies.set(ADMIN_SESSION_COOKIE, createSessionCookieValue(), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: true,
  })
  return response
}
