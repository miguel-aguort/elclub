import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ActivitySection } from './ActivitySection'

describe('ActivitySection', () => {
  it('renders the activity title and description', () => {
    render(
      <ActivitySection
        activity={{ slug: 'climbing', title: 'Climbing', description: 'Sport and trad routes for all levels.' }}
      />
    )
    expect(screen.getByRole('heading', { name: 'Climbing' })).toBeInTheDocument()
    expect(screen.getByText('Sport and trad routes for all levels.')).toBeInTheDocument()
  })
})
