'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import Sidebar from '../../../components/Sidebar'
import { C } from '../../../lib/theme'
import { globalModelOku } from '../../../components/Sidebar'

// ─── Tipler ──────────────────────────────────────────────────────
interface ReklamGrubu {
  id: number; ad: string; durum: number; harcama: string
  tiklama: number; gosterim: number; ctr: string; donusum: number
  gelir: string; roas: string; ort_cpc: string
}
interface Kelime {
  kelime: string; esleme: string; grup: string; durum: number
  harcama: string; tiklama: number; gosterim: number; ctr: string
  donusum: number; gelir: string; roas: string; ort_cpc: string
  gosterim_payi: string | null
  qs: number | null; qs_ctr: string | null; qs_alakalilik: string | null; qs_landing: string | null
}
interface Cihaz {
  cihaz: string; harcama: string; tiklama: number; gosterim: number
  ctr: string; donusum: number; gelir: string; roas: string; ort_cpc: string
}
interface GunlukVeri {
  tarih: string; harcama: string; tiklama: number; gosterim: number
  donusum: number; gelir: string; roas: string
}
interface ReklamMetni {
  id: string; grup: string; tip: string
  basliklar: string[]; aciklamalar: string[]; url: string
  harcama: string; tiklama: number; gosterim: number; ctr: string
  donusum: number; gelir: string; roas: string; ort_cpc: string
}
interface AramaTerimi {
  terim: string; durum: string; grup: string
  harcama: string; tiklama: number; gosterim: number; ctr: string
  donusum: number; gelir: string; roas: string; ort_cpc: string
  negatifAday: boolean
}
interface AssetItem { tur: string; metin: string; perf: string; perfLabel: string }
interface AssetGrubu {
  id: string; ad: string; guc: string
  harcama: string; tiklama: number; gosterim: number
  donusum: number; gelir: string; roas: string
  assetler: AssetItem[]
}

// Tüm olası sekmeler
type Sekme = 'Reklam Grupları' | 'Anahtar Kelimeler' | 'Reklam Metinleri' | 'Arama Terimleri' | 'Asset Grupları' | 'Cihaz Kırılımı' | 'Günlük Trend'

// ─── Yardımcılar ─────────────────────────────────────────────────
function para(v: string | number) {
  return `₺${parseFloat(String(v)).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function sayi(n: number) { return n.toLocaleString('tr-TR') }
function roasRenk(r: number) {
  if (r >= 5) return '#059669'
  if (r >= 3) return '#0284C7'
  if (r >= 1.5) return '#D97706'
  return '#DC2626'
}

function DurumBadge({ durum }: { durum: number }) {
  const aktif = durum === 2
  return (
    <span style={{
      padding: '2px 8px', borderRadius: '20px', fontSize: '0.65rem', fontWeight: 600,
      background: aktif ? '#DCFCE7' : '#FEE2E2',
      color: aktif ? '#166534' : '#991B1B',
    }}>
      {aktif ? '● Aktif' : '■ Durdu'}
    </span>
  )
}

function QsBadge({ skor }: { skor: number | null }) {
  if (skor === null) return <span style={{ color: C.faint, fontSize: '0.75rem' }}>—</span>
  const renk = skor >= 7 ? '#059669' : skor >= 5 ? '#D97706' : '#DC2626'
  const bg   = skor >= 7 ? '#DCFCE7' : skor >= 5 ? '#FEF3C7' : '#FEE2E2'
  return (
    <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 700, background: bg, color: renk }}>
      {skor}/10
    </span>
  )
}

function QsEtiket({ label }: { label: string | null }) {
  if (!label || label === '—') return <span style={{ color: C.faint, fontSize: '0.72rem' }}>—</span>
  const renk = label === 'Yüksek' ? '#059669' : label === 'Orta' ? '#D97706' : '#DC2626'
  return <span style={{ fontSize: '0.72rem', color: renk, fontWeight: 600 }}>{label}</span>
}

function PerfLabel({ label, perf }: { label: string; perf: string }) {
  const renkMap: Record<string, string> = {
    BEST: '#059669', GOOD: '#0284C7', LOW: '#DC2626', PENDING: '#D97706'
  }
  const bgMap: Record<string, string> = {
    BEST: '#DCFCE7', GOOD: '#EFF6FF', LOW: '#FEE2E2', PENDING: '#FEF3C7'
  }
  if (!perf || perf === 'UNSPECIFIED' || perf === 'UNKNOWN') return <span style={{ color: C.faint, fontSize: '0.72rem' }}>—</span>
  return (
    <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700, background: bgMap[perf] || C.bg, color: renkMap[perf] || C.muted }}>
      {label}
    </span>
  )
}

function MarkdownGoster({ metin }: { metin: string }) {
  return (
    <div style={{ fontSize: '0.84rem', color: C.text, lineHeight: 1.7 }}>
      {metin.split('\n').map((satir, i) => {
        if (satir.startsWith('## ')) return <h3 key={i} style={{ fontSize: '0.95rem', fontWeight: 700, color: C.primary, margin: '18px 0 6px', borderBottom: `1px solid ${C.border}`, paddingBottom: '4px' }}>{satir.replace('## ', '')}</h3>
        if (satir.startsWith('### ')) return <h4 key={i} style={{ fontSize: '0.88rem', fontWeight: 700, color: C.text, margin: '12px 0 4px' }}>{satir.replace('### ', '')}</h4>
        if (satir.match(/^\d+\./)) {
          const m = satir.match(/^(\d+\.)(.*)/)
          return <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '5px' }}><span style={{ color: C.primary, fontWeight: 700, minWidth: '18px' }}>{m?.[1]}</span><span dangerouslySetInnerHTML={{ __html: (m?.[2] || '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} /></div>
        }
        if (satir.startsWith('- ') || satir.startsWith('• ')) return <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '3px', paddingLeft: '8px' }}><span style={{ color: C.primary }}>·</span><span dangerouslySetInnerHTML={{ __html: satir.replace(/^[-•]\s/, '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} /></div>
        if (satir.trim() === '') return <div key={i} style={{ height: '5px' }} />
        return <p key={i} style={{ margin: '0 0 5px' }} dangerouslySetInnerHTML={{ __html: satir.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
      })}
    </div>
  )
}

// ─── Ana Bileşen ─────────────────────────────────────────────────
function Icerik() {
  const params = useParams()
  const searchParams = useSearchParams()
  const kampanyaId = params.id as string
  const hesap = searchParams.get('hesap') || 'karmen'
  const kampanyaAd = searchParams.get('ad') || 'Kampanya'
  const kampanyaTip = searchParams.get('tip') || ''

  const [donem, setDonem] = useState('30')
  const [aktifSekme, setAktifSekme] = useState<Sekme>('Reklam Grupları')
  const [gruplar, setGruplar] = useState<ReklamGrubu[]>([])
  const [kelimeler, setKelimeler] = useState<Kelime[]>([])
  const [cihazlar, setCihazlar] = useState<Cihaz[]>([])
  const [gunluk, setGunluk] = useState<GunlukVeri[]>([])
  const [reklamMetinleri, setReklamMetinleri] = useState<ReklamMetni[]>([])
  const [aramaTerimleri, setAramaTerimleri] = useState<AramaTerimi[]>([])
  const [assetGruplari, setAssetGruplari] = useState<AssetGrubu[]>([])
  const [yukleniyor, setYukleniyor] = useState(false)
  const [aiMetin, setAiMetin] = useState('')
  const [aiYukleniyor, setAiYukleniyor] = useState(false)
  const [aiAcik, setAiAcik] = useState(false)
  const [aiModel, setAiModel] = useState('claude-sonnet-4-6')

  // Arama terimleri filtresi
  const [aramaSadeceProblem, setAramaSadeceProblem] = useState(false)

  // Asset grubu genişletme
  const [acikAsset, setAcikAsset] = useState<string | null>(null)

  useEffect(() => {
    setAiModel(globalModelOku())
    const onModel = (e: Event) => setAiModel((e as CustomEvent).detail)
    window.addEventListener('modelDegisti', onModel)
    return () => window.removeEventListener('modelDegisti', onModel)
  }, [])

  const yukle = useCallback(async (sekme: Sekme) => {
    setYukleniyor(true)
    const base = `/api/google-ads?hesap=${hesap}&donem=${donem}&kampanya_id=${kampanyaId}`
    try {
      if (sekme === 'Reklam Grupları') {
        const d = await fetch(`${base}&tur=reklam-gruplari`).then(r => r.json())
        setGruplar(d.data || [])
      } else if (sekme === 'Anahtar Kelimeler') {
        const d = await fetch(`${base}&tur=anahtar-kelimeler`).then(r => r.json())
        setKelimeler(d.data || [])
      } else if (sekme === 'Reklam Metinleri') {
        const d = await fetch(`${base}&tur=reklam-metinleri`).then(r => r.json())
        setReklamMetinleri(d.data || [])
      } else if (sekme === 'Arama Terimleri') {
        const d = await fetch(`${base}&tur=arama-terimleri`).then(r => r.json())
        setAramaTerimleri(d.data || [])
      } else if (sekme === 'Asset Grupları') {
        const d = await fetch(`${base}&tur=asset-gruplari`).then(r => r.json())
        setAssetGruplari(d.data || [])
      } else if (sekme === 'Cihaz Kırılımı') {
        const d = await fetch(`${base}&tur=cihaz-kirilim`).then(r => r.json())
        setCihazlar(d.data || [])
      } else if (sekme === 'Günlük Trend') {
        const d = await fetch(`${base}&tur=gunluk`).then(r => r.json())
        setGunluk(d.data || [])
      }
    } catch { /* silent */ }
    setYukleniyor(false)
  }, [hesap, donem, kampanyaId])

  useEffect(() => { yukle(aktifSekme) }, [yukle, aktifSekme])

  async function aiAnalizYap() {
    setAiYukleniyor(true)
    setAiAcik(true)
    setAiMetin('')
    try {
      const veri = await fetch(`/api/google-ads?hesap=${hesap}&donem=${donem}&kampanya_id=${kampanyaId}&tur=reklam-gruplari`).then(r => r.json())
      const hesapAdi = hesap === 'karmen' ? 'Karmen Halı' : 'Cotto Home'
      const donemAdi = { '7': '7 Gün', '14': '14 Gün', '30': '30 Gün', '90': '90 Gün' }[donem] || '30 Gün'
      const res = await fetch('/api/google-ads-analiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kampanyalar: veri.data || [],
          hesapAdi: `${hesapAdi} — ${kampanyaAd}`,
          donem: donemAdi,
          model: aiModel,
          kampanyaTip,
        })
      })
      const data = await res.json()
      setAiMetin(data.analiz ? JSON.stringify(data.analiz, null, 2) : data.error || 'Analiz yapılamadı')
    } catch { setAiMetin('Bağlantı hatası.') }
    setAiYukleniyor(false)
  }

  // Sekme listesi — kampanya tipine göre
  const sekmeler: Sekme[] = (() => {
    if (kampanyaTip === 'Search') {
      return ['Reklam Grupları', 'Anahtar Kelimeler', 'Reklam Metinleri', 'Arama Terimleri', 'Cihaz Kırılımı', 'Günlük Trend']
    }
    if (kampanyaTip === 'Performance Max') {
      return ['Asset Grupları', 'Cihaz Kırılımı', 'Günlük Trend']
    }
    return ['Reklam Grupları', 'Cihaz Kırılımı', 'Günlük Trend']
  })()

  const thS: React.CSSProperties = {
    padding: '9px 12px', fontSize: '0.7rem', fontWeight: 700, color: C.muted,
    textAlign: 'left', background: C.tableHead, borderBottom: `2px solid ${C.border}`, whiteSpace: 'nowrap'
  }
  const tdS: React.CSSProperties = {
    padding: '10px 12px', fontSize: '0.82rem', borderBottom: `1px solid ${C.borderLight}`, whiteSpace: 'nowrap'
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg }}>
      <Sidebar />
      <div style={{ marginLeft: '220px', flex: 1, padding: '28px 32px' }}>

        {/* ── Başlık ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <Link href="/google-ads" style={{ color: C.muted, textDecoration: 'none', fontSize: '0.8rem' }}>
            ← Google Ads
          </Link>
          <span style={{ color: C.faint }}>›</span>
          <div>
            <h1 style={{ fontSize: '1.1rem', fontWeight: 800, color: C.text, margin: 0 }}>{kampanyaAd}</h1>
            <div style={{ fontSize: '0.72rem', color: C.faint, marginTop: '2px' }}>
              {hesap === 'karmen' ? 'Karmen Halı' : 'Cotto Home'} · {kampanyaTip && <span style={{ color: C.primary, fontWeight: 600 }}>{kampanyaTip}</span>}
            </div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {['7', '14', '30', '90'].map(d => (
              <button key={d} onClick={() => setDonem(d)} style={{
                padding: '5px 10px', borderRadius: '8px',
                border: `1px solid ${donem === d ? C.primary + '60' : C.border}`,
                background: donem === d ? C.primary + '10' : C.card,
                color: donem === d ? C.primary : C.muted,
                cursor: 'pointer', fontSize: '0.75rem', fontWeight: donem === d ? 700 : 400
              }}>{d}g</button>
            ))}
            <button onClick={aiAnalizYap} style={{
              padding: '6px 14px', borderRadius: '8px', border: 'none',
              background: '#7C3AED', color: '#fff', cursor: 'pointer',
              fontSize: '0.8rem', fontWeight: 600
            }}>🤖 AI Analiz</button>
          </div>
        </div>

        {/* ── Sekmeler ── */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', borderBottom: `1px solid ${C.border}`, paddingBottom: '0', flexWrap: 'wrap' }}>
          {sekmeler.map(s => (
            <button key={s} onClick={() => setAktifSekme(s)} style={{
              padding: '8px 14px', borderRadius: '8px 8px 0 0',
              border: `1px solid ${aktifSekme === s ? C.border : 'transparent'}`,
              borderBottom: aktifSekme === s ? `1px solid ${C.card}` : 'transparent',
              background: aktifSekme === s ? C.card : 'transparent',
              color: aktifSekme === s ? C.primary : C.muted,
              cursor: 'pointer', fontSize: '0.8rem', fontWeight: aktifSekme === s ? 700 : 400,
              marginBottom: '-1px', position: 'relative'
            }}>{s}</button>
          ))}
        </div>

        {/* ── İçerik ── */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', overflow: 'hidden' }}>
          {yukleniyor ? (
            <div style={{ padding: '40px', textAlign: 'center', color: C.faint, fontSize: '0.85rem' }}>⏳ Yükleniyor...</div>
          ) : (
            <>
              {/* ── Reklam Grupları ── */}
              {aktifSekme === 'Reklam Grupları' && (
                <div style={{ overflowX: 'auto' }}>
                  {gruplar.length === 0 ? (
                    <div style={{ padding: '32px', textAlign: 'center', color: C.faint, fontSize: '0.85rem' }}>
                      📭 Bu dönemde reklam grubu bulunamadı.
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr>
                        {['Reklam Grubu', 'Harcama', 'Gelir', 'ROAS', 'Dönüşüm', 'Tıklama', 'Gösterim', 'CTR', 'CPC', 'Durum'].map(h => <th key={h} style={thS}>{h}</th>)}
                      </tr></thead>
                      <tbody>
                        {gruplar.map(g => (
                          <tr key={g.id} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                            <td style={{ ...tdS, fontWeight: 600, color: C.text, maxWidth: '260px' }}>{g.ad}</td>
                            <td style={{ ...tdS, color: '#C2410C', fontWeight: 600 }}>{para(g.harcama)}</td>
                            <td style={{ ...tdS, color: parseFloat(g.gelir) > 0 ? '#059669' : C.faint }}>{parseFloat(g.gelir) > 0 ? para(g.gelir) : '—'}</td>
                            <td style={tdS}>{parseFloat(g.roas) > 0 ? <span style={{ color: roasRenk(parseFloat(g.roas)), fontWeight: 700 }}>{parseFloat(g.roas).toFixed(2)}x</span> : <span style={{ color: C.faint }}>—</span>}</td>
                            <td style={{ ...tdS, color: g.donusum > 0 ? '#0284C7' : C.faint }}>{g.donusum > 0 ? g.donusum.toFixed(1) : '—'}</td>
                            <td style={{ ...tdS, color: C.muted }}>{sayi(g.tiklama)}</td>
                            <td style={{ ...tdS, color: C.faint }}>{sayi(g.gosterim)}</td>
                            <td style={{ ...tdS, color: C.muted }}>%{g.ctr}</td>
                            <td style={{ ...tdS, color: C.muted }}>{parseFloat(g.ort_cpc) > 0 ? para(g.ort_cpc) : '—'}</td>
                            <td style={tdS}><DurumBadge durum={g.durum} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* ── Anahtar Kelimeler (+ Quality Score) ── */}
              {aktifSekme === 'Anahtar Kelimeler' && (
                <div style={{ overflowX: 'auto' }}>
                  {kelimeler.length === 0 ? (
                    <div style={{ padding: '32px', textAlign: 'center', color: C.faint }}>📭 Anahtar kelime bulunamadı.</div>
                  ) : (
                    <>
                      {/* Quality Score Özet */}
                      {kelimeler.some(k => k.qs !== null) && (
                        <div style={{ padding: '12px 16px', background: '#EFF6FF', borderBottom: `1px solid #BFDBFE`, display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                          <div style={{ fontSize: '0.72rem', color: '#1D4ED8', fontWeight: 700 }}>📊 Quality Score Özeti:</div>
                          {[
                            { label: '≥7 İyi', count: kelimeler.filter(k => k.qs !== null && k.qs >= 7).length, renk: '#059669' },
                            { label: '5-6 Orta', count: kelimeler.filter(k => k.qs !== null && k.qs >= 5 && k.qs < 7).length, renk: '#D97706' },
                            { label: '≤4 Düşük', count: kelimeler.filter(k => k.qs !== null && k.qs < 5).length, renk: '#DC2626' },
                            { label: 'QS Yok', count: kelimeler.filter(k => k.qs === null).length, renk: C.faint },
                          ].map(s => (
                            <div key={s.label} style={{ fontSize: '0.72rem' }}>
                              <span style={{ color: s.renk, fontWeight: 700 }}>{s.count}</span>
                              <span style={{ color: C.muted, marginLeft: '4px' }}>{s.label}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead><tr>
                          {['Anahtar Kelime', 'Eşleme', 'QS', 'Tahm. CTR', 'Reklam Uyum', 'Landing', 'Harcama', 'Gelir', 'ROAS', 'Dön.', 'Tıklama', 'CTR', 'CPC', 'G.Payı', 'Durum'].map(h => <th key={h} style={thS}>{h}</th>)}
                        </tr></thead>
                        <tbody>
                          {kelimeler.map((k, i) => (
                            <tr key={i} style={{ borderBottom: `1px solid ${C.borderLight}`, background: k.qs !== null && k.qs < 5 ? '#FFF5F5' : 'transparent' }}>
                              <td style={{ ...tdS, fontWeight: 600, color: C.text, maxWidth: '200px' }}>{k.kelime}</td>
                              <td style={tdS}>
                                <span style={{
                                  fontSize: '0.65rem', padding: '1px 6px', borderRadius: '4px', fontWeight: 700,
                                  background: k.esleme === 'Tam' ? '#DCFCE7' : k.esleme === 'İfade' ? '#EFF6FF' : '#FFFBEB',
                                  color: k.esleme === 'Tam' ? '#166534' : k.esleme === 'İfade' ? '#1D4ED8' : '#92400E',
                                }}>{k.esleme}</span>
                              </td>
                              <td style={tdS}><QsBadge skor={k.qs} /></td>
                              <td style={tdS}><QsEtiket label={k.qs_ctr} /></td>
                              <td style={tdS}><QsEtiket label={k.qs_alakalilik} /></td>
                              <td style={tdS}><QsEtiket label={k.qs_landing} /></td>
                              <td style={{ ...tdS, color: '#C2410C', fontWeight: 600 }}>{para(k.harcama)}</td>
                              <td style={{ ...tdS, color: parseFloat(k.gelir) > 0 ? '#059669' : C.faint }}>{parseFloat(k.gelir) > 0 ? para(k.gelir) : '—'}</td>
                              <td style={tdS}>{parseFloat(k.roas) > 0 ? <span style={{ color: roasRenk(parseFloat(k.roas)), fontWeight: 700 }}>{parseFloat(k.roas).toFixed(2)}x</span> : <span style={{ color: C.faint }}>—</span>}</td>
                              <td style={{ ...tdS, color: k.donusum > 0 ? '#0284C7' : C.faint }}>{k.donusum > 0 ? k.donusum.toFixed(1) : '—'}</td>
                              <td style={{ ...tdS, color: C.muted }}>{sayi(k.tiklama)}</td>
                              <td style={{ ...tdS, color: C.muted }}>%{k.ctr}</td>
                              <td style={{ ...tdS, color: C.muted }}>{parseFloat(k.ort_cpc) > 0 ? para(k.ort_cpc) : '—'}</td>
                              <td style={{ ...tdS, color: C.faint }}>{k.gosterim_payi ? `%${k.gosterim_payi}` : '—'}</td>
                              <td style={tdS}><DurumBadge durum={k.durum} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}
                </div>
              )}

              {/* ── Reklam Metinleri ── */}
              {aktifSekme === 'Reklam Metinleri' && (
                <div style={{ padding: '16px' }}>
                  {reklamMetinleri.length === 0 ? (
                    <div style={{ padding: '32px', textAlign: 'center', color: C.faint }}>📭 Reklam metni bulunamadı.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {reklamMetinleri.map((r, i) => {
                        const roas = parseFloat(r.roas)
                        return (
                          <div key={i} style={{
                            background: C.bg, border: `1px solid ${C.border}`, borderRadius: '10px',
                            overflow: 'hidden'
                          }}>
                            {/* Reklam başlığı */}
                            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: r.tip === 'RSA' ? '#EDE9FE' : '#E0F2FE', color: r.tip === 'RSA' ? '#5B21B6' : '#0369A1' }}>{r.tip}</span>
                              <span style={{ fontSize: '0.8rem', color: C.muted, fontWeight: 500 }}>{r.grup}</span>
                              <div style={{ marginLeft: 'auto', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                                {[
                                  { b: 'Harcama', d: para(r.harcama), renk: '#C2410C' },
                                  { b: 'Tıklama', d: sayi(r.tiklama), renk: C.muted },
                                  { b: 'CTR', d: `%${r.ctr}`, renk: parseFloat(r.ctr) >= 3 ? '#059669' : parseFloat(r.ctr) >= 1.5 ? '#D97706' : '#DC2626' },
                                  { b: 'Dönüşüm', d: r.donusum > 0 ? r.donusum.toFixed(1) : '—', renk: '#0284C7' },
                                  { b: 'ROAS', d: roas > 0 ? `${roas.toFixed(2)}x` : '—', renk: roasRenk(roas) },
                                ].map(m => (
                                  <div key={m.b} style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '0.6rem', color: C.faint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{m.b}</div>
                                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: m.renk }}>{m.d}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                            {/* Başlıklar */}
                            <div style={{ padding: '12px 16px' }}>
                              {r.basliklar.length > 0 && (
                                <div style={{ marginBottom: '10px' }}>
                                  <div style={{ fontSize: '0.62rem', color: C.faint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>BAŞLIKLAR ({r.basliklar.length})</div>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    {r.basliklar.map((b, j) => (
                                      <span key={j} style={{ fontSize: '0.78rem', padding: '3px 10px', borderRadius: '6px', background: '#F5F3FF', color: '#4C1D95', border: '1px solid #DDD6FE', fontWeight: 500 }}>{b}</span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {r.aciklamalar.length > 0 && (
                                <div>
                                  <div style={{ fontSize: '0.62rem', color: C.faint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>AÇIKLAMALAR ({r.aciklamalar.length})</div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {r.aciklamalar.map((a, j) => (
                                      <div key={j} style={{ fontSize: '0.8rem', color: C.text, padding: '6px 10px', borderRadius: '6px', background: C.card, border: `1px solid ${C.border}` }}>{a}</div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── Arama Terimleri ── */}
              {aktifSekme === 'Arama Terimleri' && (
                <div style={{ overflowX: 'auto' }}>
                  {aramaTerimleri.length === 0 ? (
                    <div style={{ padding: '32px', textAlign: 'center', color: C.faint }}>📭 Arama terimi bulunamadı.</div>
                  ) : (
                    <>
                      {/* Üst bar */}
                      <div style={{ padding: '10px 16px', background: '#FFF7ED', borderBottom: `1px solid #FED7AA`, display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', gap: '16px', flex: 1, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.72rem', color: '#C2410C', fontWeight: 700 }}>
                            🚨 {aramaTerimleri.filter(t => t.negatifAday).length} negatif aday
                          </span>
                          <span style={{ fontSize: '0.72rem', color: C.muted }}>
                            Toplam {aramaTerimleri.length} arama terimi · En pahalı 200 gösteriliyor
                          </span>
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.75rem', color: C.text, fontWeight: 600 }}>
                          <input
                            type="checkbox"
                            checked={aramaSadeceProblem}
                            onChange={e => setAramaSadeceProblem(e.target.checked)}
                            style={{ accentColor: '#DC2626' }}
                          />
                          Sadece negatif adayları göster
                        </label>
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead><tr>
                          {['Arama Terimi', 'Grup', 'Harcama', 'Gelir', 'ROAS', 'Dön.', 'Tıklama', 'CTR', 'CPC', 'Durum'].map(h => <th key={h} style={thS}>{h}</th>)}
                        </tr></thead>
                        <tbody>
                          {aramaTerimleri
                            .filter(t => !aramaSadeceProblem || t.negatifAday)
                            .map((t, i) => {
                              const roas = parseFloat(t.roas)
                              const harcama = parseFloat(t.harcama)
                              const durumRenk = t.durum === 'EXCLUDED' || t.durum === 'ADDED_EXCLUDED' ? '#DC2626' : t.durum === 'ADDED' ? '#059669' : C.muted
                              const durumLabel: Record<string, string> = { ADDED: 'Eklendi', EXCLUDED: 'Hariç', ADDED_EXCLUDED: 'Hariç+', NONE: '—' }
                              return (
                                <tr key={i} style={{ borderBottom: `1px solid ${C.borderLight}`, background: t.negatifAday ? '#FFF5F5' : 'transparent' }}>
                                  <td style={{ ...tdS, maxWidth: '240px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      {t.negatifAday && <span title="Negatif aday: yüksek harcama, sıfır dönüşüm" style={{ fontSize: '0.7rem', background: '#FEE2E2', color: '#DC2626', padding: '1px 5px', borderRadius: '4px', fontWeight: 700, flexShrink: 0 }}>⚠️ NEG</span>}
                                      <span style={{ fontWeight: t.negatifAday ? 700 : 500, color: t.negatifAday ? '#DC2626' : C.text, wordBreak: 'break-word', whiteSpace: 'normal', fontSize: '0.8rem' }}>{t.terim}</span>
                                    </div>
                                  </td>
                                  <td style={{ ...tdS, color: C.muted, maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.grup}</td>
                                  <td style={{ ...tdS, color: '#C2410C', fontWeight: 600 }}>{harcama > 0 ? para(t.harcama) : '—'}</td>
                                  <td style={{ ...tdS, color: parseFloat(t.gelir) > 0 ? '#059669' : C.faint }}>{parseFloat(t.gelir) > 0 ? para(t.gelir) : '—'}</td>
                                  <td style={tdS}>{roas > 0 ? <span style={{ color: roasRenk(roas), fontWeight: 700 }}>{roas.toFixed(2)}x</span> : <span style={{ color: C.faint }}>—</span>}</td>
                                  <td style={{ ...tdS, color: t.donusum > 0 ? '#0284C7' : C.faint }}>{t.donusum > 0 ? t.donusum.toFixed(1) : '—'}</td>
                                  <td style={{ ...tdS, color: C.muted }}>{sayi(t.tiklama)}</td>
                                  <td style={{ ...tdS, color: C.muted }}>%{t.ctr}</td>
                                  <td style={{ ...tdS, color: C.muted }}>{parseFloat(t.ort_cpc) > 0 ? para(t.ort_cpc) : '—'}</td>
                                  <td style={tdS}><span style={{ fontSize: '0.7rem', fontWeight: 600, color: durumRenk }}>{durumLabel[t.durum] || t.durum}</span></td>
                                </tr>
                              )
                            })}
                        </tbody>
                      </table>
                    </>
                  )}
                </div>
              )}

              {/* ── Asset Grupları (PMax) ── */}
              {aktifSekme === 'Asset Grupları' && (
                <div style={{ padding: '16px' }}>
                  {assetGruplari.length === 0 ? (
                    <div style={{ padding: '32px', textAlign: 'center', color: C.faint }}>
                      📭 Asset grubu bulunamadı.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {assetGruplari.map(grp => {
                        const roas = parseFloat(grp.roas)
                        const acik = acikAsset === grp.id
                        const gucRenk: Record<string, string> = { 'Mükemmel': '#059669', 'İyi': '#0284C7', 'Orta': '#D97706', 'Zayıf': '#DC2626', 'Bekleniyor': C.muted }
                        const gucBg: Record<string, string>   = { 'Mükemmel': '#DCFCE7', 'İyi': '#EFF6FF', 'Orta': '#FEF3C7', 'Zayıf': '#FEE2E2', 'Bekleniyor': C.bg }
                        return (
                          <div key={grp.id} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: '10px', overflow: 'hidden' }}>
                            {/* Grup başlığı */}
                            <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', cursor: 'pointer' }} onClick={() => setAcikAsset(acik ? null : grp.id)}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                  <span style={{ fontWeight: 700, fontSize: '0.88rem', color: C.text }}>{grp.ad}</span>
                                  <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', background: gucBg[grp.guc] || C.bg, color: gucRenk[grp.guc] || C.muted }}>
                                    {grp.guc === 'Mükemmel' ? '⭐' : grp.guc === 'İyi' ? '✅' : grp.guc === 'Zayıf' ? '⚠️' : '📊'} {grp.guc}
                                  </span>
                                </div>
                                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                                  {[
                                    { b: 'Harcama', d: para(grp.harcama), r: '#C2410C' },
                                    { b: 'Gelir', d: parseFloat(grp.gelir) > 0 ? para(grp.gelir) : '—', r: '#059669' },
                                    { b: 'ROAS', d: roas > 0 ? `${roas.toFixed(2)}x` : '—', r: roasRenk(roas) },
                                    { b: 'Dönüşüm', d: grp.donusum > 0 ? grp.donusum.toFixed(1) : '—', r: '#0284C7' },
                                    { b: 'Gösterim', d: sayi(grp.gosterim), r: C.muted },
                                  ].map(m => (
                                    <div key={m.b}>
                                      <div style={{ fontSize: '0.58rem', color: C.faint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{m.b}</div>
                                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: m.r }}>{m.d}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div style={{ flexShrink: 0, color: C.muted, fontSize: '0.8rem' }}>
                                {acik ? '▲ Gizle' : '▼ Asset\'leri Gör'}
                              </div>
                            </div>

                            {/* Asset detayları */}
                            {acik && grp.assetler.length > 0 && (
                              <div style={{ borderTop: `1px solid ${C.border}`, padding: '12px 16px' }}>
                                {/* Tur bazlı gruplandır */}
                                {Array.from(new Set(grp.assetler.map(a => a.tur))).map(tur => {
                                  const turunAssetleri = grp.assetler.filter(a => a.tur === tur)
                                  return (
                                    <div key={tur} style={{ marginBottom: '12px' }}>
                                      <div style={{ fontSize: '0.62rem', color: C.faint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                                        {tur} ({turunAssetleri.length})
                                      </div>
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {turunAssetleri.map((a, j) => {
                                          const isImage = a.metin.startsWith('http')
                                          const isVideo = a.metin.startsWith('youtube:')
                                          return (
                                            <div key={j} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '8px', background: C.card, border: `1px solid ${C.border}`, maxWidth: '320px' }}>
                                              {isImage ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={a.metin} alt="" style={{ width: '40px', height: '30px', objectFit: 'cover', borderRadius: '4px', flexShrink: 0 }} />
                                              ) : isVideo ? (
                                                <span style={{ fontSize: '0.9rem' }}>▶️</span>
                                              ) : (
                                                <span style={{ fontSize: '0.78rem', color: C.text, wordBreak: 'break-word', whiteSpace: 'normal', flex: 1 }}>{a.metin}</span>
                                              )}
                                              {a.perf && a.perf !== 'UNSPECIFIED' && a.perf !== 'UNKNOWN' && (
                                                <PerfLabel label={a.perfLabel} perf={a.perf} />
                                              )}
                                            </div>
                                          )
                                        })}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── Cihaz Kırılımı ── */}
              {aktifSekme === 'Cihaz Kırılımı' && (
                <div style={{ padding: '20px' }}>
                  {cihazlar.length === 0 ? (
                    <div style={{ textAlign: 'center', color: C.faint, padding: '20px' }}>📭 Veri bulunamadı.</div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                      {cihazlar.map(c => {
                        const ikon = c.cihaz === 'Mobil' ? '📱' : c.cihaz === 'Masaüstü' ? '🖥️' : c.cihaz === 'Tablet' ? '📟' : '❓'
                        const roas = parseFloat(c.roas)
                        return (
                          <div key={c.cihaz} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '18px' }}>
                            <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>{ikon}</div>
                            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: C.text, marginBottom: '12px' }}>{c.cihaz}</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                              {[
                                { b: 'Harcama', d: para(c.harcama), r: '#C2410C' },
                                { b: 'Gelir', d: parseFloat(c.gelir) > 0 ? para(c.gelir) : '—', r: '#059669' },
                                { b: 'ROAS', d: roas > 0 ? `${roas.toFixed(2)}x` : '—', r: roasRenk(roas) },
                                { b: 'Tıklama', d: sayi(c.tiklama), r: C.muted },
                                { b: 'CTR', d: `%${c.ctr}`, r: C.muted },
                                { b: 'CPC', d: parseFloat(c.ort_cpc) > 0 ? para(c.ort_cpc) : '—', r: C.muted },
                              ].map(m => (
                                <div key={m.b}>
                                  <div style={{ fontSize: '0.6rem', color: C.faint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{m.b}</div>
                                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: m.r }}>{m.d}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── Günlük Trend ── */}
              {aktifSekme === 'Günlük Trend' && (
                <div style={{ overflowX: 'auto' }}>
                  {gunluk.length === 0 ? (
                    <div style={{ padding: '32px', textAlign: 'center', color: C.faint }}>📭 Veri bulunamadı.</div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr>
                        {['Tarih', 'Harcama', 'Gelir', 'ROAS', 'Dönüşüm', 'Tıklama', 'Gösterim'].map(h => <th key={h} style={thS}>{h}</th>)}
                      </tr></thead>
                      <tbody>
                        {gunluk.map(g => {
                          const roas = parseFloat(g.roas)
                          return (
                            <tr key={g.tarih} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                              <td style={{ ...tdS, fontWeight: 600, color: C.text }}>{g.tarih}</td>
                              <td style={{ ...tdS, color: '#C2410C', fontWeight: 600 }}>{para(g.harcama)}</td>
                              <td style={{ ...tdS, color: parseFloat(g.gelir) > 0 ? '#059669' : C.faint }}>{parseFloat(g.gelir) > 0 ? para(g.gelir) : '—'}</td>
                              <td style={tdS}>{roas > 0 ? <span style={{ color: roasRenk(roas), fontWeight: 700 }}>{roas.toFixed(2)}x</span> : <span style={{ color: C.faint }}>—</span>}</td>
                              <td style={{ ...tdS, color: g.donusum > 0 ? '#0284C7' : C.faint }}>{g.donusum > 0 ? g.donusum.toFixed(1) : '—'}</td>
                              <td style={{ ...tdS, color: C.muted }}>{sayi(g.tiklama)}</td>
                              <td style={{ ...tdS, color: C.faint }}>{sayi(g.gosterim)}</td>
                            </tr>
                          )
                        })}
                        <tr style={{ background: C.tableHead, fontWeight: 700 }}>
                          <td style={{ ...tdS, color: C.muted, borderTop: `2px solid ${C.border}` }}>Toplam</td>
                          <td style={{ ...tdS, color: '#C2410C', borderTop: `2px solid ${C.border}` }}>{para(gunluk.reduce((a, g) => a + parseFloat(g.harcama), 0))}</td>
                          <td style={{ ...tdS, color: '#059669', borderTop: `2px solid ${C.border}` }}>{para(gunluk.reduce((a, g) => a + parseFloat(g.gelir), 0))}</td>
                          <td style={{ ...tdS, borderTop: `2px solid ${C.border}` }}>
                            {(() => { const th = gunluk.reduce((a, g) => a + parseFloat(g.harcama), 0); const tg = gunluk.reduce((a, g) => a + parseFloat(g.gelir), 0); const r = th > 0 ? tg / th : 0; return r > 0 ? <span style={{ color: roasRenk(r), fontWeight: 700 }}>{r.toFixed(2)}x</span> : '—' })()}
                          </td>
                          <td style={{ ...tdS, color: '#0284C7', borderTop: `2px solid ${C.border}` }}>{gunluk.reduce((a, g) => a + g.donusum, 0).toFixed(1)}</td>
                          <td style={{ ...tdS, color: C.muted, borderTop: `2px solid ${C.border}` }}>{sayi(gunluk.reduce((a, g) => a + g.tiklama, 0))}</td>
                          <td style={{ ...tdS, color: C.faint, borderTop: `2px solid ${C.border}` }}>{sayi(gunluk.reduce((a, g) => a + g.gosterim, 0))}</td>
                        </tr>
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── AI Analiz Paneli ── */}
        {aiAcik && (
          <div style={{ marginTop: '20px', background: C.card, border: `1px solid #DDD6FE`, borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '12px 20px', background: '#F5F3FF', borderBottom: `1px solid #DDD6FE`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>🤖</span>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#5B21B6' }}>AI Kampanya Analizi — {kampanyaAd}</div>
              </div>
              <button onClick={() => setAiAcik(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#7C3AED', fontSize: '1rem' }}>✕</button>
            </div>
            <div style={{ padding: '20px 24px' }}>
              {aiYukleniyor ? (
                <div style={{ textAlign: 'center', padding: '28px', color: C.faint }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>🔄</div>
                  <div style={{ fontSize: '0.85rem' }}>Analiz yapılıyor...</div>
                </div>
              ) : <MarkdownGoster metin={aiMetin} />}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

export default function KampanyaDetay() {
  return (
    <Suspense fallback={<div style={{ padding: '40px', textAlign: 'center' }}>Yükleniyor...</div>}>
      <Icerik />
    </Suspense>
  )
}
