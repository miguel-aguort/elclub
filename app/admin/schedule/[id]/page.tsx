export const dynamic = 'force-dynamic'

import { notFound, redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getDb } from '@/lib/db'
import { getScheduleSessionById } from '@/lib/schedule-sessions'
import { isValidSessionCookie, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth'
import { ScheduleSessionForm } from '@/components/ScheduleSessionForm'
import { DeleteScheduleSessionButton } from '@/components/DeleteScheduleSessionButton'

export default async function EditScheduleSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies()
  if (!isValidSessionCookie(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)) {
    redirect('/admin/login')
  }

  const { id } = await params
  const session = getScheduleSessionById(getDb(), Number(id))
  if (!session) {
    notFound()
  }

  return (
    <main className="signup-section">
      <div className="signup-inner">
        <h2>{session.title}</h2>
        <ScheduleSessionForm session={session} />
        <DeleteScheduleSessionButton id={session.id} />
      </div>
    </main>
  )
}
