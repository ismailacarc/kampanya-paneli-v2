import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { sessionDogrula, COOKIE_ADI } from '@/lib/session'

const DOSYA = join(process.cwd(), 'data', 'ayarlar.json')

function oku() {
  try { return JSON.parse(readFileSync(DOSYA, 'utf-8')) }
  catch { return { ciro_duzeltme: 0, harcama_duzeltme: 0, guncellendi: null } }
}

// GET — tüm oturum açmış kullanıcılar okuyabilir
export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_ADI)?.value
  if (!token || !await sessionDogrula(token)) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })
  }
  return NextResponse.json(oku())
}

// POST — sadece admin yazabilir
export async function POST(request: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_ADI)?.value
  if (!token) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })
  const session = await sessionDogrula(token)
  if (!session || session.rol !== 'admin') {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })
  }

  const { ciro_duzeltme, harcama_duzeltme } = await request.json()
  const ayarlar = {
    ciro_duzeltme:    Number(ciro_duzeltme)    || 0,
    harcama_duzeltme: Number(harcama_duzeltme) || 0,
    guncellendi: new Date().toLocaleString('tr-TR'),
  }
  writeFileSync(DOSYA, JSON.stringify(ayarlar, null, 2), 'utf-8')
  return NextResponse.json({ ok: true })
}
