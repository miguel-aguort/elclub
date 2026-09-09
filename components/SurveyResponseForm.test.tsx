import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SurveyResponseForm } from './SurveyResponseForm'
import type { Survey } from '@/lib/surveys'

const survey: Survey = {
  id: 1,
  slug: 'horario',
  title: 'Horario',
  createdAt: '2026-09-09T00:00:00.000Z',
  questions: [
    {
      id: 10,
      prompt: '¿Sábado o domingo?',
      type: 'single_choice',
      required: true,
      options: [
        { id: 100, label: 'Sábado' },
        { id: 101, label: 'Domingo' },
      ],
    },
    { id: 11, prompt: 'Comentarios', type: 'text', required: true, options: [] },
  ],
}

describe('SurveyResponseForm', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    cleanup()
  })

  it('submits the chosen option and text answer, then shows a success message', async () => {
    ;(fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok' }),
    })
    const user = userEvent.setup()
    render(<SurveyResponseForm survey={survey} />)

    await user.type(screen.getByLabelText(/email/i), 'ana@example.com')
    await user.click(screen.getByLabelText('Sábado'))
    await user.type(screen.getByRole('textbox', { name: /comentarios/i }), 'Todo bien')
    await user.click(screen.getByRole('button', { name: /enviar/i }))

    await waitFor(() => {
      expect(screen.getByText(/gracias por responder/i)).toBeInTheDocument()
    })
    expect(fetch).toHaveBeenCalledWith('/api/surveys/horario/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'ana@example.com', answers: { '10': 'Sábado', '11': 'Todo bien' } }),
    })
  })

  it('shows a not-a-member message', async () => {
    ;(fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({ status: 'invalid', error: { field: 'email', reason: 'not_member' } }),
    })
    const user = userEvent.setup()
    render(<SurveyResponseForm survey={survey} />)

    await user.type(screen.getByLabelText(/email/i), 'stranger@example.com')
    await user.click(screen.getByLabelText('Sábado'))
    await user.type(screen.getByRole('textbox', { name: /comentarios/i }), 'Hola')
    await user.click(screen.getByRole('button', { name: /enviar/i }))

    await waitFor(() => {
      expect(screen.getByText(/no encontramos ese email/i)).toBeInTheDocument()
    })
  })

  it('shows a generic error message when the request fails', async () => {
    ;(fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network down'))
    const user = userEvent.setup()
    render(<SurveyResponseForm survey={survey} />)

    await user.type(screen.getByLabelText(/email/i), 'ana@example.com')
    await user.click(screen.getByLabelText('Sábado'))
    await user.type(screen.getByRole('textbox', { name: /comentarios/i }), 'Hola')
    await user.click(screen.getByRole('button', { name: /enviar/i }))

    await waitFor(() => {
      expect(screen.getByText(/inténtalo de nuevo/i)).toBeInTheDocument()
    })
  })
})
