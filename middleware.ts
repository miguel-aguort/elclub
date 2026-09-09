import { NextResponse, type NextRequest } from 'next/server'
import { hasValidSession } from '@/lib/admin-auth'

export const runtime = 'nodejs'

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
}

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === '/admin/login' || request.nextUrl.pathname === '/api/admin/login') {
    return NextResponse.next()
  }

  if (hasValidSession(request)) {
    return NextResponse.next()
  }

  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ status: 'unauthorized' }, { status: 401 })
  }

  return NextResponse.redirect(new URL('/admin/login', request.url))
}
