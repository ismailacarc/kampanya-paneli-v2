import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { sessionDogrula, COOKIE_ADI } from '@/lib/session'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Statik dosyalar ve API'leri atla
  if (
    pathname === '/login' ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/')
  ) {
    return NextResponse.next()
  }

  const token = request.cookies.get(COOKIE_ADI)?.value
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const session = await sessionDogrula(token)
  if (!session) {
    const response = NextResponse.redirect(new URL('/login', request.url))
    response.cookies.delete(COOKIE_ADI)
    return response
  }

  // Admin paneline sadece adminler girebilir
  if (pathname.startsWith('/admin') && session.rol !== 'admin') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Sayfa yetki kontrolü
  const sayfaMap: Record<string, keyof typeof session.yetkiler.sayfalar> = {
    '/meta':            'meta',
    '/google-ads':      'google_ads',
    '/analytics':       'analytics',
    '/search-console':  'search_console',
    '/ticimax-seo':     'ticimax_seo',
    '/ai-analiz':       'ai_merkezi',
  }
  const sayfaYetki = Object.entries(sayfaMap).find(([path]) => pathname.startsWith(path))
  if (sayfaYetki) {
    const [, alan] = sayfaYetki
    if (!session.yetkiler.sayfalar[alan]) {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
