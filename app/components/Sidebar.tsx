'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { C } from '../lib/theme'

const NAV = [
  { href: '/', icon: '🏠', ad: 'Ana Dashboard', aktif: true },
  { tip: 'divider', label: 'Reklam Platformları' },
  { href: '/meta', icon: '📘', ad: 'Meta Ads', aktif: true },
  { href: '/google-ads', icon: '🟡', ad: 'Google Ads', aktif: true },
  { tip: 'divider', label: 'Organik & Pazar' },
  { href: '/analytics', icon: '📈', ad: 'Google Analytics', aktif: true },
  { href: '/search-console', icon: '🔍', ad: 'Search Console', aktif: true },
  { href: '/trendyol', icon: '🟠', ad: 'Trendyol', aktif: false },
  { href: '/ticimax-seo', icon: '🛒', ad: 'Ticimax SEO', aktif: true },
  { tip: 'divider', label: 'Araçlar' },
  { href: '/ai-analiz', icon: '🤖', ad: 'AI Merkezi', aktif: true },
  { href: '/kampanya-planlama', icon: '🗓️', ad: 'Kampanya Planlama', aktif: true },
  { href: '/optimizasyon', icon: '⚡', ad: 'Optimizasyon', aktif: true },
  { href: '/kreatif-performans', icon: '🎨', ad: 'Kreatif Performans', aktif: true },
  { tip: 'divider', label: 'Sistem' },
  { href: '/admin', icon: '⚙️', ad: 'Admin Paneli', aktif: true },
]

export const MODELLER = [
  { id: 'claude-haiku-4-5-20251001', ad: 'Haiku 4.5', aciklama: 'Hızlı', icon: '⚡' },
  { id: 'claude-sonnet-4-6', ad: 'Sonnet 4.6', aciklama: 'Önerilen', icon: '✨' },
  { id: 'claude-opus-4-6', ad: 'Opus 4.6', aciklama: 'Güçlü', icon: '🔥' },
]

export const VARSAYILAN_MODEL = 'claude-sonnet-4-6'

export function globalModelOku(): string {
  if (typeof window === 'undefined') return VARSAYILAN_MODEL
  return localStorage.getItem('global_ai_model') || VARSAYILAN_MODEL
}

export function globalModelYaz(modelId: string) {
  localStorage.setItem('global_ai_model', modelId)
  window.dispatchEvent(new CustomEvent('modelDegisti', { detail: modelId }))
}

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [aktifModel, setAktifModel] = useState(VARSAYILAN_MODEL)
  const [modelAcik, setModelAcik] = useState(false)

  useEffect(() => {
    setAktifModel(globalModelOku())
    function onModel(e: Event) {
      setAktifModel((e as CustomEvent).detail)
    }
    window.addEventListener('modelDegisti', onModel)
    return () => window.removeEventListener('modelDegisti', onModel)
  }, [])

  function modelSec(id: string) {
    setAktifModel(id)
    globalModelYaz(id)
    setModelAcik(false)
  }

  async function cikisYap() {
    await fetch('/api/auth', { method: 'DELETE' })
    router.push('/login')
  }

  const secilenModel = MODELLER.find(m => m.id === aktifModel) || MODELLER[1]

  return (
    <div style={{
      width: '220px', flexShrink: 0,
      background: C.card, borderRight: `1px solid ${C.border}`,
      display: 'flex', flexDirection: 'column',
      position: 'fixed', top: 0, left: 0, height: '100vh',
      zIndex: 100, boxShadow: '1px 0 4px rgba(0,0,0,0.04)'
    }}>

      {/* Logo */}
      <div style={{ padding: '18px 16px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '34px', height: '34px', background: C.primary, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>
            📊
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.88rem', color: C.primary }}>Reklam Paneli</div>
            <div style={{ fontSize: '0.63rem', color: C.faint, marginTop: '1px' }}>Karmen & Cotto Home</div>
          </div>
        </div>
      </div>

      {/* Navigasyon */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '10px 8px' }}>
        {NAV.map((item, i) => {
          if ('tip' in item) {
            return (
              <div key={i} style={{ padding: '12px 10px 4px', fontSize: '0.6rem', color: C.faint, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
                {item.label}
              </div>
            )
          }

          const isActive = item.href === '/'
            ? pathname === '/'
            : pathname === item.href || pathname.startsWith(item.href + '/')

          if (!item.aktif) {
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '8px', marginBottom: '2px', opacity: 0.45, cursor: 'not-allowed' }}>
                <span style={{ fontSize: '1rem', width: '20px', textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
                <span style={{ fontSize: '0.82rem', color: C.muted, flex: 1 }}>{item.ad}</span>
                <span style={{ fontSize: '0.58rem', color: C.faint, background: C.borderLight, padding: '1px 5px', borderRadius: '3px', whiteSpace: 'nowrap' }}>Yakında</span>
              </div>
            )
          }

          return (
            <Link key={i} href={item.href!} style={{ textDecoration: 'none', display: 'block', marginBottom: '2px' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '8px 10px', borderRadius: '8px',
                background: isActive ? C.primary + '12' : 'transparent',
                border: `1px solid ${isActive ? C.primary + '25' : 'transparent'}`,
                transition: 'all 0.15s', cursor: 'pointer'
              }}
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = C.bg }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
              >
                <span style={{ fontSize: '1rem', width: '20px', textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
                <span style={{ fontSize: '0.82rem', fontWeight: isActive ? 600 : 400, color: isActive ? C.primary : C.text, flex: 1 }}>{item.ad}</span>
                {isActive && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: C.primary, flexShrink: 0 }} />}
              </div>
            </Link>
          )
        })}
      </nav>

      {/* Global Model Seçici */}
      <div style={{ padding: '10px 12px', borderTop: `1px solid ${C.border}`, position: 'relative' }}>
        <div style={{ fontSize: '0.58rem', color: C.faint, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: '6px' }}>AI Modeli</div>
        <button onClick={() => setModelAcik(!modelAcik)} style={{
          width: '100%', padding: '7px 10px', borderRadius: '8px',
          background: C.bg, border: `1px solid ${C.border}`,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px',
          transition: 'all 0.15s'
        }}
          onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.borderColor = C.primary + '60'}
          onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.borderColor = C.border}
        >
          <span style={{ fontSize: '0.85rem' }}>{secilenModel.icon}</span>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: C.text }}>{secilenModel.ad}</div>
            <div style={{ fontSize: '0.6rem', color: C.faint }}>{secilenModel.aciklama}</div>
          </div>
          <span style={{ fontSize: '0.65rem', color: C.faint }}>{modelAcik ? '▲' : '▼'}</span>
        </button>

        {modelAcik && (
          <div style={{
            position: 'absolute', bottom: '100%', left: '12px', right: '12px',
            background: C.card, border: `1px solid ${C.border}`, borderRadius: '10px',
            boxShadow: '0 -4px 16px rgba(0,0,0,0.1)', overflow: 'hidden', marginBottom: '4px'
          }}>
            {MODELLER.map(m => (
              <button key={m.id} onClick={() => modelSec(m.id)} style={{
                width: '100%', padding: '9px 12px', background: aktifModel === m.id ? C.primary + '10' : 'transparent',
                border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                borderBottom: `1px solid ${C.borderLight}`, transition: 'background 0.1s'
              }}
                onMouseEnter={e => { if (aktifModel !== m.id) (e.currentTarget as HTMLButtonElement).style.background = C.bg }}
                onMouseLeave={e => { if (aktifModel !== m.id) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
              >
                <span style={{ fontSize: '0.9rem' }}>{m.icon}</span>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: aktifModel === m.id ? C.primary : C.text }}>{m.ad}</div>
                  <div style={{ fontSize: '0.63rem', color: C.faint }}>{m.aciklama}</div>
                </div>
                {aktifModel === m.id && <span style={{ fontSize: '0.7rem', color: C.primary }}>✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Çıkış */}
      <div style={{ padding: '8px 12px 12px' }}>
        <button onClick={cikisYap} style={{
          width: '100%', padding: '8px 10px', borderRadius: '8px',
          background: 'transparent', border: `1px solid ${C.border}`,
          color: C.muted, cursor: 'pointer', fontSize: '0.78rem',
          display: 'flex', alignItems: 'center', gap: '8px',
          transition: 'all 0.15s'
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#FEF2F2'; (e.currentTarget as HTMLButtonElement).style.color = '#DC2626'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#FECACA' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = C.muted; (e.currentTarget as HTMLButtonElement).style.borderColor = C.border }}
        >
          <span>🚪</span> Çıkış Yap
        </button>
      </div>
    </div>
  )
}
