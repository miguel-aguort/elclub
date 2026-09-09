'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function DeleteActivityButton({ id }: { id: number }) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!confirm('¿Borrar esta actividad?')) return
    setDeleting(true)
    await fetch(`/api/admin/activities/${id}`, { method: 'DELETE' })
    router.push('/admin/activities')
    router.refresh()
  }

  return (
    <button type="button" className="cta-ghost" onClick={handleDelete} disabled={deleting}>
      {deleting ? 'Borrando…' : 'Borrar actividad'}
    </button>
  )
}
