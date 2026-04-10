// ─── Kullanıcı deposu ─────────────────────────────────────────────────────────
// Şu an: JSON dosyası (local)
// Vercel KV'ye geçişte: sadece bu dosyadaki fonksiyonlar değişir,
// başka hiçbir dosyaya dokunulmaz.

import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const DOSYA = join(process.cwd(), 'data', 'users.json')

export interface Yetkiler {
  sayfalar: {
    meta: boolean
    google_ads: boolean
    analytics: boolean
    search_console: boolean
    ticimax_seo: boolean
    ai_merkezi: boolean
  }
  markalar: {
    karmen: boolean
    cotto: boolean
  }
  ciro_goster: boolean
  harcama_goster: boolean
  roas_goster: boolean
  ai_uret: boolean
  blog_yaz: boolean
  admin_panel: boolean
}

export interface Kullanici {
  id: string
  ad: string
  email: string
  passwordHash: string
  rol: 'admin' | 'kullanici'
  aktif: boolean
  olusturuldu: string
  yetkiler: Yetkiler
}

export const VARSAYILAN_YETKILER: Yetkiler = {
  sayfalar: {
    meta: true,
    google_ads: true,
    analytics: true,
    search_console: false,
    ticimax_seo: false,
    ai_merkezi: false,
  },
  markalar: { karmen: true, cotto: true },
  ciro_goster: false,
  harcama_goster: false,
  roas_goster: true,
  ai_uret: false,
  blog_yaz: false,
  admin_panel: false,
}

function oku(): Kullanici[] {
  try {
    const raw = readFileSync(DOSYA, 'utf-8')
    return JSON.parse(raw).users as Kullanici[]
  } catch {
    return []
  }
}

function yaz(users: Kullanici[]) {
  writeFileSync(DOSYA, JSON.stringify({ users }, null, 2), 'utf-8')
}

export function tumKullanicilar(): Kullanici[] {
  return oku()
}

export function emailIleGetir(email: string): Kullanici | null {
  return oku().find(u => u.email.toLowerCase() === email.toLowerCase()) ?? null
}

export function idIleGetir(id: string): Kullanici | null {
  return oku().find(u => u.id === id) ?? null
}

export function kullaniciEkle(yeni: Omit<Kullanici, 'id' | 'olusturuldu'>): Kullanici {
  const users = oku()
  const id = String(Date.now())
  const kullanici: Kullanici = { ...yeni, id, olusturuldu: new Date().toISOString().split('T')[0] }
  yaz([...users, kullanici])
  return kullanici
}

export function kullaniciGuncelle(id: string, guncelleme: Partial<Omit<Kullanici, 'id'>>): boolean {
  const users = oku()
  const idx = users.findIndex(u => u.id === id)
  if (idx === -1) return false
  users[idx] = { ...users[idx], ...guncelleme }
  yaz(users)
  return true
}

export function kullaniciSil(id: string): boolean {
  const users = oku()
  const yeni = users.filter(u => u.id !== id)
  if (yeni.length === users.length) return false
  yaz(yeni)
  return true
}
