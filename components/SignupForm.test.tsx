import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SignupForm } from './SignupForm'

describe('SignupForm', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('submits name, email, and phone and shows a success message', async () => {
    ;(fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok' }),
    })
    const user = userEvent.setup()
    render(<SignupForm />)

    await user.type(screen.getByLabelText(/nombre/i), 'Ana')
    await user.type(screen.getByLabelText(/email/i), 'ana@example.com')
    await user.type(screen.getByLabelText(/tel[eé]fono/i), '555-1234')
    await user.click(screen.getByRole('button', { name: /únete/i }))

    await waitFor(() => {
      expect(screen.getByText(/ya estás dentro/i)).toBeInTheDocument()
    })
    expect(fetch).toHaveBeenCalledWith('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Ana', email: 'ana@example.com', phone: '555-1234' }),
    })
  })

  it('shows a friendly message for a duplicate email', async () => {
    ;(fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'duplicate' }),
    })
    const user = userEvent.setup()
    render(<SignupForm />)

    await user.type(screen.getByLabelText(/nombre/i), 'Ana')
    await user.type(screen.getByLabelText(/email/i), 'ana@example.com')
    await user.click(screen.getByRole('button', { name: /únete/i }))

    await waitFor(() => {
      expect(screen.getByText(/ya estabas en la lista/i)).toBeInTheDocument()
    })
  })

  it('shows a generic error message when the request fails', async () => {
    ;(fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network down'))
    const user = userEvent.setup()
    render(<SignupForm />)

    await user.type(screen.getByLabelText(/nombre/i), 'Ana')
    await user.type(screen.getByLabelText(/email/i), 'ana@example.com')
    await user.click(screen.getByRole('button', { name: /únete/i }))

    await waitFor(() => {
      expect(screen.getByText(/inténtalo de nuevo/i)).toBeInTheDocument()
    })
  })
})
