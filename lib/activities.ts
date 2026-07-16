export interface Activity {
  slug: string
  number: string
  title: string
  description: string
  image: string
  icon: 'run' | 'climb' | 'bike'
}

export const activities: Activity[] = [
  {
    slug: 'carrera-de-montana',
    number: '01',
    title: 'Carrera de Montaña',
    description: 'Salidas grupales semanales por los senderos de la sierra, para todos los ritmos.',
    image: 'https://picsum.photos/id/1018/900/700?grayscale',
    icon: 'run',
  },
  {
    slug: 'escalada',
    number: '02',
    title: 'Escalada',
    description: 'Vías deportivas y clásicas, sesiones indoor y salidas a roca para todos los niveles.',
    image: 'https://picsum.photos/id/1015/900/700?grayscale',
    icon: 'climb',
  },
  {
    slug: 'bici',
    number: '03',
    title: 'Bici',
    description: 'Rutas de carretera y montaña, desde paseos tranquilos hasta subidas largas.',
    image: 'https://picsum.photos/id/1016/900/700?grayscale',
    icon: 'bike',
  },
]
