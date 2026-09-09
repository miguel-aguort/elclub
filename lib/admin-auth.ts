import { createHmac, timingSafeEqual } from 'node:crypto'

export const ADMIN_SESSION_COOKIE = 'admin_session'

function adminPassword(): string {
  return process.env.ADMIN_PASSWORD || ''
}

export function checkPassword(input: string): boolean {
  const expected = adminPassword()
  if (expected.length === 0) return false
  // Use constant-time comparison to prevent timing attacks
  try {
    const a = Buffer.from(input)
    const b = Buffer.from(expected)
    return a.length === b.length && timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export function createSessionCookieValue(): string {
  return createHmac('sha256', adminPassword()).update('elclub-admin-session').digest('hex')
}

export function isValidSessionCookie(value: string | undefined | null): boolean {
  if (!value) return false
  // Fail closed: return false if ADMIN_PASSWORD is unset/empty
  const pwd = adminPassword()
  if (!pwd) return false
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
