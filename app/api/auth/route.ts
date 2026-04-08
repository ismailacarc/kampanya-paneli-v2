import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { sifre } = await request.json()

  if (sifre !== process.env.PANEL_SIFRE) {
    return NextResponse.json({ error: 'Hatalı şifre' }, { status: 401 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set('panel_auth', process.env.PANEL_SIFRE!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7, // 7 gün
    path: '/',
    sameSite: 'lax',
  })

  return response
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  response.cookies.delete('panel_auth')
  return response
}
