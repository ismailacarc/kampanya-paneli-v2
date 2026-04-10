// ─── JWT session yönetimi (jose — Edge Runtime uyumlu) ────────────────────────
import { SignJWT, jwtVerify } from 'jose'
import type { Yetkiler } from './userStore'

const SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET || 'gelistirme-icin-gizli-anahtar-bunu-env-e-ekle'
)

const SURE = 60 * 60 * 24 * 7 // 7 gün (saniye)

export interface SessionPayload {
  userId: string
  ad: string
  email: string
  rol: 'admin' | 'kullanici'
  yetkiler: Yetkiler
}

export async function sessionOlustur(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SURE}s`)
    .sign(SECRET)
}

export async function sessionDogrula(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET)
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}

export const COOKIE_ADI = 'panel_session'
export const COOKIE_AYARLAR = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  maxAge: SURE,
  path: '/' as const,
  sameSite: 'lax' as const,
}
