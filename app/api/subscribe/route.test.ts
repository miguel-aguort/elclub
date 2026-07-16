import { describe, it, expect, beforeAll } from 'vitest'

let POST: typeof import('./route').POST

beforeAll(async () => {
  process.env.DB_PATH = ':memory:'
  ;({ POST } = await import('./route'))
})

function jsonRequest(body: unknown) {
  return new Request('http://localhost/api/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/subscribe', () => {
  it('accepts a valid signup', async () => {
    const response = await POST(jsonRequest({ name: 'Ana', email: 'ana@example.com' }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok' })
  })

  it('rejects a missing name', async () => {
    const response = await POST(jsonRequest({ email: 'noname@example.com' }))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ status: 'invalid', field: 'name' })
  })

  it('rejects a malformed email', async () => {
    const response = await POST(jsonRequest({ name: 'Ana', email: 'not-an-email' }))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ status: 'invalid', field: 'email' })
  })

  it('reports a duplicate email on the second signup', async () => {
    await POST(jsonRequest({ name: 'Ana', email: 'dup@example.com' }))
    const response = await POST(jsonRequest({ name: 'Ana Again', email: 'dup@example.com' }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'duplicate' })
  })
})
