'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function DeleteScheduleSessionButton({ id }: { id: number }) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!confirm('¿Borrar esta sesión?')) return
    setDeleting(true)
    await fetch(`/api/admin/schedule/${id}`, { method: 'DELETE' })
    router.push('/admin/schedule')
    router.refresh()
  }

  return (
    <button type="button" className="cta-ghost" onClick={handleDelete} disabled={deleting}>
      {deleting ? 'Borrando…' : 'Borrar sesión'}
    </button>
  )
}
