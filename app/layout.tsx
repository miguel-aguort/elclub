import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'El Club',
  description: 'Trail running, climbing, and biking community',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
