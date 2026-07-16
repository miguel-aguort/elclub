import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Home from './page'

describe('Home page', () => {
  it('renders the activity sections and the signup form', () => {
    render(<Home />)
    expect(screen.getByRole('heading', { name: 'Trail Running' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Climbing' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Biking' })).toBeInTheDocument()
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
})
