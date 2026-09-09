export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { isValidSessionCookie, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth'
import { ActivityBuilderForm } from '@/components/ActivityBuilderForm'

export default async function NewActivityPage() {
  const cookieStore = await cookies()
  if (!isValidSessionCookie(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)) {
    redirect('/admin/login')
  }

  return (
    <main className="signup-section">
      <div className="signup-inner">
        <h2>Nueva actividad</h2>
        <ActivityBuilderForm />
      </div>
    </main>
  )
}
