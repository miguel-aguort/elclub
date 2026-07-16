import type { Metadata } from 'next'
import { Anton } from 'next/font/google'
import './globals.css'

const anton = Anton({ weight: '400', subsets: ['latin'], variable: '--font-display' })

export const metadata: Metadata = {
  title: 'El Club!',
  description: 'Trail running, climbing, and biking community — La Pedriza, Manzanares El Real',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={anton.variable}>
      <body>{children}</body>
    </html>
  )
}
