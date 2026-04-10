'use client'

import { useState, useCallback } from 'react'
import Sidebar from '../components/Sidebar'
import { C } from '../lib/theme'
import { globalModelOku } from '../components/Sidebar'

// ─── Tipler ───────────────────────────────────────────────────────────────────
interface Genel {
  tiklamalar: number; gösterimler: number; ctr: number; pozisyon: number
  oncekiTiklamalar: number; oncekiGösterimler: number; oncekiCtr: number; oncekiPozisyon: number
  degisimTiklamalar: number | null; degisimGösterimler: number | null
  degisimCtr: number | null; degisimPozisyon: number | null
  tarihAralik: { baslangic: string; bitis: string }
  oncekiTarih: { baslangic: string; bitis: string }
}
interface Kelime  { kelime: string;   tiklamalar: number; gösterimler: number; ctr: number; pozisyon: number }
interface Sayfa   { url: string;      tiklamalar: number; gösterimler: number; ctr: number; pozisyon: number }
interface Cihaz   { cihaz: string;    tiklamalar: number; gösterimler: number; ctr: number; pozisyon: number }
interface Ulke    { ulke: string;     tiklamalar: number; gösterimler: number; ctr: number; pozisyon: number }
interface Trend   { tarih: string;    tiklamalar: number; gösterimler: number; ctr: number; pozisyon: number }
interface SayfaKelime { url: string; kelime: string; tiklamalar: number; gösterimler: number; ctr: number; pozisyon: number }
interface AiAnaliz { gucluNoktalar: string[]; dikkatNoktalar: string[]; firsatOnerileri: string[]; eylemListesi: string[]; ozet: string }

type Sekme = 'kelimeler' | 'sayfalar' | 'firsat' | 'cihazlar' | 'ulkeler' | 'trend' | 'sayfa_kelime'

// ─── Sabitler ─────────────────────────────────────────────────────────────────
const PRESETLER = [
  { id: '7',   ad: 'Son 7 Gün' },
  { id: '28',  ad: 'Son 28 Gün' },
  { id: '90',  ad: 'Son 90 Gün' },
  { id: '180', ad: 'Son 6 Ay' },
]
const MARKA = {
  karmen: { ad: 'Karmen Halı', renk: '#7C2D12', bg: '#FFF7ED', border: '#FED7AA', light: '#FFEDD5' },
  cotto:  { ad: 'Cotto Home',  renk: '#1E3A8A', bg: '#EFF6FF', border: '#BFDBFE', light: '#DBEAFE' },
}
const CIHAZ_ICON: Record<string, string> = { MOBILE: '📱', DESKTOP: '🖥', TABLET: '📲' }
const ULKE_AD: Record<string, string> = {
  tur: '🇹🇷 Türkiye', usa: '🇺🇸 ABD', deu: '🇩🇪 Almanya', gbr: '🇬🇧 İngiltere',
  fra: '🇫🇷 Fransa', nld: '🇳🇱 Hollanda', bel: '🇧🇪 Belçika', che: '🇨🇭 İsviçre',
  aut: '🇦🇹 Avusturya', swe: '🇸🇪 İsveç', nor: '🇳🇴 Norveç', dnk: '🇩🇰 Danimarka',
}

// ─── Yardımcılar ──────────────────────────────────────────────────────────────
function pozRenk(p: number) { return p <= 3 ? '#15803d' : p <= 10 ? '#D97706' : '#DC2626' }
function ctrRenk(c: number) { return c >= 5 ? '#15803d' : c >= 2 ? '#D97706' : '#DC2626' }
function kısalt(url: string, max = 52) { return url.length > max ? url.slice(0, max) + '…' : url }

function PozBadge({ pos }: { pos: number }) {
  const renk = pozRenk(pos), bg = pos <= 3 ? '#F0FDF4' : pos <= 10 ? '#FFFBEB' : '#FEF2F2'
  return <span style={{ fontSize: '0.75rem', fontWeight: 800, color: renk, background: bg, padding: '2px 8px', borderRadius: '8px', border: `1px solid ${renk}30` }}>#{pos.toFixed(1)}</span>
}

function DegisimBadge({ deger, ters = false }: { deger: number | null; ters?: boolean }) {
  if (deger === null) return null
  const iyi = ters ? deger < 0 : deger > 0
  const renk = deger === 0 ? '#6B7280' : iyi ? '#15803d' : '#DC2626'
  const bg   = deger === 0 ? '#F3F4F6' : iyi ? '#F0FDF4' : '#FEF2F2'
  const ok   = deger > 0 ? '↑' : deger < 0 ? '↓' : '→'
  return (
    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: renk, background: bg, padding: '2px 6px', borderRadius: '6px' }}>
      {ok} {Math.abs(deger)}%
    </span>
  )
}

// ─── Mini SVG Trend Çizgisi ───────────────────────────────────────────────────
function TrendCizgi({ veriler, alan, renk, yukseklik = 48 }: { veriler: Trend[]; alan: keyof Trend; renk: string; yukseklik?: number }) {
  if (veriler.length < 2) return null
  const degerler = veriler.map(v => v[alan] as number)
  const min = Math.min(...degerler), max = Math.max(...degerler)
  const aralik = max - min || 1
  const w = 100, h = yukseklik
  const noktalar = degerler.map((d, i) => {
    const x = (i / (degerler.length - 1)) * w
    const y = h - ((d - min) / aralik) * (h - 6) - 3
    return `${x},${y}`
  }).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: yukseklik }} preserveAspectRatio="none">
      <polyline fill="none" stroke={renk} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" points={noktalar} />
    </svg>
  )
}

// ─── Ana Sayfa ────────────────────────────────────────────────────────────────
export default function SearchConsolePage() {
  const [hesap, setHesap]   = useState<'karmen' | 'cotto'>('karmen')
  const [donem, setDonem]   = useState('28')
  const [ozelBas, setOzelBas] = useState('')
  const [ozelBit, setOzelBit] = useState('')
  const [sekme, setSekme]   = useState<Sekme>('kelimeler')

  const [genel, setGenel]               = useState<Genel | null>(null)
  const [kelimeler, setKelimeler]       = useState<Kelime[]>([])
  const [sayfalar, setSayfalar]         = useState<Sayfa[]>([])
  const [firsatlar, setFirsatlar]       = useState<Kelime[]>([])
  const [cihazlar, setCihazlar]         = useState<Cihaz[]>([])
  const [ulkeler, setUlkeler]           = useState<Ulke[]>([])
  const [trend, setTrend]               = useState<Trend[]>([])
  const [sayfaKelime, setSayfaKelime]   = useState<SayfaKelime[]>([])
  const [yukleniyor, setYukleniyor]     = useState(false)
  const [hata, setHata]                 = useState('')
  const [yuklendi, setYuklendi]         = useState(false)

  // Sıralama state'leri
  const [siralamaKelime, setSiralamaKelime] = useState<keyof Kelime>('tiklamalar')
  const [kelimeYon, setKelimeYon]           = useState<'asc' | 'desc'>('desc')
  const [siralamaSayfa, setSiralamaSayfa]   = useState<keyof Sayfa>('tiklamalar')
  const [sayfaYon, setSayfaYon]             = useState<'asc' | 'desc'>('desc')
  const [siralamaSK, setSiralamaSK]         = useState<keyof SayfaKelime>('tiklamalar')
  const [skYon, setSkYon]                   = useState<'asc' | 'desc'>('desc')

  // AI state
  const [aiYukleniyor, setAiYukleniyor] = useState(false)
  const [aiSonuc, setAiSonuc]           = useState<AiAnaliz | null>(null)
  const [aiAcik, setAiAcik]             = useState(false)

  // Trend görünüm
  const [trendAlan, setTrendAlan] = useState<'tiklamalar' | 'gösterimler' | 'ctr' | 'pozisyon'>('tiklamalar')

  const marka = MARKA[hesap]

  // ── Veri çekme ──────────────────────────────────────────────────────────────
  const veriCek = useCallback(async (h: string, d: string, bas?: string, bit?: string) => {
    setYukleniyor(true); setHata(''); setGenel(null)
    setKelimeler([]); setSayfalar([]); setFirsatlar([])
    setCihazlar([]); setUlkeler([]); setTrend([]); setSayfaKelime([])
    setAiSonuc(null)

    const body = (tur: string) => JSON.stringify({
      hesap: h, tur, donem: d,
      ...(d === 'ozel' && bas && bit ? { baslangic: bas, bitis: bit } : {}),
    })
    const post = (tur: string) => fetch('/api/search-console', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body(tur) }).then(r => r.json())

    try {
      const [genelRes, kelRes, sayfaRes, firsatRes, cihazRes, ulkeRes, trendRes, skRes] = await Promise.allSettled([
        post('genel'), post('kelimeler'), post('sayfalar'), post('firsat'),
        post('cihazlar'), post('ulkeler'), post('trend'), post('sayfa_kelime'),
      ])
      if (genelRes.status === 'fulfilled' && !genelRes.value.error)   setGenel(genelRes.value)
      if (kelRes.status   === 'fulfilled' && !kelRes.value.error)     setKelimeler(kelRes.value.kelimeler || [])
      if (sayfaRes.status === 'fulfilled' && !sayfaRes.value.error)   setSayfalar(sayfaRes.value.sayfalar || [])
      if (firsatRes.status === 'fulfilled' && !firsatRes.value.error) setFirsatlar(firsatRes.value.firsatlar || [])
      if (cihazRes.status === 'fulfilled' && !cihazRes.value.error)   setCihazlar(cihazRes.value.cihazlar || [])
      if (ulkeRes.status  === 'fulfilled' && !ulkeRes.value.error)    setUlkeler(ulkeRes.value.ulkeler || [])
      if (trendRes.status === 'fulfilled' && !trendRes.value.error)   setTrend(trendRes.value.trend || [])
      if (skRes.status    === 'fulfilled' && !skRes.value.error)      setSayfaKelime(skRes.value.satirlar || [])

      const ilkHata = [genelRes, kelRes, sayfaRes, firsatRes, cihazRes, ulkeRes, trendRes, skRes]
        .find(r => r.status === 'fulfilled' && (r as PromiseFulfilledResult<{ error?: string }>).value.error)
      if (ilkHata?.status === 'fulfilled') setHata((ilkHata as PromiseFulfilledResult<{ error: string }>).value.error)
      setYuklendi(true)
    } catch (e) {
      setHata(e instanceof Error ? e.message : String(e))
    } finally {
      setYukleniyor(false)
    }
  }, [])

  // ── AI Analiz ────────────────────────────────────────────────────────────────
  async function aiAnalizEt() {
    setAiYukleniyor(true); setAiAcik(true)
    try {
      const res = await fetch('/api/search-console', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hesap, tur: 'ai', model: globalModelOku(),
          marka: hesap,
          veriler: { genel, kelimeler: kelimeler.slice(0, 10), firsatlar: firsatlar.slice(0, 10), cihazlar },
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setAiSonuc(data)
    } catch (e) {
      setHata(e instanceof Error ? e.message : String(e))
    } finally {
      setAiYukleniyor(false)
    }
  }

  // ── Sıralama yardımcısı ───────────────────────────────────────────────────
  function siralaToggle<T>(alan: keyof T, aktif: keyof T, setAktif: (v: keyof T) => void, yon: 'asc' | 'desc', setYon: (v: 'asc' | 'desc') => void) {
    if (alan === aktif) setYon(yon === 'desc' ? 'asc' : 'desc')
    else { setAktif(alan); setYon('desc') }
  }
  function sirala<T>(liste: T[], alan: keyof T, yon: 'asc' | 'desc') {
    return [...liste].sort((a, b) => {
      const fark = (a[alan] as number) - (b[alan] as number)
      return yon === 'desc' ? -fark : fark
    })
  }

  const siraliKelimeler = sirala(kelimeler, siralamaKelime, kelimeYon)
  const siraliSayfalar  = sirala(sayfalar,  siralamaSayfa,  sayfaYon)
  const siraliSK        = sirala(sayfaKelime, siralamaSK,   skYon)

  function SiralamaBaslik<T>({ etiket, alan, aktif, yon, setAktif, setYon }: {
    etiket: string; alan: keyof T; aktif: keyof T; yon: 'asc' | 'desc'
    setAktif: (v: keyof T) => void; setYon: (v: 'asc' | 'desc') => void
  }) {
    const secili = aktif === alan
    return (
      <div onClick={() => siralaToggle(alan, aktif, setAktif, yon, setYon)}
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', color: secili ? marka.renk : C.muted, fontWeight: secili ? 700 : 600, userSelect: 'none' }}>
        {etiket} {secili && <span style={{ fontSize: '0.65rem' }}>{yon === 'desc' ? '▼' : '▲'}</span>}
      </div>
    )
  }

  // Tablo başlık satırı ortak stili
  const thStyle: React.CSSProperties = { display: 'grid', gap: '0', background: C.tableHead, borderBottom: `1px solid ${C.border}`, padding: '10px 16px', fontSize: '0.68rem', fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }
  function satırBg(i: number) { return i % 2 === 0 ? '#fff' : '#FAFBFC' }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F8F9FB', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <Sidebar />
      <div style={{ flex: 1, marginLeft: '220px' }}>

        {/* ── HEADER ── */}
        <header style={{ background: '#fff', borderBottom: `1px solid ${C.border}`, padding: '0 28px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: C.text }}>🔍 Search Console</div>
            <div style={{ fontSize: '0.7rem', color: C.faint }}>Organik arama performansı</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            {(['karmen', 'cotto'] as const).map(h => (
              <button key={h} onClick={() => { setHesap(h); setYuklendi(false); setAiSonuc(null) }} style={{
                padding: '5px 13px', borderRadius: '8px', border: `1.5px solid ${hesap === h ? MARKA[h].renk : C.border}`,
                background: hesap === h ? MARKA[h].bg : '#fff', color: hesap === h ? MARKA[h].renk : C.muted,
                fontWeight: hesap === h ? 700 : 400, cursor: 'pointer', fontSize: '0.79rem',
              }}>{MARKA[h].ad}</button>
            ))}
            <div style={{ width: '1px', height: '20px', background: C.border, margin: '0 3px' }} />
            {PRESETLER.map(p => (
              <button key={p.id} onClick={() => setDonem(p.id)} style={{
                padding: '5px 10px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '0.75rem',
                background: donem === p.id ? C.text : 'transparent',
                color: donem === p.id ? '#fff' : C.muted, fontWeight: donem === p.id ? 700 : 400,
              }}>{p.ad}</button>
            ))}
            <button onClick={() => setDonem('ozel')} style={{
              padding: '5px 10px', borderRadius: '7px', cursor: 'pointer', fontSize: '0.75rem',
              border: `1.5px solid ${donem === 'ozel' ? '#0284C7' : C.border}`,
              background: donem === 'ozel' ? '#EFF6FF' : 'transparent',
              color: donem === 'ozel' ? '#0369A1' : C.muted, fontWeight: donem === 'ozel' ? 700 : 400,
            }}>📅 Özel</button>
            <div style={{ width: '1px', height: '20px', background: C.border, margin: '0 3px' }} />
            <button onClick={() => veriCek(hesap, donem, donem === 'ozel' ? ozelBas : undefined, donem === 'ozel' ? ozelBit : undefined)}
              disabled={yukleniyor || (donem === 'ozel' && (!ozelBas || !ozelBit))}
              style={{ padding: '7px 18px', borderRadius: '8px', background: marka.renk, color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem', opacity: (donem === 'ozel' && (!ozelBas || !ozelBit)) ? 0.5 : 1 }}>
              {yukleniyor ? '⏳ Yükleniyor...' : yuklendi ? '🔄 Yenile' : '⬇ Verileri Çek'}
            </button>
          </div>
        </header>

        {/* ── ÖZEL TARİH ── */}
        {donem === 'ozel' && (
          <div style={{ background: '#EFF6FF', borderBottom: `1px solid #BAE6FD`, padding: '10px 28px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.82rem', color: '#0369A1', fontWeight: 500 }}>📅 Tarih Aralığı:</span>
            <input type="date" value={ozelBas} onChange={e => setOzelBas(e.target.value)} style={{ background: '#fff', border: `1px solid #BAE6FD`, borderRadius: '6px', color: C.text, padding: '5px 10px', fontSize: '0.82rem' }} />
            <span style={{ color: C.muted }}>—</span>
            <input type="date" value={ozelBit} onChange={e => setOzelBit(e.target.value)} style={{ background: '#fff', border: `1px solid #BAE6FD`, borderRadius: '6px', color: C.text, padding: '5px 10px', fontSize: '0.82rem' }} />
            <button onClick={() => { if (ozelBas && ozelBit) veriCek(hesap, 'ozel', ozelBas, ozelBit) }}
              disabled={!ozelBas || !ozelBit}
              style={{ background: '#0284C7', color: '#fff', border: 'none', borderRadius: '6px', padding: '5px 16px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, opacity: (!ozelBas || !ozelBit) ? 0.5 : 1 }}>
              Uygula
            </button>
          </div>
        )}

        <main style={{ padding: '28px 32px' }}>

          {/* ── İLK DURUM ── */}
          {!yuklendi && !yukleniyor && (
            <div style={{ textAlign: 'center', padding: '80px 0' }}>
              <div style={{ fontSize: '3.5rem', marginBottom: '16px' }}>🔍</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: C.text, marginBottom: '6px' }}>{marka.ad} — Search Console</div>
              <div style={{ fontSize: '0.78rem', color: C.muted, marginBottom: '28px' }}>Tıklama, gösterim, CTR, sıralama ve cihaz verilerini çek</div>
              <button onClick={() => veriCek(hesap, donem)} style={{ padding: '12px 32px', borderRadius: '10px', background: marka.renk, color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>
                ⬇ Verileri Çek
              </button>
            </div>
          )}

          {/* ── HATA ── */}
          {hata && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', padding: '14px 18px', marginBottom: '20px', color: '#DC2626', fontSize: '0.82rem' }}>
              ❌ <strong>Hata:</strong> {hata}
            </div>
          )}

          {/* ── HERO KPI ── */}
          {genel && (
            <>
              <div style={{ marginBottom: '6px', fontSize: '0.68rem', color: C.faint, fontWeight: 600 }}>
                {genel.tarihAralik.baslangic} — {genel.tarihAralik.bitis} · Karşılaştırma: {genel.oncekiTarih.baslangic} — {genel.oncekiTarih.bitis}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '24px' }}>
                {[
                  { etiket: 'Toplam Tıklama',  ikon: '👆', deger: genel.tiklamalar.toLocaleString('tr-TR'),   renk: '#1E3A8A', bg: 'linear-gradient(135deg,#EFF6FF,#DBEAFE)', border: '#93C5FD', degisim: genel.degisimTiklamalar, ters: false },
                  { etiket: 'Toplam Gösterim', ikon: '👁',  deger: genel.gösterimler.toLocaleString('tr-TR'), renk: '#5B21B6', bg: 'linear-gradient(135deg,#F5F3FF,#EDE9FE)', border: '#C4B5FD', degisim: genel.degisimGösterimler, ters: false },
                  { etiket: 'Ort. CTR',        ikon: '🎯', deger: `%${genel.ctr}`,                           renk: ctrRenk(genel.ctr), bg: 'linear-gradient(135deg,#FFFBEB,#FEF3C7)', border: '#FDE68A', degisim: genel.degisimCtr, ters: false },
                  { etiket: 'Ort. Sıralama',   ikon: '📊', deger: `#${genel.pozisyon}`,                      renk: pozRenk(genel.pozisyon), bg: 'linear-gradient(135deg,#F0FDF4,#DCFCE7)', border: '#86EFAC', degisim: genel.degisimPozisyon, ters: true },
                ].map(k => (
                  <div key={k.etiket} style={{ background: k.bg, border: `1px solid ${k.border}`, borderRadius: '14px', padding: '18px 20px', boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <span style={{ fontSize: '1.3rem' }}>{k.ikon}</span>
                      <DegisimBadge deger={k.degisim} ters={k.ters} />
                    </div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 900, color: k.renk, lineHeight: 1, marginBottom: '5px' }}>{k.deger}</div>
                    <div style={{ fontSize: '0.68rem', fontWeight: 700, color: k.renk, opacity: 0.75, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k.etiket}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── AI PANEL ── */}
          {yuklendi && (
            <div style={{ marginBottom: '20px' }}>
              {!aiAcik ? (
                <button onClick={aiAnalizEt} style={{
                  padding: '10px 22px', borderRadius: '10px', background: 'linear-gradient(135deg,#7C3AED,#5B21B6)',
                  color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '0.84rem',
                  boxShadow: '0 4px 12px rgba(124,58,237,0.3)',
                }}>
                  🤖 AI ile Analiz Et
                </button>
              ) : (
                <div style={{ background: 'linear-gradient(135deg,#F5F3FF,#EDE9FE)', border: '1px solid #C4B5FD', borderRadius: '14px', padding: '20px 24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#5B21B6' }}>🤖 AI SEO Analizi — {marka.ad}</div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {!aiSonuc && !aiYukleniyor && <button onClick={aiAnalizEt} style={{ padding: '5px 12px', borderRadius: '6px', background: '#7C3AED', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>🔄 Yenile</button>}
                      <button onClick={() => setAiAcik(false)} style={{ padding: '5px 10px', borderRadius: '6px', background: '#fff', color: C.muted, border: `1px solid ${C.border}`, cursor: 'pointer', fontSize: '0.75rem' }}>✕ Kapat</button>
                    </div>
                  </div>
                  {aiYukleniyor && (
                    <div style={{ color: '#7C3AED', fontSize: '0.82rem' }}>⏳ AI analiz yapıyor...</div>
                  )}
                  {aiSonuc && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                      {/* Özet */}
                      <div style={{ gridColumn: '1 / -1', background: '#fff', borderRadius: '10px', padding: '14px 16px', border: '1px solid #DDD6FE' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#7C3AED', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>📋 Genel Değerlendirme</div>
                        <div style={{ fontSize: '0.82rem', color: C.text, lineHeight: 1.6 }}>{aiSonuc.ozet}</div>
                      </div>
                      {/* Güçlü noktalar */}
                      <div style={{ background: '#F0FDF4', borderRadius: '10px', padding: '14px 16px', border: '1px solid #86EFAC' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>✅ Güçlü Noktalar</div>
                        {aiSonuc.gucluNoktalar.map((m, i) => <div key={i} style={{ fontSize: '0.78rem', color: '#166534', marginBottom: '5px', paddingLeft: '10px', borderLeft: '2px solid #86EFAC' }}>{m}</div>)}
                      </div>
                      {/* Dikkat */}
                      <div style={{ background: '#FEF2F2', borderRadius: '10px', padding: '14px 16px', border: '1px solid #FCA5A5' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#DC2626', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>⚠️ Dikkat Noktaları</div>
                        {aiSonuc.dikkatNoktalar.map((m, i) => <div key={i} style={{ fontSize: '0.78rem', color: '#991B1B', marginBottom: '5px', paddingLeft: '10px', borderLeft: '2px solid #FCA5A5' }}>{m}</div>)}
                      </div>
                      {/* Fırsat önerileri */}
                      <div style={{ background: '#FFFBEB', borderRadius: '10px', padding: '14px 16px', border: '1px solid #FDE68A' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#D97706', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>🚀 Fırsat Önerileri</div>
                        {aiSonuc.firsatOnerileri.map((m, i) => <div key={i} style={{ fontSize: '0.78rem', color: '#92400E', marginBottom: '5px', paddingLeft: '10px', borderLeft: '2px solid #FDE68A' }}>{m}</div>)}
                      </div>
                      {/* Eylem listesi */}
                      <div style={{ background: '#F5F3FF', borderRadius: '10px', padding: '14px 16px', border: '1px solid #DDD6FE' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#7C3AED', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>📌 Eylem Listesi</div>
                        {aiSonuc.eylemListesi.map((m, i) => (
                          <div key={i} style={{ fontSize: '0.78rem', color: '#4C1D95', marginBottom: '5px', display: 'flex', gap: '6px' }}>
                            <span style={{ fontWeight: 700, color: '#7C3AED', minWidth: '16px' }}>{i + 1}.</span>
                            <span>{m}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── SEKMELER ── */}
          {yuklendi && (
            <>
              <div style={{ display: 'flex', gap: '3px', marginBottom: '16px', flexWrap: 'wrap' }}>
                {([
                  { id: 'kelimeler',   label: '🔑 Kelimeler',     sayac: kelimeler.length },
                  { id: 'sayfalar',    label: '📄 Sayfalar',       sayac: sayfalar.length },
                  { id: 'firsat',      label: '🚀 Fırsat',         sayac: firsatlar.length },
                  { id: 'cihazlar',    label: '📱 Cihazlar',       sayac: cihazlar.length },
                  { id: 'ulkeler',     label: '🌍 Ülkeler',        sayac: ulkeler.length },
                  { id: 'trend',       label: '📈 Günlük Trend',   sayac: trend.length },
                  { id: 'sayfa_kelime',label: '🔗 Sayfa + Kelime', sayac: sayfaKelime.length },
                ] as const).map(s => (
                  <button key={s.id} onClick={() => setSekme(s.id)} style={{
                    padding: '7px 14px', borderRadius: '8px', border: `1px solid ${sekme === s.id ? marka.renk : C.border}`,
                    background: sekme === s.id ? marka.renk : '#fff',
                    color: sekme === s.id ? '#fff' : C.muted,
                    fontWeight: sekme === s.id ? 700 : 400, cursor: 'pointer', fontSize: '0.78rem', transition: 'all 0.15s',
                  }}>
                    {s.label} <span style={{ opacity: 0.75, fontSize: '0.68rem' }}>({s.sayac})</span>
                  </button>
                ))}
              </div>

              {/* ── KELİMELER ── */}
              {sekme === 'kelimeler' && (
                <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: '14px', overflow: 'hidden' }}>
                  <div style={{ ...thStyle, gridTemplateColumns: '1fr 90px 100px 80px 90px' }}>
                    <div>Anahtar Kelime</div>
                    <SiralamaBaslik<Kelime> etiket="Tıklama"  alan="tiklamalar"  aktif={siralamaKelime} yon={kelimeYon} setAktif={setSiralamaKelime} setYon={setKelimeYon} />
                    <SiralamaBaslik<Kelime> etiket="Gösterim" alan="gösterimler" aktif={siralamaKelime} yon={kelimeYon} setAktif={setSiralamaKelime} setYon={setKelimeYon} />
                    <SiralamaBaslik<Kelime> etiket="CTR"      alan="ctr"         aktif={siralamaKelime} yon={kelimeYon} setAktif={setSiralamaKelime} setYon={setKelimeYon} />
                    <SiralamaBaslik<Kelime> etiket="Sıralama" alan="pozisyon"    aktif={siralamaKelime} yon={kelimeYon} setAktif={setSiralamaKelime} setYon={setKelimeYon} />
                  </div>
                  {siraliKelimeler.map((k, i) => (
                    <div key={k.kelime} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 100px 80px 90px', padding: '10px 16px', borderBottom: `1px solid ${C.borderLight}`, background: satırBg(i), alignItems: 'center' }}
                      onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = marka.light}
                      onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = satırBg(i)}>
                      <div style={{ fontSize: '0.82rem', color: C.text, fontWeight: 500 }}>{k.kelime}</div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1E3A8A' }}>{k.tiklamalar.toLocaleString('tr-TR')}</div>
                      <div style={{ fontSize: '0.78rem', color: C.muted }}>{k.gösterimler.toLocaleString('tr-TR')}</div>
                      <div style={{ fontSize: '0.78rem', fontWeight: 600, color: ctrRenk(k.ctr) }}>%{k.ctr}</div>
                      <PozBadge pos={k.pozisyon} />
                    </div>
                  ))}
                  {!siraliKelimeler.length && <div style={{ padding: '40px', textAlign: 'center', color: C.faint, fontSize: '0.82rem' }}>Veri bulunamadı</div>}
                </div>
              )}

              {/* ── SAYFALAR ── */}
              {sekme === 'sayfalar' && (
                <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: '14px', overflow: 'hidden' }}>
                  <div style={{ ...thStyle, gridTemplateColumns: '1fr 90px 100px 80px 90px' }}>
                    <div>Sayfa URL</div>
                    <SiralamaBaslik<Sayfa> etiket="Tıklama"  alan="tiklamalar"  aktif={siralamaSayfa} yon={sayfaYon} setAktif={setSiralamaSayfa} setYon={setSayfaYon} />
                    <SiralamaBaslik<Sayfa> etiket="Gösterim" alan="gösterimler" aktif={siralamaSayfa} yon={sayfaYon} setAktif={setSiralamaSayfa} setYon={setSayfaYon} />
                    <SiralamaBaslik<Sayfa> etiket="CTR"      alan="ctr"         aktif={siralamaSayfa} yon={sayfaYon} setAktif={setSiralamaSayfa} setYon={setSayfaYon} />
                    <SiralamaBaslik<Sayfa> etiket="Sıralama" alan="pozisyon"    aktif={siralamaSayfa} yon={sayfaYon} setAktif={setSiralamaSayfa} setYon={setSayfaYon} />
                  </div>
                  {siraliSayfalar.map((s, i) => (
                    <div key={s.url} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 100px 80px 90px', padding: '10px 16px', borderBottom: `1px solid ${C.borderLight}`, background: satırBg(i), alignItems: 'center' }}
                      onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = marka.light}
                      onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = satırBg(i)}>
                      <div style={{ fontSize: '0.78rem', color: C.text, fontFamily: 'monospace', fontWeight: 500 }}>{kısalt(s.url)}</div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1E3A8A' }}>{s.tiklamalar.toLocaleString('tr-TR')}</div>
                      <div style={{ fontSize: '0.78rem', color: C.muted }}>{s.gösterimler.toLocaleString('tr-TR')}</div>
                      <div style={{ fontSize: '0.78rem', fontWeight: 600, color: ctrRenk(s.ctr) }}>%{s.ctr}</div>
                      <PozBadge pos={s.pozisyon} />
                    </div>
                  ))}
                  {!siraliSayfalar.length && <div style={{ padding: '40px', textAlign: 'center', color: C.faint, fontSize: '0.82rem' }}>Veri bulunamadı</div>}
                </div>
              )}

              {/* ── FIRSAT ── */}
              {sekme === 'firsat' && (
                <>
                  <div style={{ background: `linear-gradient(135deg,${marka.bg},${marka.light})`, border: `1px solid ${marka.border}`, borderRadius: '12px', padding: '14px 18px', marginBottom: '14px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '1.5rem' }}>🚀</span>
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: marka.renk, marginBottom: '4px' }}>Fırsat Kelimeleri</div>
                      <div style={{ fontSize: '0.75rem', color: C.muted, lineHeight: 1.5 }}>Sıralama <strong>4–20</strong> arası, 50+ gösterimli kelimeler. İçerik güçlendirmesiyle <strong>kısa sürede ilk 3&apos;e</strong> girebilir.</div>
                    </div>
                  </div>
                  <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: '14px', overflow: 'hidden' }}>
                    <div style={{ ...thStyle, gridTemplateColumns: '1fr 90px 100px 80px 90px' }}>
                      <div>Anahtar Kelime</div><div>Tıklama</div><div>Gösterim</div><div>CTR</div><div>Sıralama</div>
                    </div>
                    {firsatlar.map((k, i) => (
                      <div key={k.kelime} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 100px 80px 90px', padding: '10px 16px', borderBottom: `1px solid ${C.borderLight}`, background: satırBg(i), alignItems: 'center' }}
                        onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = marka.light}
                        onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = satırBg(i)}>
                        <div>
                          <div style={{ fontSize: '0.82rem', color: C.text, fontWeight: 500 }}>{k.kelime}</div>
                          <div style={{ fontSize: '0.64rem', color: C.faint, marginTop: '1px' }}>{k.pozisyon <= 10 ? '🟡 1. sayfada' : '🔴 2. sayfada'}</div>
                        </div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1E3A8A' }}>{k.tiklamalar.toLocaleString('tr-TR')}</div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#5B21B6' }}>{k.gösterimler.toLocaleString('tr-TR')}</div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: ctrRenk(k.ctr) }}>%{k.ctr}</div>
                        <PozBadge pos={k.pozisyon} />
                      </div>
                    ))}
                    {!firsatlar.length && <div style={{ padding: '40px', textAlign: 'center', color: C.faint, fontSize: '0.82rem' }}>Fırsat kelimesi bulunamadı</div>}
                  </div>
                </>
              )}

              {/* ── CİHAZLAR ── */}
              {sekme === 'cihazlar' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
                  {cihazlar.map(c => {
                    const topTik = cihazlar.reduce((s, x) => s + x.tiklamalar, 0)
                    const yuz = topTik ? Math.round(c.tiklamalar / topTik * 100) : 0
                    return (
                      <div key={c.cihaz} style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: '14px', padding: '22px 24px', boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}>
                        <div style={{ fontSize: '2rem', marginBottom: '10px' }}>{CIHAZ_ICON[c.cihaz] || '📟'}</div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: C.text, marginBottom: '12px' }}>{c.cihaz}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {[
                            { label: 'Tıklama',  val: c.tiklamalar.toLocaleString('tr-TR'),  renk: '#1E3A8A' },
                            { label: 'Gösterim', val: c.gösterimler.toLocaleString('tr-TR'), renk: '#5B21B6' },
                            { label: 'CTR',      val: `%${c.ctr}`,                           renk: ctrRenk(c.ctr) },
                            { label: 'Sıralama', val: `#${c.pozisyon}`,                       renk: pozRenk(c.pozisyon) },
                          ].map(m => (
                            <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: '0.72rem', color: C.faint }}>{m.label}</span>
                              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: m.renk }}>{m.val}</span>
                            </div>
                          ))}
                        </div>
                        <div style={{ marginTop: '14px', height: '6px', background: '#F3F4F6', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${yuz}%`, background: marka.renk, borderRadius: '3px', transition: 'width 0.6s' }} />
                        </div>
                        <div style={{ fontSize: '0.68rem', color: C.faint, marginTop: '4px' }}>%{yuz} tıklama payı</div>
                      </div>
                    )
                  })}
                  {!cihazlar.length && <div style={{ gridColumn: '1/-1', padding: '40px', textAlign: 'center', color: C.faint, fontSize: '0.82rem' }}>Veri bulunamadı</div>}
                </div>
              )}

              {/* ── ÜLKELER ── */}
              {sekme === 'ulkeler' && (
                <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: '14px', overflow: 'hidden' }}>
                  <div style={{ ...thStyle, gridTemplateColumns: '1fr 100px 110px 80px 90px 120px' }}>
                    <div>Ülke</div><div>Tıklama</div><div>Gösterim</div><div>CTR</div><div>Sıralama</div><div>Tıklama Payı</div>
                  </div>
                  {ulkeler.map((u, i) => {
                    const topTik = ulkeler.reduce((s, x) => s + x.tiklamalar, 0)
                    const yuz = topTik ? Math.round(u.tiklamalar / topTik * 100) : 0
                    return (
                      <div key={u.ulke} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 110px 80px 90px 120px', padding: '10px 16px', borderBottom: `1px solid ${C.borderLight}`, background: satırBg(i), alignItems: 'center' }}
                        onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = marka.light}
                        onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = satırBg(i)}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: C.text }}>{ULKE_AD[u.ulke] || `🌐 ${u.ulke.toUpperCase()}`}</div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1E3A8A' }}>{u.tiklamalar.toLocaleString('tr-TR')}</div>
                        <div style={{ fontSize: '0.78rem', color: C.muted }}>{u.gösterimler.toLocaleString('tr-TR')}</div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: ctrRenk(u.ctr) }}>%{u.ctr}</div>
                        <PozBadge pos={u.pozisyon} />
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ flex: 1, height: '5px', background: '#F3F4F6', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${yuz}%`, background: marka.renk, borderRadius: '3px' }} />
                            </div>
                            <span style={{ fontSize: '0.7rem', color: C.faint, minWidth: '28px' }}>%{yuz}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  {!ulkeler.length && <div style={{ padding: '40px', textAlign: 'center', color: C.faint, fontSize: '0.82rem' }}>Veri bulunamadı</div>}
                </div>
              )}

              {/* ── GÜNLÜK TREND ── */}
              {sekme === 'trend' && (
                <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: '14px', overflow: 'hidden' }}>
                  {/* Alan seçici */}
                  <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.borderLight}`, display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.72rem', color: C.faint, fontWeight: 600, marginRight: '6px' }}>Göster:</span>
                    {([
                      { id: 'tiklamalar',  label: '👆 Tıklama',  renk: '#1E3A8A' },
                      { id: 'gösterimler', label: '👁 Gösterim', renk: '#5B21B6' },
                      { id: 'ctr',         label: '🎯 CTR',      renk: '#D97706' },
                      { id: 'pozisyon',    label: '📊 Sıralama', renk: '#15803d' },
                    ] as const).map(a => (
                      <button key={a.id} onClick={() => setTrendAlan(a.id)} style={{
                        padding: '4px 12px', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer',
                        border: `1px solid ${trendAlan === a.id ? a.renk : C.border}`,
                        background: trendAlan === a.id ? a.renk + '15' : '#fff',
                        color: trendAlan === a.id ? a.renk : C.muted,
                        fontWeight: trendAlan === a.id ? 700 : 400,
                      }}>{a.label}</button>
                    ))}
                  </div>
                  {/* Grafik */}
                  {trend.length > 0 && (
                    <div style={{ padding: '20px 18px 8px' }}>
                      <TrendCizgi veriler={trend} alan={trendAlan} renk={trendAlan === 'tiklamalar' ? '#1E3A8A' : trendAlan === 'gösterimler' ? '#5B21B6' : trendAlan === 'ctr' ? '#D97706' : '#15803d'} yukseklik={80} />
                    </div>
                  )}
                  {/* Tablo */}
                  <div style={{ ...thStyle, gridTemplateColumns: '120px 90px 100px 80px 90px' }}>
                    <div>Tarih</div><div>Tıklama</div><div>Gösterim</div><div>CTR</div><div>Sıralama</div>
                  </div>
                  <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
                    {[...trend].reverse().map((t, i) => (
                      <div key={t.tarih} style={{ display: 'grid', gridTemplateColumns: '120px 90px 100px 80px 90px', padding: '8px 16px', borderBottom: `1px solid ${C.borderLight}`, background: satırBg(i), alignItems: 'center' }}>
                        <div style={{ fontSize: '0.78rem', color: C.text, fontWeight: 500 }}>{t.tarih}</div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1E3A8A' }}>{t.tiklamalar.toLocaleString('tr-TR')}</div>
                        <div style={{ fontSize: '0.78rem', color: C.muted }}>{t.gösterimler.toLocaleString('tr-TR')}</div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: ctrRenk(t.ctr) }}>%{t.ctr}</div>
                        <PozBadge pos={t.pozisyon} />
                      </div>
                    ))}
                  </div>
                  {!trend.length && <div style={{ padding: '40px', textAlign: 'center', color: C.faint, fontSize: '0.82rem' }}>Veri bulunamadı</div>}
                </div>
              )}

              {/* ── SAYFA + KELİME ── */}
              {sekme === 'sayfa_kelime' && (
                <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: '14px', overflow: 'hidden' }}>
                  <div style={{ ...thStyle, gridTemplateColumns: '1fr 1fr 90px 100px 80px 90px' }}>
                    <div>Sayfa</div>
                    <div>Anahtar Kelime</div>
                    <SiralamaBaslik<SayfaKelime> etiket="Tıklama"  alan="tiklamalar"  aktif={siralamaSK} yon={skYon} setAktif={setSiralamaSK} setYon={setSkYon} />
                    <SiralamaBaslik<SayfaKelime> etiket="Gösterim" alan="gösterimler" aktif={siralamaSK} yon={skYon} setAktif={setSiralamaSK} setYon={setSkYon} />
                    <SiralamaBaslik<SayfaKelime> etiket="CTR"      alan="ctr"         aktif={siralamaSK} yon={skYon} setAktif={setSiralamaSK} setYon={setSkYon} />
                    <SiralamaBaslik<SayfaKelime> etiket="Sıralama" alan="pozisyon"    aktif={siralamaSK} yon={skYon} setAktif={setSiralamaSK} setYon={setSkYon} />
                  </div>
                  <div style={{ maxHeight: '560px', overflowY: 'auto' }}>
                    {siraliSK.map((r, i) => (
                      <div key={`${r.url}-${r.kelime}`} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 90px 100px 80px 90px', padding: '9px 16px', borderBottom: `1px solid ${C.borderLight}`, background: satırBg(i), alignItems: 'center' }}
                        onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = marka.light}
                        onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = satırBg(i)}>
                        <div style={{ fontSize: '0.72rem', color: C.muted, fontFamily: 'monospace' }}>{kısalt(r.url, 40)}</div>
                        <div style={{ fontSize: '0.8rem', color: C.text, fontWeight: 500 }}>{r.kelime}</div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1E3A8A' }}>{r.tiklamalar.toLocaleString('tr-TR')}</div>
                        <div style={{ fontSize: '0.78rem', color: C.muted }}>{r.gösterimler.toLocaleString('tr-TR')}</div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: ctrRenk(r.ctr) }}>%{r.ctr}</div>
                        <PozBadge pos={r.pozisyon} />
                      </div>
                    ))}
                  </div>
                  {!siraliSK.length && <div style={{ padding: '40px', textAlign: 'center', color: C.faint, fontSize: '0.82rem' }}>Veri bulunamadı</div>}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}
