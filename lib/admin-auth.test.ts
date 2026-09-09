import { describe, it, expect, beforeEach } from 'vitest'
import {
  checkPassword,
  createSessionCookieValue,
  isValidSessionCookie,
  hasValidSession,
  ADMIN_SESSION_COOKIE,
} from './admin-auth'

describe('admin-auth', () => {
  beforeEach(() => {
    process.env.ADMIN_PASSWORD = 'club-secret'
  })

  it('accepts the correct password', () => {
    expect(checkPassword('club-secret')).toBe(true)
  })

  it('rejects an incorrect password', () => {
    expect(checkPassword('wrong')).toBe(false)
  })

  it('rejects any password when ADMIN_PASSWORD is unset', () => {
    delete process.env.ADMIN_PASSWORD
    expect(checkPassword('')).toBe(false)
    expect(checkPassword('anything')).toBe(false)
  })

  it('validates a cookie value created for the current password', () => {
    const value = createSessionCookieValue()
    expect(isValidSessionCookie(value)).toBe(true)
  })

  it('rejects a garbage cookie value', () => {
    expect(isValidSessionCookie('not-a-real-token')).toBe(false)
  })

  it('rejects a missing cookie value', () => {
    expect(isValidSessionCookie(undefined)).toBe(false)
  })

  it('reads a valid session out of a request cookie header', () => {
    const value = createSessionCookieValue()
    const request = new Request('http://localhost/admin/surveys', {
      headers: { cookie: `${ADMIN_SESSION_COOKIE}=${value}` },
    })
    expect(hasValidSession(request)).toBe(true)
  })

  it('rejects a request with no cookie header', () => {
    const request = new Request('http://localhost/admin/surveys')
    expect(hasValidSession(request)).toBe(false)
  })

  it('rejects a session cookie when ADMIN_PASSWORD is unset, even with the publicly-computable HMAC-of-empty-string', () => {
    // Compute what the old (buggy) code would have accepted
    const { createHmac } = require('node:crypto')
    const publiclyComputedValue = createHmac('sha256', '').update('elclub-admin-session').digest('hex')

    // Delete the password
    delete process.env.ADMIN_PASSWORD

    // isValidSessionCookie must return false, not accept the publicly-known value
    expect(isValidSessionCookie(publiclyComputedValue)).toBe(false)
  })

  it('validates a session cookie among multiple cookies in the header', () => {
    const value = createSessionCookieValue()
    const request = new Request('http://localhost/admin/surveys', {
      headers: { cookie: `other=1; ${ADMIN_SESSION_COOKIE}=${value}; foo=bar` },
    })
    expect(hasValidSession(request)).toBe(true)
  })

  it('rejects a request with a substring-colliding cookie name (not_admin_session)', () => {
    const request = new Request('http://localhost/admin/surveys', {
      headers: { cookie: 'not_admin_session=something' },
    })
    expect(hasValidSession(request)).toBe(false)
  })
})
