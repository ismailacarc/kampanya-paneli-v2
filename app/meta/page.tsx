'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, Filler } from 'chart.js'
import { Bar } from 'react-chartjs-2'
import Sidebar from '../components/Sidebar'
import AiRapor from '../components/AiRapor'
import { excelExport } from '../lib/export'
import { C, METRIK_RENK } from '../lib/theme'
import { HESAPLAR, PRESETLER, Satir, AnalizGecmis } from '../lib/types'
import {
  para, sayi, getDonusum, getGelir, getRoas, roasRenk,
  kampanyaSkoru, oncekiDonemTarihleri, yuzdeDesisim,
  getSepet, getGoruntulenme, getCheckout
} from '../lib/helpers'
import { UrunSatir } from '../lib/types'

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, Filler)

const AI_PRESETLER = [
  { id: '7', ad: 'Son 7 Gün' },
  { id: '14', ad: 'Son 14 Gün' },
  { id: '30', ad: 'Son 30 Gün' },
  { id: '90', ad: 'Son 90 Gün' },
]

// ─── Bileşenler ──────────────────────────────────────────────────

function Badge({ status }: { status: string }) {
  const aktif = status === 'ACTIVE'
  return (
    <span style={{
      padding: '3px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 600,
      background: aktif ? '#DCFCE7' : '#FEE2E2',
      color: aktif ? '#166534' : '#991B1B',
      border: `1px solid ${aktif ? '#A7F3D0' : '#FECACA'}`,
      whiteSpace: 'nowrap'
    }}>
      {aktif ? '● Aktif' : '■ Durduruldu'}
    </span>
  )
}

function SkorBadge({ ins }: { ins?: import('../lib/types').Insights }) {
  const { harf, renk, skor } = kampanyaSkoru(ins)
  if (harf === '—') {
    return (
      <td style={{ padding: '12px', borderBottom: `1px solid ${C.borderLight}`, textAlign: 'center' }}>
        <span style={{ color: C.faint, fontSize: '0.78rem' }}>—</span>
      </td>
    )
  }
  return (
    <td style={{ padding: '12px', borderBottom: `1px solid ${C.borderLight}`, textAlign: 'center' }}>
      <span title={`Performans skoru: ${skor}/100\nROAS (%50) + CTR (%25) + Dönüşüm Oranı (%25)`} style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: '26px', height: '26px', borderRadius: '50%',
        background: renk + '15', border: `2px solid ${renk}`, color: renk,
        fontSize: '0.75rem', fontWeight: 700, cursor: 'help'
      }}>
        {harf}
      </span>
    </td>
  )
}

const ALANLAR = ['harcama', 'gelir', 'roas', 'donusum', 'sepet', 'sepet_maliyet', 'gosterim', 'tiklama', 'ctr', 'cpc', 'frekans', 'cpm']
const ALAN_BASLIK: Record<string, string> = {
  harcama: 'Harcama', gelir: 'Gelir', roas: 'ROAS', donusum: 'Dönüşüm',
  sepet: 'Sepete Ekl.', sepet_maliyet: 'Sepet Mal.',
  gosterim: 'Gösterim', tiklama: 'Tıklama', ctr: 'CTR', cpc: 'CPC',
  frekans: 'Frekans', cpm: 'CPM'
}

function MetrikHucre({ ins, alan }: { ins?: import('../lib/types').Insights; alan: string }) {
  const h = parseFloat(ins?.spend || '0')
  const g = getGelir(ins)
  const r = getRoas(ins)
  const d = getDonusum(ins)
  const s = getSepet(ins)

  const deger = (() => {
    switch (alan) {
      case 'harcama': return h > 0 ? para(h) : '—'
      case 'gelir': return g > 0 ? para(g) : '—'
      case 'roas': return r > 0 ? `${r.toFixed(2)}x` : '—'
      case 'donusum': return d > 0 ? sayi(d) : '—'
      case 'sepet': return s > 0 ? sayi(s) : '—'
      case 'sepet_maliyet': return s > 0 && h > 0 ? para(h / s) : '—'
      case 'gosterim': return ins?.impressions ? sayi(ins.impressions) : '—'
      case 'tiklama': return ins?.clicks ? sayi(ins.clicks) : '—'
      case 'ctr': return ins?.ctr ? `%${parseFloat(ins.ctr).toFixed(2)}` : '—'
      case 'cpc': return ins?.cpc && parseFloat(ins.cpc) > 0 ? para(ins.cpc) : '—'
      case 'frekans': return ins?.frequency ? `${parseFloat(ins.frequency).toFixed(1)}x` : '—'
      case 'cpm': return ins?.cpm && parseFloat(ins.cpm) > 0 ? para(ins.cpm) : '—'
      default: return '—'
    }
  })()

  const renk = (() => {
    switch (alan) {
      case 'harcama': return METRIK_RENK.harcama
      case 'gelir': return g > 0 ? METRIK_RENK.gelir : C.faint
      case 'roas': return roasRenk(r)
      case 'donusum': return d > 0 ? METRIK_RENK.donusum : C.faint
      case 'sepet': return s > 0 ? '#8B5CF6' : C.faint
      case 'sepet_maliyet': return s > 0 && h > 0 ? '#7C3AED' : C.faint
      case 'frekans': {
        const f = parseFloat(ins?.frequency || '0')
        if (f === 0) return C.faint
        if (f >= 6) return '#DC2626'
        if (f >= 4) return '#D97706'
        return '#059669'
      }
      default: return C.muted
    }
  })()

  return (
    <td style={{
      padding: '11px 12px', fontSize: '0.83rem',
      borderBottom: `1px solid ${C.borderLight}`,
      color: renk, fontWeight: ['harcama', 'gelir', 'roas'].includes(alan) ? 600 : 400,
      whiteSpace: 'nowrap'
    }}>
      {deger}
    </td>
  )
}

function AiDonemModal({ onConfirm, onClose }: { onConfirm: (donem: string) => void; onClose: () => void }) {
  const [secim, setSecim] = useState('30')
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '16px', padding: '28px', width: '380px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '4px', color: C.text }}>🤖 Hızlı AI Analizi</div>
        <div style={{ fontSize: '0.83rem', color: C.muted, marginBottom: '20px' }}>Hangi dönem için analiz yapılsın?</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
          {AI_PRESETLER.map(p => (
            <button key={p.id} onClick={() => setSecim(p.id)} style={{
              padding: '12px', borderRadius: '10px',
              border: `2px solid ${secim === p.id ? '#7C3AED' : C.border}`,
              background: secim === p.id ? '#F5F3FF' : C.bg,
              color: secim === p.id ? '#6D28D9' : C.muted,
              cursor: 'pointer', fontSize: '0.88rem',
              fontWeight: secim === p.id ? 600 : 400,
              transition: 'all 0.15s', textAlign: 'center'
            }}>
              {p.ad}
            </button>
          ))}
        </div>
        <Link href="/ai-analiz" style={{
          display: 'block', textAlign: 'center', padding: '9px', borderRadius: '8px',
          border: `1px solid ${C.border}`, color: C.muted, textDecoration: 'none',
          fontSize: '0.8rem', marginBottom: '14px', background: C.bg
        }}>
          🔧 Gelişmiş ayarlar → AI Merkezi
        </Link>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '10px', borderRadius: '8px',
            border: `1px solid ${C.border}`, background: 'transparent',
            color: C.muted, cursor: 'pointer', fontSize: '0.85rem'
          }}>İptal</button>
          <button onClick={() => onConfirm(secim)} style={{
            flex: 2, padding: '10px', borderRadius: '8px', border: 'none',
            background: '#7C3AED', color: '#fff', cursor: 'pointer',
            fontSize: '0.88rem', fontWeight: 600
          }}>
            🤖 Analiz Et
          </button>
        </div>
      </div>
    </div>
  )
}

function DeltaBadge({ simdiki, onceki, tersSiralama }: { simdiki: number; onceki: number; tersSiralama?: boolean }) {
  const delta = yuzdeDesisim(simdiki, onceki)
  if (!delta) return null
  const pozitif = tersSiralama ? !delta.yukari : delta.yukari
  return (
    <span style={{
      fontSize: '0.68rem', fontWeight: 600,
      color: pozitif ? '#059669' : '#DC2626',
      background: pozitif ? '#F0FDF4' : '#FEF2F2',
      padding: '1px 5px', borderRadius: '4px'
    }}>
      {delta.yukari ? '↑' : '↓'} %{delta.deger.toFixed(1)}
    </span>
  )
}

// ─── Ana Sayfa ────────────────────────────────────────────────────

export default function MetaPanel() {
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
  const [aiAnaliz, setAiAnaliz] = useState<Record<string, unknown> | null>(null)
  const [aiYukleniyor, setAiYukleniyor] = useState(false)
  const [aiAcik, setAiAcik] = useState(false)
  const [aiDonemModal, setAiDonemModal] = useState(false)
  const [aiDonemAdi, setAiDonemAdi] = useState('')
  const [setYukLen, setSetYukLen] = useState<string | null>(null)
  const [rekYukLen, setRekYukLen] = useState<string | null>(null)
  const [hata, setHata] = useState('')
  const [grafik, setGrafik] = useState(false)
  const [statusFiltre, setStatusFiltre] = useState<'hepsi' | 'aktif' | 'durduruldu'>('aktif')
  const [siralama, setSiralama] = useState<{ alan: string; yon: 'asc' | 'desc' }>({ alan: 'harcama', yon: 'desc' })
  const [gecmis, setGecmis] = useState<AnalizGecmis[]>([])
  const [gecmisAcik, setGecmisAcik] = useState(false)
  const [oncekiToplamlar, setOncekiToplamlar] = useState<{ harcama: number; gelir: number; roas: number; donusum: number; tiklama: number; gosterim: number } | null>(null)
  const [roasHedefi, setRoasHedefi] = useState(3)
  const [anomaliler, setAnomaliler] = useState<{ kampanyaId: string; kampanyaAdi: string; metrik: string; once: number; simdi: number; mesaj: string }[]>([])
  const [anomaliYukleniyor, setAnomaliYukleniyor] = useState(false)
  const [anomaliGizle, setAnomaliGizle] = useState(false)
  const [urunler, setUrunler] = useState<UrunSatir[]>([])
  const [urunCursor, setUrunCursor] = useState<string | null>(null)
  const [urunYukleniyor, setUrunYukleniyor] = useState(false)
  const [urunAcik, setUrunAcik] = useState(false)
  const [urunSiralama, setUrunSiralama] = useState<{ alan: string; yon: 'asc' | 'desc' }>({ alan: 'gelir', yon: 'desc' })
  const [butceAcik, setButceAcik] = useState(false)

  const baslangicRef = useRef(baslangic)
  const bitisRef = useRef(bitis)
  baslangicRef.current = baslangic
  bitisRef.current = bitis

  useEffect(() => {
    try {
      const stored = localStorage.getItem('reklam_analiz_gecmisi')
      if (stored) setGecmis(JSON.parse(stored))
      const hedef = localStorage.getItem('roas_hedefi')
      if (hedef) setRoasHedefi(parseFloat(hedef))
    } catch { /* ignore */ }
  }, [])

  const yukle = useCallback(() => {
    setYukleniyor(true)
    setHata('')
    setKampanyalar([])
    setReklamSetleri({})
    setReklamlar({})
    setAcikKampanya(null)
    setAcikSet(null)
    setOncekiToplamlar(null)

    let url = `/api/meta?hesap=${aktifHesap}&tur=kampanyalar&donem=${donem}`
    if (donem === 'ozel' && baslangicRef.current && bitisRef.current) {
      url += `&baslangic=${baslangicRef.current}&bitis=${bitisRef.current}`
    }

    fetch(url).then(r => r.json()).then(d => {
      if (d.error) { setHata(d.error); setYukleniyor(false); return }
      const liste: Satir[] = d.data || []
      setKampanyalar(liste)
      setYukleniyor(false)

      const onceki = oncekiDonemTarihleri(donem)
      if (onceki) {
        fetch(`/api/meta?hesap=${aktifHesap}&tur=kampanyalar&donem=ozel&baslangic=${onceki.baslangic}&bitis=${onceki.bitis}`)
          .then(r => r.json()).then(od => {
            if (od.data) {
              const ok: Satir[] = od.data
              const oh = ok.reduce((a, k) => a + parseFloat(k.insights?.data[0]?.spend || '0'), 0)
              const og = ok.reduce((a, k) => a + getGelir(k.insights?.data[0]), 0)
              setOncekiToplamlar({
                harcama: oh, gelir: og, roas: oh > 0 ? og / oh : 0,
                donusum: ok.reduce((a, k) => a + getDonusum(k.insights?.data[0]), 0),
                tiklama: ok.reduce((a, k) => a + parseInt(k.insights?.data[0]?.clicks || '0'), 0),
                gosterim: ok.reduce((a, k) => a + parseInt(k.insights?.data[0]?.impressions || '0'), 0),
              })
            }
          }).catch(() => { /* opsiyonel */ })
      }
    }).catch(() => { setHata('Bağlantı hatası'); setYukleniyor(false) })
  }, [aktifHesap, donem])

  useEffect(() => { yukle() }, [yukle])

  async function aiAnalizYap(aiDonem: string) {
    const donemAdi = AI_PRESETLER.find(p => p.id === aiDonem)?.ad || `Son ${aiDonem} Gün`
    setAiDonemModal(false)
    setAiYukleniyor(true)
    setAiAcik(true)
    setAiAnaliz(null)
    setAiDonemAdi(donemAdi)

    const hesapBilgisi = HESAPLAR.find(h => h.id === aktifHesap)!
    try {
      const metaRes = await fetch(`/api/meta?hesap=${aktifHesap}&tur=kampanyalar&donem=${aiDonem}`)
      const metaData = await metaRes.json()
      const res = await fetch('/api/ai-analiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kampanyalar: metaData.data || [], hesapAdi: hesapBilgisi.ad })
      })
      const data = await res.json()
      if (data.error) {
        setAiAnaliz({ hata: data.error })
      } else {
        setAiAnaliz(data.analiz)
        const yeniItem: AnalizGecmis = {
          id: Date.now().toString(), tarih: new Date().toLocaleString('tr-TR'),
          hesapAdi: hesapBilgisi.ad, donemAdi, analiz: data.analiz
        }
        setGecmis(prev => {
          const yeni = [yeniItem, ...prev].slice(0, 10)
          try { localStorage.setItem('reklam_analiz_gecmisi', JSON.stringify(yeni)) } catch { /* ignore */ }
          return yeni
        })
      }
    } catch { setAiAnaliz({ hata: 'Bağlantı hatası' }) }
    setAiYukleniyor(false)
  }

  function gecmisSil(id: string) {
    setGecmis(prev => {
      const yeni = prev.filter(g => g.id !== id)
      try { localStorage.setItem('reklam_analiz_gecmisi', JSON.stringify(yeni)) } catch { /* ignore */ }
      return yeni
    })
  }

  async function anomaliTara() {
    setAnomaliYukleniyor(true)
    setAnomaliGizle(false)
    try {
      const aktifKamp = kampanyalar.filter(k => k.status === 'ACTIVE' && parseFloat(k.insights?.data[0]?.spend || '0') > 0)
      if (aktifKamp.length === 0) { setAnomaliYukleniyor(false); return }

      // 7 günlük veriyi çek — 30 günle kıyaslamak için
      let url7g = `/api/meta?hesap=${aktifHesap}&tur=kampanyalar&donem=7`
      if (baslangic && bitis) url7g = `/api/meta?hesap=${aktifHesap}&tur=kampanyalar&donem=7`
      const res7g = await fetch(url7g).then(r => r.json())
      const kamp7g: Satir[] = res7g.data || []

      const sonuclar: typeof anomaliler = []
      for (const k of aktifKamp) {
        const k7 = kamp7g.find(x => x.id === k.id)
        const ins30 = k.insights?.data[0]
        const ins7 = k7?.insights?.data[0]
        if (!ins30 || !ins7) continue

        const roas30 = getRoas(ins30)
        const roas7 = getRoas(ins7)
        const ctr30 = parseFloat(ins30.ctr || '0')
        const ctr7 = parseFloat(ins7.ctr || '0')
        const h30 = parseFloat(ins30.spend || '0')
        const h7 = parseFloat(ins7.spend || '0')

        if (roas30 > 0.5 && roas7 > 0 && roas7 < roas30 * 0.6) {
          sonuclar.push({
            kampanyaId: k.id, kampanyaAdi: k.name, metrik: 'ROAS',
            once: roas30, simdi: roas7,
            mesaj: `ROAS 30 günde ${roas30.toFixed(2)}x → son 7 günde ${roas7.toFixed(2)}x (%${Math.round((1 - roas7 / roas30) * 100)} düşüş)`
          })
        }
        if (ctr30 > 0.2 && ctr7 > 0 && ctr7 < ctr30 * 0.6) {
          sonuclar.push({
            kampanyaId: k.id, kampanyaAdi: k.name, metrik: 'CTR',
            once: ctr30, simdi: ctr7,
            mesaj: `CTR 30 günde %${ctr30.toFixed(2)} → son 7 günde %${ctr7.toFixed(2)} (%${Math.round((1 - ctr7 / ctr30) * 100)} düşüş)`
          })
        }
        if (h30 > 100 && h7 > 0 && (h7 / 7) < (h30 / 30) * 0.4) {
          sonuclar.push({
            kampanyaId: k.id, kampanyaAdi: k.name, metrik: 'Harcama',
            once: h30 / 30, simdi: h7 / 7,
            mesaj: `Günlük harcama düştü: 30 gün ort. ${para(h30 / 30)}/gün → son 7 gün ort. ${para(h7 / 7)}/gün`
          })
        }
      }
      setAnomaliler(sonuclar)
    } catch { /* ignore */ }
    setAnomaliYukleniyor(false)
  }

  async function urunYukle(sifirla = false) {
    setUrunYukleniyor(true)
    if (sifirla) { setUrunler([]); setUrunCursor(null) }
    const cursor = sifirla ? '' : (urunCursor || '')
    try {
      let url = `/api/meta?hesap=${aktifHesap}&tur=urun-kirilim&donem=${donem}`
      if (donem === 'ozel' && baslangic && bitis) url += `&baslangic=${baslangic}&bitis=${bitis}`
      if (cursor) url += `&cursor=${cursor}`
      const res = await fetch(url)
      const data = await res.json()
      if (sifirla) console.log('[ÜRÜN DEBUG] İlk 3 satır:', JSON.stringify((data.data || []).slice(0, 3), null, 2))
      const yeni: UrunSatir[] = data.data || []
      setUrunler(prev => sifirla ? yeni : [...prev, ...yeni])
      setUrunCursor(data.paging?.cursors?.after || null)
    } catch { /* ignore */ }
    setUrunYukleniyor(false)
  }

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

  const getSiralamaValue = (k: Satir, alan: string): number => {
    const ins = k.insights?.data[0]
    const h = parseFloat(ins?.spend || '0')
    const s = getSepet(ins)
    switch (alan) {
      case 'harcama': return h
      case 'gelir': return getGelir(ins)
      case 'roas': return getRoas(ins)
      case 'donusum': return getDonusum(ins)
      case 'sepet': return s
      case 'sepet_maliyet': return s > 0 && h > 0 ? h / s : 0
      case 'gosterim': return parseInt(ins?.impressions || '0')
      case 'tiklama': return parseInt(ins?.clicks || '0')
      case 'ctr': return parseFloat(ins?.ctr || '0')
      case 'cpc': return parseFloat(ins?.cpc || '0')
      case 'frekans': return parseFloat(ins?.frequency || '0')
      case 'cpm': return parseFloat(ins?.cpm || '0')
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
    setSiralama(prev => ({ alan, yon: prev.alan === alan && prev.yon === 'desc' ? 'asc' : 'desc' }))
  }

  const th = kampanyalar.reduce((a, k) => a + parseFloat(k.insights?.data[0]?.spend || '0'), 0)
  const tg = kampanyalar.reduce((a, k) => a + getGelir(k.insights?.data[0]), 0)
  const td = kampanyalar.reduce((a, k) => a + getDonusum(k.insights?.data[0]), 0)
  const tt = kampanyalar.reduce((a, k) => a + parseInt(k.insights?.data[0]?.clicks || '0'), 0)
  const tgos = kampanyalar.reduce((a, k) => a + parseInt(k.insights?.data[0]?.impressions || '0'), 0)
  const ts = kampanyalar.reduce((a, k) => a + getSepet(k.insights?.data[0]), 0)
  const tgor = kampanyalar.reduce((a, k) => a + getGoruntulenme(k.insights?.data[0]), 0)
  const tco = kampanyalar.reduce((a, k) => a + getCheckout(k.insights?.data[0]), 0)
  const roas = th > 0 ? tg / th : 0
  const aktifSayi = kampanyalar.filter(k => k.status === 'ACTIVE').length

  const grafikKampanyalar = [...kampanyalar]
    .filter(k => parseFloat(k.insights?.data[0]?.spend || '0') > 0)
    .sort((a, b) => parseFloat(b.insights?.data[0]?.spend || '0') - parseFloat(a.insights?.data[0]?.spend || '0'))
    .slice(0, 8)

  const grafikData = {
    labels: grafikKampanyalar.map(k => k.name.length > 20 ? k.name.substring(0, 20) + '...' : k.name),
    datasets: [
      { label: 'Harcama (₺)', data: grafikKampanyalar.map(k => parseFloat(k.insights?.data[0]?.spend || '0')), backgroundColor: 'rgba(15, 76, 129, 0.8)', borderRadius: 6, yAxisID: 'y' },
      { label: 'Gelir (₺)', data: grafikKampanyalar.map(k => getGelir(k.insights?.data[0])), backgroundColor: 'rgba(5, 150, 105, 0.8)', borderRadius: 6, yAxisID: 'y' },
    ]
  }

  const hesapBilgi = HESAPLAR.find(h => h.id === aktifHesap)!
  const aktifKampanyalar = kampanyalar.filter(k => k.status === 'ACTIVE' && parseFloat(k.insights?.data[0]?.spend || '0') > 0)
  const enIyi = [...aktifKampanyalar].sort((a, b) => getRoas(b.insights?.data[0]) - getRoas(a.insights?.data[0]))[0]
  const enKotu = [...aktifKampanyalar].sort((a, b) => getRoas(a.insights?.data[0]) - getRoas(b.insights?.data[0]))[0]

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <Sidebar />

      <div style={{ flex: 1, marginLeft: '220px' }}>
        {aiDonemModal && <AiDonemModal onConfirm={aiAnalizYap} onClose={() => setAiDonemModal(false)} />}

        {/* HEADER */}
        <header style={{
          background: C.card, borderBottom: `1px solid ${C.border}`,
          padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          height: '56px', position: 'sticky', top: 0, zIndex: 50,
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: C.primary }}>📘 Meta Ads</span>
            <div style={{ width: '1px', height: '20px', background: C.border }} />
            <div style={{ display: 'flex', gap: '4px' }}>
              {HESAPLAR.map(h => (
                <button key={h.id} onClick={() => setAktifHesap(h.id)} style={{
                  padding: '5px 14px', borderRadius: '8px',
                  border: `1.5px solid ${aktifHesap === h.id ? h.renk : C.border}`,
                  background: aktifHesap === h.id ? h.renk + '15' : 'transparent',
                  color: aktifHesap === h.id ? h.renk : C.muted,
                  cursor: 'pointer', fontSize: '0.82rem', fontWeight: aktifHesap === h.id ? 600 : 400,
                  transition: 'all 0.15s'
                }}>{h.emoji} {h.ad}</button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {donem !== 'ozel' ? (
              <>
                {PRESETLER.map(p => (
                  <button key={p.id} onClick={() => setDonem(p.id)} style={{
                    padding: '4px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '0.75rem',
                    background: donem === p.id ? C.cardHover : 'transparent',
                    color: donem === p.id ? C.text : C.muted, fontWeight: donem === p.id ? 600 : 400,
                  }}>{p.ad}</button>
                ))}
                <button onClick={() => setDonem('ozel')} style={{
                  padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem',
                  border: `1.5px solid ${C.border}`,
                  background: 'transparent', color: C.muted,
                }}>📅 Özel</button>
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <button onClick={() => setDonem('30')} style={{ padding: '4px 8px', borderRadius: '6px', border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, cursor: 'pointer', fontSize: '0.72rem' }}>← Geri</button>
                <input type="date" value={baslangic} onChange={e => setBaslangic(e.target.value)}
                  style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '6px', color: C.text, padding: '4px 8px', fontSize: '0.75rem' }} />
                <span style={{ color: C.faint, fontSize: '0.75rem' }}>—</span>
                <input type="date" value={bitis} onChange={e => setBitis(e.target.value)}
                  style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '6px', color: C.text, padding: '4px 8px', fontSize: '0.75rem' }} />
                <button onClick={yukle} disabled={!baslangic || !bitis} style={{
                  padding: '4px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
                  background: baslangic && bitis ? C.accent : C.borderLight,
                  color: baslangic && bitis ? '#fff' : C.faint,
                }}>Uygula</button>
              </div>
            )}
            <div style={{ width: '1px', height: '20px', background: C.border, margin: '0 4px' }} />
            <span style={{ background: '#DCFCE7', color: '#166534', padding: '3px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 600, border: '1px solid #A7F3D0' }}>● Canlı</span>
            {!yukleniyor && kampanyalar.length > 0 && (
              <button onClick={() => setAiDonemModal(true)} style={{
                background: '#7C3AED', color: '#fff', border: 'none', borderRadius: '8px',
                padding: '5px 14px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, marginLeft: '4px'
              }}>🤖 Hızlı Analiz</button>
            )}
            {gecmis.length > 0 && (
              <button onClick={() => setGecmisAcik(!gecmisAcik)} style={{
                background: gecmisAcik ? C.cardHover : 'transparent',
                color: gecmisAcik ? C.text : C.muted,
                border: `1px solid ${C.border}`, borderRadius: '6px',
                padding: '4px 10px', cursor: 'pointer', fontSize: '0.75rem', marginLeft: '2px'
              }}>📋 ({gecmis.length})</button>
            )}
          </div>
        </header>


        <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '20px 24px' }}>

          {/* GEÇMİŞ ANALİZLER */}
          {gecmisAcik && gecmis.length > 0 && (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', marginBottom: '20px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <div style={{ padding: '12px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F5F3FF' }}>
                <span style={{ fontWeight: 600, fontSize: '0.88rem', color: '#4C1D95' }}>📋 Geçmiş Analizler</span>
                <Link href="/ai-analiz" style={{ fontSize: '0.75rem', color: '#7C3AED', textDecoration: 'none', fontWeight: 500 }}>AI Merkezi&apos;nde aç →</Link>
              </div>
              <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {gecmis.map(item => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', background: C.bg, borderRadius: '8px', border: `1px solid ${C.border}` }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '2px' }}>
                        <span style={{ fontSize: '0.83rem', fontWeight: 600, color: C.text }}>{item.hesapAdi}</span>
                        <span style={{ fontSize: '0.72rem', color: '#7C3AED', background: '#F5F3FF', border: '1px solid #DDD6FE', padding: '1px 6px', borderRadius: '4px' }}>{item.donemAdi}</span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: C.faint }}>{item.tarih}</div>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: C.muted }}>ROAS: <span style={{ color: '#0284C7', fontWeight: 600 }}>{String(item.analiz.genelRoas || '—')}</span></div>
                    <button onClick={() => { setAiAnaliz(item.analiz); setAiDonemAdi(`${item.hesapAdi} · ${item.donemAdi}`); setAiAcik(true); setGecmisAcik(false) }}
                      style={{ background: '#7C3AED', color: '#fff', border: 'none', borderRadius: '6px', padding: '5px 12px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>Görüntüle</button>
                    <button onClick={() => gecmisSil(item.id)}
                      style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.muted, borderRadius: '6px', padding: '5px 9px', cursor: 'pointer', fontSize: '0.8rem' }}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!yukleniyor && !hata && (
            <>
              {/* KPI KARTLAR */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', marginBottom: '10px' }}>
                {[
                  { b: 'Toplam Harcama', d: para(th), r: METRIK_RENK.harcama, a: `${aktifSayi}/${kampanyalar.length} aktif`, simdiki: th, onceki: oncekiToplamlar?.harcama },
                  { b: 'Toplam Gelir', d: para(tg), r: METRIK_RENK.gelir, a: 'Dönüşüm geliri', simdiki: tg, onceki: oncekiToplamlar?.gelir },
                  { b: 'ROAS', d: `${roas.toFixed(2)}x`, r: roasRenk(roas), a: 'Harcama getirisi', simdiki: roas, onceki: oncekiToplamlar?.roas },
                  { b: 'Dönüşüm', d: sayi(td), r: METRIK_RENK.donusum, a: 'Toplam satış', simdiki: td, onceki: oncekiToplamlar?.donusum },
                  { b: 'Tıklama', d: sayi(tt), r: METRIK_RENK.tiklama, a: 'Toplam tıklama', simdiki: tt, onceki: oncekiToplamlar?.tiklama },
                ].map((k, i) => (
                  <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '16px', borderTop: `3px solid ${k.r}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                    <div style={{ fontSize: '0.68rem', color: C.muted, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{k.b}</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: k.r, marginBottom: '6px' }}>{k.d}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.68rem', color: C.faint }}>{k.a}</span>
                      {k.onceki !== undefined && k.simdiki !== undefined && (
                        <DeltaBadge simdiki={k.simdiki} onceki={k.onceki} tersSiralama={k.b === 'Ort. CPC'} />
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* DÖNÜŞÜM HUNİSİ KARTLARI */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '20px' }}>
                {[
                  { b: 'Görüntülenme', d: tgor > 0 ? sayi(tgor) : '—', r: '#6366F1', a: 'Ürün görüntüleme', icon: '👁️' },
                  { b: 'Sepete Ekleme', d: ts > 0 ? sayi(ts) : '—', r: '#8B5CF6', a: ts > 0 && th > 0 ? `Sepet mal: ${para(th / ts)}` : 'Add to cart', icon: '🛒' },
                  { b: 'Ödeme Başlatma', d: tco > 0 ? sayi(tco) : '—', r: '#F59E0B', a: tco > 0 && ts > 0 ? `Dön. oranı: %${((tco / ts) * 100).toFixed(1)}` : 'Checkout', icon: '💳' },
                  { b: 'Görüntülenme', d: tgos >= 1000000 ? `${(tgos / 1000000).toFixed(1)}M` : tgos >= 1000 ? `${(tgos / 1000).toFixed(0)}B` : sayi(tgos), r: METRIK_RENK.gosterim, a: 'Reklam gösterimi', icon: '📢' },
                ].map((k, i) => (
                  <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                    <div style={{ fontSize: '1.6rem' }}>{k.icon}</div>
                    <div>
                      <div style={{ fontSize: '0.65rem', color: C.muted, textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>{k.b}</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 700, color: k.r }}>{k.d}</div>
                      <div style={{ fontSize: '0.65rem', color: C.faint, marginTop: '1px' }}>{k.a}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* AI ANALİZ RAPORU */}
              {aiAcik && (
                aiYukleniyor ? (
                  <div style={{ background: C.card, border: '1px solid #DDD6FE', borderRadius: '12px', marginBottom: '20px', padding: '40px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🤖</div>
                    <p style={{ fontSize: '0.95rem', color: C.text, fontWeight: 500 }}>Aktif kampanyalar analiz ediliyor...</p>
                    <p style={{ fontSize: '0.78rem', marginTop: '6px', color: C.muted }}>{aiDonemAdi} · 10-20 saniye sürebilir</p>
                  </div>
                ) : aiAnaliz ? (
                  <div style={{ marginBottom: '20px' }}>
                    <AiRapor analiz={aiAnaliz} hesapAdi={hesapBilgi.ad} donemAdi={aiDonemAdi} onKapat={() => setAiAcik(false)} />
                  </div>
                ) : null
              )}

              {/* EN İYİ / EN KÖTÜ */}
              {enIyi && enKotu && enIyi.id !== enKotu.id && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
                  <div style={{ background: C.card, border: '1px solid #A7F3D0', borderRadius: '10px', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: '#059669', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 700 }}>🏆 En İyi ROAS</div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 600, color: C.text }}>{enIyi.name}</div>
                    </div>
                    <div style={{ fontSize: '1.7rem', fontWeight: 700, color: '#059669' }}>{getRoas(enIyi.insights?.data[0]).toFixed(2)}x</div>
                  </div>
                  <div style={{ background: C.card, border: '1px solid #FECACA', borderRadius: '10px', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: '#DC2626', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 700 }}>⚠️ En Düşük ROAS</div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 600, color: C.text }}>{enKotu.name}</div>
                    </div>
                    <div style={{ fontSize: '1.7rem', fontWeight: 700, color: '#DC2626' }}>{getRoas(enKotu.insights?.data[0]).toFixed(2)}x</div>
                  </div>
                </div>
              )}

              {/* GRAFİK */}
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '10px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div onClick={() => setGrafik(!grafik)} style={{ padding: '14px 20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: grafik ? `1px solid ${C.border}` : 'none' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.88rem', color: C.text }}>📊 Kampanya Bazlı Harcama & Gelir</span>
                  <span style={{ color: C.muted, fontSize: '0.8rem' }}>{grafik ? '▲ Gizle' : '▼ Göster'}</span>
                </div>
                {grafik && (
                  <div style={{ padding: '16px 20px 20px' }}>
                    <Bar data={grafikData} options={{
                      responsive: true,
                      plugins: {
                        legend: { labels: { color: C.muted, font: { size: 11 } } },
                        tooltip: { callbacks: { label: (c) => ` ₺${parseFloat(String(c.raw)).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}` } }
                      },
                      scales: {
                        x: { ticks: { color: C.muted, font: { size: 10 } }, grid: { color: C.borderLight } },
                        y: { ticks: { color: C.muted, callback: (v) => `₺${Number(v).toLocaleString('tr-TR')}` }, grid: { color: C.borderLight } }
                      }
                    }} />
                  </div>
                )}
              </div>

              {/* FİLTRELER */}
              {(() => {
                const hedefAltindaki = kampanyalar.filter(k => {
                  const r = getRoas(k.insights?.data[0])
                  return r > 0 && r < roasHedefi
                }).length
                return hedefAltindaki > 0 ? (
                  <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '9px 16px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.83rem', color: '#DC2626', fontWeight: 600 }}>
                      ⚠️ {hedefAltindaki} kampanya hedef ROAS&apos;ın ({roasHedefi}x) altında
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#991B1B' }}>— &quot;Hedef Altı&quot; etiketiyle işaretlendi</span>
                  </div>
                ) : null
              })()}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}>
                <input placeholder="🔍 Kampanya ara..." value={arama} onChange={e => setArama(e.target.value)}
                  style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '8px', color: C.text, padding: '7px 14px', fontSize: '0.82rem', width: '220px', outline: 'none' }} />
                {(['hepsi', 'aktif', 'durduruldu'] as const).map(s => (
                  <button key={s} onClick={() => setStatusFiltre(s)} style={{
                    padding: '6px 14px', borderRadius: '8px',
                    border: `1px solid ${statusFiltre === s ? C.accent : C.border}`,
                    background: statusFiltre === s ? '#EFF6FF' : 'transparent',
                    color: statusFiltre === s ? '#0369A1' : C.muted,
                    cursor: 'pointer', fontSize: '0.78rem', fontWeight: statusFiltre === s ? 600 : 400,
                  }}>
                    {s === 'hepsi' ? 'Tümü' : s === 'aktif' ? '● Aktif' : '■ Durduruldu'}
                  </button>
                ))}
                <div style={{ width: '1px', height: '20px', background: C.border }} />
                <button onClick={anomaliTara} disabled={anomaliYukleniyor || kampanyalar.length === 0} style={{
                  padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
                  border: `1px solid ${anomaliler.length > 0 ? '#FECACA' : '#FDE68A'}`,
                  background: anomaliler.length > 0 ? '#FEF2F2' : '#FFFBEB',
                  color: anomaliler.length > 0 ? '#DC2626' : '#B45309',
                  opacity: anomaliYukleniyor ? 0.6 : 1
                }}>
                  {anomaliYukleniyor ? '⏳ Taranıyor...' : anomaliler.length > 0 ? `🔍 ${anomaliler.length} Anomali` : '🔍 Anomali Tara'}
                </button>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.75rem', color: C.muted, fontWeight: 500 }}>🎯 Hedef ROAS:</span>
                    <input type="number" value={roasHedefi} min="0" max="20" step="0.5"
                      onChange={e => {
                        const v = parseFloat(e.target.value)
                        if (!isNaN(v)) {
                          setRoasHedefi(v)
                          try { localStorage.setItem('roas_hedefi', String(v)) } catch { /* ignore */ }
                        }
                      }}
                      style={{ width: '58px', background: C.card, border: `1px solid ${C.border}`, borderRadius: '6px', color: C.text, padding: '5px 8px', fontSize: '0.82rem', outline: 'none', textAlign: 'center' }}
                    />
                  </div>
                  <span style={{ fontSize: '0.78rem', color: C.muted }}>{filtreliKampanyalar.length} kampanya</span>
                </div>
              </div>

              {/* ANOMALİ SONUÇLARI */}
              {anomaliler.length > 0 && !anomaliGizle && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', padding: '14px 18px', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#991B1B' }}>
                      🔍 {anomaliler.length} Anomali Tespit Edildi — 30 gün vs son 7 gün karşılaştırması
                    </span>
                    <button onClick={() => setAnomaliGizle(true)} style={{ background: 'transparent', border: 'none', color: '#991B1B', cursor: 'pointer', fontSize: '0.8rem' }}>✕ Kapat</button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {anomaliler.map((a, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.6)', borderRadius: '7px', padding: '8px 12px' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, background: '#DC2626', color: '#fff', padding: '2px 7px', borderRadius: '5px', flexShrink: 0 }}>{a.metrik}</span>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#7F1D1D' }}>{a.kampanyaAdi}</span>
                          <span style={{ fontSize: '0.78rem', color: '#991B1B', marginLeft: '6px' }}>— {a.mesaj}</span>
                        </div>
                        <Link href={`/kampanya/${a.kampanyaId}?hesap=${aktifHesap}&donem=30&name=${encodeURIComponent(a.kampanyaAdi)}`}
                          style={{ color: '#DC2626', fontSize: '0.72rem', textDecoration: 'none', padding: '3px 9px', borderRadius: '5px', background: '#FECACA', whiteSpace: 'nowrap', flexShrink: 0, fontWeight: 600 }}>
                          Detay →
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* KAMPANYA TABLOSU */}
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.bg }}>
                  <span style={{ fontWeight: 600, fontSize: '0.88rem', color: C.text }}>{hesapBilgi.emoji} {hesapBilgi.ad} — Kampanyalar</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '0.7rem', color: C.faint }}>Skor = ROAS+CTR+CVR · üzerine gel → detay</span>
                    <span style={{ fontSize: '0.73rem', color: C.muted }}>▶ genişlet · ↗ yeni sayfa</span>
                    <button onClick={() => excelExport(filtreliKampanyalar, `${hesapBilgi.ad}_Kampanyalar`)} style={{
                      background: '#F0FDF4', border: '1px solid #A7F3D0', color: '#059669',
                      borderRadius: '6px', padding: '5px 12px', cursor: 'pointer',
                      fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px'
                    }}>
                      📥 Excel İndir
                    </button>
                  </div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1150px' }}>
                    <thead>
                      <tr style={{ background: C.tableHead }}>
                        <th style={{ textAlign: 'left', fontSize: '0.68rem', color: C.muted, textTransform: 'uppercase', padding: '10px 16px', borderBottom: `1px solid ${C.border}`, width: '300px', fontWeight: 600, letterSpacing: '0.04em' }}>Kampanya</th>
                        <th style={{ textAlign: 'left', fontSize: '0.68rem', color: C.muted, textTransform: 'uppercase', padding: '10px 12px', borderBottom: `1px solid ${C.border}`, fontWeight: 600, letterSpacing: '0.04em' }}>Durum</th>
                        <th style={{ textAlign: 'center', fontSize: '0.68rem', color: C.muted, textTransform: 'uppercase', padding: '10px 12px', borderBottom: `1px solid ${C.border}`, minWidth: '52px', fontWeight: 600, letterSpacing: '0.04em' }} title="Performans: ROAS+CTR+CVR">Skor</th>
                        {ALANLAR.map(a => (
                          <th key={a} onClick={() => sutunTikla(a)} style={{
                            textAlign: 'left', fontSize: '0.68rem', textTransform: 'uppercase', padding: '10px 12px',
                            borderBottom: `1px solid ${C.border}`, cursor: 'pointer', userSelect: 'none',
                            fontWeight: 600, letterSpacing: '0.04em',
                            color: siralama.alan === a ? C.primary : C.muted,
                            background: siralama.alan === a ? '#EFF6FF' : 'transparent',
                          }}>
                            {ALAN_BASLIK[a]} {siralama.alan === a ? (siralama.yon === 'desc' ? '↓' : '↑') : '↕'}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtreliKampanyalar.map(k => (
                        <>
                          <tr key={k.id} onClick={() => kampanyaTikla(k)}
                            style={{ cursor: 'pointer', background: acikKampanya === k.id ? C.cardHover : C.card }}
                            onMouseEnter={e => { if (acikKampanya !== k.id) (e.currentTarget as HTMLTableRowElement).style.background = C.cardHover }}
                            onMouseLeave={e => { if (acikKampanya !== k.id) (e.currentTarget as HTMLTableRowElement).style.background = C.card }}>
                            <td style={{ padding: '11px 16px', fontSize: '0.83rem', borderBottom: `1px solid ${C.borderLight}` }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ color: C.muted, fontSize: '0.75rem', minWidth: '12px', flexShrink: 0 }}>{acikKampanya === k.id ? '▼' : '▶'}</span>
                                <span style={{ fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>{k.name}</span>
                                {getRoas(k.insights?.data[0]) > 0 && getRoas(k.insights?.data[0]) < roasHedefi && (
                                  <span style={{ fontSize: '0.65rem', color: '#DC2626', background: '#FEF2F2', padding: '1px 5px', borderRadius: '3px', border: '1px solid #FECACA', whiteSpace: 'nowrap', flexShrink: 0 }}>⚠️ Hedef Altı</span>
                                )}
                                <Link href={`/kampanya/${k.id}?hesap=${aktifHesap}&donem=${donem}&name=${encodeURIComponent(k.name)}&status=${k.status}`}
                                  onClick={e => e.stopPropagation()}
                                  style={{ color: '#0284C7', fontSize: '0.7rem', textDecoration: 'none', padding: '2px 7px', borderRadius: '4px', background: '#EFF6FF', border: '1px solid #BAE6FD', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                  ↗ Detay
                                </Link>
                              </div>
                              {/* Bütçe doluluk göstergesi */}
                              {k.daily_budget && (() => {
                                const gunlukButce = parseInt(k.daily_budget) / 100 // Meta kuruş olarak döner
                                const harcama = parseFloat(k.insights?.data[0]?.spend || '0')
                                const oran = donem === '1' && gunlukButce > 0 ? Math.min(harcama / gunlukButce * 100, 100) : null
                                const renk = oran !== null ? (oran > 90 ? '#059669' : oran > 50 ? '#D97706' : '#6B7280') : '#6B7280'
                                return (
                                  <div style={{ marginTop: '5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontSize: '0.62rem', color: C.faint, whiteSpace: 'nowrap' }}>
                                      💰 {para(gunlukButce)}/gün
                                    </span>
                                    {oran !== null && (
                                      <>
                                        <div style={{ flex: 1, background: C.borderLight, borderRadius: '3px', height: '4px', maxWidth: '80px' }}>
                                          <div style={{ background: renk, borderRadius: '3px', height: '4px', width: `${oran}%`, transition: 'width 0.5s' }} />
                                        </div>
                                        <span style={{ fontSize: '0.62rem', color: renk, fontWeight: 600 }}>%{oran.toFixed(0)}</span>
                                      </>
                                    )}
                                  </div>
                                )
                              })()}
                            </td>
                            <td style={{ padding: '11px 12px', borderBottom: `1px solid ${C.borderLight}` }}><Badge status={k.status} /></td>
                            <SkorBadge ins={k.insights?.data[0]} />
                            {ALANLAR.map(a => <MetrikHucre key={a} ins={k.insights?.data[0]} alan={a} />)}
                          </tr>

                          {acikKampanya === k.id && (
                            setYukLen === k.id ? (
                              <tr key={`${k.id}-l`}><td colSpan={14} style={{ padding: '10px 40px', color: C.muted, fontSize: '0.78rem', background: C.subRow, borderBottom: `1px solid ${C.borderLight}` }}>⏳ Reklam setleri yükleniyor...</td></tr>
                            ) : (reklamSetleri[k.id] || []).map(s => (
                              <>
                                <tr key={s.id} onClick={() => setTikla(s)}
                                  style={{ cursor: 'pointer', background: acikSet === s.id ? C.cardHover : C.subRow }}
                                  onMouseEnter={e => { if (acikSet !== s.id) (e.currentTarget as HTMLTableRowElement).style.background = C.cardHover }}
                                  onMouseLeave={e => { if (acikSet !== s.id) (e.currentTarget as HTMLTableRowElement).style.background = C.subRow }}>
                                  <td style={{ padding: '9px 16px 9px 36px', fontSize: '0.8rem', borderBottom: `1px solid ${C.borderLight}` }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <span style={{ color: C.muted, fontSize: '0.7rem', minWidth: '12px' }}>{acikSet === s.id ? '▼' : '▶'}</span>
                                      <span style={{ color: '#0369A1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '220px' }}>📦 {s.name}</span>
                                    </div>
                                  </td>
                                  <td style={{ padding: '9px 12px', borderBottom: `1px solid ${C.borderLight}` }}><Badge status={s.status} /></td>
                                  <SkorBadge ins={s.insights?.data[0]} />
                                  {ALANLAR.map(a => <MetrikHucre key={a} ins={s.insights?.data[0]} alan={a} />)}
                                </tr>
                                {acikSet === s.id && (
                                  rekYukLen === s.id ? (
                                    <tr key={`${s.id}-l`}><td colSpan={14} style={{ padding: '8px 64px', color: C.muted, fontSize: '0.75rem', background: C.tableHead, borderBottom: `1px solid ${C.borderLight}` }}>⏳ Reklamlar yükleniyor...</td></tr>
                                  ) : (reklamlar[s.id] || []).map(r => (
                                    <tr key={r.id} style={{ background: C.tableHead }}>
                                      <td style={{ padding: '9px 16px 9px 58px', fontSize: '0.78rem', borderBottom: `1px solid ${C.borderLight}` }}>
                                        <span style={{ color: '#7C3AED', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: '200px' }}>🎯 {r.name}</span>
                                      </td>
                                      <td style={{ padding: '9px 12px', borderBottom: `1px solid ${C.borderLight}` }}><Badge status={r.status} /></td>
                                      <SkorBadge ins={r.insights?.data[0]} />
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
                        <tr><td colSpan={14} style={{ textAlign: 'center', padding: '48px', color: C.muted }}>Kampanya bulunamadı</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* BÜTÇE DAĞILIM KARTI */}
          {!yukleniyor && kampanyalar.filter(k => k.daily_budget).length > 0 && (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', marginTop: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
              <div onClick={() => setButceAcik(!butceAcik)} style={{ padding: '14px 20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: butceAcik ? `1px solid ${C.border}` : 'none', background: C.bg }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: '0.88rem', color: C.text }}>💰 Bütçe & Performans Dağılımı</span>
                  <span style={{ fontSize: '0.72rem', color: C.muted, marginLeft: '8px' }}>Günlük bütçe vs ROAS</span>
                </div>
                <span style={{ color: C.muted, fontSize: '0.8rem' }}>{butceAcik ? '▲ Kapat' : '▼ Göster'}</span>
              </div>
              {butceAcik && <div style={{ padding: '20px 24px' }}>
              {(() => {
                const butceli = kampanyalar.filter(k => k.daily_budget && parseFloat(k.insights?.data[0]?.spend || '0') > 0)
                const toplamButce = butceli.reduce((s, k) => s + parseInt(k.daily_budget!) / 100, 0)
                const toplamHarcama = butceli.reduce((s, k) => s + parseFloat(k.insights?.data[0]?.spend || '0'), 0)
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {butceli
                      .sort((a, b) => (parseInt(b.daily_budget!) / 100) - (parseInt(a.daily_budget!) / 100))
                      .map((k, i) => {
                        const butce = parseInt(k.daily_budget!) / 100
                        const harcama = parseFloat(k.insights?.data[0]?.spend || '0')
                        const roas = getRoas(k.insights?.data[0])
                        const butcePay = toplamButce > 0 ? (butce / toplamButce * 100) : 0
                        const harcamaPay = toplamHarcama > 0 ? (harcama / toplamHarcama * 100) : 0
                        // Değerlendirme: yüksek ROAS + az bütçe = fırsat
                        const firsat = roas >= 3 && butcePay < harcamaPay * 0.8
                        const verimsiz = roas > 0 && roas < 1.5 && butcePay > 15
                        return (
                          <div key={k.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '8px', background: firsat ? '#F0FDF4' : verimsiz ? '#FEF2F2' : C.bg, border: `1px solid ${firsat ? '#A7F3D0' : verimsiz ? '#FECACA' : C.border}` }}>
                            <div style={{ flex: 2, minWidth: 0 }}>
                              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '4px' }}>
                                {firsat && <span style={{ color: '#059669', marginRight: '4px' }}>🚀</span>}
                                {verimsiz && <span style={{ color: '#DC2626', marginRight: '4px' }}>⚠️</span>}
                                {k.name}
                              </div>
                              {/* Bütçe pay çubuğu */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '0.62rem', color: C.faint, whiteSpace: 'nowrap' }}>Bütçe</span>
                                <div style={{ flex: 1, background: C.borderLight, borderRadius: '3px', height: '5px' }}>
                                  <div style={{ background: '#0284C7', borderRadius: '3px', height: '5px', width: `${butcePay}%`, transition: 'width 0.5s' }} />
                                </div>
                                <span style={{ fontSize: '0.68rem', color: '#0284C7', fontWeight: 600, whiteSpace: 'nowrap' }}>{para(butce)}/gün · %{butcePay.toFixed(0)}</span>
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '16px', flexShrink: 0 }}>
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '0.6rem', color: C.faint }}>ROAS</div>
                                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: roasRenk(roas) }}>{roas > 0 ? `${roas.toFixed(1)}x` : '—'}</div>
                              </div>
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '0.6rem', color: C.faint }}>Harcama Payı</div>
                                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: C.muted }}>%{harcamaPay.toFixed(0)}</div>
                              </div>
                            </div>
                            {firsat && <div style={{ fontSize: '0.7rem', color: '#059669', background: '#DCFCE7', padding: '3px 8px', borderRadius: '6px', fontWeight: 600, whiteSpace: 'nowrap' }}>Bütçe artır!</div>}
                            {verimsiz && <div style={{ fontSize: '0.7rem', color: '#DC2626', background: '#FEE2E2', padding: '3px 8px', borderRadius: '6px', fontWeight: 600, whiteSpace: 'nowrap' }}>Gözden geçir</div>}
                          </div>
                        )
                      })}
                  </div>
                )
              })()}
              </div>}
            </div>
          )}

          {/* ÜRÜN PERFORMANSI */}
          {!yukleniyor && !hata && (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', marginTop: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
              <div onClick={() => { setUrunAcik(!urunAcik); if (!urunAcik && urunler.length === 0) urunYukle(true) }}
                style={{ padding: '14px 20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: urunAcik ? `1px solid ${C.border}` : 'none', background: C.bg }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: '0.88rem', color: C.text }}>🛍️ Ürün Performansı</span>
                  <span style={{ fontSize: '0.72rem', color: C.muted, marginLeft: '8px' }}>Hangi ürün ne kadar sattı?</span>
                </div>
                <span style={{ color: C.muted, fontSize: '0.8rem' }}>{urunAcik ? '▲ Kapat' : '▼ Göster'}</span>
              </div>

              {urunAcik && (
                <div style={{ padding: '0 0 16px' }}>
                  {urunYukleniyor && urunler.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: C.muted }}>⏳ Ürünler yükleniyor...</div>
                  ) : urunler.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: C.faint, fontSize: '0.85rem' }}>Ürün verisi bulunamadı. Katalog bağlantısını kontrol et.</div>
                  ) : (() => {
                    const urunDeger = (u: UrunSatir, alan: string) => {
                      const h = parseFloat(u.spend || '0')
                      const satis = parseInt(u.actions?.find(a => ['purchase', 'offsite_conversion.fb_pixel_purchase', 'omni_purchase'].includes(a.action_type))?.value || '0')
                      const gelir = parseFloat(u.action_values?.find(a => ['purchase', 'offsite_conversion.fb_pixel_purchase', 'omni_purchase'].includes(a.action_type))?.value || '0')
                      const sepet = parseInt(u.actions?.find(a => ['add_to_cart', 'offsite_conversion.fb_pixel_add_to_cart', 'omni_add_to_cart'].includes(a.action_type))?.value || '0')
                      const goruntulenme = parseInt(u.actions?.find(a => ['view_content', 'offsite_conversion.fb_pixel_view_content', 'omni_view_content'].includes(a.action_type))?.value || '0')
                      switch (alan) {
                        case 'harcama': return h
                        case 'satis': return satis
                        case 'gelir': return gelir
                        case 'roas': return h > 0 ? gelir / h : 0
                        case 'sepet': return sepet
                        case 'goruntulenme': return goruntulenme
                        default: return 0
                      }
                    }
                    const siraliUrunler = [...urunler].sort((a, b) => {
                      const fark = urunDeger(a, urunSiralama.alan) - urunDeger(b, urunSiralama.alan)
                      return urunSiralama.yon === 'desc' ? -fark : fark
                    })
                    const thStyle = (alan: string) => ({
                      textAlign: 'left' as const, fontSize: '0.67rem', textTransform: 'uppercase' as const,
                      padding: '9px 14px', borderBottom: `1px solid ${C.border}`, fontWeight: 600,
                      letterSpacing: '0.04em', whiteSpace: 'nowrap' as const, cursor: 'pointer',
                      userSelect: 'none' as const,
                      color: urunSiralama.alan === alan ? C.primary : C.muted,
                      background: urunSiralama.alan === alan ? '#EFF6FF' : 'transparent',
                    })
                    const tikla = (alan: string) => setUrunSiralama(p => ({ alan, yon: p.alan === alan && p.yon === 'desc' ? 'asc' : 'desc' }))
                    const ok = (alan: string) => urunSiralama.alan === alan ? (urunSiralama.yon === 'desc' ? ' ↓' : ' ↑') : ' ↕'
                    return (
                    <>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
                          <thead>
                            <tr style={{ background: C.tableHead }}>
                              <th style={{ ...thStyle(''), cursor: 'default', width: '32px' }}>#</th>
                              <th style={{ ...thStyle(''), cursor: 'default' }}>ÜRÜN</th>
                              <th style={thStyle('harcama')} onClick={() => tikla('harcama')}>HARCAMA{ok('harcama')}</th>
                              <th style={thStyle('satis')} onClick={() => tikla('satis')}>SATIŞ{ok('satis')}</th>
                              <th style={thStyle('gelir')} onClick={() => tikla('gelir')}>GELİR{ok('gelir')}</th>
                              <th style={thStyle('roas')} onClick={() => tikla('roas')}>ROAS{ok('roas')}</th>
                              <th style={thStyle('sepet')} onClick={() => tikla('sepet')}>SEPETE EKL.{ok('sepet')}</th>
                              <th style={thStyle('goruntulenme')} onClick={() => tikla('goruntulenme')}>GÖRÜNTÜLENME{ok('goruntulenme')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {siraliUrunler.map((u, i) => {
                              const h = parseFloat(u.spend || '0')
                              const satis = parseInt(u.actions?.find(a => ['purchase', 'offsite_conversion.fb_pixel_purchase', 'omni_purchase'].includes(a.action_type))?.value || '0')
                              const gelir = parseFloat(u.action_values?.find(a => ['purchase', 'offsite_conversion.fb_pixel_purchase', 'omni_purchase'].includes(a.action_type))?.value || '0')
                              const sepet = parseInt(u.actions?.find(a => ['add_to_cart', 'offsite_conversion.fb_pixel_add_to_cart', 'omni_add_to_cart'].includes(a.action_type))?.value || '0')
                              const goruntulenme = parseInt(u.actions?.find(a => ['view_content', 'offsite_conversion.fb_pixel_view_content', 'omni_view_content'].includes(a.action_type))?.value || '0')
                              const urunRoas = h > 0 ? gelir / h : 0
                              return (
                                <tr key={u.product_id} style={{ borderBottom: `1px solid ${C.borderLight}` }}
                                  onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = C.cardHover}
                                  onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}>
                                  <td style={{ padding: '10px 14px', fontSize: '0.75rem', color: C.faint }}>{i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</td>
                                  <td style={{ padding: '10px 14px', maxWidth: '260px' }}>
                                    <div style={{ fontWeight: 600, fontSize: '0.83rem', color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.product_name || u.product_id}</div>
                                    {u.product_name && <div style={{ fontSize: '0.63rem', color: C.faint, marginTop: '1px' }}>ID: {u.product_id}</div>}
                                  </td>
                                  <td style={{ padding: '10px 14px', fontSize: '0.83rem', color: METRIK_RENK.harcama, fontWeight: 600, whiteSpace: 'nowrap' }}>{h > 0 ? para(h) : '—'}</td>
                                  <td style={{ padding: '10px 14px', fontSize: '0.83rem', color: METRIK_RENK.donusum, fontWeight: 600 }}>{satis > 0 ? sayi(satis) : '—'}</td>
                                  <td style={{ padding: '10px 14px', fontSize: '0.83rem', color: METRIK_RENK.gelir, fontWeight: 600, whiteSpace: 'nowrap' }}>{gelir > 0 ? para(gelir) : '—'}</td>
                                  <td style={{ padding: '10px 14px', fontSize: '0.88rem', fontWeight: 700, color: roasRenk(urunRoas) }}>{urunRoas > 0 ? `${urunRoas.toFixed(2)}x` : '—'}</td>
                                  <td style={{ padding: '10px 14px', fontSize: '0.83rem', color: '#8B5CF6' }}>{sepet > 0 ? sayi(sepet) : '—'}</td>
                                  <td style={{ padding: '10px 14px', fontSize: '0.83rem', color: '#6366F1' }}>{goruntulenme > 0 ? sayi(goruntulenme) : '—'}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                      {urunCursor && (
                        <div style={{ textAlign: 'center', paddingTop: '12px' }}>
                          <button onClick={() => urunYukle(false)} disabled={urunYukleniyor} style={{
                            padding: '8px 24px', borderRadius: '8px', border: `1px solid ${C.border}`,
                            background: 'transparent', color: C.muted, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 500
                          }}>
                            {urunYukleniyor ? '⏳ Yükleniyor...' : '▼ Daha fazla göster'}
                          </button>
                        </div>
                      )}
                    </>
                    )
                  })()}
                </div>
              )}
            </div>
          )}

          {yukleniyor && (
            <div style={{ textAlign: 'center', padding: '80px', color: C.muted }}>
              <div style={{ fontSize: '2rem', marginBottom: '12px' }}>⏳</div>
              <p style={{ fontWeight: 500 }}>{hesapBilgi.ad} kampanyaları yükleniyor...</p>
            </div>
          )}

          {hata && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', padding: '16px 20px', color: '#991B1B' }}>
              <strong>⚠️ Hata:</strong> {hata}
              <p style={{ color: C.muted, marginTop: '6px', fontSize: '0.82rem' }}>Token süresi dolmuş olabilir. .env.local dosyasındaki META_ACCESS_TOKEN&apos;ı güncelle.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
