export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { isValidSessionCookie, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth'
import { ScheduleSessionForm } from '@/components/ScheduleSessionForm'

export default async function NewScheduleSessionPage() {
  const cookieStore = await cookies()
  if (!isValidSessionCookie(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)) {
    redirect('/admin/login')
  }

  return (
    <main className="signup-section">
      <div className="signup-inner">
        <h2>Nueva sesión</h2>
        <ScheduleSessionForm />
      </div>
    </main>
  )
}
