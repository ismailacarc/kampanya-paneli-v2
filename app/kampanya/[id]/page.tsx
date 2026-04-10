'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { C, METRIK_RENK } from '../../lib/theme'
import { HESAPLAR, PRESETLER, Insights, Satir, KirilimSatir, YasCinsiyetSatir, BolgeSatir, GunlukSatir, KreatifSatir } from '../../lib/types'
import { para, sayi, getDonusum, getGelir, getRoas, roasRenk, kampanyaSkoru, oncekiDonemTarihleri, yuzdeDesisim, getSepet, getGoruntulenme, getCheckout } from '../../lib/helpers'
import { UrunSatir } from '../../lib/types'
import { excelExport } from '../../lib/export'
import AiRapor from '../../components/AiRapor'
import { kayitEkle, OptimizasyonKaydi } from '../../lib/gecmis'

const HESAP_ADI: Record<string, string> = Object.fromEntries(HESAPLAR.map(h => [h.id, h.ad]))

function Badge({ status }: { status: string }) {
  const aktif = status === 'ACTIVE'
  return (
    <span style={{
      padding: '2px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 600,
      background: aktif ? '#DCFCE7' : '#FEE2E2',
      color: aktif ? '#166534' : '#991B1B',
      whiteSpace: 'nowrap'
    }}>
      {aktif ? '● Aktif' : '■ Durduruldu'}
    </span>
  )
}

function DeltaBadge({ simdiki, onceki, tersSiralama }: { simdiki: number; onceki: number; tersSiralama?: boolean }) {
  const delta = yuzdeDesisim(simdiki, onceki)
  if (!delta) return null
  const pozitif = tersSiralama ? !delta.yukari : delta.yukari
  return (
    <span style={{
      fontSize: '0.65rem', fontWeight: 600,
      color: pozitif ? '#059669' : '#DC2626',
      background: pozitif ? '#F0FDF4' : '#FEF2F2',
      padding: '1px 5px', borderRadius: '4px'
    }}>
      {delta.yukari ? '↑' : '↓'} %{delta.deger.toFixed(1)}
    </span>
  )
}

function SkorBadge({ ins }: { ins?: Insights }) {
  const { harf, renk, skor } = kampanyaSkoru(ins)
  if (harf === '—') return <span style={{ color: C.faint, fontSize: '0.78rem' }}>—</span>
  return (
    <span title={`Skor: ${skor}/100`} style={{
      display: 'inline-block', width: '22px', height: '22px', borderRadius: '50%',
      background: renk + '22', border: `1.5px solid ${renk}`, color: renk,
      fontSize: '0.72rem', fontWeight: 700, textAlign: 'center', lineHeight: '20px',
      cursor: 'help'
    }}>
      {harf}
    </span>
  )
}

const ALANLAR = ['harcama', 'gelir', 'roas', 'donusum', 'gosterim', 'tiklama', 'ctr', 'cpc', 'frekans', 'cpm']
const ALAN_BASLIK: Record<string, string> = {
  harcama: 'Harcama', gelir: 'Gelir', roas: 'ROAS', donusum: 'Dönüşüm',
  gosterim: 'Gösterim', tiklama: 'Tıklama', ctr: 'CTR', cpc: 'CPC',
  frekans: 'Frekans', cpm: 'CPM'
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
      case 'tiklama': return METRIK_RENK.tiklama
      case 'gosterim': return METRIK_RENK.gosterim
      case 'cpc': return METRIK_RENK.cpc
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
      padding: '12px', fontSize: '0.83rem',
      borderBottom: `1px solid ${C.borderLight}`,
      color: renk,
      fontWeight: ['harcama', 'gelir', 'roas'].includes(alan) ? 600 : 400,
      whiteSpace: 'nowrap'
    }}>
      {deger}
    </td>
  )
}

export default function KampanyaDetay() {
  const params = useParams()
  const searchParams = useSearchParams()

  const id = params.id as string
  const hesap = searchParams.get('hesap') || 'karmen'
  const kampanyaAdi = decodeURIComponent(searchParams.get('name') || 'Kampanya')
  const kampanyaStatus = searchParams.get('status') || 'ACTIVE'

  const [donem, setDonem] = useState(searchParams.get('donem') || '30')
  const [baslangic, setBaslangic] = useState('')
  const [bitis, setBitis] = useState('')
  const [reklamSetleri, setReklamSetleri] = useState<Satir[]>([])
  const [reklamlar, setReklamlar] = useState<Record<string, Satir[]>>({})
  const [acikSet, setAcikSet] = useState<string | null>(null)
  const [yukleniyor, setYukleniyor] = useState(true)
  const [rekYukLen, setRekYukLen] = useState<string | null>(null)
  const [aiAnaliz, setAiAnaliz] = useState<Record<string, unknown> | null>(null)
  const [aiYukleniyor, setAiYukleniyor] = useState(false)
  const [aiAcik, setAiAcik] = useState(false)
  const [hizliNotAcik, setHizliNotAcik] = useState(false)
  const [hizliNotMetin, setHizliNotMetin] = useState('')
  const [hizliNotKaydedildi, setHizliNotKaydedildi] = useState(false)
  const [siralama, setSiralama] = useState<{ alan: string; yon: 'asc' | 'desc' }>({ alan: 'harcama', yon: 'desc' })
  const [aktifTab, setAktifTab] = useState<'setler' | 'kirilim' | 'yas_cinsiyet' | 'bolge' | 'gunluk' | 'kreatifler' | 'urunler'>('setler')
  const [kirilimPlatform, setKirilimPlatform] = useState<KirilimSatir[]>([])
  const [kirilimCihaz, setKirilimCihaz] = useState<KirilimSatir[]>([])
  const [kirilimYukleniyor, setKirilimYukleniyor] = useState(false)
  const [yasCinsiyet, setYasCinsiyet] = useState<YasCinsiyetSatir[]>([])
  const [yasCinsiyetYukleniyor, setYasCinsiyetYukleniyor] = useState(false)
  const [bolge, setBolge] = useState<BolgeSatir[]>([])
  const [bolgeYukleniyor, setBolgeYukleniyor] = useState(false)
  const [gunlukTrend, setGunlukTrend] = useState<GunlukSatir[]>([])
  const [gunlukYukleniyor, setGunlukYukleniyor] = useState(false)
  const [gunlukGorunum, setGunlukGorunum] = useState<'gunluk' | 'haftalik'>('gunluk')
  const [kreatifler, setKreatifler] = useState<KreatifSatir[]>([])
  const [kreatifYukleniyor, setKreatifYukleniyor] = useState(false)
  const [urunler, setUrunler] = useState<UrunSatir[]>([])
  const [urunCursor, setUrunCursor] = useState<string | null>(null)
  const [urunYukleniyor, setUrunYukleniyor] = useState(false)
  const [urunSiralama, setUrunSiralama] = useState<{ alan: string; yon: 'asc' | 'desc' }>({ alan: 'gelir', yon: 'desc' })
  const [oncekiToplamlar, setOncekiToplamlar] = useState<{ harcama: number; gelir: number; roas: number; donusum: number; tiklama: number; gosterim: number } | null>(null)

  const hesapAdi = HESAP_ADI[hesap] || hesap

  const baslangicRef = useRef(baslangic)
  const bitisRef = useRef(bitis)
  baslangicRef.current = baslangic
  bitisRef.current = bitis

  const yukle = useCallback(() => {
    setYukleniyor(true)
    setReklamSetleri([])
    setReklamlar({})
    setAcikSet(null)
    setOncekiToplamlar(null)
    setKirilimPlatform([])
    setKirilimCihaz([])
    setYasCinsiyet([])
    setBolge([])
    setGunlukTrend([])
    setKreatifler([])

    let baseUrl = `/api/meta?hesap=${hesap}&tur=reklam-setleri&kampanya_id=${id}&donem=${donem}`
    if (donem === 'ozel' && baslangicRef.current && bitisRef.current) {
      baseUrl += `&baslangic=${baslangicRef.current}&bitis=${bitisRef.current}`
    }

    fetch(baseUrl)
      .then(r => r.json())
      .then(d => {
        const setler: Satir[] = d.data || []
        setReklamSetleri(setler)
        setYukleniyor(false)

        // Önceki dönem karşılaştırması
        const onceki = oncekiDonemTarihleri(donem)
        if (onceki) {
          fetch(`/api/meta?hesap=${hesap}&tur=reklam-setleri&kampanya_id=${id}&donem=ozel&baslangic=${onceki.baslangic}&bitis=${onceki.bitis}`)
            .then(r => r.json())
            .then(od => {
              if (od.data) {
                const ok: Satir[] = od.data
                const oh = ok.reduce((a, s) => a + parseFloat(s.insights?.data[0]?.spend || '0'), 0)
                const og = ok.reduce((a, s) => a + getGelir(s.insights?.data[0]), 0)
                setOncekiToplamlar({
                  harcama: oh, gelir: og, roas: oh > 0 ? og / oh : 0,
                  donusum: ok.reduce((a, s) => a + getDonusum(s.insights?.data[0]), 0),
                  tiklama: ok.reduce((a, s) => a + parseInt(s.insights?.data[0]?.clicks || '0'), 0),
                  gosterim: ok.reduce((a, s) => a + parseInt(s.insights?.data[0]?.impressions || '0'), 0),
                })
              }
            }).catch(() => { /* opsiyonel */ })
        }
      })
      .catch(() => setYukleniyor(false))
  }, [hesap, id, donem])

  useEffect(() => { yukle() }, [yukle])

  function setTikla(s: Satir) {
    if (acikSet === s.id) { setAcikSet(null); return }
    setAcikSet(s.id)
    if (reklamlar[s.id]) return
    setRekYukLen(s.id)
    fetch(`/api/meta?hesap=${hesap}&tur=reklamlar&set_id=${s.id}&donem=${donem}`)
      .then(r => r.json())
      .then(d => {
        setReklamlar(p => ({ ...p, [s.id]: d.data || [] }))
        setRekYukLen(null)
      })
  }

  async function aiAnalizYap() {
    setAiYukleniyor(true)
    setAiAcik(true)
    setAiAnaliz(null)

    try {
      const toplamHarcama = reklamSetleri.reduce((acc, s) => acc + parseFloat(s.insights?.data[0]?.spend || '0'), 0)
      const toplamGelir = reklamSetleri.reduce((acc, s) => acc + getGelir(s.insights?.data[0]), 0)
      const toplamDonusum = reklamSetleri.reduce((acc, s) => acc + getDonusum(s.insights?.data[0]), 0)
      const toplamTiklama = reklamSetleri.reduce((acc, s) => acc + parseInt(s.insights?.data[0]?.clicks || '0'), 0)
      const toplamGosterim = reklamSetleri.reduce((acc, s) => acc + parseInt(s.insights?.data[0]?.impressions || '0'), 0)

      const setKampanyalari = reklamSetleri.map(s => ({
        name: `${kampanyaAdi} → ${s.name}`,
        status: s.status,
        insights: s.insights
      }))

      const gonderilecek = setKampanyalari.length > 0 ? setKampanyalari : [{
        name: kampanyaAdi,
        status: kampanyaStatus,
        insights: {
          data: [{
            spend: String(toplamHarcama),
            impressions: String(toplamGosterim),
            clicks: String(toplamTiklama),
            ctr: toplamTiklama > 0 ? String((toplamTiklama / toplamGosterim) * 100) : '0',
            cpc: toplamTiklama > 0 ? String(toplamHarcama / toplamTiklama) : '0',
            action_values: [{ action_type: 'purchase', value: String(toplamGelir) }],
            actions: [{ action_type: 'purchase', value: String(toplamDonusum) }]
          }]
        }
      }]

      const res = await fetch('/api/ai-analiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kampanyalar: gonderilecek,
          hesapAdi: `${hesapAdi} / ${kampanyaAdi}`,
          skipStatusFilter: true
        })
      })
      const data = await res.json()
      setAiAnaliz(data.error ? { hata: data.error } : data.analiz)
    } catch {
      setAiAnaliz({ hata: 'Bağlantı hatası' })
    }
    setAiYukleniyor(false)
  }

  async function kirilimYukle() {
    if (kirilimPlatform.length > 0) return
    setKirilimYukleniyor(true)
    try {
      const [platRes, cihazRes] = await Promise.all([
        fetch(`/api/meta?hesap=${hesap}&tur=kirilim&kampanya_id=${id}&kirilim=publisher_platform&${donemQuery()}`),
        fetch(`/api/meta?hesap=${hesap}&tur=kirilim&kampanya_id=${id}&kirilim=device_platform&${donemQuery()}`)
      ])
      setKirilimPlatform((await platRes.json()).data || [])
      setKirilimCihaz((await cihazRes.json()).data || [])
    } catch { /* ignore */ }
    setKirilimYukleniyor(false)
  }

  function donemQuery() {
    if (donem === 'ozel' && baslangic && bitis) return `donem=ozel&baslangic=${baslangic}&bitis=${bitis}`
    return `donem=${donem}`
  }

  async function yasCinsiyetYukle() {
    if (yasCinsiyet.length > 0) return
    setYasCinsiyetYukleniyor(true)
    try {
      const res = await fetch(`/api/meta?hesap=${hesap}&tur=kirilim&kampanya_id=${id}&kirilim=age_gender&${donemQuery()}`)
      setYasCinsiyet((await res.json()).data || [])
    } catch { /* ignore */ }
    setYasCinsiyetYukleniyor(false)
  }

  async function bolgeYukle() {
    if (bolge.length > 0) return
    setBolgeYukleniyor(true)
    try {
      const res = await fetch(`/api/meta?hesap=${hesap}&tur=kirilim&kampanya_id=${id}&kirilim=region&${donemQuery()}`)
      const data = (await res.json()).data || []
      setBolge(data.sort((a: BolgeSatir, b: BolgeSatir) => parseFloat(b.spend || '0') - parseFloat(a.spend || '0')))
    } catch { /* ignore */ }
    setBolgeYukleniyor(false)
  }

  async function gunlukYukle() {
    if (gunlukTrend.length > 0) return
    setGunlukYukleniyor(true)
    try {
      const res = await fetch(`/api/meta?hesap=${hesap}&tur=kirilim&kampanya_id=${id}&kirilim=gunluk&${donemQuery()}`)
      setGunlukTrend((await res.json()).data || [])
    } catch { /* ignore */ }
    setGunlukYukleniyor(false)
  }

  async function kreatifYukle() {
    if (kreatifler.length > 0) return
    setKreatifYukleniyor(true)
    try {
      const res = await fetch(`/api/meta?hesap=${hesap}&tur=kreatifler&kampanya_id=${id}&${donemQuery()}`)
      const data = await res.json()
      const liste: KreatifSatir[] = data.data || []
      // Harcamaya göre sırala
      setKreatifler(liste.sort((a, b) =>
        parseFloat(b.insights?.data[0]?.spend || '0') - parseFloat(a.insights?.data[0]?.spend || '0')
      ))
    } catch { /* ignore */ }
    setKreatifYukleniyor(false)
  }

  async function urunYukle(sifirla = false) {
    setUrunYukleniyor(true)
    if (sifirla) { setUrunler([]); setUrunCursor(null) }
    const cursor = sifirla ? '' : (urunCursor || '')
    try {
      let url = `/api/meta?hesap=${hesap}&tur=urun-kirilim&kampanya_id=${id}&${donemQuery()}`
      if (cursor) url += `&cursor=${cursor}`
      const res = await fetch(url)
      const data = await res.json()
      const yeni: UrunSatir[] = data.data || []
      setUrunler(prev => sifirla ? yeni : [...prev, ...yeni])
      setUrunCursor(data.paging?.cursors?.after || null)
    } catch { /* ignore */ }
    setUrunYukleniyor(false)
  }

  function tabDegistir(tab: typeof aktifTab) {
    setAktifTab(tab)
    if (tab === 'kirilim') kirilimYukle()
    if (tab === 'yas_cinsiyet') yasCinsiyetYukle()
    if (tab === 'bolge') bolgeYukle()
    if (tab === 'gunluk') gunlukYukle()
    if (tab === 'kreatifler') kreatifYukle()
    if (tab === 'urunler') urunYukle(true)
  }

  function sutunTikla(alan: string) {
    setSiralama(prev => ({
      alan,
      yon: prev.alan === alan && prev.yon === 'desc' ? 'asc' : 'desc'
    }))
  }

  const getSiralamaValue = (s: Satir, alan: string): number => {
    const ins = s.insights?.data[0]
    switch (alan) {
      case 'harcama': return parseFloat(ins?.spend || '0')
      case 'gelir': return getGelir(ins)
      case 'roas': return getRoas(ins)
      case 'donusum': return getDonusum(ins)
      case 'gosterim': return parseInt(ins?.impressions || '0')
      case 'tiklama': return parseInt(ins?.clicks || '0')
      case 'ctr': return parseFloat(ins?.ctr || '0')
      case 'cpc': return parseFloat(ins?.cpc || '0')
      case 'frekans': return parseFloat(ins?.frequency || '0')
      case 'cpm': return parseFloat(ins?.cpm || '0')
      default: return 0
    }
  }

  const siraliSetler = [...reklamSetleri].sort((a, b) => {
    const fark = getSiralamaValue(a, siralama.alan) - getSiralamaValue(b, siralama.alan)
    return siralama.yon === 'desc' ? -fark : fark
  })

  const th = reklamSetleri.reduce((a, s) => a + parseFloat(s.insights?.data[0]?.spend || '0'), 0)
  const tg = reklamSetleri.reduce((a, s) => a + getGelir(s.insights?.data[0]), 0)
  const td = reklamSetleri.reduce((a, s) => a + getDonusum(s.insights?.data[0]), 0)
  const tt = reklamSetleri.reduce((a, s) => a + parseInt(s.insights?.data[0]?.clicks || '0'), 0)
  const tgos = reklamSetleri.reduce((a, s) => a + parseInt(s.insights?.data[0]?.impressions || '0'), 0)
  const roas = th > 0 ? tg / th : 0
  const donemAdi = PRESETLER.find(p => p.id === donem)?.ad || `Son ${donem} Gün`

  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.text, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      {/* HEADER */}
      <header style={{
        background: C.card, borderBottom: `1px solid ${C.border}`,
        padding: '0 24px', display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', height: '54px', position: 'sticky', top: 0, zIndex: 100,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link href="/meta" style={{ color: C.muted, textDecoration: 'none', fontSize: '0.83rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
            ← Meta Ads
          </Link>
          <span style={{ color: C.border }}>|</span>
          <span style={{ fontSize: '0.83rem', color: C.muted }}>{hesapAdi}</span>
          <span style={{ color: C.border }}>›</span>
          <span style={{ fontWeight: 600, fontSize: '0.9rem', maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: C.text }}>
            {kampanyaAdi}
          </span>
          <Badge status={kampanyaStatus} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          {donem !== 'ozel' ? (
            <>
              {PRESETLER.map(p => (
                <button key={p.id} onClick={() => setDonem(p.id)} style={{
                  padding: '4px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '0.75rem',
                  background: donem === p.id ? C.tableHead : 'transparent',
                  color: donem === p.id ? C.text : C.muted,
                  fontWeight: donem === p.id ? 600 : 400,
                }}>{p.ad}</button>
              ))}
              <button onClick={() => setDonem('ozel')} style={{
                padding: '4px 10px', borderRadius: '6px', border: `1px solid ${C.border}`,
                cursor: 'pointer', fontSize: '0.75rem', background: 'transparent', color: C.muted,
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
          {!yukleniyor && reklamSetleri.length > 0 && (
            <>
              <button onClick={() => { setHizliNotAcik(true); setHizliNotKaydedildi(false) }} style={{
                background: 'transparent', color: C.muted, border: `1px solid ${C.border}`,
                borderRadius: '7px', padding: '5px 12px', cursor: 'pointer',
                fontSize: '0.78rem', fontWeight: 500, marginLeft: '8px',
                display: 'flex', alignItems: 'center', gap: '5px'
              }}>
                📝 Not Ekle
              </button>
              <button onClick={aiAnalizYap} disabled={aiYukleniyor} style={{
                background: aiYukleniyor ? C.borderLight : '#7C3AED',
                color: aiYukleniyor ? C.faint : '#fff',
                border: 'none', borderRadius: '7px',
                padding: '5px 14px', cursor: aiYukleniyor ? 'not-allowed' : 'pointer',
                fontSize: '0.78rem', fontWeight: 600, marginLeft: '4px',
                display: 'flex', alignItems: 'center', gap: '5px'
              }}>
                {aiYukleniyor ? '⏳ Analiz yapılıyor...' : '🤖 Bu Kampanyayı Analiz Et'}
              </button>
            </>
          )}
        </div>
      </header>

      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '20px 24px' }}>

        {!yukleniyor && (
          <>
            {/* KPI KARTLAR */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '10px', marginBottom: '20px' }}>
              {[
                { b: 'Toplam Harcama', d: th > 0 ? para(th) : '—', r: METRIK_RENK.harcama, a: donemAdi, simdiki: th, onceki: oncekiToplamlar?.harcama, ters: false },
                { b: 'Toplam Gelir', d: tg > 0 ? para(tg) : '—', r: METRIK_RENK.gelir, a: 'Dönüşüm geliri', simdiki: tg, onceki: oncekiToplamlar?.gelir, ters: false },
                { b: 'ROAS', d: roas > 0 ? `${roas.toFixed(2)}x` : '—', r: roasRenk(roas), a: 'Harcama getirisi', simdiki: roas, onceki: oncekiToplamlar?.roas, ters: false },
                { b: 'Dönüşüm', d: td > 0 ? sayi(td) : '—', r: METRIK_RENK.donusum, a: 'Toplam satış', simdiki: td, onceki: oncekiToplamlar?.donusum, ters: false },
                { b: 'Tıklama', d: tt > 0 ? sayi(tt) : '—', r: METRIK_RENK.tiklama, a: 'Toplam tıklama', simdiki: tt, onceki: oncekiToplamlar?.tiklama, ters: false },
                {
                  b: 'Gösterim',
                  d: tgos >= 1000000 ? `${(tgos / 1000000).toFixed(1)}M` : tgos >= 1000 ? `${(tgos / 1000).toFixed(0)}B` : tgos > 0 ? sayi(tgos) : '—',
                  r: METRIK_RENK.gosterim, a: 'Toplam gösterim', simdiki: tgos, onceki: oncekiToplamlar?.gosterim, ters: false
                },
                { b: 'Sepete Ekleme', d: (() => { const s = reklamSetleri.reduce((a, x) => a + getSepet(x.insights?.data[0]), 0); return s > 0 ? sayi(s) : '—' })(), r: '#8B5CF6', a: (() => { const s = reklamSetleri.reduce((a, x) => a + getSepet(x.insights?.data[0]), 0); return s > 0 && th > 0 ? `Sepet mal: ${para(th / s)}` : 'Add to cart' })(), simdiki: reklamSetleri.reduce((a, x) => a + getSepet(x.insights?.data[0]), 0), onceki: undefined, ters: false },
                { b: 'Reklam Seti', d: String(reklamSetleri.length), r: C.muted, a: 'Toplam reklam seti', simdiki: 0, onceki: undefined, ters: false },
              ].map((k, i) => (
                <div key={i} style={{
                  background: C.card, border: `1px solid ${C.border}`,
                  borderRadius: '10px', padding: '14px',
                  borderTop: `3px solid ${k.r}`,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                }}>
                  <div style={{ fontSize: '0.68rem', color: C.muted, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{k.b}</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: k.r, marginBottom: '4px' }}>{k.d}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.68rem', color: C.faint }}>{k.a}</span>
                    {k.onceki !== undefined && k.simdiki > 0 && (
                      <DeltaBadge simdiki={k.simdiki} onceki={k.onceki} tersSiralama={k.ters} />
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* AI ANALİZ RAPORU */}
            {aiAcik && (
              aiYukleniyor ? (
                <div style={{
                  background: C.card, border: '1px solid #DDD6FE',
                  borderRadius: '12px', marginBottom: '20px', padding: '40px',
                  textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
                }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🤖</div>
                  <p style={{ fontSize: '0.95rem', color: C.text, fontWeight: 500 }}>Reklam setleri analiz ediliyor...</p>
                  <p style={{ fontSize: '0.78rem', marginTop: '8px', color: C.faint }}>10-20 saniye sürebilir</p>
                  <div style={{ marginTop: '20px', width: '200px', margin: '20px auto 0', height: '4px', background: C.borderLight, borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: '#7C3AED', borderRadius: '2px', width: '60%', animation: 'progress 2s ease-in-out infinite' }} />
                  </div>
                </div>
              ) : aiAnaliz ? (
                <div style={{ marginBottom: '20px' }}>
                  <AiRapor
                    analiz={aiAnaliz}
                    hesapAdi={`${hesapAdi} / ${kampanyaAdi}`}
                    donemAdi={donemAdi}
                    onKapat={() => setAiAcik(false)}
                  />
                </div>
              ) : null
            )}

            {/* SEKMELER + İÇERİK */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              {/* Tab Başlıkları */}
              <div style={{ borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', background: C.bg }}>
                <div style={{ display: 'flex' }}>
                  {([
                    { id: 'setler' as const, ad: `📦 Reklam Setleri (${reklamSetleri.length})` },
                    { id: 'kirilim' as const, ad: '📊 Platform & Cihaz' },
                    { id: 'yas_cinsiyet' as const, ad: '👥 Yaş & Cinsiyet' },
                    { id: 'bolge' as const, ad: '🗺️ Bölge' },
                    { id: 'gunluk' as const, ad: '📅 Trend' },
                    { id: 'kreatifler' as const, ad: '🎨 Kreatifler' },
                    { id: 'urunler' as const, ad: '🛍️ Ürünler' },
                  ]).map(t => (
                    <button key={t.id} onClick={() => tabDegistir(t.id)} style={{
                      padding: '14px 16px', background: 'transparent', border: 'none',
                      borderBottom: `2px solid ${aktifTab === t.id ? C.primary : 'transparent'}`,
                      color: aktifTab === t.id ? C.primary : C.muted,
                      cursor: 'pointer', fontSize: '0.85rem', fontWeight: aktifTab === t.id ? 600 : 400,
                      marginBottom: '-1px', transition: 'all 0.15s'
                    }}>
                      {t.ad}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {aktifTab === 'setler' && <span style={{ fontSize: '0.73rem', color: C.muted }}>▶ satıra tıkla → reklamları gör</span>}
                  {aktifTab === 'setler' && reklamSetleri.length > 0 && (
                    <button onClick={() => excelExport(reklamSetleri, `${kampanyaAdi}_Reklam_Setleri`, 'set')} style={{
                      background: '#F0FDF4', border: '1px solid #A7F3D0', color: '#059669',
                      borderRadius: '6px', padding: '5px 12px', cursor: 'pointer',
                      fontSize: '0.75rem', fontWeight: 600
                    }}>
                      📥 Excel İndir
                    </button>
                  )}
                </div>
              </div>
              {/* KIRILIM TAB İÇERİĞİ */}
              {aktifTab === 'kirilim' && (
                <div style={{ padding: '20px 24px' }}>
                  {kirilimYukleniyor ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: C.muted }}>⏳ Kırılım verileri yükleniyor...</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                      {/* Platform Kırılımı */}
                      <div>
                        <div style={{ fontSize: '0.72rem', color: C.muted, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em', marginBottom: '10px' }}>📱 Platform Kırılımı (Facebook / Instagram / vb.)</div>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ background: C.tableHead }}>
                              {['Platform', 'Harcama', 'Gösterim', 'Tıklama', 'Dönüşüm', 'Gelir', 'ROAS'].map(h => (
                                <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: '0.68rem', color: C.muted, textTransform: 'uppercase', fontWeight: 600, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {kirilimPlatform.length === 0 ? (
                              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: C.faint, fontSize: '0.82rem' }}>Veri bulunamadı</td></tr>
                            ) : kirilimPlatform.map((row, i) => {
                              const h = parseFloat(row.spend || '0')
                              const g = getGelir({ spend: '0', impressions: '0', clicks: '0', ctr: '0', cpc: '0', action_values: row.action_values })
                              const d = getDonusum({ spend: '0', impressions: '0', clicks: '0', ctr: '0', cpc: '0', actions: row.actions })
                              const r = h > 0 ? g / h : 0
                              const PLATFORM_ADI: Record<string, string> = { facebook: '🔵 Facebook', instagram: '📸 Instagram', messenger: '💬 Messenger', audience_network: '📡 Audience Network' }
                              return (
                                <tr key={i} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                                  <td style={{ padding: '10px 12px', fontSize: '0.83rem', fontWeight: 600, color: C.text }}>{PLATFORM_ADI[row.publisher_platform || ''] || row.publisher_platform || '—'}</td>
                                  <td style={{ padding: '10px 12px', fontSize: '0.83rem', color: METRIK_RENK.harcama, fontWeight: 600 }}>{h > 0 ? para(h) : '—'}</td>
                                  <td style={{ padding: '10px 12px', fontSize: '0.83rem', color: C.muted }}>{row.impressions ? sayi(row.impressions) : '—'}</td>
                                  <td style={{ padding: '10px 12px', fontSize: '0.83rem', color: C.muted }}>{row.clicks ? sayi(row.clicks) : '—'}</td>
                                  <td style={{ padding: '10px 12px', fontSize: '0.83rem', color: d > 0 ? METRIK_RENK.donusum : C.faint }}>{d > 0 ? sayi(d) : '—'}</td>
                                  <td style={{ padding: '10px 12px', fontSize: '0.83rem', color: g > 0 ? METRIK_RENK.gelir : C.faint, fontWeight: 600 }}>{g > 0 ? para(g) : '—'}</td>
                                  <td style={{ padding: '10px 12px', fontSize: '0.9rem', color: roasRenk(r), fontWeight: 700 }}>{r > 0 ? `${r.toFixed(2)}x` : '—'}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Cihaz Kırılımı */}
                      <div>
                        <div style={{ fontSize: '0.72rem', color: C.muted, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em', marginBottom: '10px' }}>💻 Cihaz Kırılımı (Mobil / Masaüstü)</div>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ background: C.tableHead }}>
                              {['Cihaz', 'Harcama', 'Gösterim', 'Tıklama', 'Dönüşüm', 'Gelir', 'ROAS'].map(h => (
                                <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: '0.68rem', color: C.muted, textTransform: 'uppercase', fontWeight: 600, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {kirilimCihaz.length === 0 ? (
                              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: C.faint, fontSize: '0.82rem' }}>Veri bulunamadı</td></tr>
                            ) : kirilimCihaz.map((row, i) => {
                              const h = parseFloat(row.spend || '0')
                              const g = getGelir({ spend: '0', impressions: '0', clicks: '0', ctr: '0', cpc: '0', action_values: row.action_values })
                              const d = getDonusum({ spend: '0', impressions: '0', clicks: '0', ctr: '0', cpc: '0', actions: row.actions })
                              const r = h > 0 ? g / h : 0
                              const CIHAZ_ADI: Record<string, string> = { mobile: '📱 Mobil', desktop: '🖥️ Masaüstü', connected_tv: '📺 TV', unknown: '❓ Bilinmeyen' }
                              return (
                                <tr key={i} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                                  <td style={{ padding: '10px 12px', fontSize: '0.83rem', fontWeight: 600, color: C.text }}>{CIHAZ_ADI[row.device_platform || ''] || row.device_platform || '—'}</td>
                                  <td style={{ padding: '10px 12px', fontSize: '0.83rem', color: METRIK_RENK.harcama, fontWeight: 600 }}>{h > 0 ? para(h) : '—'}</td>
                                  <td style={{ padding: '10px 12px', fontSize: '0.83rem', color: C.muted }}>{row.impressions ? sayi(row.impressions) : '—'}</td>
                                  <td style={{ padding: '10px 12px', fontSize: '0.83rem', color: C.muted }}>{row.clicks ? sayi(row.clicks) : '—'}</td>
                                  <td style={{ padding: '10px 12px', fontSize: '0.83rem', color: d > 0 ? METRIK_RENK.donusum : C.faint }}>{d > 0 ? sayi(d) : '—'}</td>
                                  <td style={{ padding: '10px 12px', fontSize: '0.83rem', color: g > 0 ? METRIK_RENK.gelir : C.faint, fontWeight: 600 }}>{g > 0 ? para(g) : '—'}</td>
                                  <td style={{ padding: '10px 12px', fontSize: '0.9rem', color: roasRenk(r), fontWeight: 700 }}>{r > 0 ? `${r.toFixed(2)}x` : '—'}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* YAŞ & CİNSİYET TAB */}
              {aktifTab === 'yas_cinsiyet' && (
                <div style={{ padding: '20px 24px' }}>
                  {yasCinsiyetYukleniyor ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: C.muted }}>⏳ Yükleniyor...</div>
                  ) : yasCinsiyet.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: C.faint, fontSize: '0.85rem' }}>Veri bulunamadı</div>
                  ) : (() => {
                    // Yaş gruplarını ve cinsiyetleri çıkar
                    const yaslar = [...new Set(yasCinsiyet.map(r => r.age))].sort()
                    const cinsiyetler = [...new Set(yasCinsiyet.map(r => r.gender))]
                    const CINSIYET_ADI: Record<string, string> = { male: '👨 Erkek', female: '👩 Kadın', unknown: '❓ Bilinmeyen' }
                    // Toplam harcama (yüzde için)
                    const toplamH = yasCinsiyet.reduce((s, r) => s + parseFloat(r.spend || '0'), 0)

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        {/* Özet kartlar */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                          {cinsiyetler.map(c => {
                            const rows = yasCinsiyet.filter(r => r.gender === c)
                            const h = rows.reduce((s, r) => s + parseFloat(r.spend || '0'), 0)
                            const g = rows.reduce((s, r) => s + getGelir({ spend: '0', impressions: '0', clicks: '0', ctr: '0', cpc: '0', action_values: r.action_values }), 0)
                            const roas = h > 0 ? g / h : 0
                            return (
                              <div key={c} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '14px 16px' }}>
                                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: C.text, marginBottom: '8px' }}>{CINSIYET_ADI[c] || c}</div>
                                <div style={{ display: 'flex', gap: '14px' }}>
                                  <div><div style={{ fontSize: '0.62rem', color: C.faint }}>Harcama</div><div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#C2410C' }}>{h > 0 ? para(h) : '—'}</div></div>
                                  <div><div style={{ fontSize: '0.62rem', color: C.faint }}>ROAS</div><div style={{ fontSize: '0.9rem', fontWeight: 700, color: roasRenk(roas) }}>{roas > 0 ? `${roas.toFixed(2)}x` : '—'}</div></div>
                                  <div><div style={{ fontSize: '0.62rem', color: C.faint }}>Pay</div><div style={{ fontSize: '0.9rem', fontWeight: 700, color: C.muted }}>{toplamH > 0 ? `%${(h / toplamH * 100).toFixed(0)}` : '—'}</div></div>
                                </div>
                                {/* Bütçe pay çubuğu */}
                                <div style={{ marginTop: '8px', background: C.borderLight, borderRadius: '4px', height: '4px' }}>
                                  <div style={{ background: c === 'female' ? '#EC4899' : c === 'male' ? '#3B82F6' : C.muted, borderRadius: '4px', height: '4px', width: `${toplamH > 0 ? (h / toplamH * 100) : 0}%`, transition: 'width 0.6s' }} />
                                </div>
                              </div>
                            )
                          })}
                        </div>

                        {/* Detay tablo */}
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ background: C.tableHead }}>
                              {['Yaş', 'Cinsiyet', 'Harcama', 'Pay %', 'Gösterim', 'Tıklama', 'Dönüşüm', 'Gelir', 'ROAS'].map(h => (
                                <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: '0.68rem', color: C.muted, textTransform: 'uppercase', fontWeight: 600, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {[...yasCinsiyet]
                              .sort((a, b) => parseFloat(b.spend || '0') - parseFloat(a.spend || '0'))
                              .map((row, i) => {
                                const h = parseFloat(row.spend || '0')
                                const g = getGelir({ spend: '0', impressions: '0', clicks: '0', ctr: '0', cpc: '0', action_values: row.action_values })
                                const d = getDonusum({ spend: '0', impressions: '0', clicks: '0', ctr: '0', cpc: '0', actions: row.actions })
                                const r = h > 0 ? g / h : 0
                                const pay = toplamH > 0 ? (h / toplamH * 100) : 0
                                return (
                                  <tr key={i} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                                    <td style={{ padding: '10px 12px', fontSize: '0.83rem', fontWeight: 600, color: C.text }}>{row.age}</td>
                                    <td style={{ padding: '10px 12px', fontSize: '0.83rem', color: C.muted }}>{CINSIYET_ADI[row.gender] || row.gender}</td>
                                    <td style={{ padding: '10px 12px', fontSize: '0.83rem', color: METRIK_RENK.harcama, fontWeight: 600 }}>{h > 0 ? para(h) : '—'}</td>
                                    <td style={{ padding: '10px 12px', fontSize: '0.83rem', color: C.muted }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <div style={{ background: C.borderLight, borderRadius: '3px', height: '6px', width: '60px' }}>
                                          <div style={{ background: '#7C3AED', borderRadius: '3px', height: '6px', width: `${pay}%` }} />
                                        </div>
                                        <span>%{pay.toFixed(0)}</span>
                                      </div>
                                    </td>
                                    <td style={{ padding: '10px 12px', fontSize: '0.83rem', color: C.muted }}>{row.impressions ? sayi(row.impressions) : '—'}</td>
                                    <td style={{ padding: '10px 12px', fontSize: '0.83rem', color: C.muted }}>{row.clicks ? sayi(row.clicks) : '—'}</td>
                                    <td style={{ padding: '10px 12px', fontSize: '0.83rem', color: d > 0 ? METRIK_RENK.donusum : C.faint }}>{d > 0 ? sayi(d) : '—'}</td>
                                    <td style={{ padding: '10px 12px', fontSize: '0.83rem', color: g > 0 ? METRIK_RENK.gelir : C.faint, fontWeight: 600 }}>{g > 0 ? para(g) : '—'}</td>
                                    <td style={{ padding: '10px 12px', fontSize: '0.9rem', color: roasRenk(r), fontWeight: 700 }}>{r > 0 ? `${r.toFixed(2)}x` : '—'}</td>
                                  </tr>
                                )
                              })}
                          </tbody>
                        </table>
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* BÖLGE TAB */}
              {aktifTab === 'bolge' && (
                <div style={{ padding: '20px 24px' }}>
                  {bolgeYukleniyor ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: C.muted }}>⏳ Yükleniyor...</div>
                  ) : bolge.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: C.faint, fontSize: '0.85rem' }}>Veri bulunamadı</div>
                  ) : (() => {
                    const toplamH = bolge.reduce((s, r) => s + parseFloat(r.spend || '0'), 0)
                    const maxH = parseFloat(bolge[0]?.spend || '0')
                    return (
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: C.tableHead }}>
                            {['Bölge / Şehir', 'Harcama', 'Pay %', 'Gösterim', 'Tıklama', 'Dönüşüm', 'Gelir', 'ROAS'].map(h => (
                              <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: '0.68rem', color: C.muted, textTransform: 'uppercase', fontWeight: 600, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {bolge.map((row, i) => {
                            const h = parseFloat(row.spend || '0')
                            const g = getGelir({ spend: '0', impressions: '0', clicks: '0', ctr: '0', cpc: '0', action_values: row.action_values })
                            const d = getDonusum({ spend: '0', impressions: '0', clicks: '0', ctr: '0', cpc: '0', actions: row.actions })
                            const r = h > 0 ? g / h : 0
                            const pay = toplamH > 0 ? (h / toplamH * 100) : 0
                            const barWidth = maxH > 0 ? (h / maxH * 100) : 0
                            return (
                              <tr key={i} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                                <td style={{ padding: '10px 12px', fontSize: '0.83rem', fontWeight: i < 3 ? 700 : 500, color: C.text }}>
                                  {i < 3 ? ['🥇', '🥈', '🥉'][i] + ' ' : ''}{row.region || '—'}
                                </td>
                                <td style={{ padding: '10px 12px', fontSize: '0.83rem', color: METRIK_RENK.harcama, fontWeight: 600 }}>
                                  <div>{h > 0 ? para(h) : '—'}</div>
                                  <div style={{ background: C.borderLight, borderRadius: '3px', height: '4px', width: '80px', marginTop: '4px' }}>
                                    <div style={{ background: '#C2410C', borderRadius: '3px', height: '4px', width: `${barWidth}%` }} />
                                  </div>
                                </td>
                                <td style={{ padding: '10px 12px', fontSize: '0.83rem', color: C.muted }}>%{pay.toFixed(1)}</td>
                                <td style={{ padding: '10px 12px', fontSize: '0.83rem', color: C.muted }}>{row.impressions ? sayi(row.impressions) : '—'}</td>
                                <td style={{ padding: '10px 12px', fontSize: '0.83rem', color: C.muted }}>{row.clicks ? sayi(row.clicks) : '—'}</td>
                                <td style={{ padding: '10px 12px', fontSize: '0.83rem', color: d > 0 ? METRIK_RENK.donusum : C.faint }}>{d > 0 ? sayi(d) : '—'}</td>
                                <td style={{ padding: '10px 12px', fontSize: '0.83rem', color: g > 0 ? METRIK_RENK.gelir : C.faint, fontWeight: 600 }}>{g > 0 ? para(g) : '—'}</td>
                                <td style={{ padding: '10px 12px', fontSize: '0.9rem', color: roasRenk(r), fontWeight: 700 }}>{r > 0 ? `${r.toFixed(2)}x` : '—'}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    )
                  })()}
                </div>
              )}

              {/* TREND TAB */}
              {aktifTab === 'gunluk' && (
                <div style={{ padding: '20px 24px' }}>
                  {/* Günlük / Haftalık toggle */}
                  {gunlukTrend.length > 0 && (
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
                      {(['gunluk', 'haftalik'] as const).map(g => (
                        <button key={g} onClick={() => setGunlukGorunum(g)} style={{
                          padding: '5px 14px', borderRadius: '7px', border: `1.5px solid ${gunlukGorunum === g ? C.primary : C.border}`,
                          background: gunlukGorunum === g ? C.primary + '15' : 'transparent',
                          color: gunlukGorunum === g ? C.primary : C.muted,
                          cursor: 'pointer', fontSize: '0.8rem', fontWeight: gunlukGorunum === g ? 600 : 400
                        }}>{g === 'gunluk' ? '📅 Günlük' : '📆 Haftalık'}</button>
                      ))}
                    </div>
                  )}
                  {gunlukYukleniyor ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: C.muted }}>⏳ Yükleniyor...</div>
                  ) : gunlukTrend.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: C.faint, fontSize: '0.85rem' }}>Veri bulunamadı</div>
                  ) : (() => {
                    // Haftalık görünüm için veriyi grupla
                    const gosterilecek = gunlukGorunum === 'haftalik'
                      ? (() => {
                          const haftalar: GunlukSatir[] = []
                          for (let i = 0; i < gunlukTrend.length; i += 7) {
                            const dilim = gunlukTrend.slice(i, i + 7)
                            const topH = dilim.reduce((s, r) => s + parseFloat(r.spend || '0'), 0)
                            const topG = dilim.reduce((s, r) => s + getGelir({ spend: '0', impressions: '0', clicks: '0', ctr: '0', cpc: '0', action_values: r.action_values }), 0)
                            const topKlik = dilim.reduce((s, r) => s + parseInt(r.clicks || '0'), 0)
                            const topGos = dilim.reduce((s, r) => s + parseInt(r.impressions || '0'), 0)
                            haftalar.push({
                              date_start: `${dilim[0]?.date_start} – ${dilim[dilim.length - 1]?.date_start}`,
                              spend: String(topH),
                              impressions: String(topGos),
                              clicks: String(topKlik),
                              ctr: topGos > 0 ? String(topKlik / topGos * 100) : '0',
                              cpc: topKlik > 0 ? String(topH / topKlik) : '0',
                              action_values: [{ action_type: 'purchase', value: String(topG) }],
                              actions: dilim.flatMap(r => r.actions || []).reduce((acc, a) => {
                                const ex = acc.find(x => x.action_type === a.action_type)
                                if (ex) ex.value = String(parseInt(ex.value) + parseInt(a.value))
                                else acc.push({ ...a })
                                return acc
                              }, [] as { action_type: string; value: string }[])
                            })
                          }
                          return haftalar
                        })()
                      : gunlukTrend

                    const maxH = Math.max(...gosterilecek.map(r => parseFloat(r.spend || '0')))
                    const maxRoas = Math.max(...gosterilecek.map(r => {
                      const h = parseFloat(r.spend || '0')
                      const g = getGelir({ spend: '0', impressions: '0', clicks: '0', ctr: '0', cpc: '0', action_values: r.action_values })
                      return h > 0 ? g / h : 0
                    }))
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {/* Mini bar chart — harcama */}
                        <div>
                          <div style={{ fontSize: '0.72rem', color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>
                            📊 {gunlukGorunum === 'haftalik' ? 'Haftalık' : 'Günlük'} Harcama Trendi
                          </div>
                          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '90px', overflowX: 'auto' }}>
                            {gosterilecek.map((row, i) => {
                              const h = parseFloat(row.spend || '0')
                              const barPx = maxH > 0 ? Math.max((h / maxH) * 62, h > 0 ? 2 : 0) : 0
                              const adim = Math.max(1, Math.ceil(gosterilecek.length / 7))
                              const goster = i % adim === 0 || i === gosterilecek.length - 1
                              const tarih = gunlukGorunum === 'haftalik'
                                ? (() => {
                                    const parts = row.date_start?.split(' – ')
                                    if (!parts?.[0]) return `H${i + 1}`
                                    const d = new Date(parts[0])
                                    return `${d.getDate()} ${d.toLocaleDateString('tr-TR', { month: 'short' })}`
                                  })()
                                : row.date_start ? new Date(row.date_start).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }) : ''
                              return (
                                <div key={i} title={`${row.date_start || `H${i+1}`}: ${para(h)}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', minWidth: '24px', flex: 1 }}>
                                  <div style={{ background: '#C2410C', borderRadius: '3px 3px 0 0', width: '100%', height: `${barPx}px`, transition: 'height 0.4s', cursor: 'help' }} />
                                  {goster && (
                                    <div style={{ fontSize: '0.52rem', color: C.faint, textAlign: 'center', writingMode: 'vertical-rl', transform: 'rotate(180deg)', maxHeight: '28px', overflow: 'hidden', whiteSpace: 'nowrap' }}>{tarih}</div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>

                        {/* ROAS Trend Sparkline */}
                        {maxRoas > 0 && (() => {
                          const roasPts = gosterilecek.map((r, i) => {
                            const h = parseFloat(r.spend || '0')
                            const g = getGelir({ spend: '0', impressions: '0', clicks: '0', ctr: '0', cpc: '0', action_values: r.action_values })
                            const rv = h > 0 ? g / h : 0
                            const x = gosterilecek.length > 1 ? (i / (gosterilecek.length - 1)) * 100 : 50
                            const y = maxRoas > 0 ? (1 - rv / maxRoas) * 56 + 6 : 62
                            return { x, y, rv, label: r.date_start || `H${i + 1}` }
                          })
                          const linePath = roasPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
                          const areaPath = `${linePath} L 100 68 L 0 68 Z`
                          const avgRoas = gosterilecek.reduce((s, r) => {
                            const h = parseFloat(r.spend || '0')
                            const g = getGelir({ spend: '0', impressions: '0', clicks: '0', ctr: '0', cpc: '0', action_values: r.action_values })
                            return s + (h > 0 ? g / h : 0)
                          }, 0) / (gosterilecek.filter(r => parseFloat(r.spend || '0') > 0).length || 1)
                          const avgY = maxRoas > 0 ? (1 - avgRoas / maxRoas) * 56 + 6 : 62
                          return (
                            <div>
                              <div style={{ fontSize: '0.72rem', color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                📈 {gunlukGorunum === 'haftalik' ? 'Haftalık' : 'Günlük'} ROAS Trendi
                                <span style={{ fontSize: '0.68rem', fontWeight: 400, color: C.faint }}>Ort: <b style={{ color: roasRenk(avgRoas) }}>{avgRoas.toFixed(2)}x</b> · Max: <b style={{ color: '#059669' }}>{maxRoas.toFixed(2)}x</b></span>
                              </div>
                              <div style={{ position: 'relative' }}>
                                <svg viewBox="0 0 100 72" preserveAspectRatio="none" style={{ width: '100%', height: '72px', display: 'block' }}>
                                  <defs>
                                    <linearGradient id="roasAreaGrad" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="0%" stopColor="#059669" stopOpacity="0.25" />
                                      <stop offset="100%" stopColor="#059669" stopOpacity="0.02" />
                                    </linearGradient>
                                  </defs>
                                  {/* Ortalama çizgisi */}
                                  <line x1="0" y1={avgY} x2="100" y2={avgY} stroke="#D97706" strokeWidth="0.5" strokeDasharray="2,2" />
                                  {/* Alan dolgusu */}
                                  <path d={areaPath} fill="url(#roasAreaGrad)" />
                                  {/* Çizgi */}
                                  <path d={linePath} fill="none" stroke="#059669" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
                                  {/* Noktalar */}
                                  {roasPts.map((p, i) => (
                                    <circle key={i} cx={p.x} cy={p.y} r={gosterilecek.length <= 14 ? '2' : '1.2'} fill={roasRenk(p.rv)} stroke="#fff" strokeWidth="0.8">
                                      <title>{p.label}: {p.rv.toFixed(2)}x</title>
                                    </circle>
                                  ))}
                                </svg>
                                {/* Y ekseni etiketleri */}
                                <div style={{ position: 'absolute', top: 0, right: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '72px', pointerEvents: 'none' }}>
                                  <span style={{ fontSize: '0.58rem', color: C.faint }}>{maxRoas.toFixed(1)}x</span>
                                  <span style={{ fontSize: '0.58rem', color: C.faint }}>0x</span>
                                </div>
                              </div>
                            </div>
                          )
                        })()}

                        {/* Tablo */}
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ background: C.tableHead }}>
                              {['Tarih', 'Harcama', 'Gösterim', 'Tıklama', 'CTR', 'CPC', 'Dönüşüm', 'Gelir', 'ROAS'].map(h => (
                                <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: '0.68rem', color: C.muted, textTransform: 'uppercase', fontWeight: 600, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {[...gosterilecek].reverse().map((row, i) => {
                              const h = parseFloat(row.spend || '0')
                              const g = getGelir({ spend: '0', impressions: '0', clicks: '0', ctr: '0', cpc: '0', action_values: row.action_values })
                              const d = getDonusum({ spend: '0', impressions: '0', clicks: '0', ctr: '0', cpc: '0', actions: row.actions })
                              const r = h > 0 ? g / h : 0
                              const roasBar = maxRoas > 0 ? (r / maxRoas * 100) : 0
                              const tarih = row.date_start ? new Date(row.date_start).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' }) : '—'
                              return (
                                <tr key={i} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                                  <td style={{ padding: '9px 12px', fontSize: '0.83rem', fontWeight: 500, color: C.text, whiteSpace: 'nowrap' }}>{tarih}</td>
                                  <td style={{ padding: '9px 12px', fontSize: '0.83rem', color: METRIK_RENK.harcama, fontWeight: 600 }}>{h > 0 ? para(h) : '—'}</td>
                                  <td style={{ padding: '9px 12px', fontSize: '0.83rem', color: C.muted }}>{row.impressions ? sayi(row.impressions) : '—'}</td>
                                  <td style={{ padding: '9px 12px', fontSize: '0.83rem', color: C.muted }}>{row.clicks ? sayi(row.clicks) : '—'}</td>
                                  <td style={{ padding: '9px 12px', fontSize: '0.83rem', color: C.muted }}>{row.ctr ? `%${parseFloat(row.ctr).toFixed(2)}` : '—'}</td>
                                  <td style={{ padding: '9px 12px', fontSize: '0.83rem', color: C.muted }}>{row.cpc ? para(parseFloat(row.cpc)) : '—'}</td>
                                  <td style={{ padding: '9px 12px', fontSize: '0.83rem', color: d > 0 ? METRIK_RENK.donusum : C.faint }}>{d > 0 ? sayi(d) : '—'}</td>
                                  <td style={{ padding: '9px 12px', fontSize: '0.83rem', color: g > 0 ? METRIK_RENK.gelir : C.faint, fontWeight: 600 }}>{g > 0 ? para(g) : '—'}</td>
                                  <td style={{ padding: '9px 12px', fontSize: '0.9rem', color: roasRenk(r), fontWeight: 700 }}>
                                    {r > 0 ? (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span>{r.toFixed(2)}x</span>
                                        <div style={{ background: C.borderLight, borderRadius: '3px', height: '5px', width: '40px' }}>
                                          <div style={{ background: roasRenk(r), borderRadius: '3px', height: '5px', width: `${roasBar}%` }} />
                                        </div>
                                      </div>
                                    ) : '—'}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* 🛍️ ÜRÜNLER TAB */}
              {aktifTab === 'urunler' && (
                <div>
                  {urunYukleniyor && urunler.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px', color: C.muted }}>⏳ Ürün verileri yükleniyor...</div>
                  ) : urunler.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px', color: C.faint, fontSize: '0.85rem' }}>
                      Ürün verisi bulunamadı. Meta Katalog bağlantısını kontrol et.
                    </div>
                  ) : (() => {
                    const urunDeger = (u: UrunSatir, alan: string) => {
                      const h = parseFloat(u.spend || '0')
                      const satis = parseInt(u.actions?.find(a => ['purchase', 'offsite_conversion.fb_pixel_purchase', 'omni_purchase'].includes(a.action_type))?.value || '0')
                      const gelir = parseFloat(u.action_values?.find(a => ['purchase', 'offsite_conversion.fb_pixel_purchase', 'omni_purchase'].includes(a.action_type))?.value || '0')
                      switch (alan) {
                        case 'harcama': return h
                        case 'satis': return satis
                        case 'gelir': return gelir
                        case 'roas': return h > 0 ? gelir / h : 0
                        case 'sepet': return parseInt(u.actions?.find(a => ['add_to_cart', 'offsite_conversion.fb_pixel_add_to_cart', 'omni_add_to_cart'].includes(a.action_type))?.value || '0')
                        case 'goruntulenme': return parseInt(u.actions?.find(a => ['view_content', 'offsite_conversion.fb_pixel_view_content', 'omni_view_content'].includes(a.action_type))?.value || '0')
                        case 'checkout': return parseInt(u.actions?.find(a => ['initiate_checkout', 'offsite_conversion.fb_pixel_initiate_checkout', 'omni_initiated_checkout'].includes(a.action_type))?.value || '0')
                        default: return 0
                      }
                    }
                    const siraliUrunler = [...urunler].sort((a, b) => {
                      const fark = urunDeger(a, urunSiralama.alan) - urunDeger(b, urunSiralama.alan)
                      return urunSiralama.yon === 'desc' ? -fark : fark
                    })
                    const thS = (alan: string) => ({
                      textAlign: 'left' as const, fontSize: '0.67rem', textTransform: 'uppercase' as const,
                      padding: '9px 14px', borderBottom: `1px solid ${C.border}`, fontWeight: 600,
                      letterSpacing: '0.04em', whiteSpace: 'nowrap' as const, cursor: 'pointer', userSelect: 'none' as const,
                      color: urunSiralama.alan === alan ? C.primary : C.muted,
                      background: urunSiralama.alan === alan ? '#EFF6FF' : 'transparent',
                    })
                    const tikla = (alan: string) => setUrunSiralama(p => ({ alan, yon: p.alan === alan && p.yon === 'desc' ? 'asc' : 'desc' }))
                    const ok = (alan: string) => urunSiralama.alan === alan ? (urunSiralama.yon === 'desc' ? ' ↓' : ' ↑') : ' ↕'
                    return (
                    <>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: C.tableHead }}>
                            <th style={{ ...thS(''), cursor: 'default', width: '32px' }}>#</th>
                            <th style={{ ...thS(''), cursor: 'default' }}>ÜRÜN</th>
                            <th style={thS('harcama')} onClick={() => tikla('harcama')}>HARCAMA{ok('harcama')}</th>
                            <th style={thS('satis')} onClick={() => tikla('satis')}>SATIŞ{ok('satis')}</th>
                            <th style={thS('gelir')} onClick={() => tikla('gelir')}>GELİR{ok('gelir')}</th>
                            <th style={thS('roas')} onClick={() => tikla('roas')}>ROAS{ok('roas')}</th>
                            <th style={thS('sepet')} onClick={() => tikla('sepet')}>SEPETE EKL.{ok('sepet')}</th>
                            <th style={thS('goruntulenme')} onClick={() => tikla('goruntulenme')}>GÖRÜNTÜLENME{ok('goruntulenme')}</th>
                            <th style={thS('checkout')} onClick={() => tikla('checkout')}>CHECKOUT{ok('checkout')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {siraliUrunler.map((u, i) => {
                            const h = parseFloat(u.spend || '0')
                            const satis = parseInt(u.actions?.find(a => ['purchase', 'offsite_conversion.fb_pixel_purchase', 'omni_purchase'].includes(a.action_type))?.value || '0')
                            const gelir = parseFloat(u.action_values?.find(a => ['purchase', 'offsite_conversion.fb_pixel_purchase', 'omni_purchase'].includes(a.action_type))?.value || '0')
                            const sepet = parseInt(u.actions?.find(a => ['add_to_cart', 'offsite_conversion.fb_pixel_add_to_cart', 'omni_add_to_cart'].includes(a.action_type))?.value || '0')
                            const goruntulenme = parseInt(u.actions?.find(a => ['view_content', 'offsite_conversion.fb_pixel_view_content', 'omni_view_content'].includes(a.action_type))?.value || '0')
                            const checkout = parseInt(u.actions?.find(a => ['initiate_checkout', 'offsite_conversion.fb_pixel_initiate_checkout', 'omni_initiated_checkout'].includes(a.action_type))?.value || '0')
                            const urunRoas = h > 0 ? gelir / h : 0
                            return (
                              <tr key={u.product_id} style={{ borderBottom: `1px solid ${C.borderLight}` }}
                                onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = C.cardHover}
                                onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}>
                                <td style={{ padding: '10px 14px', fontSize: '0.75rem', color: C.faint }}>{i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</td>
                                <td style={{ padding: '10px 14px', maxWidth: '240px' }}>
                                  <div style={{ fontWeight: 600, fontSize: '0.83rem', color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.product_name || u.product_id}</div>
                                  {u.product_name && <div style={{ fontSize: '0.63rem', color: C.faint, marginTop: '1px' }}>ID: {u.product_id}</div>}
                                </td>
                                <td style={{ padding: '10px 14px', fontSize: '0.83rem', color: METRIK_RENK.harcama, fontWeight: 600, whiteSpace: 'nowrap' }}>{h > 0 ? para(h) : '—'}</td>
                                <td style={{ padding: '10px 14px', fontSize: '0.83rem', color: METRIK_RENK.donusum, fontWeight: 600 }}>{satis > 0 ? sayi(satis) : '—'}</td>
                                <td style={{ padding: '10px 14px', fontSize: '0.83rem', color: METRIK_RENK.gelir, fontWeight: 600, whiteSpace: 'nowrap' }}>{gelir > 0 ? para(gelir) : '—'}</td>
                                <td style={{ padding: '10px 14px', fontSize: '0.88rem', fontWeight: 700, color: roasRenk(urunRoas) }}>{urunRoas > 0 ? `${urunRoas.toFixed(2)}x` : '—'}</td>
                                <td style={{ padding: '10px 14px', fontSize: '0.83rem', color: '#8B5CF6' }}>{sepet > 0 ? sayi(sepet) : '—'}</td>
                                <td style={{ padding: '10px 14px', fontSize: '0.83rem', color: '#6366F1' }}>{goruntulenme > 0 ? sayi(goruntulenme) : '—'}</td>
                                <td style={{ padding: '10px 14px', fontSize: '0.83rem', color: '#F59E0B' }}>{checkout > 0 ? sayi(checkout) : '—'}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                      {urunCursor && (
                        <div style={{ textAlign: 'center', padding: '14px' }}>
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

              {/* REKLAM SETLERİ TAB İÇERİĞİ */}
              {aktifTab === 'setler' && <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1000px' }}>
                  <thead>
                    <tr style={{ background: C.tableHead }}>
                      <th style={{ textAlign: 'left', fontSize: '0.68rem', color: C.muted, textTransform: 'uppercase', padding: '9px 16px', borderBottom: `1px solid ${C.border}`, width: '280px' }}>Reklam Seti</th>
                      <th style={{ textAlign: 'left', fontSize: '0.68rem', color: C.muted, textTransform: 'uppercase', padding: '9px 12px', borderBottom: `1px solid ${C.border}` }}>Durum</th>
                      <th style={{ textAlign: 'left', fontSize: '0.68rem', color: C.muted, textTransform: 'uppercase', padding: '9px 12px', borderBottom: `1px solid ${C.border}` }}>Skor</th>
                      {ALANLAR.map(a => (
                        <th key={a} onClick={() => sutunTikla(a)} style={{
                          textAlign: 'left', fontSize: '0.68rem', textTransform: 'uppercase', padding: '9px 12px',
                          borderBottom: `1px solid ${C.border}`, cursor: 'pointer', userSelect: 'none',
                          color: siralama.alan === a ? C.text : C.muted,
                          background: siralama.alan === a ? C.cardHover : 'transparent',
                        }}>
                          {ALAN_BASLIK[a]} {siralama.alan === a ? (siralama.yon === 'desc' ? '↓' : '↑') : '↕'}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {siraliSetler.map(s => (
                      <>
                        <tr key={s.id} onClick={() => setTikla(s)}
                          style={{ cursor: 'pointer', background: acikSet === s.id ? C.cardHover : 'transparent' }}
                          onMouseEnter={e => { if (acikSet !== s.id) (e.currentTarget as HTMLTableRowElement).style.background = C.cardHover }}
                          onMouseLeave={e => { if (acikSet !== s.id) (e.currentTarget as HTMLTableRowElement).style.background = 'transparent' }}>
                          <td style={{ padding: '12px 16px', fontSize: '0.83rem', borderBottom: `1px solid ${C.borderLight}` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ color: C.muted, fontSize: '0.75rem', minWidth: '12px', flexShrink: 0 }}>
                                {acikSet === s.id ? '▼' : '▶'}
                              </span>
                              <span style={{ color: C.accent, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📦 {s.name}</span>
                            </div>
                          </td>
                          <td style={{ padding: '12px', borderBottom: `1px solid ${C.borderLight}` }}><Badge status={s.status} /></td>
                          <td style={{ padding: '12px', borderBottom: `1px solid ${C.borderLight}` }}><SkorBadge ins={s.insights?.data[0]} /></td>
                          {ALANLAR.map(a => <MetrikHucre key={a} ins={s.insights?.data[0]} alan={a} />)}
                        </tr>

                        {/* REKLAMLAR */}
                        {acikSet === s.id && (
                          rekYukLen === s.id ? (
                            <tr key={`${s.id}-l`}>
                              <td colSpan={14} style={{ padding: '10px 40px', color: C.muted, fontSize: '0.78rem', background: C.subRow, borderBottom: `1px solid ${C.borderLight}` }}>
                                ⏳ Reklamlar yükleniyor...
                              </td>
                            </tr>
                          ) : (reklamlar[s.id] || []).map(r => (
                            <tr key={r.id} style={{ background: C.subRow }}>
                              <td style={{ padding: '9px 16px 9px 40px', fontSize: '0.78rem', borderBottom: `1px solid ${C.borderLight}` }}>
                                <span style={{ color: '#7C3AED', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: '220px' }}>🎯 {r.name}</span>
                              </td>
                              <td style={{ padding: '9px 12px', borderBottom: `1px solid ${C.borderLight}` }}><Badge status={r.status} /></td>
                              <td style={{ padding: '9px 12px', borderBottom: `1px solid ${C.borderLight}` }}><SkorBadge ins={r.insights?.data[0]} /></td>
                              {ALANLAR.map(a => <MetrikHucre key={a} ins={r.insights?.data[0]} alan={a} />)}
                            </tr>
                          ))
                        )}
                      </>
                    ))}
                    {reklamSetleri.length === 0 && (
                      <tr>
                        <td colSpan={14} style={{ textAlign: 'center', padding: '40px', color: C.muted }}>
                          Bu kampanyada reklam seti bulunamadı
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>}

              {/* 🎨 KREATİFLER TAB */}
              {aktifTab === 'kreatifler' && (
                <div>
                  {kreatifYukleniyor ? (
                    <div style={{ textAlign: 'center', padding: '60px', color: C.muted }}>⏳ Kreatifler yükleniyor...</div>
                  ) : kreatifler.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px', color: C.muted }}>Bu kampanyada kreatif bulunamadı.</div>
                  ) : (() => {
                    const avgCtr = kreatifler.length > 0
                      ? kreatifler.reduce((s, k) => s + parseFloat(k.insights?.data[0]?.ctr || '0'), 0) / kreatifler.filter(k => k.insights?.data[0]).length
                      : 0
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {/* Özet banner */}
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                          {[
                            { label: 'Toplam Kreatif', value: String(kreatifler.length) },
                            { label: 'Ort. CTR', value: `%${avgCtr.toFixed(2)}` },
                            { label: 'Yorgun Kreatif', value: String(kreatifler.filter(k => {
                              const ins = k.insights?.data[0]
                              const freq = parseFloat(ins?.frequency || '0')
                              const ctr = parseFloat(ins?.ctr || '0')
                              return freq >= 4 && ctr < avgCtr * 0.7
                            }).length), alert: true },
                          ].map((m, i) => (
                            <div key={i} style={{ background: m.alert ? '#FEF2F2' : C.card, border: `1px solid ${m.alert ? '#FECACA' : C.border}`, borderRadius: '10px', padding: '10px 16px', flex: '1', minWidth: '120px' }}>
                              <div style={{ fontSize: '0.65rem', color: m.alert ? '#DC2626' : C.muted, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>{m.label}</div>
                              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: m.alert ? '#DC2626' : C.text, marginTop: '4px' }}>{m.value}</div>
                            </div>
                          ))}
                        </div>

                        {/* Kreatif kartları */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {kreatifler.map((k, i) => {
                            const ins = k.insights?.data[0]
                            const h = parseFloat(ins?.spend || '0')
                            const g = getGelir(ins)
                            const d = getDonusum(ins)
                            const r = h > 0 ? g / h : 0
                            const ctr = parseFloat(ins?.ctr || '0')
                            const freq = parseFloat(ins?.frequency || '0')
                            const isVideo = k.creative?.video_id || k.creative?.object_type === 'VIDEO'
                            const thumbUrl = k.creative?.thumbnail_url || k.creative?.image_url
                            const yorgun = freq >= 4 && ctr < avgCtr * 0.7
                            return (
                              <div key={k.id} style={{
                                display: 'flex', gap: '14px', alignItems: 'flex-start',
                                background: yorgun ? '#FEF2F2' : C.card,
                                border: `1px solid ${yorgun ? '#FECACA' : C.border}`,
                                borderRadius: '12px', padding: '14px', position: 'relative'
                              }}>
                                {/* Görsel */}
                                <div style={{ width: '80px', height: '80px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0, background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${C.border}`, position: 'relative' }}>
                                  {thumbUrl ? (
                                    <img src={thumbUrl} alt="kreatif" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  ) : (
                                    <span style={{ fontSize: '1.8rem' }}>{isVideo ? '🎬' : '📸'}</span>
                                  )}
                                  {isVideo && (
                                    <div style={{ position: 'absolute', bottom: '4px', right: '4px', background: 'rgba(0,0,0,0.65)', borderRadius: '4px', padding: '1px 5px', fontSize: '0.6rem', color: '#fff', fontWeight: 700 }}>▶ VİDEO</div>
                                  )}
                                </div>

                                {/* Sıra */}
                                <div style={{ position: 'absolute', top: '10px', left: '10px', background: i === 0 ? '#F59E0B' : C.border, borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700, color: i === 0 ? '#fff' : C.muted }}>
                                  {i + 1}
                                </div>

                                {/* Bilgiler */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                                    <span style={{ fontWeight: 600, fontSize: '0.85rem', color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '320px' }}>
                                      {isVideo ? '🎬' : '📸'} {k.name}
                                    </span>
                                    <Badge status={k.status} />
                                    {yorgun && (
                                      <span style={{ background: '#DC2626', color: '#fff', borderRadius: '6px', padding: '2px 8px', fontSize: '0.65rem', fontWeight: 700 }}>
                                        🔥 YORGUN KREATİF
                                      </span>
                                    )}
                                  </div>

                                  {/* Metrik çubukları */}
                                  <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                                    {[
                                      { label: 'Harcama', value: h > 0 ? para(h) : '—', color: '#C2410C' },
                                      { label: 'Gelir', value: g > 0 ? para(g) : '—', color: '#059669' },
                                      { label: 'ROAS', value: r > 0 ? `${r.toFixed(2)}x` : '—', color: roasRenk(r) },
                                      { label: 'CTR', value: ins?.ctr ? `%${parseFloat(ins.ctr).toFixed(2)}` : '—', color: ctr >= avgCtr ? '#059669' : '#D97706' },
                                      { label: 'Frekans', value: freq > 0 ? freq.toFixed(1) : '—', color: freq >= 4 ? '#DC2626' : freq >= 2.5 ? '#D97706' : C.muted },
                                      { label: 'Dönüşüm', value: d > 0 ? sayi(d) : '—', color: '#0284C7' },
                                    ].map((m, j) => (
                                      <div key={j} style={{ minWidth: '60px' }}>
                                        <div style={{ fontSize: '0.62rem', color: C.faint, textTransform: 'uppercase', fontWeight: 600 }}>{m.label}</div>
                                        <div style={{ fontSize: '0.88rem', fontWeight: 700, color: m.color, marginTop: '2px' }}>{m.value}</div>
                                      </div>
                                    ))}
                                  </div>

                                  {/* CTR vs ortalama bar */}
                                  {ins?.ctr && avgCtr > 0 && (
                                    <div style={{ marginTop: '10px' }}>
                                      <div style={{ fontSize: '0.62rem', color: C.faint, marginBottom: '4px' }}>CTR (kampanya ort: %{avgCtr.toFixed(2)})</div>
                                      <div style={{ background: C.borderLight, borderRadius: '4px', height: '5px', width: '200px', position: 'relative' }}>
                                        <div style={{ background: ctr >= avgCtr ? '#059669' : '#DC2626', borderRadius: '4px', height: '5px', width: `${Math.min((ctr / (avgCtr * 2)) * 100, 100)}%`, transition: 'width 0.4s' }} />
                                        {/* Ortalama çizgisi */}
                                        <div style={{ position: 'absolute', top: '-3px', left: '50%', width: '2px', height: '11px', background: C.muted, borderRadius: '1px' }} />
                                      </div>
                                    </div>
                                  )}

                                  {/* Yorgunluk önerisi */}
                                  {yorgun && (
                                    <div style={{ marginTop: '10px', padding: '8px 12px', background: '#FEE2E2', borderRadius: '8px', fontSize: '0.77rem', color: '#991B1B' }}>
                                      ⚠️ Bu kreatif yoruldu. Frekans {freq.toFixed(1)}x, CTR kampanya ortalamasının %{Math.round((1 - ctr / avgCtr) * 100)} altında. Yenilenmeyi veya duraklatmayı düşün.
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>
          </>
        )}

        {yukleniyor && (
          <div style={{ textAlign: 'center', padding: '80px', color: C.muted }}>
            <div style={{ fontSize: '2rem', marginBottom: '12px' }}>⏳</div>
            <p>Reklam setleri yükleniyor...</p>
          </div>
        )}

      </main>

      <style>{`
        @keyframes progress {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(0%); }
          100% { transform: translateX(200%); }
        }
      `}</style>

      {/* HIZLI NOT MODALİ */}
      {hizliNotAcik && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setHizliNotAcik(false) }}>
          <div style={{ background: C.card, borderRadius: '14px', width: '460px', border: `1px solid ${C.border}`, boxShadow: '0 10px 40px rgba(0,0,0,0.15)', overflow: 'hidden' }}>
            <div style={{ padding: '18px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F5F3FF' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#4C1D95' }}>📝 Hızlı Not — Opt. Günlüğüne Ekle</div>
                <div style={{ fontSize: '0.72rem', color: '#7C3AED', marginTop: '2px' }}>{kampanyaAdi}</div>
              </div>
              <button onClick={() => setHizliNotAcik(false)} style={{ background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
            </div>
            <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Anlık metrikler */}
              <div style={{ display: 'flex', gap: '12px', background: C.bg, borderRadius: '9px', padding: '12px 14px', border: `1px solid ${C.border}` }}>
                {[
                  { b: 'Harcama', v: para(th), r: '#C2410C' },
                  { b: 'Gelir', v: para(tg), r: '#059669' },
                  { b: 'ROAS', v: `${roas.toFixed(2)}x`, r: roas >= 3 ? '#059669' : roas >= 1.5 ? '#D97706' : '#DC2626' },
                  { b: 'Dönüşüm', v: String(td), r: '#0284C7' },
                ].map((m, i) => (
                  <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: '0.62rem', color: C.faint, marginBottom: '2px' }}>{m.b}</div>
                    <div style={{ fontSize: '0.83rem', fontWeight: 700, color: m.r }}>{m.v}</div>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: C.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '7px' }}>Ne yaptın / ne gözlemledin?</div>
                <textarea
                  value={hizliNotMetin}
                  onChange={e => setHizliNotMetin(e.target.value)}
                  placeholder="Örn: Bütçeyi 200₺ artırdım. Hedef kitlede 25-34 yaş grubunu kapattım..."
                  rows={4}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: '0.83rem', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
                />
              </div>
              {hizliNotKaydedildi && (
                <div style={{ background: '#F0FDF4', border: '1px solid #A7F3D0', borderRadius: '8px', padding: '10px 14px', fontSize: '0.83rem', color: '#059669', fontWeight: 500 }}>
                  ✅ Optimizasyon günlüğüne kaydedildi! AI Merkezi &rsaquo; Opt. Günlüğü sekmesinde görüntüleyebilirsin.
                </div>
              )}
            </div>
            <div style={{ padding: '14px 20px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setHizliNotAcik(false)} style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.muted, borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', fontSize: '0.83rem' }}>
                Kapat
              </button>
              <button
                onClick={() => {
                  if (!hizliNotMetin.trim()) return
                  const kayit: OptimizasyonKaydi = {
                    id: Date.now().toString(),
                    tarih: new Date().toISOString(),
                    hesap: hesap,
                    donemAdi: donemAdi,
                    kaynak: 'kampanya-detay',
                    kampanyaIds: [id],
                    kampanyaAdlari: [kampanyaAdi],
                    metriks: { harcama: th, gelir: tg, roas, donusum: td },
                    yapilanlar: [hizliNotMetin.trim()],
                    notlar: '',
                    hatirlatmaGun: 0,
                    hatirlatmaTarihi: null,
                    hatirlatmaGoruldu: false,
                  }
                  kayitEkle(kayit)
                  setHizliNotKaydedildi(true)
                  setHizliNotMetin('')
                }}
                disabled={!hizliNotMetin.trim()}
                style={{
                  background: hizliNotMetin.trim() ? '#7C3AED' : C.cardHover,
                  color: hizliNotMetin.trim() ? '#fff' : C.faint,
                  border: 'none', borderRadius: '8px', padding: '8px 20px',
                  cursor: hizliNotMetin.trim() ? 'pointer' : 'not-allowed',
                  fontSize: '0.83rem', fontWeight: 600
                }}>
                ✅ Günlüğe Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
