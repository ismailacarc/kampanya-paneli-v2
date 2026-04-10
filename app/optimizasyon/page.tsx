'use client'

import { useState, useEffect, useCallback } from 'react'
import Sidebar from '../components/Sidebar'
import { globalModelOku, MODELLER } from '../components/Sidebar'
import { C } from '../lib/theme'
import { HESAPLAR, PRESETLER } from '../lib/types'
import { para, sayi, getDonusum, getGelir, roasRenk } from '../lib/helpers'

// ─── Tipler ──────────────────────────────────────────────────────
interface OneriKart {
  tip: 'artir' | 'azalt' | 'kapat' | 'kreatif' | 'uyari' | 'firsat' | 'negatif' | 'teklif' | 'butce_kaydir'
  baslik: string
  aciklama: string
  kampanya?: string
  oncelik: 'yuksek' | 'orta' | 'dusuk'
}

interface AnalizSonuc {
  ozet: string
  oneriler: OneriKart[]
  guclular: string[]
  zayiflar: string[]
  butceVerimliligi: string
  firsat: string
}

interface KayitliAnaliz {
  id: string
  tarih: string
  hesap: string
  donem: string
  model: string
  durum: 'bekliyor' | 'tamamlandi' | 'hata'
  hataMesaji?: string
  sonuc?: AnalizSonuc
  metrikler?: { harcama: number; donusum: number; gelir: number; roas: number }
  platform?: 'meta' | 'google'
}

// ─── Sabitler ────────────────────────────────────────────────────
const ONERI_RENK: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  artir:       { bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0', icon: '📈' },
  azalt:       { bg: '#FFFBEB', text: '#B45309', border: '#FDE68A', icon: '📉' },
  kapat:       { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA', icon: '🛑' },
  kreatif:     { bg: '#F5F3FF', text: '#7C3AED', border: '#DDD6FE', icon: '🎨' },
  uyari:       { bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA', icon: '⚠️' },
  firsat:      { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE', icon: '💡' },
  negatif:     { bg: '#F0FDF4', text: '#166534', border: '#BBF7D0', icon: '🚫' },
  teklif:      { bg: '#FDF4FF', text: '#7E22CE', border: '#E9D5FF', icon: '🎯' },
  butce_kaydir:{ bg: '#EFF6FF', text: '#1E40AF', border: '#BFDBFE', icon: '🔀' },
}

const ONCELIK: Record<string, { renk: string; label: string }> = {
  yuksek: { renk: '#DC2626', label: '🔴 Öncelikli' },
  orta:   { renk: '#D97706', label: '🟡 Orta' },
  dusuk:  { renk: '#6B7280', label: '⚪ Düşük' },
}

function gecmisOku(): KayitliAnaliz[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem('optimizasyon_gecmisi') || '[]') } catch { return [] }
}

function gecmisYaz(liste: KayitliAnaliz[]) {
  localStorage.setItem('optimizasyon_gecmisi', JSON.stringify(liste))
}

// ─── Ana Sayfa ────────────────────────────────────────────────────
export default function OptimizasyonPage() {
  const [hesap, setHesap] = useState('karmen')
  const [donem, setDonem] = useState('30')
  const [model, setModel] = useState(globalModelOku())
  const [platform, setPlatform] = useState<'meta' | 'google'>('meta')
  const [yukleniyor, setYukleniyor] = useState(false)
  const [hata, setHata] = useState('')
  const [aktifSonuc, setAktifSonuc] = useState<AnalizSonuc | null>(null)
  const [aktifMetrikler, setAktifMetrikler] = useState<KayitliAnaliz['metrikler'] | null>(null)
  const [aktifPlatform, setAktifPlatform] = useState<'meta' | 'google'>('meta')
  const [gecmis, setGecmis] = useState<KayitliAnaliz[]>([])
  const [gecmisAcik, setGecmisAcik] = useState(true)

  useEffect(() => {
    const kayitli = gecmisOku()
    setGecmis(kayitli)
    const sonTamamlanan = kayitli.find(k => k.durum === 'tamamlandi' && k.sonuc)
    if (sonTamamlanan?.sonuc) {
      setAktifSonuc(sonTamamlanan.sonuc)
      setAktifMetrikler(sonTamamlanan.metrikler || null)
      setAktifPlatform(sonTamamlanan.platform || 'meta')
    }

    function onModel() { setModel(globalModelOku()) }
    window.addEventListener('modelDegisti', onModel)

    function onStorage(e: StorageEvent) {
      if (e.key !== 'optimizasyon_gecmisi') return
      const guncellenmis: KayitliAnaliz[] = JSON.parse(e.newValue || '[]')
      setGecmis(guncellenmis)
      const yeniTamamlanan = guncellenmis.find(k =>
        k.durum === 'tamamlandi' && k.sonuc &&
        !gecmis.find(g => g.id === k.id && g.durum === 'tamamlandi')
      )
      if (yeniTamamlanan?.sonuc) {
        setAktifSonuc(yeniTamamlanan.sonuc)
        setAktifMetrikler(yeniTamamlanan.metrikler || null)
        setAktifPlatform(yeniTamamlanan.platform || 'meta')
        setYukleniyor(false)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('modelDegisti', onModel)
      window.removeEventListener('storage', onStorage)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const analiz = useCallback(async () => {
    setYukleniyor(true)
    setHata('')

    const analizId = Date.now().toString()
    const secilenModel = MODELLER.find(m => m.id === model) || MODELLER[1]
    const bekleyen: KayitliAnaliz = {
      id: analizId,
      tarih: new Date().toLocaleDateString('tr-TR') + ' ' + new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      hesap, donem, model: secilenModel.ad,
      durum: 'bekliyor',
      platform,
    }
    const mevcutGecmis = gecmisOku()
    const ilkGecmis = [bekleyen, ...mevcutGecmis].slice(0, 30)
    setGecmis(ilkGecmis)
    gecmisYaz(ilkGecmis)

    if (platform === 'meta') {
      // ── META AKIŞ ──
      let kampanyalar: Record<string, unknown>[] = []
      try {
        const r = await fetch(`/api/meta?hesap=${hesap}&tur=kampanyalar&donem=${donem}`)
        const d = await r.json()
        kampanyalar = d.data || []
      } catch { /* devam */ }

      if (kampanyalar.length === 0) {
        const guncel = gecmisOku().map(k => k.id === analizId
          ? { ...k, durum: 'hata' as const, hataMesaji: 'Bu dönem için kampanya verisi bulunamadı.' }
          : k
        )
        setGecmis(guncel); gecmisYaz(guncel)
        setHata('Bu dönem için kampanya verisi bulunamadı.')
        setYukleniyor(false)
        return
      }

      const toplamHarcama = kampanyalar.reduce((t, k) => t + parseFloat((k as { insights?: { data: { spend?: string }[] } }).insights?.data?.[0]?.spend || '0'), 0)
      const toplamDonusum = kampanyalar.reduce((t, k) => t + getDonusum((k as { insights?: { data: unknown[] } }).insights?.data?.[0] as Parameters<typeof getDonusum>[0]), 0)
      const toplamGelir   = kampanyalar.reduce((t, k) => t + getGelir((k as { insights?: { data: unknown[] } }).insights?.data?.[0] as Parameters<typeof getGelir>[0]), 0)
      const metrikler = { harcama: toplamHarcama, donusum: toplamDonusum, gelir: toplamGelir, roas: toplamHarcama > 0 ? toplamGelir / toplamHarcama : 0 }

      fetch('/api/optimizasyon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kampanyalar, hesap, donem, model })
      })
      .then(r => r.json())
      .then(data => {
        const guncel = gecmisOku().map(k => k.id === analizId
          ? { ...k, durum: data.error ? 'hata' as const : 'tamamlandi' as const, sonuc: data.sonuc, metrikler, hataMesaji: data.error }
          : k
        )
        gecmisYaz(guncel); setGecmis(guncel)
        if (!data.error && data.sonuc) { setAktifSonuc(data.sonuc); setAktifMetrikler(metrikler); setAktifPlatform('meta') }
        else setHata(data.error || 'Analiz üretilemedi')
        setYukleniyor(false)
      })
      .catch(e => {
        const guncel = gecmisOku().map(k => k.id === analizId ? { ...k, durum: 'hata' as const, hataMesaji: e.message } : k)
        gecmisYaz(guncel); setGecmis(guncel); setHata(e.message); setYukleniyor(false)
      })

    } else {
      // ── GOOGLE AKİŞ ──
      let kampanyalar: Record<string, unknown>[] = []
      try {
        const r = await fetch(`/api/google-ads?hesap=${hesap}&tur=kampanyalar&donem=${donem}`)
        const d = await r.json()
        kampanyalar = (d.data || []).filter((k: { durum: number }) => k.durum === 2 || k.durum === 3)
      } catch { /* devam */ }

      if (kampanyalar.length === 0) {
        const guncel = gecmisOku().map(k => k.id === analizId
          ? { ...k, durum: 'hata' as const, hataMesaji: 'Bu dönem için Google Ads kampanya verisi bulunamadı.' }
          : k
        )
        setGecmis(guncel); gecmisYaz(guncel)
        setHata('Bu dönem için Google Ads kampanya verisi bulunamadı.')
        setYukleniyor(false)
        return
      }

      const toplamHarcama = kampanyalar.reduce((t, k) => t + parseFloat((k as { harcama: string }).harcama || '0'), 0)
      const toplamDonusum = kampanyalar.reduce((t, k) => t + ((k as { donusum: number }).donusum || 0), 0)
      const toplamGelir   = kampanyalar.reduce((t, k) => t + parseFloat((k as { gelir: string }).gelir || '0'), 0)
      const metrikler = { harcama: toplamHarcama, donusum: toplamDonusum, gelir: toplamGelir, roas: toplamHarcama > 0 ? toplamGelir / toplamHarcama : 0 }

      fetch('/api/optimizasyon-google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kampanyalar, hesap, donem, model })
      })
      .then(r => r.json())
      .then(data => {
        const guncel = gecmisOku().map(k => k.id === analizId
          ? { ...k, durum: data.error ? 'hata' as const : 'tamamlandi' as const, sonuc: data.sonuc, metrikler, hataMesaji: data.error }
          : k
        )
        gecmisYaz(guncel); setGecmis(guncel)
        if (!data.error && data.sonuc) { setAktifSonuc(data.sonuc); setAktifMetrikler(metrikler); setAktifPlatform('google') }
        else setHata(data.error || 'Analiz üretilemedi')
        setYukleniyor(false)
      })
      .catch(e => {
        const guncel = gecmisOku().map(k => k.id === analizId ? { ...k, durum: 'hata' as const, hataMesaji: e.message } : k)
        gecmisYaz(guncel); setGecmis(guncel); setHata(e.message); setYukleniyor(false)
      })
    }
  }, [hesap, donem, model, platform])

  function analizYukle(a: KayitliAnaliz) {
    if (!a.sonuc) return
    setAktifSonuc(a.sonuc)
    setAktifMetrikler(a.metrikler || null)
    setAktifPlatform(a.platform || 'meta')
    setHesap(a.hesap)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function analizSil(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    const yeni = gecmis.filter(a => a.id !== id)
    setGecmis(yeni)
    gecmisYaz(yeni)
  }

  const secilenModel = MODELLER.find(m => m.id === model) || MODELLER[1]
  const hesapBilgi = HESAPLAR.find(h => h.id === hesap)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg }}>
      <Sidebar />
      <main style={{ marginLeft: '220px', flex: 1, padding: '24px', maxWidth: '1100px' }}>

        {/* Başlık */}
        <div style={{ marginBottom: '20px' }}>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: C.text, margin: 0 }}>⚡ Optimizasyon Merkezi</h1>
          <p style={{ fontSize: '0.82rem', color: C.muted, margin: '4px 0 0' }}>Hesabını seç, dönemi belirle — AI kampanyalarını analiz edip somut aksiyon önerileri sunsun.</p>
        </div>

        {/* Kontroller */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '16px 20px', marginBottom: '20px', display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>

          {/* Platform Toggle */}
          <div>
            <div style={{ fontSize: '0.68rem', color: C.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>Platform</div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => setPlatform('meta')} style={{
                padding: '7px 14px', borderRadius: '8px', cursor: 'pointer',
                border: `2px solid ${platform === 'meta' ? '#1877F2' : C.border}`,
                background: platform === 'meta' ? '#1877F215' : C.card,
                color: platform === 'meta' ? '#1877F2' : C.muted,
                fontSize: '0.78rem', fontWeight: 600
              }}>📘 Meta Ads</button>
              <button onClick={() => setPlatform('google')} style={{
                padding: '7px 14px', borderRadius: '8px', cursor: 'pointer',
                border: `2px solid ${platform === 'google' ? '#4285F4' : C.border}`,
                background: platform === 'google' ? '#4285F415' : C.card,
                color: platform === 'google' ? '#4285F4' : C.muted,
                fontSize: '0.78rem', fontWeight: 600
              }}>🔵 Google Ads</button>
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.68rem', color: C.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>Hesap</div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {HESAPLAR.map(h => (
                <button key={h.id} onClick={() => setHesap(h.id)} style={{
                  padding: '7px 14px', borderRadius: '8px', cursor: 'pointer',
                  border: `2px solid ${hesap === h.id ? h.renk : C.border}`,
                  background: hesap === h.id ? h.renk + '15' : C.card,
                  color: hesap === h.id ? h.renk : C.muted,
                  fontSize: '0.78rem', fontWeight: 600
                }}>{h.emoji} {h.ad}</button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.68rem', color: C.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>Dönem</div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {PRESETLER.filter(p => ['7', '14', '30', '90'].includes(p.id)).map(p => (
                <button key={p.id} onClick={() => setDonem(p.id)} style={{
                  padding: '7px 12px', borderRadius: '8px', cursor: 'pointer',
                  border: `2px solid ${donem === p.id ? C.primary : C.border}`,
                  background: donem === p.id ? C.primary + '10' : C.card,
                  color: donem === p.id ? C.primary : C.muted,
                  fontSize: '0.75rem', fontWeight: 600
                }}>{p.ad}</button>
              ))}
            </div>
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'flex-end', gap: '10px' }}>
            <div style={{ fontSize: '0.72rem', color: C.faint, paddingBottom: '8px' }}>
              {secilenModel.icon} {secilenModel.ad}
            </div>
            <button onClick={analiz} disabled={yukleniyor} style={{
              padding: '9px 24px', borderRadius: '10px',
              background: yukleniyor ? C.muted : platform === 'google' ? '#4285F4' : C.primary,
              color: '#fff', border: 'none',
              cursor: yukleniyor ? 'not-allowed' : 'pointer',
              fontSize: '0.88rem', fontWeight: 700
            }}>
              {yukleniyor ? '⏳ Analiz Ediliyor...' : '⚡ Analiz Et'}
            </button>
          </div>
        </div>

        {yukleniyor && (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '40px', textAlign: 'center', marginBottom: '20px' }}>
            <div style={{ fontSize: '1.8rem', marginBottom: '10px' }}>⚡</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: C.text, marginBottom: '4px' }}>Analiz ediliyor...</div>
            <div style={{ fontSize: '0.75rem', color: C.muted }}>{hesapBilgi?.ad} · {platform === 'google' ? 'Google Ads' : 'Meta Ads'} · Son {donem} gün · Sayfadan çıksan bile devam eder.</div>
          </div>
        )}

        {hata && (
          <div style={{ padding: '12px 16px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', fontSize: '0.82rem', color: '#DC2626', marginBottom: '16px' }}>{hata}</div>
        )}

        {/* ─── SONUÇ ─── */}
        {aktifSonuc && !yukleniyor && (
          <div style={{ marginBottom: '20px' }}>

            {/* Platform badge */}
            <div style={{ marginBottom: '12px' }}>
              {aktifPlatform === 'google'
                ? <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#4285F4', background: '#EBF3FE', border: '1px solid #BBDEFB', padding: '3px 10px', borderRadius: '10px' }}>🔵 Google Ads Analizi</span>
                : <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#1877F2', background: '#EBF2FF', border: '1px solid #BFDBFE', padding: '3px 10px', borderRadius: '10px' }}>📘 Meta Ads Analizi</span>
              }
            </div>

            {/* Metrikler */}
            {aktifMetrikler && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
                {[
                  { label: 'Toplam Harcama', val: para(aktifMetrikler.harcama), renk: '#DC2626' },
                  { label: 'Toplam Satış',   val: sayi(aktifMetrikler.donusum), renk: '#7C3AED' },
                  { label: 'Toplam Gelir',   val: para(aktifMetrikler.gelir),   renk: '#15803D' },
                  { label: 'Genel ROAS',     val: aktifMetrikler.roas > 0 ? `${aktifMetrikler.roas.toFixed(2)}x` : '—', renk: roasRenk(aktifMetrikler.roas) },
                ].map(({ label, val, renk }) => (
                  <div key={label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '14px 16px' }}>
                    <div style={{ fontSize: '0.65rem', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>{label}</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: renk }}>{val}</div>
                  </div>
                ))}
              </div>
            )}

            {/* AI Özet */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '18px 20px', marginBottom: '14px' }}>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: C.text, marginBottom: '10px' }}>🧠 AI Analizi</div>
              <p style={{ fontSize: '0.85rem', color: C.text, lineHeight: 1.7, margin: 0 }}>{aktifSonuc.ozet}</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '12px', padding: '16px 18px' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#15803D', marginBottom: '10px' }}>✅ İyi Giden</div>
                {aktifSonuc.guclular.map((g, i) => (
                  <div key={i} style={{ fontSize: '0.78rem', color: '#166534', marginBottom: '5px', display: 'flex', gap: '6px' }}><span>•</span><span>{g}</span></div>
                ))}
              </div>
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '12px', padding: '16px 18px' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#DC2626', marginBottom: '10px' }}>⚠️ Dikkat Edilmesi Gereken</div>
                {aktifSonuc.zayiflar.map((z, i) => (
                  <div key={i} style={{ fontSize: '0.78rem', color: '#991B1B', marginBottom: '5px', display: 'flex', gap: '6px' }}><span>•</span><span>{z}</span></div>
                ))}
              </div>
            </div>

            {aktifSonuc.butceVerimliligi && (
              <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '12px', padding: '14px 18px', marginBottom: '14px' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#B45309', marginBottom: '6px' }}>💰 Bütçe Verimliliği</div>
                <div style={{ fontSize: '0.82rem', color: '#92400E' }}>{aktifSonuc.butceVerimliligi}</div>
              </div>
            )}

            {/* Öneriler */}
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: C.text, marginBottom: '10px' }}>📋 Aksiyon Önerileri</div>

              {/* Google'a özel öneri tipi legend */}
              {aktifPlatform === 'google' && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                  {[
                    { tip: 'negatif', label: '🚫 Negatif Kelime' },
                    { tip: 'teklif', label: '🎯 Teklif Ayarı' },
                    { tip: 'butce_kaydir', label: '🔀 Bütçe Kaydır' },
                  ].map(({ tip, label }) => {
                    const r = ONERI_RENK[tip]
                    return (
                      <span key={tip} style={{ fontSize: '0.65rem', fontWeight: 600, color: r.text, background: r.bg, border: `1px solid ${r.border}`, padding: '2px 8px', borderRadius: '8px' }}>{label}</span>
                    )
                  })}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {aktifSonuc.oneriler.map((o, i) => {
                  const r = ONERI_RENK[o.tip] || ONERI_RENK.uyari
                  const on = ONCELIK[o.oncelik] || ONCELIK.dusuk
                  return (
                    <div key={i} style={{ background: r.bg, border: `1px solid ${r.border}`, borderRadius: '10px', padding: '13px 15px', display: 'flex', gap: '10px' }}>
                      <span style={{ fontSize: '1.1rem', flexShrink: 0, marginTop: '1px' }}>{r.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                          <span style={{ fontSize: '0.83rem', fontWeight: 700, color: r.text }}>{o.baslik}</span>
                          <span style={{ fontSize: '0.63rem', fontWeight: 700, color: on.renk, background: on.renk + '18', padding: '2px 7px', borderRadius: '10px', whiteSpace: 'nowrap', marginLeft: '8px' }}>{on.label}</span>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: r.text, opacity: 0.85, lineHeight: 1.55 }}>{o.aciklama}</div>
                        {o.kampanya && <div style={{ fontSize: '0.68rem', color: r.text, opacity: 0.6, marginTop: '4px' }}>Kampanya: {o.kampanya}</div>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {aktifSonuc.firsat && (
              <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '12px', padding: '14px 18px' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1D4ED8', marginBottom: '6px' }}>💡 Büyüme Fırsatı</div>
                <div style={{ fontSize: '0.82rem', color: '#1E40AF' }}>{aktifSonuc.firsat}</div>
              </div>
            )}
          </div>
        )}

        {!aktifSonuc && !yukleniyor && !hata && (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '60px', textAlign: 'center', color: C.faint, marginBottom: '20px' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>⚡</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: C.muted, marginBottom: '6px' }}>Optimizasyon Analizi</div>
            <div style={{ fontSize: '0.8rem' }}>Platform, hesap ve dönem seçip "Analiz Et" butonuna tıkla.</div>
          </div>
        )}

        {/* ─── GEÇMİŞ ─── */}
        {gecmis.length > 0 && (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', overflow: 'hidden' }}>
            <div onClick={() => setGecmisAcik(!gecmisAcik)}
              style={{ padding: '13px 18px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.bg }}>
              <span style={{ fontWeight: 600, fontSize: '0.85rem', color: C.text }}>📂 Analiz Geçmişi ({gecmis.length})</span>
              <span style={{ fontSize: '0.78rem', color: C.faint }}>{gecmisAcik ? '▲' : '▼'}</span>
            </div>

            {gecmisAcik && (
              <div style={{ borderTop: `1px solid ${C.border}` }}>
                {gecmis.map(a => {
                  const h = HESAPLAR.find(h => h.id === a.hesap)
                  const bekliyor = a.durum === 'bekliyor'
                  const hataVar = a.durum === 'hata'
                  const isGoogle = a.platform === 'google'
                  return (
                    <div key={a.id} onClick={() => analizYukle(a)}
                      style={{ padding: '11px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${C.borderLight}`, cursor: a.sonuc ? 'pointer' : 'default', opacity: bekliyor ? 0.7 : 1 }}
                      onMouseEnter={e => { if (a.sonuc) (e.currentTarget as HTMLDivElement).style.background = C.bg }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
                    >
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <span>{h?.emoji}</span>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: C.text }}>{h?.ad} · Son {a.donem} gün</span>
                            {/* Platform badge */}
                            {isGoogle
                              ? <span style={{ fontSize: '0.63rem', fontWeight: 700, color: '#4285F4', background: '#EBF3FE', border: '1px solid #BBDEFB', padding: '1px 6px', borderRadius: '8px' }}>🔵 Google Ads</span>
                              : <span style={{ fontSize: '0.63rem', fontWeight: 700, color: '#1877F2', background: '#EBF2FF', border: '1px solid #BFDBFE', padding: '1px 6px', borderRadius: '8px' }}>📘 Meta Ads</span>
                            }
                            {bekliyor && <span style={{ fontSize: '0.63rem', background: '#FFFBEB', color: '#B45309', border: '1px solid #FDE68A', padding: '1px 6px', borderRadius: '8px', fontWeight: 600 }}>⏳ Analiz ediliyor...</span>}
                            {hataVar && <span style={{ fontSize: '0.63rem', background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', padding: '1px 6px', borderRadius: '8px', fontWeight: 600 }}>✕ Hata</span>}
                            {a.durum === 'tamamlandi' && <span style={{ fontSize: '0.63rem', background: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0', padding: '1px 6px', borderRadius: '8px', fontWeight: 600 }}>✓ Hazır</span>}
                          </div>
                          <div style={{ fontSize: '0.68rem', color: C.faint, marginTop: '2px' }}>{a.tarih} · {a.model}</div>
                          {a.metrikler && (
                            <div style={{ fontSize: '0.68rem', color: C.muted, marginTop: '2px' }}>
                              {para(a.metrikler.harcama)} harcama · ROAS {a.metrikler.roas.toFixed(2)}x · {sayi(a.metrikler.donusum)} satış
                            </div>
                          )}
                        </div>
                      </div>
                      <button onClick={(e) => analizSil(a.id, e)} style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: C.faint, fontSize: '0.75rem', padding: '4px 7px', borderRadius: '5px'
                      }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#DC2626' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = C.faint }}
                      >✕</button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  )
}
