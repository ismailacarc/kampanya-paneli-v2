import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const auth = request.cookies.get('panel_auth')
  const sifre = process.env.PANEL_SIFRE

  // Login sayfası ve auth API'yi atla
  if (request.nextUrl.pathname === '/login' || request.nextUrl.pathname.startsWith('/api/auth')) {
    return NextResponse.next()
  }

  // Cookie yoksa veya yanlışsa login'e yönlendir
  if (!auth || auth.value !== sifre) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
