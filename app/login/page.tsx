'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function Login() {
  const [sifre, setSifre] = useState('')
  const [hata, setHata] = useState('')
  const [yukleniyor, setYukleniyor] = useState(false)
  const router = useRouter()

  async function girisYap(e: React.FormEvent) {
    e.preventDefault()
    setYukleniyor(true)
    setHata('')

    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sifre }),
    })

    if (res.ok) {
      router.push('/')
      router.refresh()
    } else {
      setHata('Hatalı şifre. Tekrar deneyin.')
      setYukleniyor(false)
    }
  }

  return (
    <div style={{
      background: '#0d1117', minHeight: '100vh', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    }}>
      <div style={{ width: '360px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>📊</div>
          <h1 style={{ color: '#e6edf3', fontSize: '1.3rem', fontWeight: 700, margin: 0 }}>Reklam Paneli</h1>
          <p style={{ color: '#8b949e', fontSize: '0.85rem', marginTop: '6px' }}>Karmen Halı & Cotto Home</p>
        </div>

        <form onSubmit={girisYap} style={{
          background: '#161b22', border: '1px solid #30363d',
          borderRadius: '12px', padding: '28px'
        }}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', color: '#8b949e', fontSize: '0.82rem', marginBottom: '8px' }}>
              Panel Şifresi
            </label>
            <input
              type="password"
              value={sifre}
              onChange={e => setSifre(e.target.value)}
              placeholder="••••••••"
              autoFocus
              style={{
                width: '100%', background: '#0d1117', border: `1px solid ${hata ? '#f85149' : '#30363d'}`,
                borderRadius: '6px', color: '#e6edf3', padding: '10px 14px',
                fontSize: '0.95rem', boxSizing: 'border-box', outline: 'none'
              }}
            />
          </div>

          {hata && (
            <div style={{ background: '#3a1a1a', border: '1px solid #f85149', borderRadius: '6px', padding: '8px 12px', color: '#f85149', fontSize: '0.8rem', marginBottom: '16px' }}>
              {hata}
            </div>
          )}

          <button type="submit" disabled={yukleniyor || !sifre} style={{
            width: '100%', padding: '10px', background: sifre ? '#1f6feb' : '#21262d',
            color: sifre ? '#fff' : '#484f58', border: 'none', borderRadius: '6px',
            fontSize: '0.9rem', fontWeight: 600, cursor: sifre ? 'pointer' : 'default',
            transition: 'all 0.15s'
          }}>
            {yukleniyor ? 'Giriş yapılıyor...' : 'Giriş Yap'}
          </button>
        </form>

        <p style={{ textAlign: 'center', color: '#484f58', fontSize: '0.75rem', marginTop: '20px' }}>
          Şifreyi unutanlar için: ismailacar.c@gmail.com
        </p>
      </div>
    </div>
  )
}
