export interface Activity {
  slug: string
  title: string
  description: string
  icon?: string
}

export const activities: Activity[] = [
  {
    slug: 'trail-running',
    title: 'Trail Running',
    description: 'Weekly group runs on the trails around the mountain, for every pace.',
    icon: '🏃',
  },
  {
    slug: 'climbing',
    title: 'Climbing',
    description: 'Sport and trad routes, indoor sessions, and outdoor trips for all levels.',
    icon: '🧗',
  },
  {
    slug: 'biking',
    title: 'Biking',
    description: 'Road and mountain biking routes, from casual rides to longer climbs.',
    icon: '🚵',
  },
]
