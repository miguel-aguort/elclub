import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EventSignupForm } from './EventSignupForm'

describe('EventSignupForm', () => {
  afterEach(() => {
    cleanup()
  })

  it('submits the email and shows a success message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'ok' }) }))
    const user = userEvent.setup()
    render(<EventSignupForm eventId={1} eventTitle="Cross al Yelmo" />)

    await user.type(screen.getByLabelText(/email/i), 'ana@example.com')
    await user.click(screen.getByRole('button', { name: /apuntarme/i }))

    await waitFor(() => {
      expect(screen.getByText(/apuntado/i)).toBeInTheDocument()
    })
    expect(fetch).toHaveBeenCalledWith('/api/actividades/1/apuntarse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'ana@example.com' }),
    })
  })

  it('shows a not-a-member message with a link to join the community', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ status: 'invalid', error: { field: 'email', reason: 'not_member' } }),
      })
    )
    const user = userEvent.setup()
    render(<EventSignupForm eventId={1} eventTitle="Cross al Yelmo" />)

    await user.type(screen.getByLabelText(/email/i), 'stranger@example.com')
    await user.click(screen.getByRole('button', { name: /apuntarme/i }))

    await waitFor(() => {
      expect(screen.getByText(/no pertenece a la comunidad/i)).toBeInTheDocument()
    })
    expect(screen.getByRole('link', { name: /únete aquí/i })).toHaveAttribute('href', '/#unete')
  })

  it('shows a generic error message when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    const user = userEvent.setup()
    render(<EventSignupForm eventId={1} eventTitle="Cross al Yelmo" />)

    await user.type(screen.getByLabelText(/email/i), 'ana@example.com')
    await user.click(screen.getByRole('button', { name: /apuntarme/i }))

    await waitFor(() => {
      expect(screen.getByText(/inténtalo de nuevo/i)).toBeInTheDocument()
    })
  })
})
