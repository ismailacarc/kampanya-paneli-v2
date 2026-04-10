import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { sessionDogrula, COOKIE_ADI } from '@/lib/session'

// GET /api/auth/me — Oturumdaki kullanıcı bilgisi
export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_ADI)?.value
  if (!token) return NextResponse.json({ error: 'Oturum yok' }, { status: 401 })

  const session = await sessionDogrula(token)
  if (!session) return NextResponse.json({ error: 'Geçersiz oturum' }, { status: 401 })

  return NextResponse.json({
    userId:   session.userId,
    ad:       session.ad,
    email:    session.email,
    rol:      session.rol,
    yetkiler: session.yetkiler,
  })
}
