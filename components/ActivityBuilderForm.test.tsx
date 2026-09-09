import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ActivityBuilderForm } from './ActivityBuilderForm'
import type { Event } from '@/lib/events'

const push = vi.fn()
const refresh = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
}))

describe('ActivityBuilderForm', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    push.mockClear()
    refresh.mockClear()
  })

  afterEach(() => cleanup())

  it('creates a new activity', async () => {
    ;(fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok', id: 1 }),
    })
    const user = userEvent.setup()
    render(<ActivityBuilderForm />)

    await user.type(screen.getByLabelText(/título/i), 'Salida a La Pedriza')
    await user.type(screen.getByLabelText(/descripción/i), 'Ruta tranquila')
    await user.type(screen.getByLabelText(/ubicación/i), 'Parking de Canto Cochino')
    await user.type(screen.getByLabelText(/fecha/i), '2026-10-04')
    await user.type(screen.getByLabelText(/hora/i), '09:00')
    await user.click(screen.getByRole('button', { name: /guardar actividad/i }))

    expect(fetch).toHaveBeenCalledWith(
      '/api/admin/activities',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          title: 'Salida a La Pedriza',
          description: 'Ruta tranquila',
          location: 'Parking de Canto Cochino',
          eventAt: '2026-10-04T09:00',
          link: undefined,
        }),
      })
    )
  })

  it('updates an existing activity via PATCH, prefilled from props', async () => {
    ;(fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok' }),
    })
    const activity: Event = {
      id: 7,
      title: 'Salida a La Pedriza',
      description: 'Ruta tranquila',
      location: 'Parking de Canto Cochino',
      eventAt: '2026-10-04T09:00',
      link: null,
      createdAt: '2026-09-09T00:00:00.000Z',
    }
    const user = userEvent.setup()
    render(<ActivityBuilderForm activity={activity} />)

    expect(screen.getByLabelText(/título/i)).toHaveValue('Salida a La Pedriza')
    expect(screen.getByLabelText(/fecha/i)).toHaveValue('2026-10-04')
    expect(screen.getByLabelText(/hora/i)).toHaveValue('09:00')
    await user.click(screen.getByRole('button', { name: /guardar actividad/i }))

    expect(fetch).toHaveBeenCalledWith('/api/admin/activities/7', expect.objectContaining({ method: 'PATCH' }))
  })

  it('shows an error message when the save fails', async () => {
    ;(fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({ status: 'invalid', error: { field: 'title' } }),
    })
    const user = userEvent.setup()
    render(<ActivityBuilderForm />)

    await user.type(screen.getByLabelText(/título/i), 'X')
    await user.type(screen.getByLabelText(/descripción/i), 'Y')
    await user.type(screen.getByLabelText(/ubicación/i), 'Z')
    await user.type(screen.getByLabelText(/fecha/i), '2026-10-04')
    await user.type(screen.getByLabelText(/hora/i), '09:00')
    await user.click(screen.getByRole('button', { name: /guardar actividad/i }))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
})
