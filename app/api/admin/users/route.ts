import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import { sessionDogrula, COOKIE_ADI } from '@/lib/session'
import { tumKullanicilar, kullaniciEkle, kullaniciGuncelle, kullaniciSil, VARSAYILAN_YETKILER } from '@/lib/userStore'

async function adminKontrol() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_ADI)?.value
  if (!token) return null
  const session = await sessionDogrula(token)
  if (!session || session.rol !== 'admin') return null
  return session
}

// GET — Tüm kullanıcıları listele
export async function GET() {
  const session = await adminKontrol()
  if (!session) return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })

  const users = tumKullanicilar().map(u => ({
    id: u.id, ad: u.ad, email: u.email,
    rol: u.rol, aktif: u.aktif, olusturuldu: u.olusturuldu,
    yetkiler: u.yetkiler,
  }))
  return NextResponse.json({ users })
}

// POST — Yeni kullanıcı ekle
export async function POST(request: Request) {
  const session = await adminKontrol()
  if (!session) return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })

  const { ad, email, sifre, rol = 'kullanici', yetkiler } = await request.json()
  if (!ad || !email || !sifre) {
    return NextResponse.json({ error: 'Ad, e-posta ve şifre zorunludur' }, { status: 400 })
  }

  const passwordHash = await bcrypt.hash(sifre, 10)
  const yeni = kullaniciEkle({
    ad, email, passwordHash,
    rol: rol as 'admin' | 'kullanici',
    aktif: true,
    yetkiler: yetkiler || VARSAYILAN_YETKILER,
  })

  return NextResponse.json({ ok: true, id: yeni.id })
}

// PATCH — Kullanıcı güncelle (izinler, şifre, aktif)
export async function PATCH(request: Request) {
  const session = await adminKontrol()
  if (!session) return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })

  const { id, sifre, ...guncelleme } = await request.json()
  if (!id) return NextResponse.json({ error: 'id zorunludur' }, { status: 400 })

  if (sifre) {
    guncelleme.passwordHash = await bcrypt.hash(sifre, 10)
  }

  const basarili = kullaniciGuncelle(id, guncelleme)
  if (!basarili) return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

// DELETE — Kullanıcı sil
export async function DELETE(request: Request) {
  const session = await adminKontrol()
  if (!session) return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })

  const { id } = await request.json()
  if (id === session.userId) {
    return NextResponse.json({ error: 'Kendinizi silemezsiniz' }, { status: 400 })
  }

  const basarili = kullaniciSil(id)
  if (!basarili) return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
