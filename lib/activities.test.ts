import { describe, it, expect } from 'vitest'
import { activities } from './activities'

describe('activities', () => {
  it('includes carrera de montaña, escalada, and bici', () => {
    const slugs = activities.map((a) => a.slug)
    expect(slugs).toEqual(expect.arrayContaining(['carrera-de-montana', 'escalada', 'bici']))
  })

  it('gives every activity a non-empty title and description', () => {
    for (const activity of activities) {
      expect(activity.title.length).toBeGreaterThan(0)
      expect(activity.description.length).toBeGreaterThan(0)
    }
  })
})
