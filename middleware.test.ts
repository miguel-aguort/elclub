import { describe, it, expect, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { middleware } from './middleware'
import { createSessionCookieValue, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth'

describe('middleware', () => {
  beforeEach(() => {
    process.env.ADMIN_PASSWORD = 'club-secret'
  })

  it('lets the login page through unauthenticated', () => {
    const response = middleware(new NextRequest('http://localhost/admin/login'))
    expect(response.status).toBe(200)
  })

  it('redirects an unauthenticated admin page request to login', () => {
    const response = middleware(new NextRequest('http://localhost/admin/surveys'))
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost/admin/login')
  })

  it('returns 401 json for an unauthenticated admin api request', async () => {
    const response = middleware(new NextRequest('http://localhost/api/admin/surveys'))
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ status: 'unauthorized' })
  })

  it('lets an authenticated request through', () => {
    const request = new NextRequest('http://localhost/admin/surveys', {
      headers: { cookie: `${ADMIN_SESSION_COOKIE}=${createSessionCookieValue()}` },
    })
    expect(middleware(request).status).toBe(200)
  })
})
