import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { emailIleGetir } from '@/lib/userStore'
import { sessionOlustur, COOKIE_ADI, COOKIE_AYARLAR } from '@/lib/session'

// POST /api/auth — Giriş
export async function POST(request: Request) {
  try {
    const { email, sifre } = await request.json()

    if (!email || !sifre) {
      return NextResponse.json({ error: 'E-posta ve şifre zorunludur' }, { status: 400 })
    }

    const kullanici = emailIleGetir(email)
    if (!kullanici || !kullanici.aktif) {
      return NextResponse.json({ error: 'E-posta veya şifre hatalı' }, { status: 401 })
    }

    const eslesme = await bcrypt.compare(sifre, kullanici.passwordHash)
    if (!eslesme) {
      return NextResponse.json({ error: 'E-posta veya şifre hatalı' }, { status: 401 })
    }

    const token = await sessionOlustur({
      userId:   kullanici.id,
      ad:       kullanici.ad,
      email:    kullanici.email,
      rol:      kullanici.rol,
      yetkiler: kullanici.yetkiler,
    })

    const response = NextResponse.json({ ok: true, ad: kullanici.ad, rol: kullanici.rol })
    response.cookies.set(COOKIE_ADI, token, COOKIE_AYARLAR)
    return response

  } catch (e) {
    console.error('Auth hatası:', e)
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 })
  }
}

// DELETE /api/auth — Çıkış
export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  response.cookies.delete(COOKIE_ADI)
  return response
}
