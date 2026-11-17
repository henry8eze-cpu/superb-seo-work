import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

// First line of defence: signed-in checks per area. Every page, server action and
// route handler still checks role and school membership against the database.
const ADMIN_ONLY = ['/admin', '/api/admin']

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname
  const adminOnly = ADMIN_ONLY.some((p) => path === p || path.startsWith(`${p}/`))

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    secureCookie: request.nextUrl.protocol === 'https:',
  })

  if (!token) {
    if (path.startsWith('/api/')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const login = new URL('/auth/login', request.url)
    login.searchParams.set('callbackUrl', `${path}${request.nextUrl.search}`)
    return NextResponse.redirect(login)
  }

  const role = token.role === 'ADMIN' ? 'PLATFORM_ADMIN' : token.role
  if (adminOnly && role !== 'PLATFORM_ADMIN') {
    if (path.startsWith('/api/')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/school/:path*',
    '/account/:path*',
    '/checkout/:path*',
    '/dashboard/:path*',
    '/api/admin/:path*',
    '/api/school/:path*',
  ],
}
