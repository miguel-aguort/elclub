import { createHmac, timingSafeEqual } from 'node:crypto'

export const ADMIN_SESSION_COOKIE = 'admin_session'

function adminPassword(): string {
  return process.env.ADMIN_PASSWORD || ''
}

export function checkPassword(input: string): boolean {
  const expected = adminPassword()
  return expected.length > 0 && input === expected
}

export function createSessionCookieValue(): string {
  return createHmac('sha256', adminPassword()).update('elclub-admin-session').digest('hex')
}

export function isValidSessionCookie(value: string | undefined | null): boolean {
  if (!value) return false
  const expected = createSessionCookieValue()
  const a = Buffer.from(value)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function hasValidSession(request: Request): boolean {
  const header = request.headers.get('cookie')
  if (!header) return false
  const cookie = header
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ADMIN_SESSION_COOKIE}=`))
  if (!cookie) return false
  return isValidSessionCookie(cookie.slice(ADMIN_SESSION_COOKIE.length + 1))
}
