export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { SurveyBuilderForm } from '@/components/SurveyBuilderForm'
import { isValidSessionCookie, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth'

export default async function NewSurveyPage() {
  const cookieStore = await cookies()
  if (!isValidSessionCookie(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)) {
    redirect('/admin/login')
  }

  return (
    <main className="signup-section">
      <div className="signup-inner">
        <h2>Nueva encuesta</h2>
        <SurveyBuilderForm />
      </div>
    </main>
  )
}
