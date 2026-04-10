'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { C } from '../lib/theme'

export default function Login() {
  const [email,      setEmail]      = useState('')
  const [sifre,      setSifre]      = useState('')
  const [hata,       setHata]       = useState('')
  const [yukleniyor, setYukleniyor] = useState(false)
  const router = useRouter()

  async function girisYap(e: React.FormEvent) {
    e.preventDefault()
    setYukleniyor(true)
    setHata('')

    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, sifre }),
    })

    if (res.ok) {
      router.push('/')
      router.refresh()
    } else {
      const data = await res.json()
      setHata(data.error || 'Giriş başarısız.')
      setYukleniyor(false)
    }
  }

  return (
    <div style={{
      background: C.bg, minHeight: '100vh', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    }}>
      <div style={{ width: '380px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '2.8rem', marginBottom: '14px' }}>📊</div>
          <h1 style={{ color: C.text, fontSize: '1.3rem', fontWeight: 700, margin: 0 }}>Reklam Paneli</h1>
          <p style={{ color: C.muted, fontSize: '0.85rem', marginTop: '6px' }}>Karmen Halı & Cotto Home</p>
        </div>

        <form onSubmit={girisYap} style={{
          background: C.card, border: `1px solid ${C.border}`,
          borderRadius: '14px', padding: '28px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.07)'
        }}>
          {/* E-posta */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', color: C.muted, fontSize: '0.82rem', fontWeight: 500, marginBottom: '6px' }}>
              E-posta
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="ad@ornek.com"
              autoFocus
              style={{
                width: '100%', background: C.input,
                border: `1px solid ${hata ? '#DC2626' : C.border}`,
                borderRadius: '8px', color: C.text, padding: '10px 14px',
                fontSize: '0.92rem', boxSizing: 'border-box', outline: 'none',
              }}
            />
          </div>

          {/* Şifre */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', color: C.muted, fontSize: '0.82rem', fontWeight: 500, marginBottom: '6px' }}>
              Şifre
            </label>
            <input
              type="password"
              value={sifre}
              onChange={e => setSifre(e.target.value)}
              placeholder="••••••••"
              style={{
                width: '100%', background: C.input,
                border: `1px solid ${hata ? '#DC2626' : C.border}`,
                borderRadius: '8px', color: C.text, padding: '10px 14px',
                fontSize: '0.92rem', boxSizing: 'border-box', outline: 'none',
              }}
            />
          </div>

          {hata && (
            <div style={{
              background: '#FEF2F2', border: '1px solid #FECACA',
              borderRadius: '7px', padding: '9px 14px',
              color: '#DC2626', fontSize: '0.8rem', marginBottom: '16px'
            }}>
              ❌ {hata}
            </div>
          )}

          <button type="submit" disabled={yukleniyor || !email || !sifre} style={{
            width: '100%', padding: '11px',
            background: (email && sifre) ? C.primary : C.borderLight,
            color: (email && sifre) ? '#fff' : C.faint,
            border: 'none', borderRadius: '8px',
            fontSize: '0.9rem', fontWeight: 600,
            cursor: (email && sifre) ? 'pointer' : 'default',
            transition: 'all 0.15s'
          }}>
            {yukleniyor ? '⏳ Giriş yapılıyor...' : 'Giriş Yap'}
          </button>
        </form>

        <p style={{ textAlign: 'center', color: C.faint, fontSize: '0.75rem', marginTop: '20px' }}>
          Sorun için: ismailacar.c@gmail.com
        </p>
      </div>
    </div>
  )
}
