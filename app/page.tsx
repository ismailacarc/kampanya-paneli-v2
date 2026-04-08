'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, Filler } from 'chart.js'
import { Bar } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, Filler)

interface Insights {
  spend: string
  impressions: string
  clicks: string
  ctr: string
  cpc: string
  actions?: { action_type: string; value: string }[]
  action_values?: { action_type: string; value: string }[]
}

interface Satir {
  id: string
  name: string
  status: string
  daily_budget?: string
  insights?: { data: Insights[] }
}

const HESAPLAR = [
  { id: 'karmen', ad: 'Karmen Halı', emoji: '🏠', renk: '#c07a3a' },
  { id: 'cotto', ad: 'Cotto Home', emoji: '🛋️', renk: '#3a7ab5' },
]

const PRESETLER = [
  { id: '7', ad: 'Son 7 Gün' },
  { id: '14', ad: 'Son 14 Gün' },
  { id: '30', ad: 'Son 30 Gün' },
  { id: '90', ad: 'Son 90 Gün' },
  { id: '180', ad: 'Son 6 Ay' },
  { id: 'ozel', ad: '📅 Özel Aralık' },
]

function para(v: string | number) {
  return `₺${parseFloat(String(v)).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function sayi(v: string | number) {
  return parseInt(String(v)).toLocaleString('tr-TR')
}
function getDonusum(ins?: Insights) {
  const a = ins?.actions?.find(a => ['purchase', 'offsite_conversion.fb_pixel_purchase', 'omni_purchase'].includes(a.action_type))
  return parseInt(a?.value || '0')
}
function getGelir(ins?: Insights) {
  const a = ins?.action_values?.find(a => ['purchase', 'offsite_conversion.fb_pixel_purchase', 'omni_purchase'].includes(a.action_type))
  return parseFloat(a?.value || '0')
}
function getRoas(ins?: Insights) {
  const h = parseFloat(ins?.spend || '0')
  const g = getGelir(ins)
  return h > 0 ? g / h : 0
}
function roasRenk(r: number) {
  if (r >= 4) return '#57a86a'
  if (r >= 2) return '#b07840'
  if (r > 0) return '#a05050'
  return '#484f58'
}

function Badge({ status }: { status: string }) {
  const aktif = status === 'ACTIVE'
  return (
    <span style={{ padding: '2px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 600, background: aktif ? '#1a3a2a' : '#2a1a1a', color: aktif ? '#3fb950' : '#f85149', whiteSpace: 'nowrap' }}>
      {aktif ? '● Aktif' : '■ Durduruldu'}
    </span>
  )
}

function MetrikHucre({ ins, alan }: { ins?: Insights; alan: string }) {
  const h = parseFloat(ins?.spend || '0')
  const g = getGelir(ins)
  const r = getRoas(ins)
  const d = getDonusum(ins)

  const deger = (() => {
    switch (alan) {
      case 'harcama': return h > 0 ? para(h) : '—'
      case 'gelir': return g > 0 ? para(g) : '—'
      case 'roas': return r > 0 ? `${r.toFixed(2)}x` : '—'
      case 'donusum': return d > 0 ? sayi(d) : '—'
      case 'gosterim': return ins?.impressions ? sayi(ins.impressions) : '—'
      case 'tiklama': return ins?.clicks ? sayi(ins.clicks) : '—'
      case 'ctr': return ins?.ctr ? `%${parseFloat(ins.ctr).toFixed(2)}` : '—'
      case 'cpc': return ins?.cpc && parseFloat(ins.cpc) > 0 ? para(ins.cpc) : '—'
      default: return '—'
    }
  })()

  const renk = (() => {
    switch (alan) {
      case 'harcama': return '#f0883e'
      case 'gelir': return g > 0 ? '#3fb950' : '#484f58'
      case 'roas': return roasRenk(r)
      case 'donusum': return d > 0 ? '#58a6ff' : '#484f58'
      default: return '#8b949e'
    }
  })()

  return (
    <td style={{ padding: '12px', fontSize: '0.83rem', borderBottom: '1px solid #21262d', color: renk, fontWeight: ['harcama', 'gelir', 'roas'].includes(alan) ? 600 : 400, whiteSpace: 'nowrap' }}>
      {deger}
    </td>
  )
}

const ALANLAR = ['harcama', 'gelir', 'roas', 'donusum', 'gosterim', 'tiklama', 'ctr', 'cpc']
const ALAN_BASLIK: Record<string, string> = {
  harcama: 'Harcama', gelir: 'Gelir', roas: 'ROAS', donusum: 'Dönüşüm',
  gosterim: 'Gösterim', tiklama: 'Tıklama', ctr: 'CTR', cpc: 'CPC'
}

export default function Panel() {
  const [aktifHesap, setAktifHesap] = useState('karmen')
  const [donem, setDonem] = useState('30')
  const [baslangic, setBaslangic] = useState('')
  const [bitis, setBitis] = useState('')
  const [arama, setArama] = useState('')
  const [kampanyalar, setKampanyalar] = useState<Satir[]>([])
  const [reklamSetleri, setReklamSetleri] = useState<Record<string, Satir[]>>({})
  const [reklamlar, setReklamlar] = useState<Record<string, Satir[]>>({})
  const [acikKampanya, setAcikKampanya] = useState<string | null>(null)
  const [acikSet, setAcikSet] = useState<string | null>(null)
  const [yukleniyor, setYukleniyor] = useState(true)
  const [setYukLen, setSetYukLen] = useState<string | null>(null)
  const [rekYukLen, setRekYukLen] = useState<string | null>(null)
  const [hata, setHata] = useState('')
  const [grafik, setGrafik] = useState(true)
  const [statusFiltre, setStatusFiltre] = useState<'hepsi' | 'aktif' | 'durduruldu'>('hepsi')
  const router = useRouter()

  async function cikisYap() {
    await fetch('/api/auth', { method: 'DELETE' })
    router.push('/login')
  }
  const [siralama, setSiralama] = useState<{ alan: string; yon: 'asc' | 'desc' }>({ alan: 'harcama', yon: 'desc' })
  const baslangicRef = useRef(baslangic)
  const bitisRef = useRef(bitis)
  baslangicRef.current = baslangic
  bitisRef.current = bitis

  const yukle = useCallback(() => {
    setYukleniyor(true)
    setHata('')
    setKampanyalar([])
    setReklamSetleri({})
    setReklamlar({})
    setAcikKampanya(null)
    setAcikSet(null)

    let url = `/api/meta?hesap=${aktifHesap}&tur=kampanyalar&donem=${donem}`
    if (donem === 'ozel' && baslangicRef.current && bitisRef.current) {
      url += `&baslangic=${baslangicRef.current}&bitis=${bitisRef.current}`
    }

    fetch(url).then(r => r.json()).then(d => {
      if (d.error) setHata(d.error)
      else setKampanyalar(d.data || [])
      setYukleniyor(false)
    }).catch(() => { setHata('Bağlantı hatası'); setYukleniyor(false) })
  }, [aktifHesap, donem])

  useEffect(() => { yukle() }, [yukle])

  function kampanyaTikla(k: Satir) {
    if (acikKampanya === k.id) { setAcikKampanya(null); return }
    setAcikKampanya(k.id); setAcikSet(null)
    if (reklamSetleri[k.id]) return
    setSetYukLen(k.id)
    let url = `/api/meta?hesap=${aktifHesap}&tur=reklam-setleri&kampanya_id=${k.id}&donem=${donem}`
    if (donem === 'ozel' && baslangic && bitis) url += `&baslangic=${baslangic}&bitis=${bitis}`
    fetch(url).then(r => r.json()).then(d => {
      setReklamSetleri(p => ({ ...p, [k.id]: d.data || [] }))
      setSetYukLen(null)
    })
  }

  function setTikla(s: Satir) {
    if (acikSet === s.id) { setAcikSet(null); return }
    setAcikSet(s.id)
    if (reklamlar[s.id]) return
    setRekYukLen(s.id)
    let url = `/api/meta?hesap=${aktifHesap}&tur=reklamlar&set_id=${s.id}&donem=${donem}`
    if (donem === 'ozel' && baslangic && bitis) url += `&baslangic=${baslangic}&bitis=${bitis}`
    fetch(url).then(r => r.json()).then(d => {
      setReklamlar(p => ({ ...p, [s.id]: d.data || [] }))
      setRekYukLen(null)
    })
  }

  // Filtre + Sıralama
  const getSiralamaValue = (k: Satir, alan: string): number => {
    const ins = k.insights?.data[0]
    switch (alan) {
      case 'harcama': return parseFloat(ins?.spend || '0')
      case 'gelir': return getGelir(ins)
      case 'roas': return getRoas(ins)
      case 'donusum': return getDonusum(ins)
      case 'gosterim': return parseInt(ins?.impressions || '0')
      case 'tiklama': return parseInt(ins?.clicks || '0')
      case 'ctr': return parseFloat(ins?.ctr || '0')
      case 'cpc': return parseFloat(ins?.cpc || '0')
      default: return 0
    }
  }

  const filtreliKampanyalar = kampanyalar
    .filter(k => {
      const aramak = k.name.toLowerCase().includes(arama.toLowerCase())
      const statusOk = statusFiltre === 'hepsi' || (statusFiltre === 'aktif' ? k.status === 'ACTIVE' : k.status !== 'ACTIVE')
      return aramak && statusOk
    })
    .sort((a, b) => {
      const fark = getSiralamaValue(a, siralama.alan) - getSiralamaValue(b, siralama.alan)
      return siralama.yon === 'desc' ? -fark : fark
    })

  function sutunTikla(alan: string) {
    setSiralama(prev => ({
      alan,
      yon: prev.alan === alan && prev.yon === 'desc' ? 'asc' : 'desc'
    }))
  }

  // KPI
  const th = kampanyalar.reduce((a, k) => a + parseFloat(k.insights?.data[0]?.spend || '0'), 0)
  const tg = kampanyalar.reduce((a, k) => a + getGelir(k.insights?.data[0]), 0)
  const td = kampanyalar.reduce((a, k) => a + getDonusum(k.insights?.data[0]), 0)
  const tt = kampanyalar.reduce((a, k) => a + parseInt(k.insights?.data[0]?.clicks || '0'), 0)
  const tgos = kampanyalar.reduce((a, k) => a + parseInt(k.insights?.data[0]?.impressions || '0'), 0)
  const roas = th > 0 ? tg / th : 0
  const aktifSayi = kampanyalar.filter(k => k.status === 'ACTIVE').length

  // Grafik verisi
  const grafikKampanyalar = [...kampanyalar]
    .filter(k => parseFloat(k.insights?.data[0]?.spend || '0') > 0)
    .sort((a, b) => parseFloat(b.insights?.data[0]?.spend || '0') - parseFloat(a.insights?.data[0]?.spend || '0'))
    .slice(0, 8)

  const grafikData = {
    labels: grafikKampanyalar.map(k => k.name.length > 20 ? k.name.substring(0, 20) + '...' : k.name),
    datasets: [
      {
        label: 'Harcama (₺)',
        data: grafikKampanyalar.map(k => parseFloat(k.insights?.data[0]?.spend || '0')),
        backgroundColor: 'rgba(31, 111, 235, 0.8)',
        borderRadius: 6,
        yAxisID: 'y',
      },
      {
        label: 'Gelir (₺)',
        data: grafikKampanyalar.map(k => getGelir(k.insights?.data[0])),
        backgroundColor: 'rgba(63, 185, 80, 0.8)',
        borderRadius: 6,
        yAxisID: 'y',
      },
    ]
  }

  const hesapBilgi = HESAPLAR.find(h => h.id === aktifHesap)!

  // En iyi / en kötü
  const aktifKampanyalar = kampanyalar.filter(k => k.status === 'ACTIVE' && parseFloat(k.insights?.data[0]?.spend || '0') > 0)
  const enIyi = [...aktifKampanyalar].sort((a, b) => getRoas(b.insights?.data[0]) - getRoas(a.insights?.data[0]))[0]
  const enKotu = [...aktifKampanyalar].sort((a, b) => getRoas(a.insights?.data[0]) - getRoas(b.insights?.data[0]))[0]

  return (
    <div style={{ background: '#0d1117', minHeight: '100vh', color: '#e6edf3', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      {/* HEADER */}
      <header style={{ background: '#161b22', borderBottom: '1px solid #30363d', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '54px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>📊 Reklam Paneli</span>
          <div style={{ display: 'flex', gap: '4px' }}>
            {HESAPLAR.map(h => (
              <button key={h.id} onClick={() => setAktifHesap(h.id)} style={{
                padding: '4px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
                background: aktifHesap === h.id ? h.renk : '#21262d',
                color: aktifHesap === h.id ? '#fff' : '#8b949e',
                transition: 'all 0.15s'
              }}>{h.emoji} {h.ad}</button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {PRESETLER.filter(p => p.id !== 'ozel').map(p => (
            <button key={p.id} onClick={() => setDonem(p.id)} style={{
              padding: '3px 10px', borderRadius: '5px', border: 'none', cursor: 'pointer', fontSize: '0.75rem',
              background: donem === p.id ? '#30363d' : 'transparent',
              color: donem === p.id ? '#e6edf3' : '#8b949e',
            }}>{p.ad}</button>
          ))}
          <button onClick={() => setDonem('ozel')} style={{
            padding: '3px 10px', borderRadius: '5px', border: `1px solid ${donem === 'ozel' ? '#1f6feb' : '#30363d'}`, cursor: 'pointer', fontSize: '0.75rem',
            background: donem === 'ozel' ? '#1f6feb20' : 'transparent',
            color: donem === 'ozel' ? '#58a6ff' : '#8b949e',
          }}>📅 Özel</button>
          <span style={{ background: '#238636', color: '#fff', padding: '3px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 600, marginLeft: '6px' }}>● Canlı</span>
          <button onClick={cikisYap} style={{ background: 'transparent', border: '1px solid #30363d', color: '#8b949e', borderRadius: '6px', padding: '3px 10px', cursor: 'pointer', fontSize: '0.72rem', marginLeft: '8px' }}>Çıkış</button>
        </div>
      </header>

      {/* ÖZEL TARİH ARALIĞI */}
      {donem === 'ozel' && (
        <div style={{ background: '#161b22', borderBottom: '1px solid #30363d', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '0.82rem', color: '#8b949e' }}>Tarih Aralığı:</span>
          <input type="date" value={baslangic} onChange={e => setBaslangic(e.target.value)}
            style={{ background: '#21262d', border: '1px solid #30363d', borderRadius: '6px', color: '#e6edf3', padding: '5px 10px', fontSize: '0.82rem' }} />
          <span style={{ color: '#8b949e' }}>—</span>
          <input type="date" value={bitis} onChange={e => setBitis(e.target.value)}
            style={{ background: '#21262d', border: '1px solid #30363d', borderRadius: '6px', color: '#e6edf3', padding: '5px 10px', fontSize: '0.82rem' }} />
          <button onClick={yukle} style={{
            background: '#1f6feb', color: '#fff', border: 'none', borderRadius: '6px',
            padding: '5px 16px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600
          }}>Uygula</button>
        </div>
      )}

      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '20px 24px' }}>

        {!yukleniyor && !hata && (
          <>
            {/* KPI KARTLAR */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '10px', marginBottom: '20px' }}>
              {[
                { b: 'Toplam Harcama', d: para(th), r: '#a07850', a: `${aktifSayi}/${kampanyalar.length} aktif kampanya` },
                { b: 'Toplam Gelir', d: para(tg), r: '#57a86a', a: 'Dönüşüm geliri' },
                { b: 'ROAS', d: `${roas.toFixed(2)}x`, r: roasRenk(roas), a: 'Reklam harcama getirisi' },
                { b: 'Dönüşüm', d: sayi(td), r: '#4a7fa0', a: 'Toplam satış' },
                { b: 'Tıklama', d: sayi(tt), r: '#7a70a0', a: 'Toplam tıklama' },
                { b: 'Gösterim', d: tgos >= 1000000 ? `${(tgos / 1000000).toFixed(1)}M` : tgos >= 1000 ? `${(tgos / 1000).toFixed(0)}B` : sayi(tgos), r: '#4a7090', a: 'Toplam gösterim' },
                { b: 'Ort. CPC', d: tt > 0 ? para(th / tt) : '—', r: '#4a8a60', a: 'Tıklama başı maliyet' },
              ].map((k, i) => (
                <div key={i} style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '10px', padding: '14px', borderTop: `3px solid ${k.r}` }}>
                  <div style={{ fontSize: '0.68rem', color: '#8b949e', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{k.b}</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: k.r, marginBottom: '4px' }}>{k.d}</div>
                  <div style={{ fontSize: '0.68rem', color: '#484f58' }}>{k.a}</div>
                </div>
              ))}
            </div>

            {/* EN İYİ / EN KÖTÜ */}
            {enIyi && enKotu && enIyi.id !== enKotu.id && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
                <div style={{ background: '#161b22', border: '1px solid #1a3a2a', borderRadius: '10px', padding: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.68rem', color: '#3fb950', marginBottom: '4px', textTransform: 'uppercase' }}>🏆 En İyi ROAS</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{enIyi.name}</div>
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#3fb950' }}>{getRoas(enIyi.insights?.data[0]).toFixed(2)}x</div>
                </div>
                <div style={{ background: '#161b22', border: '1px solid #3a1a1a', borderRadius: '10px', padding: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.68rem', color: '#f85149', marginBottom: '4px', textTransform: 'uppercase' }}>⚠️ En Düşük ROAS</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{enKotu.name}</div>
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#f85149' }}>{getRoas(enKotu.insights?.data[0]).toFixed(2)}x</div>
                </div>
              </div>
            )}

            {/* GRAFİK */}
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '10px', marginBottom: '20px' }}>
              <div onClick={() => setGrafik(!grafik)} style={{ padding: '14px 20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>📊 Kampanya Bazlı Harcama & Gelir Karşılaştırması</span>
                <span style={{ color: '#8b949e', fontSize: '0.8rem' }}>{grafik ? '▲ Gizle' : '▼ Göster'}</span>
              </div>
              {grafik && (
                <div style={{ padding: '0 20px 20px' }}>
                  <Bar data={grafikData} options={{
                    responsive: true,
                    plugins: {
                      legend: { labels: { color: '#8b949e', font: { size: 11 } } },
                      tooltip: { callbacks: { label: (c) => ` ₺${parseFloat(String(c.raw)).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}` } }
                    },
                    scales: {
                      x: { ticks: { color: '#8b949e', font: { size: 10 } }, grid: { color: '#21262d' } },
                      y: { ticks: { color: '#8b949e', callback: (v) => `₺${Number(v).toLocaleString('tr-TR')}` }, grid: { color: '#21262d' } }
                    }
                  }} />
                </div>
              )}
            </div>

            {/* FİLTRELER */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', alignItems: 'center' }}>
              <input
                placeholder="🔍 Kampanya ara..."
                value={arama}
                onChange={e => setArama(e.target.value)}
                style={{ background: '#21262d', border: '1px solid #30363d', borderRadius: '6px', color: '#e6edf3', padding: '7px 14px', fontSize: '0.82rem', width: '240px' }}
              />
              {(['hepsi', 'aktif', 'durduruldu'] as const).map(s => (
                <button key={s} onClick={() => setStatusFiltre(s)} style={{
                  padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 500,
                  background: statusFiltre === s ? '#30363d' : 'transparent',
                  color: statusFiltre === s ? '#e6edf3' : '#8b949e',
                }}>
                  {s === 'hepsi' ? 'Tümü' : s === 'aktif' ? '● Aktif' : '■ Durduruldu'}
                </button>
              ))}
              <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: '#8b949e' }}>
                {filtreliKampanyalar.length} kampanya gösteriliyor
              </span>
            </div>

            {/* KAMPANYA TABLOSU */}
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #30363d', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{hesapBilgi.emoji} {hesapBilgi.ad} — Kampanyalar</span>
                <span style={{ fontSize: '0.75rem', color: '#8b949e' }}>▶ tıkla → reklam setleri · tekrar tıkla → reklamlar</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1000px' }}>
                  <thead>
                    <tr style={{ background: '#0d1117' }}>
                      <th style={{ textAlign: 'left', fontSize: '0.68rem', color: '#8b949e', textTransform: 'uppercase', padding: '9px 16px', borderBottom: '1px solid #30363d', width: '260px' }}>Kampanya</th>
                      <th style={{ textAlign: 'left', fontSize: '0.68rem', color: '#8b949e', textTransform: 'uppercase', padding: '9px 12px', borderBottom: '1px solid #30363d' }}>Durum</th>
                      {ALANLAR.map(a => (
                        <th key={a} onClick={() => sutunTikla(a)} style={{
                          textAlign: 'left', fontSize: '0.68rem', textTransform: 'uppercase', padding: '9px 12px',
                          borderBottom: '1px solid #30363d', cursor: 'pointer', userSelect: 'none',
                          color: siralama.alan === a ? '#e6edf3' : '#8b949e',
                          background: siralama.alan === a ? '#21262d' : 'transparent',
                        }}>
                          {ALAN_BASLIK[a]} {siralama.alan === a ? (siralama.yon === 'desc' ? '↓' : '↑') : '↕'}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtreliKampanyalar.map(k => (
                      <>
                        <tr key={k.id} onClick={() => kampanyaTikla(k)} style={{ cursor: 'pointer', background: acikKampanya === k.id ? '#1c2128' : 'transparent' }}
                          onMouseEnter={e => { if (acikKampanya !== k.id) e.currentTarget.style.background = '#1c2128' }}
                          onMouseLeave={e => { if (acikKampanya !== k.id) e.currentTarget.style.background = 'transparent' }}>
                          <td style={{ padding: '12px 16px', fontSize: '0.83rem', borderBottom: '1px solid #21262d' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ color: '#8b949e', fontSize: '0.75rem', minWidth: '12px' }}>{acikKampanya === k.id ? '▼' : '▶'}</span>
                              <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '220px' }}>{k.name}</span>
                            </div>
                          </td>
                          <td style={{ padding: '12px', borderBottom: '1px solid #21262d' }}><Badge status={k.status} /></td>
                          {ALANLAR.map(a => <MetrikHucre key={a} ins={k.insights?.data[0]} alan={a} />)}
                        </tr>

                        {/* REKLAM SETLERİ */}
                        {acikKampanya === k.id && (
                          setYukLen === k.id ? (
                            <tr key={`${k.id}-l`}><td colSpan={11} style={{ padding: '10px 40px', color: '#8b949e', fontSize: '0.78rem', background: '#161b22', borderBottom: '1px solid #21262d' }}>⏳ Reklam setleri yükleniyor...</td></tr>
                          ) : (reklamSetleri[k.id] || []).map(s => (
                            <>
                              <tr key={s.id} onClick={() => setTikla(s)} style={{ cursor: 'pointer', background: acikSet === s.id ? '#21262d' : '#191e24' }}
                                onMouseEnter={e => { if (acikSet !== s.id) e.currentTarget.style.background = '#21262d' }}
                                onMouseLeave={e => { if (acikSet !== s.id) e.currentTarget.style.background = '#191e24' }}>
                                <td style={{ padding: '10px 16px 10px 36px', fontSize: '0.8rem', borderBottom: '1px solid #21262d' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ color: '#8b949e', fontSize: '0.7rem', minWidth: '12px' }}>{acikSet === s.id ? '▼' : '▶'}</span>
                                    <span style={{ color: '#79c0ff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>📦 {s.name}</span>
                                  </div>
                                </td>
                                <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d' }}><Badge status={s.status} /></td>
                                {ALANLAR.map(a => <MetrikHucre key={a} ins={s.insights?.data[0]} alan={a} />)}
                              </tr>

                              {/* REKLAMLAR */}
                              {acikSet === s.id && (
                                rekYukLen === s.id ? (
                                  <tr key={`${s.id}-l`}><td colSpan={11} style={{ padding: '8px 64px', color: '#8b949e', fontSize: '0.75rem', background: '#0d1117', borderBottom: '1px solid #21262d' }}>⏳ Reklamlar yükleniyor...</td></tr>
                                ) : (reklamlar[s.id] || []).map(r => (
                                  <tr key={r.id} style={{ background: '#0d1117' }}>
                                    <td style={{ padding: '9px 16px 9px 58px', fontSize: '0.78rem', borderBottom: '1px solid #21262d' }}>
                                      <span style={{ color: '#d2a8ff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: '180px' }}>🎯 {r.name}</span>
                                    </td>
                                    <td style={{ padding: '9px 12px', borderBottom: '1px solid #21262d' }}><Badge status={r.status} /></td>
                                    {ALANLAR.map(a => <MetrikHucre key={a} ins={r.insights?.data[0]} alan={a} />)}
                                  </tr>
                                ))
                              )}
                            </>
                          ))
                        )}
                      </>
                    ))}
                    {filtreliKampanyalar.length === 0 && (
                      <tr><td colSpan={11} style={{ textAlign: 'center', padding: '40px', color: '#8b949e' }}>Kampanya bulunamadı</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {yukleniyor && (
          <div style={{ textAlign: 'center', padding: '80px', color: '#8b949e' }}>
            <div style={{ fontSize: '2rem', marginBottom: '12px' }}>⏳</div>
            <p>{hesapBilgi.ad} kampanyaları yükleniyor...</p>
          </div>
        )}

        {hata && (
          <div style={{ background: '#3a1a1a', border: '1px solid #f85149', borderRadius: '10px', padding: '16px 20px', color: '#f85149' }}>
            <strong>⚠️ Hata:</strong> {hata}
            <p style={{ color: '#8b949e', marginTop: '6px', fontSize: '0.82rem' }}>Token süresi dolmuş olabilir. .env.local dosyasındaki META_ACCESS_TOKEN&apos;ı güncelle.</p>
          </div>
        )}
      </main>
    </div>
  )
}
