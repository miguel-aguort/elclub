export interface Session {
  day: string
  time: string
  title: string
  place: string
}

export const schedule: Session[] = [
  { day: 'Martes', time: '19:00', title: 'Carrera de montaña', place: 'Parking de Canto Cochino' },
  { day: 'Jueves', time: '18:30', title: 'Escalada indoor', place: 'Rocódromo (centro)' },
  { day: 'Sábado', time: '09:00', title: 'Salida a roca / BTT', place: 'La Pedriza' },
  { day: 'Domingo', time: '08:30', title: 'Salida larga', place: 'Sierra de Guadarrama' },
]

export interface Stat {
  value: string
  label: string
}

export const stats: Stat[] = [
  { value: '<60 min', label: 'de Madrid' },
  { value: 'Todos', label: 'los niveles' },
  { value: '0 €', label: 'de cuota' },
]
