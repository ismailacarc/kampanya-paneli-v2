'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Sidebar from './components/Sidebar'
import { C, SHADOW, KPI, METRIK_RENK } from './lib/theme'
import { para, roasRenk } from './lib/helpers'

// ─── Tipler ───────────────────────────────────────────────────────────────────
interface MarkaOzet {
  metaHarcama: number
  googleHarcama: number
  metaGelirGA4: number
  googleGelirGA4: number
  organikGelirGA4: number
  toplamGelirGA4: number
  metaSatis: number
  googleSatis: number
  toplamSatis: number
  sessions: number
  donusumOrani: number
}

// ─── Sabitler ─────────────────────────────────────────────────────────────────
const PLATFORMS = [
  { id: 'meta',      ad: 'Meta Ads',        icon: '📘', renk: '#1877F2', aktif: true,  href: '/meta',        aciklama: 'Facebook & Instagram' },
  { id: 'google',    ad: 'Google Ads',       icon: '🟡', renk: '#F59E0B', aktif: true,  href: '/google-ads',  aciklama: 'Arama & Shopping' },
  { id: 'analytics', ad: 'Analytics',        icon: '📈', renk: '#E37400', aktif: true,  href: '/analytics',   aciklama: 'Trafik & dönüşümler' },
  { id: 'ticimax',   ad: 'Ticimax SEO',      icon: '🛒', renk: '#059669', aktif: true,  href: '/ticimax-seo', aciklama: 'Ürün & kategori SEO' },
  { id: 'search',    ad: 'Search Console',   icon: '🔍', renk: '#4285F4', aktif: true,  href: '/search-console', aciklama: 'Organik arama & sıralama' },
  { id: 'trendyol',  ad: 'Trendyol',         icon: '🟠', renk: '#F27A1A', aktif: false, href: '#',            aciklama: 'Mağaza performansı' },
]

const PRESETLER = [
  { id: '1',  ad: 'Bugün' },
  { id: '7',  ad: 'Son 7 Gün' },
  { id: '14', ad: 'Son 14 Gün' },
  { id: '30', ad: 'Son 30 Gün' },
  { id: '90', ad: 'Son 90 Gün' },
]

const META_KANALLAR    = ['Paid Social']
const GOOGLE_KANALLAR  = ['Paid Search', 'Paid Shopping', 'Cross-network']
const ORGANIK_KANALLAR = ['Organic Search', 'Organic Shopping', 'Direct', 'Referral']

// ─── Yardımcılar ──────────────────────────────────────────────────────────────
function ga4Tarihler(donem: string, baslangicOzel?: string, bitisOzel?: string) {
  if (donem === 'ozel' && baslangicOzel && bitisOzel) return { baslangic: baslangicOzel, bitis: bitisOzel }
  const gun   = parseInt(donem) || 30
  const bitis = new Date().toISOString().split('T')[0]
  const bas   = new Date(); bas.setDate(bas.getDate() - (gun - 1))
  return { baslangic: bas.toISOString().split('T')[0], bitis }
}

function yuzde(parca: number, toplam: number) {
  if (!toplam) return 0
  return Math.round((parca / toplam) * 100)
}

// ─── Ana Bileşen ──────────────────────────────────────────────────────────────
export default function AnaDashboard() {
  const [donem, setDonem]         = useState('30')
  const [baslangic, setBaslangic] = useState('')
  const [bitis, setBitis]         = useState('')
  const [karmen, setKarmen]       = useState<MarkaOzet | null>(null)
  const [cotto, setCotto]         = useState<MarkaOzet | null>(null)
  const [yukleniyor, setYukleniyor] = useState(true)
  const [ayarlar, setAyarlar] = useState({ ciro_duzeltme: 0, harcama_duzeltme: 0 })

  useEffect(() => {
    fetch('/api/admin/ayarlar')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setAyarlar(d) })
      .catch(() => {})
  }, [])

  async function markaVeriCek(hesap: string, donemStr: string, bas?: string, bit?: string): Promise<MarkaOzet> {
    const { baslangic: ga4Bas, bitis: ga4Bit } = ga4Tarihler(donemStr, bas, bit)
    const ga4Params = `hesap=${hesap}&baslangic=${ga4Bas}&bitis=${ga4Bit}`
    let metaUrl    = `/api/meta?hesap=${hesap}&tur=kampanyalar&donem=${donemStr}`
    let googleUrl  = `/api/google-ads?hesap=${hesap}&tur=kampanyalar&donem=${donemStr}`
    if (donemStr === 'ozel' && bas && bit) {
      metaUrl   += `&baslangic=${bas}&bitis=${bit}`
      googleUrl += `&baslangic=${bas}&bitis=${bit}`
    }
    const [metaRes, googleRes, ga4KanalRes, ga4GenelRes] = await Promise.allSettled([
      fetch(metaUrl).then(r => r.json()),
      fetch(googleUrl).then(r => r.json()),
      fetch(`/api/analytics?${ga4Params}&tur=kanallar`).then(r => r.json()),
      fetch(`/api/analytics?${ga4Params}&tur=genel`).then(r => r.json()),
    ])
    const metaKampanyalar  = metaRes.status   === 'fulfilled' ? (metaRes.value.data   || []) : []
    const googleKampanyalar = googleRes.status === 'fulfilled' ? (googleRes.value.data || []) : []
    const metaHarcama   = metaKampanyalar.reduce((a: number, k: { insights?: { data: { spend?: string }[] } }) => a + parseFloat(k.insights?.data[0]?.spend || '0'), 0)
    const googleHarcama = googleKampanyalar.reduce((a: number, k: { harcama: string }) => a + parseFloat(k.harcama || '0'), 0)
    const kanallar: { kanal: string; gelir: number; islem: number; sessions: number }[] =
      ga4KanalRes.status === 'fulfilled' ? (ga4KanalRes.value.data || []) : []
    const metaGelirGA4    = kanallar.filter(k => META_KANALLAR.includes(k.kanal)).reduce((s, k) => s + k.gelir, 0)
    const googleGelirGA4  = kanallar.filter(k => GOOGLE_KANALLAR.includes(k.kanal)).reduce((s, k) => s + k.gelir, 0)
    const organikGelirGA4 = kanallar.filter(k => ORGANIK_KANALLAR.includes(k.kanal)).reduce((s, k) => s + k.gelir, 0)
    const toplamGelirGA4  = kanallar.reduce((s, k) => s + k.gelir, 0)
    const metaSatis       = kanallar.filter(k => META_KANALLAR.includes(k.kanal)).reduce((s, k) => s + k.islem, 0)
    const googleSatis     = kanallar.filter(k => GOOGLE_KANALLAR.includes(k.kanal)).reduce((s, k) => s + k.islem, 0)
    const toplamSatis     = kanallar.reduce((s, k) => s + k.islem, 0)
    const g = ga4GenelRes.status === 'fulfilled' ? ga4GenelRes.value.data : null
    const sessions     = g?.sessions || 0
    const donusumOrani = g ? parseFloat((toplamSatis / Math.max(sessions, 1) * 100).toFixed(2)) : 0
    return { metaHarcama, googleHarcama, metaGelirGA4, googleGelirGA4, organikGelirGA4, toplamGelirGA4, metaSatis, googleSatis, toplamSatis, sessions, donusumOrani }
  }

  async function yukle(d: string, bas?: string, bit?: string) {
    setYukleniyor(true); setKarmen(null); setCotto(null)
    const [k, c] = await Promise.allSettled([markaVeriCek('karmen', d, bas, bit), markaVeriCek('cotto', d, bas, bit)])
    if (k.status === 'fulfilled') setKarmen(k.value)
    if (c.status === 'fulfilled') setCotto(c.value)
    setYukleniyor(false)
  }

  useEffect(() => { if (donem !== 'ozel') yukle(donem) }, [donem])

  const donemAdi = donem === 'ozel' && baslangic && bitis
    ? `${baslangic} — ${bitis}`
    : PRESETLER.find(p => p.id === donem)?.ad || 'Son 30 Gün'
  const bugun = new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const toplam = karmen && cotto ? {
    metaHarcama:     karmen.metaHarcama    + cotto.metaHarcama,
    googleHarcama:   karmen.googleHarcama  + cotto.googleHarcama,
    toplamGelirGA4:  karmen.toplamGelirGA4 + cotto.toplamGelirGA4,
    metaGelirGA4:    karmen.metaGelirGA4   + cotto.metaGelirGA4,
    googleGelirGA4:  karmen.googleGelirGA4 + cotto.googleGelirGA4,
    organikGelirGA4: karmen.organikGelirGA4 + cotto.organikGelirGA4,
    toplamSatis:     karmen.toplamSatis    + cotto.toplamSatis,
    sessions:        karmen.sessions       + cotto.sessions,
  } : null

  const toplamHarcama = toplam ? toplam.metaHarcama + toplam.googleHarcama : 0

  // Sunucu ayarlarından gelen sessiz düzeltmeler
  const dGelir    = toplam ? toplam.toplamGelirGA4 * (1 + ayarlar.ciro_duzeltme    / 100) : 0
  const dHarcama  = toplamHarcama                  * (1 + ayarlar.harcama_duzeltme / 100)
  const genelROAS = dHarcama > 0 && toplam ? dGelir / dHarcama : 0


  // ─── Marka skorkartı — Clean Light ───────────────────────────────────────────
  function MarkaKarti({ ozet, isim, aksanRenk, ikon }: { ozet: MarkaOzet | null; isim: string; aksanRenk: string; ikon: string }) {
    const toplamH  = (ozet?.metaHarcama || 0) + (ozet?.googleHarcama || 0)
    const genelR   = toplamH > 0 ? ((ozet?.toplamGelirGA4 || 0) / toplamH) : 0
    const metaR    = (ozet?.metaHarcama || 0) > 0 ? ((ozet?.metaGelirGA4 || 0) / (ozet?.metaHarcama || 1)) : 0
    const googleR  = (ozet?.googleHarcama || 0) > 0 ? ((ozet?.googleGelirGA4 || 0) / (ozet?.googleHarcama || 1)) : 0
    const maxGelir = Math.max(ozet?.metaGelirGA4 || 0, ozet?.googleGelirGA4 || 0, ozet?.organikGelirGA4 || 0, 1)

    const kanallar = [
      { etiket: 'Meta Ads',  gelir: ozet?.metaGelirGA4 || 0,    roas: metaR,   renk: '#1877F2' },
      { etiket: 'Google',    gelir: ozet?.googleGelirGA4 || 0,  roas: googleR, renk: '#F59E0B' },
      { etiket: 'Organik',   gelir: ozet?.organikGelirGA4 || 0, roas: null,    renk: '#10B981' },
    ]

    return (
      <div style={{ flex: 1, background: '#fff', border: `1px solid ${C.border}`, borderRadius: '12px', overflow: 'hidden', boxShadow: SHADOW.sm }}>
        {/* Üst aksan çizgisi */}
        <div style={{ height: '3px', background: aksanRenk }} />

        {/* Header */}
        <div style={{ padding: '20px 22px 16px', borderBottom: `1px solid ${C.borderLight}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '1rem' }}>{ikon}</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: C.muted, letterSpacing: '0.04em' }}>{isim.toUpperCase()}</span>
              </div>
              {yukleniyor ? (
                <div className="shimmer" style={{ height: '32px', width: '140px', marginBottom: '4px' }} />
              ) : (
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: C.text, letterSpacing: '-0.02em', lineHeight: 1 }}>
                  {ozet ? para(ozet.toplamGelirGA4) : '—'}
                </div>
              )}
              <div style={{ fontSize: '0.7rem', color: C.faint, marginTop: '4px' }}>GA4 toplam gelir</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.65rem', color: C.faint, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>ROAS</div>
              {yukleniyor ? (
                <div className="shimmer" style={{ height: '28px', width: '60px', marginLeft: 'auto' }} />
              ) : (
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: roasRenk(genelR), letterSpacing: '-0.02em' }}>
                  {ozet ? `${genelR.toFixed(2)}x` : '—'}
                </div>
              )}
              <div style={{ fontSize: '0.68rem', color: C.faint, marginTop: '2px' }}>
                {ozet ? `${para(toplamH)} harcama` : '—'}
              </div>
            </div>
          </div>
        </div>

        {/* Kanal satırları */}
        <div style={{ padding: '14px 22px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {kanallar.map(k => (
            <div key={k.etiket}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: k.renk, flexShrink: 0 }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 500, color: C.muted }}>{k.etiket}</span>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: C.text }}>{ozet ? para(k.gelir) : '—'}</span>
                  {k.roas !== null && ozet && (
                    <span style={{ fontSize: '0.68rem', fontWeight: 600, color: roasRenk(k.roas), background: C.bg, padding: '1px 7px', borderRadius: '6px', border: `1px solid ${C.border}` }}>
                      {k.roas.toFixed(2)}x
                    </span>
                  )}
                  <span style={{ fontSize: '0.68rem', color: C.faint, minWidth: '26px', textAlign: 'right' }}>
                    {ozet ? `%${yuzde(k.gelir, ozet.toplamGelirGA4)}` : ''}
                  </span>
                </div>
              </div>
              <div style={{ height: '4px', background: C.borderLight, borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: '2px', background: k.renk, width: ozet ? `${yuzde(k.gelir, maxGelir)}%` : '0%', transition: 'width 0.7s cubic-bezier(0.4,0,0.2,1)', opacity: 0.8 }} />
              </div>
            </div>
          ))}
        </div>

        {/* Alt istatistikler */}
        <div style={{ padding: '12px 22px 16px', borderTop: `1px solid ${C.borderLight}`, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
          {[
            { label: 'Satış',    value: ozet ? String(ozet.toplamSatis) : '—', renk: '#7C3AED' },
            { label: 'Oturum',   value: ozet ? ozet.sessions.toLocaleString('tr-TR') : '—', renk: C.text },
            { label: 'Dönüşüm', value: ozet ? `%${ozet.donusumOrani}` : '—', renk: '#2563EB' },
            { label: 'Meta Sat', value: ozet ? String(ozet.metaSatis) : '—', renk: '#1877F2' },
          ].map(m => (
            <div key={m.label}>
              <div style={{ fontSize: '0.6rem', color: C.faint, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>{m.label}</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: m.renk }}>{m.value}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const F = 'var(--font-inter), system-ui, sans-serif'

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg, fontFamily: F }}>
      <Sidebar />
      <div style={{ flex: 1, marginLeft: '220px' }}>

        {/* ── TOP BAR ── */}
        <header style={{ background: '#fff', borderBottom: `1px solid ${C.border}`, padding: '0 32px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50, boxShadow: SHADOW.xs }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: C.text, letterSpacing: '-0.01em' }}>Ana Dashboard</div>
            <div style={{ fontSize: '0.7rem', color: C.faint, marginTop: '1px' }}>{bugun}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
            {PRESETLER.map(p => (
              <button key={p.id} onClick={() => setDonem(p.id)} style={{
                padding: '5px 11px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '0.75rem',
                background: donem === p.id ? C.text : 'transparent',
                color: donem === p.id ? '#fff' : C.muted,
                fontWeight: donem === p.id ? 600 : 400, transition: 'all 0.15s', fontFamily: F,
              }}>{p.ad}</button>
            ))}
            <button onClick={() => setDonem('ozel')} style={{
              padding: '5px 11px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem',
              border: `1px solid ${donem === 'ozel' ? C.primary : C.border}`,
              background: donem === 'ozel' ? '#EFF6FF' : 'transparent',
              color: donem === 'ozel' ? C.primary : C.muted, fontWeight: donem === 'ozel' ? 600 : 400, fontFamily: F,
            }}>Özel tarih</button>
            <div style={{ width: '1px', height: '18px', background: C.border, margin: '0 10px' }} />
            <Link href="/ai-analiz" style={{ background: '#F5F3FF', border: '1px solid #DDD6FE', color: '#6D28D9', textDecoration: 'none', borderRadius: '7px', padding: '5px 14px', fontSize: '0.76rem', fontWeight: 600, fontFamily: F }}>
              AI Merkezi
            </Link>
          </div>
        </header>

        {/* ── ÖZEL TARİH ── */}
        {donem === 'ozel' && (
          <div style={{ background: '#F8FAFC', borderBottom: `1px solid ${C.border}`, padding: '10px 32px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.8rem', color: C.muted, fontWeight: 500 }}>Tarih aralığı:</span>
            <input type="date" value={baslangic} onChange={e => setBaslangic(e.target.value)} style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: '6px', color: C.text, padding: '5px 10px', fontSize: '0.8rem', fontFamily: F }} />
            <span style={{ color: C.faint }}>→</span>
            <input type="date" value={bitis} onChange={e => setBitis(e.target.value)} style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: '6px', color: C.text, padding: '5px 10px', fontSize: '0.8rem', fontFamily: F }} />
            <button onClick={() => { if (baslangic && bitis) yukle('ozel', baslangic, bitis) }} style={{ background: C.primary, color: '#fff', border: 'none', borderRadius: '6px', padding: '5px 16px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, fontFamily: F }}>Uygula</button>
          </div>
        )}

        <main style={{ padding: '32px' }}>

          {/* ── HERO KPI — Clean Left Border ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
            {[
              { label: 'Toplam Gelir',    sub: 'Tüm kanallar · Karmen + Cotto', value: toplam ? para(dGelir) : null,                              ...KPI.gelir },
              { label: 'Reklam Harcama', sub: 'Meta Ads + Google Ads',          value: toplam ? para(dHarcama) : null,                            ...KPI.harcama },
              { label: 'Genel ROAS',     sub: 'Ücretli kanallara göre',         value: toplam ? `${genelROAS.toFixed(2)}x` : null,                ...KPI.roas },
              { label: 'Toplam Satış',   sub: `${toplam ? toplam.sessions.toLocaleString('tr-TR') : '—'} oturum`,  value: toplam ? toplam.toplamSatis.toLocaleString('tr-TR') : null, ...KPI.satis },
            ].map(k => (
              <div key={k.label} style={{ background: '#fff', border: `1px solid ${C.border}`, borderLeft: `4px solid ${k.border}`, borderRadius: '10px', padding: '20px', boxShadow: SHADOW.sm }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>{k.label}</div>
                {yukleniyor ? (
                  <div className="shimmer" style={{ height: '36px', width: '80%', marginBottom: '8px' }} />
                ) : (
                  <div style={{ fontSize: '1.9rem', fontWeight: 800, color: k.text, letterSpacing: '-0.03em', lineHeight: 1, marginBottom: '6px' }}>
                    {k.value ?? '—'}
                  </div>
                )}
                <div style={{ fontSize: '0.7rem', color: C.faint }}>{k.sub}</div>
              </div>
            ))}
          </div>

          {/* ── MARKA KARTLARI ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            <MarkaKarti ozet={karmen} isim="Karmen Halı" aksanRenk="#C2410C" ikon="🟠" />
            <MarkaKarti ozet={cotto}  isim="Cotto Home"  aksanRenk="#1D4ED8" ikon="🔵" />
          </div>

          {/* ── KANAL DAĞILIMI ── */}
          {toplam && toplam.toplamGelirGA4 > 0 && (
            <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: '12px', padding: '24px', marginBottom: '24px', boxShadow: SHADOW.sm }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: C.text, letterSpacing: '-0.01em' }}>Gelir Kanal Dağılımı</div>
                  <div style={{ fontSize: '0.7rem', color: C.faint, marginTop: '3px' }}>Karmen + Cotto toplam · {donemAdi}</div>
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: KPI.gelir.text, letterSpacing: '-0.02em' }}>{para(toplam.toplamGelirGA4)}</div>
              </div>

              {/* Yığılmış bar */}
              <div style={{ display: 'flex', height: '8px', borderRadius: '4px', overflow: 'hidden', marginBottom: '20px', gap: '2px', background: C.borderLight }}>
                {[
                  { gelir: toplam.metaGelirGA4, renk: '#1877F2' },
                  { gelir: toplam.googleGelirGA4, renk: '#F59E0B' },
                  { gelir: toplam.organikGelirGA4, renk: '#10B981' },
                ].map((seg, i) => (
                  <div key={i} style={{ width: `${yuzde(seg.gelir, toplam.toplamGelirGA4)}%`, background: seg.renk, minWidth: seg.gelir > 0 ? '3px' : '0', transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)' }} />
                ))}
              </div>

              {/* Kanal cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                {[
                  { label: 'Meta Ads',         gelir: toplam.metaGelirGA4,    renk: '#1877F2', roas: `${(toplam.metaGelirGA4 / Math.max(toplam.metaHarcama, 1)).toFixed(2)}x` },
                  { label: 'Google Ads',        gelir: toplam.googleGelirGA4,  renk: '#F59E0B', roas: `${(toplam.googleGelirGA4 / Math.max(toplam.googleHarcama, 1)).toFixed(2)}x` },
                  { label: 'Organik & Direkt',  gelir: toplam.organikGelirGA4, renk: '#10B981', roas: null },
                ].map(k => (
                  <div key={k.label} style={{ background: C.bg, borderRadius: '8px', padding: '14px 16px', border: `1px solid ${C.border}`, borderTop: `3px solid ${k.renk}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: k.renk }} />
                        <span style={{ fontSize: '0.73rem', fontWeight: 600, color: C.muted }}>{k.label}</span>
                      </div>
                      {k.roas && <span style={{ fontSize: '0.68rem', fontWeight: 600, color: k.renk, background: '#fff', padding: '1px 7px', borderRadius: '5px', border: `1px solid ${C.border}` }}>ROAS {k.roas}</span>}
                    </div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: C.text, letterSpacing: '-0.02em' }}>{para(k.gelir)}</div>
                    <div style={{ fontSize: '0.68rem', color: C.faint, marginTop: '4px' }}>%{yuzde(k.gelir, toplam.toplamGelirGA4)} toplam gelir</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── PLATFORM NAV ── */}
          <div style={{ marginBottom: '8px' }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>Platformlar</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              {PLATFORMS.map(p => (
                p.aktif ? (
                  <Link key={p.id} href={p.href} style={{ textDecoration: 'none' }}>
                    <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: '12px', padding: '16px 18px', cursor: 'pointer', transition: 'all 0.15s', borderLeft: `4px solid ${p.renk}`, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
                      onMouseEnter={e => { const el = e.currentTarget as HTMLDivElement; el.style.boxShadow = '0 6px 16px rgba(0,0,0,0.1)'; el.style.transform = 'translateY(-2px)' }}
                      onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)'; el.style.transform = 'translateY(0)' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                          <span style={{ fontSize: '1.3rem' }}>{p.icon}</span>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.88rem', color: C.text }}>{p.ad}</div>
                            <div style={{ fontSize: '0.68rem', color: C.faint }}>{p.aciklama}</div>
                          </div>
                        </div>
                        <span style={{ background: '#DCFCE7', color: '#166534', fontSize: '0.6rem', fontWeight: 700, padding: '2px 8px', borderRadius: '10px' }}>● Aktif</span>
                      </div>
                      {/* Platform bazlı mini metrikler */}
                      {p.id === 'meta' && toplam && (
                        <div style={{ display: 'flex', gap: '14px', borderTop: `1px solid ${C.borderLight}`, paddingTop: '10px', marginTop: '4px' }}>
                          <div><div style={{ fontSize: '0.6rem', color: C.faint }}>Harcama</div><div style={{ fontSize: '0.85rem', fontWeight: 800, color: METRIK_RENK.harcama }}>{para(toplam.metaHarcama)}</div></div>
                          <div><div style={{ fontSize: '0.6rem', color: C.faint }}>Gelir</div><div style={{ fontSize: '0.85rem', fontWeight: 800, color: METRIK_RENK.gelir }}>{para(toplam.metaGelirGA4)}</div></div>
                          <div><div style={{ fontSize: '0.6rem', color: C.faint }}>ROAS</div><div style={{ fontSize: '0.85rem', fontWeight: 800, color: roasRenk(toplam.metaGelirGA4 / Math.max(toplam.metaHarcama, 1)) }}>{(toplam.metaGelirGA4 / Math.max(toplam.metaHarcama, 1)).toFixed(2)}x</div></div>
                        </div>
                      )}
                      {p.id === 'google' && toplam && (
                        <div style={{ display: 'flex', gap: '14px', borderTop: `1px solid ${C.borderLight}`, paddingTop: '10px', marginTop: '4px' }}>
                          <div><div style={{ fontSize: '0.6rem', color: C.faint }}>Harcama</div><div style={{ fontSize: '0.85rem', fontWeight: 800, color: METRIK_RENK.harcama }}>{para(toplam.googleHarcama)}</div></div>
                          <div><div style={{ fontSize: '0.6rem', color: C.faint }}>Gelir</div><div style={{ fontSize: '0.85rem', fontWeight: 800, color: METRIK_RENK.gelir }}>{para(toplam.googleGelirGA4)}</div></div>
                          <div><div style={{ fontSize: '0.6rem', color: C.faint }}>ROAS</div><div style={{ fontSize: '0.85rem', fontWeight: 800, color: roasRenk(toplam.googleGelirGA4 / Math.max(toplam.googleHarcama, 1)) }}>{(toplam.googleGelirGA4 / Math.max(toplam.googleHarcama, 1)).toFixed(2)}x</div></div>
                        </div>
                      )}
                      {p.id === 'analytics' && toplam && (
                        <div style={{ display: 'flex', gap: '14px', borderTop: `1px solid ${C.borderLight}`, paddingTop: '10px', marginTop: '4px' }}>
                          <div><div style={{ fontSize: '0.6rem', color: C.faint }}>Toplam Gelir</div><div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#15803d' }}>{para(toplam.toplamGelirGA4)}</div></div>
                          <div><div style={{ fontSize: '0.6rem', color: C.faint }}>Oturum</div><div style={{ fontSize: '0.85rem', fontWeight: 800, color: C.text }}>{toplam.sessions.toLocaleString('tr-TR')}</div></div>
                          <div><div style={{ fontSize: '0.6rem', color: C.faint }}>Satış</div><div style={{ fontSize: '0.85rem', fontWeight: 800, color: METRIK_RENK.donusum }}>{toplam.toplamSatis}</div></div>
                        </div>
                      )}
                      {p.id === 'ticimax' && (
                        <div style={{ borderTop: `1px solid ${C.borderLight}`, paddingTop: '10px', marginTop: '4px' }}>
                          <div style={{ fontSize: '0.7rem', color: '#059669', fontWeight: 600 }}>Ürün ve kategori SEO yönetimi →</div>
                        </div>
                      )}
                      {p.id === 'search' && (
                        <div style={{ borderTop: `1px solid ${C.borderLight}`, paddingTop: '10px', marginTop: '4px' }}>
                          <div style={{ fontSize: '0.7rem', color: p.renk, fontWeight: 600 }}>Tıklama, gösterim ve sıralama verilerini gör →</div>
                        </div>
                      )}
                      {!['meta','google','analytics','ticimax','search'].includes(p.id) && (
                        <div style={{ borderTop: `1px solid ${C.borderLight}`, paddingTop: '10px', marginTop: '4px' }}>
                          <div style={{ fontSize: '0.7rem', color: p.renk, fontWeight: 600 }}>Platforma git →</div>
                        </div>
                      )}
                    </div>
                  </Link>
                ) : (
                  <div key={p.id} style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: '12px', padding: '16px 18px', opacity: 0.5, borderLeft: `4px solid ${p.renk}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                        <span style={{ fontSize: '1.3rem' }}>{p.icon}</span>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.88rem', color: C.text }}>{p.ad}</div>
                          <div style={{ fontSize: '0.68rem', color: C.faint }}>{p.aciklama}</div>
                        </div>
                      </div>
                      <span style={{ background: C.borderLight, color: C.faint, fontSize: '0.6rem', fontWeight: 700, padding: '2px 8px', borderRadius: '10px' }}>Yakında</span>
                    </div>
                  </div>
                )
              ))}
            </div>
          </div>

        </main>
      </div>

      {/* shimmer animation */}
      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
    </div>
  )
}
