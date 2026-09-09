import { describe, it, expect, beforeAll, beforeEach } from 'vitest'

let POST: typeof import('./route').POST

beforeAll(async () => {
  ;({ POST } = await import('./route'))
})

beforeEach(() => {
  process.env.ADMIN_PASSWORD = 'club-secret'
})

function jsonRequest(body: unknown) {
  return new Request('http://localhost/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/login', () => {
  it('accepts the correct password and sets a session cookie', async () => {
    const response = await POST(jsonRequest({ password: 'club-secret' }))
    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie')).toContain('admin_session=')
  })

  it('rejects an incorrect password', async () => {
    const response = await POST(jsonRequest({ password: 'wrong' }))
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ status: 'invalid' })
  })

  it('rejects a malformed body', async () => {
    const response = await POST(new Request('http://localhost/api/admin/login', { method: 'POST', body: 'not json' }))
    expect(response.status).toBe(401)
  })
})
