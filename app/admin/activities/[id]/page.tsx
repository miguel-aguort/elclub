import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getDb } from '@/lib/db'
import { getEventById } from '@/lib/events'
import { isValidSessionCookie, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth'
import { ActivityBuilderForm } from '@/components/ActivityBuilderForm'
import { DeleteActivityButton } from '@/components/DeleteActivityButton'

export default async function EditActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies()
  if (!isValidSessionCookie(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)) {
    redirect('/admin/login')
  }

  const { id } = await params
  const event = getEventById(getDb(), Number(id))
  if (!event) {
    notFound()
  }

  return (
    <main className="signup-section">
      <div className="signup-inner">
        <h2>{event.title}</h2>
        <ActivityBuilderForm activity={event} />
        <DeleteActivityButton id={event.id} />
      </div>
    </main>
  )
}
