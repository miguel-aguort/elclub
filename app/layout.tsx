import type { Metadata } from 'next'
import { Anton, Archivo } from 'next/font/google'
import './globals.css'

const anton = Anton({ weight: '400', subsets: ['latin'], variable: '--font-display' })
const archivo = Archivo({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-body',
})

export const metadata: Metadata = {
  title: 'El Club!',
  description:
    'Comunidad de montaña — carrera de montaña, escalada y bici en La Pedriza, Manzanares El Real',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${anton.variable} ${archivo.variable}`}>
      <body>{children}</body>
    </html>
  )
}
