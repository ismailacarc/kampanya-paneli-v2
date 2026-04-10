'use client'

import { useEffect, useState, useCallback, Fragment } from 'react'
import Sidebar from '../components/Sidebar'
import { C } from '../lib/theme'
import { globalModelOku } from '../components/Sidebar'

// ─── Tipler ──────────────────────────────────────────────────────
interface Kampanya {
  id: number
  ad: string
  durum: number
  tip: string
  tipKod: number
  teklif: number
  harcama: string
  tiklama: number
  gosterim: number
  ctr: string
  donusum: number   // sadece satın alma
  sepet: number     // sepete ekle
  gelir: string
  roas: string
  ort_cpc: string
  ort_cpm: string
  donusum_maliyet: string
  donusum_orani: string
  tum_donusum: number
  tum_gelir: string
  gorunum_donusum: number
  gosterim_payi: string | null
  ust_gosterim_payi: string | null
}

interface ReklamGrubu {
  id: number
  ad: string
  kampanya: string
  durum: number
  harcama: string
  tiklama: number
  gosterim: number
  ctr: string
  donusum: number
  gelir: string
  roas: string
  ort_cpc: string
}

// ─── Sabitler ────────────────────────────────────────────────────
const HESAPLAR = [
  { id: 'karmen', ad: 'Karmen Halı' },
  { id: 'cotto', ad: 'Cotto Home' },
]

const DONEMLER = [
  { id: '0', ad: 'Bugün' },
  { id: '1', ad: 'Dün' },
  { id: '7', ad: '7 Gün' },
  { id: '14', ad: '14 Gün' },
  { id: '30', ad: '30 Gün' },
  { id: 'bu_ay', ad: 'Bu Ay' },
  { id: '90', ad: '90 Gün' },
  { id: '180', ad: '180 Gün' },
  { id: 'ozel', ad: 'Özel' },
]

const KAMPANYA_TIPLERI = [
  { id: 'tumu', ad: 'Tümü' },
  { id: 'Search', ad: '🔍 Search' },
  { id: 'Shopping', ad: '🛍️ Shopping' },
  { id: 'Performance Max', ad: '⚡ PMax' },
  { id: 'Display', ad: '🖼️ Display' },
  { id: 'Video', ad: '▶️ Video' },
  { id: 'Demand Gen', ad: '📣 Demand Gen' },
]

const TEKLIF_TIP: Record<number, string> = {
  2: 'Hedef CPA',
  3: 'Manuel CPC',
  4: 'Maks. Dönüşüm',
  6: 'Hedef ROAS',
  8: 'Geliştirilmiş CPC',
  9: 'Manuel CPM',
  10: 'Hedef İzleme %',
  12: 'Maks. Tıklama',
  13: 'Hedef İzleme Payı',
  14: 'Hedef CPM',
  16: 'Maks. Dönüşüm Değeri',
}

// Kampanya tipine göre reklam grubu açıklaması
const TIP_GRUP_ACIKLAMA: Record<string, { mesaj: string; ikon: string; renk: string }> = {
  'Performance Max': {
    mesaj: 'Performance Max kampanyalarında reklam grupları yoktur. Google, varlıkları (görsel, başlık, video) otomatik birleştirir.',
    ikon: '⚡', renk: '#D97706'
  },
  'Smart': {
    mesaj: 'Akıllı kampanyalar Google tarafından tamamen otomatik yönetilir, reklam grubu yapısı yoktur.',
    ikon: '🤖', renk: '#7C3AED'
  },
  'Video': {
    mesaj: 'Bu Video kampanyasında henüz aktif reklam grubu bulunmuyor veya seçilen dönemde harcama yapılmamış.',
    ikon: '▶️', renk: '#0284C7'
  },
}

// ─── Yardımcı fonksiyonlar ────────────────────────────────────────
function para(deger: string | number): string {
  const n = typeof deger === 'string' ? parseFloat(deger) : deger
  return `₺${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function sayi(n: number): string {
  return n.toLocaleString('tr-TR')
}

function roasRenk(roas: number): string {
  if (roas >= 5) return '#059669'
  if (roas >= 3) return '#0284C7'
  if (roas >= 1.5) return '#D97706'
  return '#DC2626'
}

function roasBg(roas: number): string {
  if (roas >= 5) return '#F0FDF4'
  if (roas >= 3) return '#EFF6FF'
  if (roas >= 1.5) return '#FFFBEB'
  return '#FEF2F2'
}

// ─── Bileşenler ──────────────────────────────────────────────────
function DurumBadge({ durum }: { durum: number }) {
  const aktif = durum === 2
  return (
    <span style={{
      padding: '2px 8px', borderRadius: '20px', fontSize: '0.68rem', fontWeight: 600,
      background: aktif ? '#DCFCE7' : '#FEE2E2',
      color: aktif ? '#166534' : '#991B1B',
      border: `1px solid ${aktif ? '#A7F3D0' : '#FECACA'}`,
      whiteSpace: 'nowrap'
    }}>
      {aktif ? '● Aktif' : '■ Durduruldu'}
    </span>
  )
}

function MarkdownGoster({ metin }: { metin: string }) {
  const satirlar = metin.split('\n')
  return (
    <div style={{ fontSize: '0.85rem', color: C.text, lineHeight: 1.7 }}>
      {satirlar.map((satir, i) => {
        if (satir.startsWith('## ')) {
          return <h3 key={i} style={{ fontSize: '0.95rem', fontWeight: 700, color: C.primary, marginTop: '20px', marginBottom: '8px', borderBottom: `1px solid ${C.border}`, paddingBottom: '4px' }}>{satir.replace('## ', '')}</h3>
        }
        if (satir.startsWith('### ')) {
          return <h4 key={i} style={{ fontSize: '0.88rem', fontWeight: 700, color: C.text, marginTop: '14px', marginBottom: '6px' }}>{satir.replace('### ', '')}</h4>
        }
        if (satir.match(/^\d+\./)) {
          const numMatch = satir.match(/^(\d+\.)(.*)/)
          return (
            <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
              <span style={{ color: C.primary, fontWeight: 700, minWidth: '20px', fontSize: '0.85rem' }}>{numMatch?.[1]}</span>
              <span style={{ flex: 1 }} dangerouslySetInnerHTML={{ __html: (numMatch?.[2] || '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
            </div>
          )
        }
        if (satir.startsWith('- ') || satir.startsWith('• ')) {
          const icerik = satir.replace(/^[-•]\s/, '')
          return (
            <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '4px', paddingLeft: '8px' }}>
              <span style={{ color: C.primary, fontWeight: 700, fontSize: '0.9rem' }}>·</span>
              <span dangerouslySetInnerHTML={{ __html: icerik.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
            </div>
          )
        }
        if (satir.trim() === '') return <div key={i} style={{ height: '6px' }} />
        return <p key={i} style={{ margin: '0 0 6px', lineHeight: 1.65 }} dangerouslySetInnerHTML={{ __html: satir.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
      })}
    </div>
  )
}

// ─── Ana Sayfa ────────────────────────────────────────────────────
export default function GoogleAdsPage() {
  const [aktifHesap, setAktifHesap] = useState('karmen')
  const [donem, setDonem] = useState('30')
  const [baslangic, setBaslangic] = useState('')
  const [bitis, setBitis] = useState('')
  const [kampanyalar, setKampanyalar] = useState<Kampanya[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState('')
  const [aktifTip, setAktifTip] = useState('tumu')
  const [siralama, setSiralama] = useState<{ alan: string; yon: 'asc' | 'desc' }>({ alan: 'harcama', yon: 'desc' })
  const [statusFiltre, setStatusFiltre] = useState<'hepsi' | 'aktif' | 'durduruldu'>('aktif')
  const [arama, setArama] = useState('')

  // Reklam grupları
  const [acikKampanya, setAcikKampanya] = useState<number | null>(null)
  const [reklamGruplari, setReklamGruplari] = useState<Record<number, ReklamGrubu[]>>({})
  const [grupYukleniyor, setGrupYukleniyor] = useState<number | null>(null)

  // AI
  const [aiMetin, setAiMetin] = useState('')
  const [aiYukleniyor, setAiYukleniyor] = useState(false)
  const [aiAcik, setAiAcik] = useState(false)
  const [aiDonemModal, setAiDonemModal] = useState(false)
  const [aiSecimDonem, setAiSecimDonem] = useState('30')
  const [aiModel, setAiModel] = useState('claude-sonnet-4-6')

  useEffect(() => {
    setAiModel(globalModelOku())
    function onModel(e: Event) { setAiModel((e as CustomEvent).detail) }
    window.addEventListener('modelDegisti', onModel)
    return () => window.removeEventListener('modelDegisti', onModel)
  }, [])

  const yukle = useCallback(() => {
    setYukleniyor(true)
    setHata('')
    setKampanyalar([])
    setAcikKampanya(null)

    let url = `/api/google-ads?hesap=${aktifHesap}&tur=kampanyalar&donem=${donem}`
    if (donem === 'ozel' && baslangic && bitis) {
      url += `&baslangic=${baslangic}&bitis=${bitis}`
    }

    fetch(url)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setHata(d.error); setYukleniyor(false); return }
        setKampanyalar(d.data || [])
        setYukleniyor(false)
      })
      .catch(() => { setHata('Bağlantı hatası'); setYukleniyor(false) })
  }, [aktifHesap, donem, baslangic, bitis])

  useEffect(() => { yukle() }, [yukle])

  async function grupYukle(kampanyaId: number) {
    if (acikKampanya === kampanyaId) { setAcikKampanya(null); return }
    setAcikKampanya(kampanyaId)
    if (reklamGruplari[kampanyaId]) return
    setGrupYukleniyor(kampanyaId)

    const url = `/api/google-ads?hesap=${aktifHesap}&tur=reklam-gruplari&donem=${donem}&kampanya_id=${kampanyaId}${donem === 'ozel' && baslangic && bitis ? `&baslangic=${baslangic}&bitis=${bitis}` : ''}`
    try {
      const r = await fetch(url)
      const d = await r.json()
      if (d.data) setReklamGruplari(prev => ({ ...prev, [kampanyaId]: d.data }))
    } catch { /* silent */ }
    setGrupYukleniyor(null)
  }

  async function aiAnalizYap() {
    setAiDonemModal(false)
    setAiYukleniyor(true)
    setAiAcik(true)
    setAiMetin('')

    // Seçilen dönemdeki veriyi çek
    let fetchUrl = `/api/google-ads?hesap=${aktifHesap}&tur=kampanyalar&donem=${aiSecimDonem}`

    try {
      const veriRes = await fetch(fetchUrl)
      const veriData = await veriRes.json()
      const aiKampanyalar = veriData.data || kampanyalar

      const donemAdi = DONEMLER.find(d => d.id === aiSecimDonem)?.ad || 'Son 30 Gün'
      const hesapAdi = HESAPLAR.find(h => h.id === aktifHesap)?.ad || aktifHesap

      const res = await fetch('/api/google-ads-analiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kampanyalar: aiKampanyalar, hesapAdi, donem: donemAdi, model: aiModel })
      })
      const data = await res.json()
      setAiMetin(data.analiz || data.error || 'Analiz yapılamadı')
    } catch {
      setAiMetin('Analiz sırasında hata oluştu.')
    }
    setAiYukleniyor(false)
  }

  // ─── Filtreleme & Sıralama ────────────────────────────────────
  const filtrelenmis = kampanyalar
    .filter(k => {
      if (aktifTip !== 'tumu' && k.tip !== aktifTip) return false
      if (statusFiltre === 'aktif' && k.durum !== 2) return false
      if (statusFiltre === 'durduruldu' && k.durum === 2) return false
      if (arama && !k.ad.toLowerCase().includes(arama.toLowerCase())) return false
      return true
    })
    .sort((a, b) => {
      const al = siralama.alan
      const getVal = (k: Kampanya): number => {
        switch (al) {
          case 'harcama': return parseFloat(k.harcama)
          case 'gelir': return parseFloat(k.gelir)
          case 'roas': return parseFloat(k.roas)
          case 'tiklama': return k.tiklama
          case 'gosterim': return k.gosterim
          case 'ctr': return parseFloat(k.ctr)
          case 'donusum': return k.donusum
          case 'sepet': return k.sepet || 0
          case 'ort_cpc': return parseFloat(k.ort_cpc)
          case 'donusum_maliyet': return parseFloat(k.donusum_maliyet)
          default: return 0
        }
      }
      return siralama.yon === 'desc' ? getVal(b) - getVal(a) : getVal(a) - getVal(b)
    })

  function siralamaToggle(alan: string) {
    setSiralama(prev => prev.alan === alan ? { alan, yon: prev.yon === 'desc' ? 'asc' : 'desc' } : { alan, yon: 'desc' })
  }

  function SiralamaIkon({ alan }: { alan: string }) {
    if (siralama.alan !== alan) return <span style={{ color: C.faint, fontSize: '0.65rem', marginLeft: '3px', opacity: 0.5 }}>⇅</span>
    return (
      <span style={{
        color: '#fff', fontSize: '0.62rem', marginLeft: '3px',
        background: C.primary, borderRadius: '3px', padding: '0px 3px', fontWeight: 800
      }}>
        {siralama.yon === 'desc' ? '↓' : '↑'}
      </span>
    )
  }

  // ─── KPI Toplamları ───────────────────────────────────────────
  const toplamHarcama = filtrelenmis.reduce((a, k) => a + parseFloat(k.harcama), 0)
  const toplamGelir = filtrelenmis.reduce((a, k) => a + parseFloat(k.gelir), 0)
  const toplamRoas = toplamHarcama > 0 ? toplamGelir / toplamHarcama : 0
  const toplamDonusum = filtrelenmis.reduce((a, k) => a + k.donusum, 0)   // sadece satın alma
  const toplamSepet = filtrelenmis.reduce((a, k) => a + (k.sepet || 0), 0) // sepete ekle
  const toplamTiklama = filtrelenmis.reduce((a, k) => a + k.tiklama, 0)
  const toplamGosterim = filtrelenmis.reduce((a, k) => a + k.gosterim, 0)
  const ortCtr = toplamGosterim > 0 ? (toplamTiklama / toplamGosterim) * 100 : 0
  const ortCpc = toplamTiklama > 0 ? toplamHarcama / toplamTiklama : 0
  const ortCpm = toplamGosterim > 0 ? (toplamHarcama / toplamGosterim) * 1000 : 0

  const kpiKartlar = [
    { ad: 'Harcama', deger: para(toplamHarcama), renk: '#C2410C', ikon: '💸' },
    { ad: 'Gelir', deger: para(toplamGelir), renk: '#059669', ikon: '💰' },
    { ad: 'ROAS', deger: `${toplamRoas.toFixed(2)}x`, renk: roasRenk(toplamRoas), ikon: '📈' },
    { ad: 'Satın Alma', deger: sayi(Math.round(toplamDonusum)), renk: '#0284C7', ikon: '🎯' },
    { ad: 'Sepete Ekle', deger: sayi(toplamSepet), renk: '#8B5CF6', ikon: '🛒' },
    { ad: 'Tıklama', deger: sayi(toplamTiklama), renk: '#7C3AED', ikon: '👆' },
    { ad: 'Gösterim', deger: toplamGosterim > 1000 ? `${(toplamGosterim / 1000).toFixed(1)}B` : sayi(toplamGosterim), renk: '#0891B2', ikon: '👁️' },
    { ad: 'Ort. CTR', deger: `%${ortCtr.toFixed(2)}`, renk: '#059669', ikon: '🖱️' },
    { ad: 'Ort. CPC', deger: para(ortCpc), renk: C.primary, ikon: '💡' },
    { ad: 'Ort. CPM', deger: para(ortCpm), renk: '#6B7280', ikon: '📊' },
  ]

  const thStyle = (alan: string): React.CSSProperties => ({
    padding: '10px 12px',
    fontSize: '0.72rem', fontWeight: 700,
    color: siralama.alan === alan ? C.primary : C.muted,
    textAlign: 'left', cursor: 'pointer', whiteSpace: 'nowrap',
    background: siralama.alan === alan ? C.primary + '08' : C.tableHead,
    borderBottom: `2px solid ${siralama.alan === alan ? C.primary + '40' : C.border}`,
    userSelect: 'none',
    transition: 'all 0.15s',
  })

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg }}>
      <Sidebar />

      <div style={{ marginLeft: '220px', flex: 1, padding: '28px 32px', maxWidth: 'calc(100vw - 220px)' }}>

        {/* ── Başlık ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: '1.3rem', fontWeight: 800, color: C.text, margin: 0 }}>🟡 Google Ads</h1>
            <p style={{ fontSize: '0.78rem', color: C.faint, margin: '3px 0 0' }}>
              {HESAPLAR.find(h => h.id === aktifHesap)?.ad} · {DONEMLER.find(d => d.id === donem)?.ad}
              {filtrelenmis.length > 0 && ` · ${filtrelenmis.length} kampanya`}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* AI Analiz */}
            <button onClick={() => setAiDonemModal(true)} style={{
              padding: '8px 16px', borderRadius: '8px', border: 'none',
              background: '#7C3AED', color: '#fff', cursor: 'pointer',
              fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px'
            }}>
              🤖 AI Analizi
            </button>
            {/* Yenile */}
            <button onClick={yukle} style={{
              padding: '8px 12px', borderRadius: '8px',
              border: `1px solid ${C.border}`, background: C.card,
              color: C.muted, cursor: 'pointer', fontSize: '0.82rem'
            }}>
              ↻ Yenile
            </button>
          </div>
        </div>

        {/* ── Hesap Seçici ── */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
          {HESAPLAR.map(h => (
            <button key={h.id} onClick={() => { setAktifHesap(h.id); setAcikKampanya(null) }} style={{
              padding: '10px 20px', borderRadius: '10px',
              border: `2px solid ${aktifHesap === h.id ? C.primary : C.border}`,
              background: aktifHesap === h.id ? C.primary : C.card,
              color: aktifHesap === h.id ? '#fff' : C.text,
              cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700,
              transition: 'all 0.15s',
              boxShadow: aktifHesap === h.id ? '0 2px 8px rgba(15,76,129,0.25)' : 'none'
            }}>
              {h.id === 'karmen' ? '🟡 ' : '🏠 '}{h.ad}
            </button>
          ))}
        </div>

        {/* ── Dönem Seçici ── */}
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '20px', alignItems: 'center' }}>
          {DONEMLER.map(d => (
            <button key={d.id} onClick={() => setDonem(d.id)} style={{
              padding: '6px 12px', borderRadius: '8px', border: `1px solid ${donem === d.id ? C.primary + '60' : C.border}`,
              background: donem === d.id ? C.primary + '10' : C.card,
              color: donem === d.id ? C.primary : C.muted,
              cursor: 'pointer', fontSize: '0.78rem', fontWeight: donem === d.id ? 700 : 400,
              transition: 'all 0.15s'
            }}>
              {d.ad}
            </button>
          ))}

          {/* Özel Tarih */}
          {donem === 'ozel' && (
            <>
              <input type="date" value={baslangic} onChange={e => setBaslangic(e.target.value)} style={{
                padding: '5px 8px', borderRadius: '6px', border: `1px solid ${C.border}`,
                fontSize: '0.78rem', background: C.card, color: C.text
              }} />
              <span style={{ color: C.faint, fontSize: '0.78rem' }}>—</span>
              <input type="date" value={bitis} onChange={e => setBitis(e.target.value)} style={{
                padding: '5px 8px', borderRadius: '6px', border: `1px solid ${C.border}`,
                fontSize: '0.78rem', background: C.card, color: C.text
              }} />
              {baslangic && bitis && (
                <button onClick={yukle} style={{
                  padding: '5px 12px', borderRadius: '6px', border: 'none',
                  background: C.primary, color: '#fff', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600
                }}>Getir</button>
              )}
            </>
          )}
        </div>

        {/* ── Hata ── */}
        {hata && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', padding: '14px 18px', marginBottom: '16px' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#DC2626', marginBottom: '4px' }}>⚠️ API Hatası</div>
            <div style={{ fontSize: '0.78rem', color: '#991B1B', wordBreak: 'break-all', fontFamily: 'monospace' }}>{hata}</div>
          </div>
        )}

        {/* ── KPI Kartları ── */}
        {[
          { baslik: 'Finansal', kartlar: kpiKartlar.slice(0, 3) },
          { baslik: 'Dönüşüm', kartlar: kpiKartlar.slice(3, 6) },
          { baslik: 'Trafik', kartlar: kpiKartlar.slice(6, 10) },
        ].map(grup => (
          <div key={grup.baslik} style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '0.62rem', color: C.faint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
              {grup.baslik}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${grup.kartlar.length}, 1fr)`, gap: '10px' }}>
              {grup.kartlar.map(k => (
                <div key={k.ad} style={{
                  background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px',
                  padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px'
                }}>
                  <div style={{
                    width: '38px', height: '38px', borderRadius: '9px', flexShrink: 0,
                    background: k.renk + '15', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.1rem'
                  }}>{k.ikon}</div>
                  <div>
                    <div style={{ fontSize: '0.62rem', color: C.faint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{k.ad}</div>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: yukleniyor ? C.faint : k.renk, marginTop: '2px' }}>
                      {yukleniyor ? '—' : k.deger}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* ── Kampanya Tipi Tabs ── */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '14px', flexWrap: 'wrap', borderBottom: `1px solid ${C.border}`, paddingBottom: '12px' }}>
          {KAMPANYA_TIPLERI.map(t => {
            const sayi = t.id === 'tumu' ? kampanyalar.length : kampanyalar.filter(k => k.tip === t.id).length
            return (
              <button key={t.id} onClick={() => setAktifTip(t.id)} style={{
                padding: '6px 12px', borderRadius: '20px', border: `1px solid ${aktifTip === t.id ? C.primary : C.border}`,
                background: aktifTip === t.id ? C.primary : C.card,
                color: aktifTip === t.id ? '#fff' : C.muted,
                cursor: 'pointer', fontSize: '0.78rem', fontWeight: aktifTip === t.id ? 700 : 400,
                display: 'flex', alignItems: 'center', gap: '5px', transition: 'all 0.15s'
              }}>
                {t.ad}
                {sayi > 0 && <span style={{
                  background: aktifTip === t.id ? 'rgba(255,255,255,0.3)' : C.bg,
                  color: aktifTip === t.id ? '#fff' : C.faint,
                  fontSize: '0.65rem', fontWeight: 700,
                  padding: '1px 5px', borderRadius: '10px'
                }}>{sayi}</span>}
              </button>
            )
          })}

          {/* Sağ taraf: Arama + Durum filtre */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              placeholder="Kampanya ara..."
              value={arama}
              onChange={e => setArama(e.target.value)}
              style={{
                padding: '5px 10px', borderRadius: '8px', border: `1px solid ${C.border}`,
                fontSize: '0.78rem', background: C.card, color: C.text, width: '150px'
              }}
            />
            {(['hepsi', 'aktif', 'durduruldu'] as const).map(s => (
              <button key={s} onClick={() => setStatusFiltre(s)} style={{
                padding: '5px 10px', borderRadius: '8px', border: `1px solid ${statusFiltre === s ? C.primary + '40' : C.border}`,
                background: statusFiltre === s ? C.primary + '08' : 'transparent',
                color: statusFiltre === s ? C.primary : C.muted,
                cursor: 'pointer', fontSize: '0.72rem', fontWeight: statusFiltre === s ? 700 : 400
              }}>
                {s === 'hepsi' ? 'Hepsi' : s === 'aktif' ? '● Aktif' : '■ Durduruldu'}
              </button>
            ))}
          </div>
        </div>

        {/* ── Kampanya Tablosu ── */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', overflow: 'hidden' }}>
          {yukleniyor ? (
            <div style={{ padding: '40px', textAlign: 'center', color: C.faint, fontSize: '0.88rem' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>⏳</div>
              Yükleniyor...
            </div>
          ) : filtrelenmis.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: C.faint, fontSize: '0.88rem' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>📭</div>
              Bu filtrelerle kampanya bulunamadı
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle('ad'), width: '30px' }}></th>
                    <th style={{ ...thStyle('ad'), textAlign: 'left', minWidth: '200px' }}>Kampanya</th>
                    <th style={{ ...thStyle('harcama') }} onClick={() => siralamaToggle('harcama')}>
                      Harcama <SiralamaIkon alan="harcama" />
                    </th>
                    <th style={{ ...thStyle('gelir') }} onClick={() => siralamaToggle('gelir')}>
                      Gelir <SiralamaIkon alan="gelir" />
                    </th>
                    <th style={{ ...thStyle('roas') }} onClick={() => siralamaToggle('roas')}>
                      ROAS <SiralamaIkon alan="roas" />
                    </th>
                    <th style={{ ...thStyle('donusum') }} onClick={() => siralamaToggle('donusum')}>
                      Satın Alma <SiralamaIkon alan="donusum" />
                    </th>
                    <th style={{ ...thStyle('sepet') }} onClick={() => siralamaToggle('sepet')}>
                      Sepete Ekle <SiralamaIkon alan="sepet" />
                    </th>
                    <th style={{ ...thStyle('tiklama') }} onClick={() => siralamaToggle('tiklama')}>
                      Tıklama <SiralamaIkon alan="tiklama" />
                    </th>
                    <th style={{ ...thStyle('gosterim') }} onClick={() => siralamaToggle('gosterim')}>
                      Gösterim <SiralamaIkon alan="gosterim" />
                    </th>
                    <th style={{ ...thStyle('ctr') }} onClick={() => siralamaToggle('ctr')}>
                      CTR <SiralamaIkon alan="ctr" />
                    </th>
                    <th style={{ ...thStyle('ort_cpc') }} onClick={() => siralamaToggle('ort_cpc')}>
                      Ort. CPC <SiralamaIkon alan="ort_cpc" />
                    </th>
                    <th style={{ ...thStyle('donusum_maliyet') }} onClick={() => siralamaToggle('donusum_maliyet')}>
                      D. Maliyeti <SiralamaIkon alan="donusum_maliyet" />
                    </th>
                    <th style={thStyle('gosterim_payi')}>G. Payı</th>
                    <th style={thStyle('durum')}>Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrelenmis.map(k => (
                    <Fragment key={k.id}>
                      <tr
                        style={{
                          background: acikKampanya === k.id ? C.primary + '05' : 'transparent',
                          borderBottom: `1px solid ${C.borderLight}`,
                          transition: 'background 0.1s'
                        }}
                        onMouseEnter={e => { if (acikKampanya !== k.id) (e.currentTarget as HTMLTableRowElement).style.background = C.bg }}
                        onMouseLeave={e => { if (acikKampanya !== k.id) (e.currentTarget as HTMLTableRowElement).style.background = 'transparent' }}
                      >
                        {/* Expand butonu */}
                        <td style={{ padding: '0 4px 0 10px', borderBottom: `1px solid ${C.borderLight}` }}>
                          <button
                            onClick={() => grupYukle(k.id)}
                            style={{
                              width: '20px', height: '20px', borderRadius: '4px',
                              border: `1px solid ${C.border}`, background: 'transparent',
                              cursor: 'pointer', fontSize: '0.6rem', color: C.muted,
                              display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}
                          >
                            {grupYukleniyor === k.id ? '⟳' : acikKampanya === k.id ? '▼' : '▶'}
                          </button>
                        </td>
                        {/* Kampanya adı */}
                        <td style={{ padding: '12px', borderBottom: `1px solid ${C.borderLight}` }}>
                          <a
                            href={`/google-ads/kampanya/${k.id}?hesap=${aktifHesap}&ad=${encodeURIComponent(k.ad)}&tip=${encodeURIComponent(k.tip)}`}
                            style={{ fontWeight: 600, color: C.primary, fontSize: '0.82rem', marginBottom: '3px', maxWidth: '280px', display: 'block', textDecoration: 'none' }}
                            onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                            onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                          >
                            {k.ad}
                          </a>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{
                              fontSize: '0.65rem', padding: '1px 6px', borderRadius: '4px',
                              background: C.sectionBlue, color: C.primary, fontWeight: 600
                            }}>{k.tip}</span>
                            {TEKLIF_TIP[k.teklif] && (
                              <span style={{
                                fontSize: '0.62rem', padding: '1px 6px', borderRadius: '4px',
                                background: C.bg, color: C.faint, border: `1px solid ${C.border}`
                              }}>{TEKLIF_TIP[k.teklif]}</span>
                            )}
                          </div>
                        </td>
                        {/* Harcama */}
                        <td style={{ padding: '12px', borderBottom: `1px solid ${C.borderLight}`, color: '#C2410C', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {para(k.harcama)}
                        </td>
                        {/* Gelir */}
                        <td style={{ padding: '12px', borderBottom: `1px solid ${C.borderLight}`, color: parseFloat(k.gelir) > 0 ? '#059669' : C.faint, fontWeight: parseFloat(k.gelir) > 0 ? 600 : 400, whiteSpace: 'nowrap' }}>
                          {parseFloat(k.gelir) > 0 ? para(k.gelir) : '—'}
                        </td>
                        {/* ROAS */}
                        <td style={{ padding: '12px', borderBottom: `1px solid ${C.borderLight}`, whiteSpace: 'nowrap' }}>
                          {parseFloat(k.roas) > 0 ? (
                            <span style={{
                              fontWeight: 700, color: roasRenk(parseFloat(k.roas)),
                              background: roasBg(parseFloat(k.roas)),
                              border: `1px solid ${roasRenk(parseFloat(k.roas))}30`,
                              padding: '3px 9px', borderRadius: '6px', fontSize: '0.8rem'
                            }}>
                              {parseFloat(k.roas).toFixed(2)}x
                            </span>
                          ) : <span style={{ color: C.faint }}>—</span>}
                        </td>
                        {/* Satın Alma */}
                        <td style={{ padding: '12px', borderBottom: `1px solid ${C.borderLight}`, color: k.donusum > 0 ? '#0284C7' : C.faint, fontWeight: k.donusum > 0 ? 600 : 400 }}>
                          {k.donusum > 0 ? k.donusum.toFixed(1) : '—'}
                        </td>
                        {/* Sepete Ekle */}
                        <td style={{ padding: '12px', borderBottom: `1px solid ${C.borderLight}`, color: (k.sepet || 0) > 0 ? '#8B5CF6' : C.faint, fontWeight: (k.sepet || 0) > 0 ? 600 : 400 }}>
                          {(k.sepet || 0) > 0 ? sayi(k.sepet) : '—'}
                        </td>
                        {/* Tıklama */}
                        <td style={{ padding: '12px', borderBottom: `1px solid ${C.borderLight}`, color: C.muted }}>
                          {sayi(k.tiklama)}
                        </td>
                        {/* Gösterim */}
                        <td style={{ padding: '12px', borderBottom: `1px solid ${C.borderLight}`, color: C.faint, fontSize: '0.78rem' }}>
                          {k.gosterim > 1000 ? `${(k.gosterim / 1000).toFixed(1)}B` : sayi(k.gosterim)}
                        </td>
                        {/* CTR */}
                        <td style={{ padding: '12px', borderBottom: `1px solid ${C.borderLight}`, color: C.muted }}>
                          %{k.ctr}
                        </td>
                        {/* CPC */}
                        <td style={{ padding: '12px', borderBottom: `1px solid ${C.borderLight}`, color: C.muted, whiteSpace: 'nowrap' }}>
                          {parseFloat(k.ort_cpc) > 0 ? para(k.ort_cpc) : '—'}
                        </td>
                        {/* Dönüşüm Maliyeti */}
                        <td style={{ padding: '12px', borderBottom: `1px solid ${C.borderLight}`, color: C.muted, whiteSpace: 'nowrap' }}>
                          {parseFloat(k.donusum_maliyet) > 0 ? para(k.donusum_maliyet) : '—'}
                        </td>
                        {/* Gösterim Payı */}
                        <td style={{ padding: '12px', borderBottom: `1px solid ${C.borderLight}`, color: C.muted, fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                          {k.gosterim_payi ? (
                            <div>
                              <div>%{k.gosterim_payi}</div>
                              {k.ust_gosterim_payi && <div style={{ fontSize: '0.65rem', color: C.faint }}>Üst: %{k.ust_gosterim_payi}</div>}
                            </div>
                          ) : '—'}
                        </td>
                        {/* Durum */}
                        <td style={{ padding: '12px', borderBottom: `1px solid ${C.borderLight}` }}>
                          <DurumBadge durum={k.durum} />
                        </td>
                      </tr>

                      {/* Reklam Grupları (açıldığında) */}
                      {acikKampanya === k.id && (
                        <tr>
                          <td colSpan={14} style={{ padding: 0, background: C.subRow }}>
                            {grupYukleniyor === k.id ? (
                              <div style={{ padding: '16px 24px', color: C.faint, fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span> Reklam grupları yükleniyor...
                              </div>
                            ) : reklamGruplari[k.id]?.length === 0 ? (() => {
                              const aciklama = TIP_GRUP_ACIKLAMA[k.tip]
                              return (
                                <div style={{ padding: '14px 20px' }}>
                                  {aciklama ? (
                                    <div style={{
                                      display: 'flex', alignItems: 'flex-start', gap: '10px',
                                      background: aciklama.renk + '10', border: `1px solid ${aciklama.renk}30`,
                                      borderRadius: '8px', padding: '10px 14px'
                                    }}>
                                      <span style={{ fontSize: '1rem', flexShrink: 0 }}>{aciklama.ikon}</span>
                                      <div>
                                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: aciklama.renk, marginBottom: '2px' }}>
                                          {k.tip} Kampanyası
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: C.muted, lineHeight: 1.5 }}>
                                          {aciklama.mesaj}
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <div style={{ fontSize: '0.78rem', color: C.faint, padding: '4px 0' }}>
                                      📭 Bu kampanyada seçilen dönem için reklam grubu verisi bulunamadı.
                                    </div>
                                  )}
                                </div>
                              )
                            })() : (
                              <div style={{ padding: '8px 16px' }}>
                                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px', paddingLeft: '8px' }}>
                                  Reklam Grupları ({reklamGruplari[k.id]?.length || 0})
                                </div>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                                  <thead>
                                    <tr style={{ background: C.bg }}>
                                      {['Reklam Grubu', 'Harcama', 'Gelir', 'ROAS', 'Dönüşüm', 'Tıklama', 'CTR', 'CPC', 'Durum'].map(h => (
                                        <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: '0.68rem', fontWeight: 700, color: C.faint, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(reklamGruplari[k.id] || []).map(g => (
                                      <tr key={g.id} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                                        <td style={{ padding: '8px 10px', color: C.text, fontWeight: 500, maxWidth: '220px' }}>{g.ad}</td>
                                        <td style={{ padding: '8px 10px', color: '#C2410C', fontWeight: 600, whiteSpace: 'nowrap' }}>{para(g.harcama)}</td>
                                        <td style={{ padding: '8px 10px', color: parseFloat(g.gelir) > 0 ? '#059669' : C.faint, whiteSpace: 'nowrap' }}>
                                          {parseFloat(g.gelir) > 0 ? para(g.gelir) : '—'}
                                        </td>
                                        <td style={{ padding: '8px 10px', color: roasRenk(parseFloat(g.roas)), fontWeight: 600 }}>
                                          {parseFloat(g.roas) > 0 ? `${parseFloat(g.roas).toFixed(2)}x` : '—'}
                                        </td>
                                        <td style={{ padding: '8px 10px', color: '#0284C7' }}>{g.donusum > 0 ? g.donusum.toFixed(1) : '—'}</td>
                                        <td style={{ padding: '8px 10px', color: C.muted }}>{sayi(g.tiklama)}</td>
                                        <td style={{ padding: '8px 10px', color: C.muted }}>%{g.ctr}</td>
                                        <td style={{ padding: '8px 10px', color: C.muted, whiteSpace: 'nowrap' }}>{parseFloat(g.ort_cpc) > 0 ? para(g.ort_cpc) : '—'}</td>
                                        <td style={{ padding: '8px 10px' }}><DurumBadge durum={g.durum} /></td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>

                {/* Toplam satırı */}
                {filtrelenmis.length > 0 && (
                  <tfoot>
                    <tr style={{ background: C.tableHead, fontWeight: 700 }}>
                      <td style={{ padding: '10px', borderTop: `2px solid ${C.border}` }}></td>
                      <td style={{ padding: '10px', borderTop: `2px solid ${C.border}`, fontSize: '0.78rem', color: C.muted }}>
                        Toplam ({filtrelenmis.length} kampanya)
                      </td>
                      <td style={{ padding: '10px', borderTop: `2px solid ${C.border}`, color: '#C2410C', whiteSpace: 'nowrap' }}>{para(toplamHarcama)}</td>
                      <td style={{ padding: '10px', borderTop: `2px solid ${C.border}`, color: '#059669', whiteSpace: 'nowrap' }}>{toplamGelir > 0 ? para(toplamGelir) : '—'}</td>
                      <td style={{ padding: '10px', borderTop: `2px solid ${C.border}`, color: roasRenk(toplamRoas) }}>{toplamRoas > 0 ? `${toplamRoas.toFixed(2)}x` : '—'}</td>
                      <td style={{ padding: '10px', borderTop: `2px solid ${C.border}`, color: '#0284C7' }}>{toplamDonusum > 0 ? toplamDonusum.toFixed(1) : '—'}</td>
                      <td style={{ padding: '10px', borderTop: `2px solid ${C.border}`, color: '#8B5CF6' }}>{toplamSepet > 0 ? sayi(toplamSepet) : '—'}</td>
                      <td style={{ padding: '10px', borderTop: `2px solid ${C.border}`, color: C.muted }}>{sayi(toplamTiklama)}</td>
                      <td style={{ padding: '10px', borderTop: `2px solid ${C.border}`, color: C.faint }}>{toplamGosterim > 1000 ? `${(toplamGosterim / 1000).toFixed(1)}B` : sayi(toplamGosterim)}</td>
                      <td style={{ padding: '10px', borderTop: `2px solid ${C.border}`, color: C.muted }}>%{ortCtr.toFixed(2)}</td>
                      <td style={{ padding: '10px', borderTop: `2px solid ${C.border}`, color: C.muted, whiteSpace: 'nowrap' }}>{para(ortCpc)}</td>
                      <td colSpan={3} style={{ padding: '10px', borderTop: `2px solid ${C.border}` }}></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>

        {/* ── AI Dönem Modal ── */}
        {aiDonemModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '16px', padding: '28px', width: '380px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '4px', color: C.text }}>🤖 AI Analizi</div>
              <div style={{ fontSize: '0.83rem', color: C.muted, marginBottom: '20px' }}>Hangi dönem için analiz yapılsın?</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                {[{ id: '7', ad: 'Son 7 Gün' }, { id: '14', ad: 'Son 14 Gün' }, { id: '30', ad: 'Son 30 Gün' }, { id: '90', ad: 'Son 90 Gün' }].map(p => (
                  <button key={p.id} onClick={() => setAiSecimDonem(p.id)} style={{
                    padding: '12px', borderRadius: '10px',
                    border: `2px solid ${aiSecimDonem === p.id ? '#7C3AED' : C.border}`,
                    background: aiSecimDonem === p.id ? '#F5F3FF' : C.bg,
                    color: aiSecimDonem === p.id ? '#6D28D9' : C.muted,
                    cursor: 'pointer', fontSize: '0.88rem',
                    fontWeight: aiSecimDonem === p.id ? 600 : 400,
                    transition: 'all 0.15s', textAlign: 'center'
                  }}>
                    {p.ad}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setAiDonemModal(false)} style={{
                  flex: 1, padding: '10px', borderRadius: '8px',
                  border: `1px solid ${C.border}`, background: 'transparent',
                  color: C.muted, cursor: 'pointer', fontSize: '0.85rem'
                }}>İptal</button>
                <button onClick={aiAnalizYap} style={{
                  flex: 2, padding: '10px', borderRadius: '8px', border: 'none',
                  background: '#7C3AED', color: '#fff', cursor: 'pointer',
                  fontSize: '0.88rem', fontWeight: 600
                }}>
                  🤖 Analiz Et
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── AI Analiz Paneli ── */}
        {aiAcik && (
          <div style={{ marginTop: '24px', background: C.card, border: `1px solid #DDD6FE`, borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', background: C.sectionPurple, borderBottom: `1px solid #DDD6FE`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.1rem' }}>🤖</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#5B21B6' }}>AI Kampanya Analizi</div>
                  <div style={{ fontSize: '0.7rem', color: '#7C3AED' }}>
                    {HESAPLAR.find(h => h.id === aktifHesap)?.ad} · {aiModel.includes('opus') ? 'Opus 4.6' : aiModel.includes('sonnet') ? 'Sonnet 4.6' : 'Haiku 4.5'}
                  </div>
                </div>
              </div>
              <button onClick={() => setAiAcik(false)} style={{
                background: 'transparent', border: 'none', cursor: 'pointer', color: '#7C3AED', fontSize: '1rem'
              }}>✕</button>
            </div>
            <div style={{ padding: '20px 24px' }}>
              {aiYukleniyor ? (
                <div style={{ textAlign: 'center', padding: '32px', color: C.faint }}>
                  <div style={{ fontSize: '1.8rem', marginBottom: '10px' }}>🔄</div>
                  <div style={{ fontSize: '0.85rem' }}>AI analiz yapıyor...</div>
                </div>
              ) : (
                <MarkdownGoster metin={aiMetin} />
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
