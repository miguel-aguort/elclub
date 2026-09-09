import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SurveyBuilderForm } from './SurveyBuilderForm'
import type { Survey } from '@/lib/surveys'

const push = vi.fn()
const refresh = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
}))

describe('SurveyBuilderForm', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    push.mockClear()
    refresh.mockClear()
  })

  afterEach(() => {
    cleanup()
  })

  it('creates a new survey with a single_choice question', async () => {
    ;(fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok', id: 1, slug: 'horario' }),
    })
    const user = userEvent.setup()
    render(<SurveyBuilderForm />)

    await user.type(screen.getByLabelText(/título/i), 'Horario')
    await user.type(screen.getByPlaceholderText('Texto de la pregunta'), '¿Vienes?')
    await user.type(screen.getByPlaceholderText('Opción 1'), 'Sí')
    await user.type(screen.getByPlaceholderText('Opción 2'), 'No')
    await user.click(screen.getByRole('button', { name: /guardar encuesta/i }))

    expect(fetch).toHaveBeenCalledWith(
      '/api/admin/surveys',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          title: 'Horario',
          questions: [{ prompt: '¿Vienes?', type: 'single_choice', options: ['Sí', 'No'] }],
        }),
      })
    )
  })

  it('updates an existing survey via PATCH, prefilled from props', async () => {
    ;(fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok' }),
    })
    const survey: Survey = {
      id: 7,
      slug: 'horario',
      title: 'Horario',
      createdAt: '2026-09-09T00:00:00.000Z',
      questions: [{ id: 1, prompt: '¿Vienes?', type: 'text', required: true, options: [] }],
    }
    const user = userEvent.setup()
    render(<SurveyBuilderForm survey={survey} />)

    expect(screen.getByLabelText(/título/i)).toHaveValue('Horario')
    await user.click(screen.getByRole('button', { name: /guardar encuesta/i }))

    expect(fetch).toHaveBeenCalledWith('/api/admin/surveys/7', expect.objectContaining({ method: 'PATCH' }))
  })

  it('shows an error message when the save fails', async () => {
    ;(fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({ status: 'invalid', error: { field: 'title' } }),
    })
    const user = userEvent.setup()
    render(<SurveyBuilderForm />)

    await user.type(screen.getByLabelText(/título/i), 'X')
    await user.type(screen.getByPlaceholderText('Texto de la pregunta'), '¿Vienes?')
    await user.type(screen.getByPlaceholderText('Opción 1'), 'Sí')
    await user.type(screen.getByPlaceholderText('Opción 2'), 'No')
    await user.click(screen.getByRole('button', { name: /guardar encuesta/i }))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
})
