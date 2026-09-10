import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import Home from './page'
import { createEvent } from '@/lib/events'
import { getDb } from '@/lib/db'

beforeAll(() => {
  process.env.DB_PATH = ':memory:'
})

afterEach(() => cleanup())

describe('Home page', () => {
  it('renders the activity sections and the signup form', () => {
    render(<Home />)
    expect(screen.getByRole('heading', { name: 'Carrera de Montaña' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Escalada' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Bici' })).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
  })

  it('links out to Instagram', () => {
    render(<Home />)
    const links = screen.getAllByRole('link', { name: /instagram/i })
    expect(links.length).toBeGreaterThan(0)
    for (const link of links) {
      expect(link).toHaveAttribute('target', '_blank')
    }
  })

  it('shows an empty-state message when there are no upcoming activities', () => {
    render(<Home />)
    expect(screen.getByText(/aún no hay actividades programadas/i)).toBeInTheDocument()
  })

  it('links an upcoming activity title to its activity page', () => {
    const result = createEvent(getDb(), {
      title: 'Salida a La Pedriza',
      description: 'Ruta tranquila para todos los niveles.',
      location: 'Parking de Canto Cochino',
      eventAt: '2030-01-01T09:00',
    })
    const id = (result as { id: number }).id

    render(<Home />)

    expect(screen.getByRole('link', { name: 'Salida a La Pedriza' })).toHaveAttribute(
      'href',
      `/actividades/${id}`
    )
  })
})
