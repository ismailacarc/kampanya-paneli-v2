'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import * as XLSX from 'xlsx'
import Sidebar from '../components/Sidebar'
import { globalModelOku, MODELLER } from '../components/Sidebar'
import { C } from '../lib/theme'
import { HESAPLAR } from '../lib/types'

// ─── Tipler ──────────────────────────────────────────────────────
interface Mesaj {
  rol: 'user' | 'assistant'
  icerik: string
  zaman: string
}

interface KampanyaBilgileri {
  hesap: string
  platform: 'meta' | 'google'
  baslangic: string
  bitis: string
  butce: string
  urunGrubu: string
  hedef: string
  notlar: string
  veriDonemi: number
}

interface KampanyaPlan {
  kampanyaAdi: string
  funnel: string
  butce: string
  gunlukButce: string
  sure: string
  kitleler: string
  optimizasyon: string
  notlar: string
}

interface AdSet {
  kampanyaAdi: string
  adSetAdi: string
  kitle: string
  butce: string
  format: string
}

interface GorselBrief {
  kampanyaAdi: string
  format: string
  boyut: string
  sure: string
  hook: string
  anaMesaj: string
  cta: string
  notlar: string
}

interface KontrolMaddesi {
  kategori: string
  madde: string
  aciklama?: string
}

interface IsTakipAdimi {
  zaman: string
  gorevler: string[]
  metrikler?: string[]
}

interface Sohbet {
  id: string
  baslik: string
  tarih: string
  mesajlar: Mesaj[]
  kampanyaBilgileri?: KampanyaBilgileri
  plan?: KampanyaPlan[]
  adSetler?: AdSet[]
  gorselBrief?: GorselBrief[]
  kontrolListesi?: KontrolMaddesi[]
  isTakipSureci?: IsTakipAdimi[]
  yukleniyor?: boolean
}

// ─── Yardımcılar ─────────────────────────────────────────────────
function simdi() {
  return new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
}

function sohbetKaydet(list: Sohbet[]) {
  localStorage.setItem('kampanya_sohbetleri', JSON.stringify(list))
}

function sohbetOku(): Sohbet[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem('kampanya_sohbetleri') || '[]') } catch { return [] }
}

function bugunStr() {
  return new Date().toISOString().split('T')[0]
}

function birHaftaSonraStr() {
  const d = new Date(); d.setDate(d.getDate() + 7)
  return d.toISOString().split('T')[0]
}

function excelIndir(data: Record<string, string>[], dosyaAdi: string) {
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Plan')
  XLSX.writeFile(wb, `${dosyaAdi}.xlsx`)
}

// ─── Tablo Bileşeni ───────────────────────────────────────────────
function DataTablosu({ basliklar, satirlar }: { basliklar: string[]; satirlar: string[][] }) {
  return (
    <div style={{ overflowX: 'auto', borderRadius: '8px', border: `1px solid ${C.border}` }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
        <thead>
          <tr style={{ background: C.primary + '10' }}>
            {basliklar.map((b, i) => (
              <th key={i} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 700, color: C.primary, borderBottom: `2px solid ${C.border}`, whiteSpace: 'nowrap' }}>{b}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {satirlar.map((row, ri) => (
            <tr key={ri} style={{ borderBottom: `1px solid ${C.borderLight}` }}
              onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = C.bg}
              onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}
            >
              {row.map((cell, ci) => (
                <td key={ci} style={{ padding: '8px 12px', color: C.text, verticalAlign: 'top' }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Markdown Renderer ───────────────────────────────────────────
function inlineFormat(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g)
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>
    if (p.startsWith('*') && p.endsWith('*')) return <em key={i}>{p.slice(1, -1)}</em>
    if (p.startsWith('`') && p.endsWith('`')) return <code key={i} style={{ background: 'rgba(0,0,0,0.08)', padding: '1px 5px', borderRadius: '3px', fontSize: '0.82em', fontFamily: 'monospace' }}>{p.slice(1, -1)}</code>
    return p
  })
}

function MarkdownRenderer({ text, dark = false }: { text: string; dark?: boolean }) {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Boş satır
    if (line.trim() === '') { elements.push(<div key={i} style={{ height: '6px' }} />); i++; continue }

    // Yatay çizgi
    if (/^---+$/.test(line.trim())) { elements.push(<hr key={i} style={{ border: 'none', borderTop: `1px solid ${dark ? 'rgba(255,255,255,0.2)' : C.border}`, margin: '8px 0' }} />); i++; continue }

    // Başlıklar
    if (line.startsWith('### ')) {
      elements.push(<div key={i} style={{ fontWeight: 700, fontSize: '0.88rem', color: dark ? '#fff' : C.text, marginTop: '10px', marginBottom: '4px' }}>{inlineFormat(line.slice(4))}</div>)
      i++; continue
    }
    if (line.startsWith('## ')) {
      elements.push(<div key={i} style={{ fontWeight: 700, fontSize: '0.92rem', color: dark ? '#fff' : C.primary, marginTop: '12px', marginBottom: '6px' }}>{inlineFormat(line.slice(3))}</div>)
      i++; continue
    }
    if (line.startsWith('# ')) {
      elements.push(<div key={i} style={{ fontWeight: 800, fontSize: '1rem', color: dark ? '#fff' : C.primary, marginTop: '12px', marginBottom: '6px' }}>{inlineFormat(line.slice(2))}</div>)
      i++; continue
    }

    // Markdown tablosu
    if (line.startsWith('|') && lines[i + 1]?.match(/^\|[\s\-:|]+\|/)) {
      const tableLines: string[] = []
      while (i < lines.length && lines[i].startsWith('|')) {
        tableLines.push(lines[i]); i++
      }
      const parseRow = (r: string) => r.split('|').slice(1, -1).map(c => c.trim())
      const headers = parseRow(tableLines[0])
      const rows = tableLines.slice(2).map(parseRow)
      elements.push(
        <div key={i} style={{ overflowX: 'auto', margin: '8px 0', borderRadius: '6px', border: `1px solid ${dark ? 'rgba(255,255,255,0.15)' : C.border}` }}>
          <table style={{ borderCollapse: 'collapse', fontSize: '0.78rem', width: '100%' }}>
            <thead>
              <tr style={{ background: dark ? 'rgba(255,255,255,0.1)' : C.primary + '12' }}>
                {headers.map((h, hi) => <th key={hi} style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700, color: dark ? '#fff' : C.primary, borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.2)' : C.border}`, whiteSpace: 'nowrap' }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} style={{ borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : C.borderLight}` }}>
                  {row.map((cell, ci) => <td key={ci} style={{ padding: '6px 10px', color: dark ? 'rgba(255,255,255,0.9)' : C.text }}>{inlineFormat(cell)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
      continue
    }

    // Bullet list
    if (line.match(/^[-*]\s/)) {
      const items: string[] = []
      while (i < lines.length && lines[i].match(/^[-*]\s/)) {
        items.push(lines[i].replace(/^[-*]\s/, '')); i++
      }
      elements.push(
        <ul key={i} style={{ margin: '4px 0', paddingLeft: '18px', listStyle: 'disc' }}>
          {items.map((item, ii) => <li key={ii} style={{ fontSize: '0.88rem', color: dark ? 'rgba(255,255,255,0.9)' : C.text, marginBottom: '3px', lineHeight: 1.7 }}>{inlineFormat(item)}</li>)}
        </ul>
      )
      continue
    }

    // Numaralı liste
    if (line.match(/^\d+\.\s/)) {
      const items: string[] = []
      while (i < lines.length && lines[i].match(/^\d+\.\s/)) {
        items.push(lines[i].replace(/^\d+\.\s/, '')); i++
      }
      elements.push(
        <ol key={i} style={{ margin: '4px 0', paddingLeft: '18px' }}>
          {items.map((item, ii) => <li key={ii} style={{ fontSize: '0.88rem', color: dark ? 'rgba(255,255,255,0.9)' : C.text, marginBottom: '3px', lineHeight: 1.7 }}>{inlineFormat(item)}</li>)}
        </ol>
      )
      continue
    }

    // Normal satır
    elements.push(
      <div key={i} style={{ fontSize: '0.88rem', color: dark ? 'rgba(255,255,255,0.95)' : C.text, lineHeight: 1.75, marginBottom: '2px' }}>
        {inlineFormat(line)}
      </div>
    )
    i++
  }

  return <div>{elements}</div>
}

// ─── Ana Sayfa ────────────────────────────────────────────────────
export default function KampanyaPlanlamaPage() {
  const [sohbetler, setSohbetler] = useState<Sohbet[]>([])
  const [aktifId, setAktifId] = useState<string | null>(null)
  const [mesaj, setMesaj] = useState('')
  const [yukleniyor, setYukleniyor] = useState(false)
  const [aktifSekme, setAktifSekme] = useState<'sohbet' | 'plan' | 'brief' | 'kontrol' | 'takip'>('sohbet')
  const [model, setModel] = useState(globalModelOku())
  const mesajSonuRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // GA4 state
  const [ga4Aktif, setGa4Aktif]         = useState(true)
  const [ga4Yukleniyor, setGa4Yukleniyor] = useState(false)
  const [ga4Ozet, setGa4Ozet]           = useState<string>('')
  const [ga4Gorsel, setGa4Gorsel]       = useState<{ sessions: number; gelir: number; donusum: number; kanallar: { ad: string; donusum: number }[] } | null>(null)

  // Form state
  const [form, setForm] = useState<KampanyaBilgileri>({
    hesap: 'karmen',
    platform: 'meta',
    baslangic: bugunStr(),
    bitis: birHaftaSonraStr(),
    butce: '',
    urunGrubu: '',
    hedef: 'satis',
    notlar: '',
    veriDonemi: 30
  })

  const aktifSohbet = sohbetler.find(s => s.id === aktifId) || null

  // Yükle
  useEffect(() => {
    const kayitli = sohbetOku()
    setSohbetler(kayitli)
    if (kayitli.length > 0) {
      setAktifId(kayitli[0].id)
      if (kayitli[0].yukleniyor) setYukleniyor(true)
    }
    // GA4 verisini sayfa açılışında çek
    ga4VerisiCek('cotto', 30).then(ozet => {
      setGa4Ozet(ozet)
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
    function onModel() { setModel(globalModelOku()) }
    window.addEventListener('modelDegisti', onModel)
    // Arka planda tamamlanan planlamayı yakala (aynı sekme, custom event)
    function onGuncellendi() {
      const guncellenmis = sohbetOku()
      setSohbetler(guncellenmis)
      if (!guncellenmis.some(s => s.yukleniyor)) setYukleniyor(false)
    }
    window.addEventListener('kampanyaGuncellendi', onGuncellendi)
    return () => {
      window.removeEventListener('modelDegisti', onModel)
      window.removeEventListener('kampanyaGuncellendi', onGuncellendi)
    }
  }, [])

  // Scroll to bottom
  useEffect(() => {
    if (aktifSekme === 'sohbet') mesajSonuRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [aktifSohbet?.mesajlar.length, yukleniyor, aktifSekme])

  // Aktif sohbet değişince form'u güncelle
  useEffect(() => {
    if (aktifSohbet?.kampanyaBilgileri) {
      setForm(aktifSohbet.kampanyaBilgileri)
    }
    setAktifSekme('sohbet')
  }, [aktifId])

  // Sohbet sil
  function sohbetSil(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    const yeni = sohbetler.filter(s => s.id !== id)
    setSohbetler(yeni)
    sohbetKaydet(yeni)
    if (aktifId === id) setAktifId(yeni[0]?.id || null)
  }

  // API çağrısı ortak fonksiyon
  const apiCagir = useCallback(async (
    mesajlar: Mesaj[],
    kampanyaBilgileri: KampanyaBilgileri,
    performansOzet: string,
    ga4OzetStr?: string
  ) => {
    const hesapAdi = kampanyaBilgileri.hesap === 'karmen' ? 'Karmen Halı' : 'Cotto Home'
    const platform = kampanyaBilgileri.platform || 'meta'
    const bilgiOzet = `Platform: ${platform === 'google' ? 'Google Ads' : 'Meta Ads'} | Hesap: ${hesapAdi} | Dönem: ${kampanyaBilgileri.baslangic} – ${kampanyaBilgileri.bitis} | Bütçe: ${kampanyaBilgileri.butce || 'belirtilmedi'} TL | Ürün/Kategori: ${kampanyaBilgileri.urunGrubu || 'belirtilmedi'} | Hedef: ${kampanyaBilgileri.hedef}${kampanyaBilgileri.notlar ? ' | Not: ' + kampanyaBilgileri.notlar : ''}`

    const res = await fetch('/api/kampanya-planlama/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mesajlar, hesap: kampanyaBilgileri.hesap, platform, model, performansOzet, kampanyaBilgileri: bilgiOzet, ga4Ozet: ga4OzetStr || '' })
    })
    return res.json()
  }, [model])

  // Meta verisi çek
  async function metaVerisiCek(hesap: string, donem: number = 30): Promise<string> {
    try {
      const r = await fetch(`/api/meta?hesap=${hesap}&tur=kampanyalar&donem=${donem}`)
      const d = await r.json()
      const kampanyalar = (d.data || []).slice(0, 8)
      if (kampanyalar.length === 0) return ''
      return kampanyalar.map((k: { name: string; status: string; insights?: { data: { spend?: string; ctr?: string; actions?: { action_type: string; value: string }[] }[] } }) => {
        const ins = k.insights?.data?.[0]
        const satis = ins?.actions?.find((a: { action_type: string }) =>
          ['purchase', 'omni_purchase', 'offsite_conversion.fb_pixel_purchase'].includes(a.action_type)
        )?.value || '0'
        return `${k.name} | ${k.status} | Harcama: ${ins?.spend || 0} TL | CTR: ${ins?.ctr || 0}% | Satış: ${satis}`
      }).join('\n')
    } catch { return '' }
  }

  // GA4 verisi çek (genel + kanallar + eticaret + ürünler)
  async function ga4VerisiCek(hesap: string, donem: number = 30): Promise<string> {
    try {
      const bitis     = new Date().toISOString().split('T')[0]
      const bas       = new Date(); bas.setDate(bas.getDate() - (donem - 1))
      const baslangic = bas.toISOString().split('T')[0]
      const params    = `hesap=${hesap}&baslangic=${baslangic}&bitis=${bitis}`

      const [genelRes, kanallarRes, eticaretRes, urunlerRes] = await Promise.all([
        fetch(`/api/analytics?${params}&tur=genel`).then(r => r.json()),
        fetch(`/api/analytics?${params}&tur=kanallar`).then(r => r.json()),
        fetch(`/api/analytics?${params}&tur=eticaret`).then(r => r.json()),
        fetch(`/api/analytics?${params}&tur=urunler`).then(r => r.json()),
      ])

      const g = genelRes.data as { sessions: number; totalUsers: number; bounceRate: number; avgSessionDur: number } | null
      if (!g) return ''

      const kanallar: { kanal: string; sessions: number; islem: number }[] = kanallarRes.data || []
      const et: { gelir: number; satisSayisi: number; ortSiparisD: number; donusumOrani: number; sepeteEkleme: number } | null = eticaretRes.data || null
      const urunler: { urun: string; gelir: number; adet: number; gorunum: number; firsatSkor: number }[] = urunlerRes.data || []

      // Kanal hesaplamaları
      const toplamKanalIslem = kanallar.reduce((s, k) => s + k.islem, 0)
      const hesaplananDonusum = g.sessions > 0 ? parseFloat(((toplamKanalIslem / g.sessions) * 100).toFixed(2)) : 0

      // Görsel panel için state
      const kanalOzet = kanallar
        .filter(k => k.islem > 0)
        .sort((a, b) => b.islem - a.islem)
        .slice(0, 4)
        .map(k => ({ ad: k.kanal, donusum: k.sessions > 0 ? parseFloat(((k.islem / k.sessions) * 100).toFixed(2)) : 0 }))

      setGa4Gorsel({
        sessions: g.sessions,
        gelir: et?.gelir || 0,
        donusum: et?.donusumOrani || hesaplananDonusum,
        kanallar: kanalOzet,
      })

      // ── Kanal metni ──
      const kanalAdiTR = (k: string) =>
        k === 'Paid Social' ? 'Meta Ads (Paid Social)'
        : k === 'Paid Search' ? 'Google Ads (Paid Search)'
        : k === 'Organic Search' ? 'Organik Arama'
        : k === 'Organic Shopping' ? 'Organik Shopping'
        : k === 'Paid Shopping' ? 'Google Shopping (Ücretli)'
        : k === 'Cross-network' ? 'PMax / Çapraz Ağ'
        : k === 'Direct' ? 'Direkt Trafik'
        : k

      const kanalMetin = kanallar
        .filter(k => k.sessions > 50)
        .sort((a, b) => b.sessions - a.sessions)
        .slice(0, 6)
        .map(k => {
          const don = k.sessions > 0 ? ((k.islem / k.sessions) * 100).toFixed(2) : '0'
          return `  - ${kanalAdiTR(k.kanal)}: ${k.sessions.toLocaleString('tr-TR')} oturum, ${k.islem} satış, %${don} dönüşüm`
        }).join('\n')

      // ── E-ticaret metni ──
      const eticaretMetin = et ? `
E-Ticaret Özeti:
  - Toplam Gelir: ₺${et.gelir.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
  - Satış Sayısı: ${et.satisSayisi}
  - Ort. Sipariş Değeri: ₺${et.ortSiparisD.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
  - Dönüşüm Oranı: %${et.donusumOrani}
  - Sepete Ekleme: ${et.sepeteEkleme.toLocaleString('tr-TR')}` : ''

      // ── Top 10 ürün metni ──
      const topUrunler = urunler.slice(0, 10)
      const urunMetin = topUrunler.length > 0 ? `
En Çok Satan 10 Ürün:
${topUrunler.map((u, i) => `  ${i + 1}. ${u.urun}: ₺${u.gelir.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} gelir, ${u.adet} satış, ${u.gorunum.toLocaleString('tr-TR')} görüntülenme`).join('\n')}` : ''

      // ── Fırsat ürünleri ──
      const firsatUrunler = urunler.filter(u => u.firsatSkor > 70).slice(0, 5)
      const firsatMetin = firsatUrunler.length > 0 ? `
Fırsat Ürünleri (Çok Görülüp Az Satılan — Reklam Potansiyeli Yüksek):
${firsatUrunler.map(u => `  - ${u.urun}: ${u.gorunum.toLocaleString('tr-TR')} görüntülenme, yalnızca ${u.adet} satış`).join('\n')}` : ''

      return `=== GA4 GERÇEK PERFORMANS VERİSİ (Son ${donem} Gün) ===
Platform: Google Analytics 4 (Gerçek Veri)
Hesap: ${hesap === 'karmen' ? 'Karmen Halı' : 'Cotto Home'}
Dönem: Son ${donem} gün

Genel Trafik:
  - Toplam Oturum: ${g.sessions.toLocaleString('tr-TR')}
  - Toplam Kullanıcı: ${g.totalUsers.toLocaleString('tr-TR')}
  - Bounce Rate: %${g.bounceRate}
  - Ort. Oturum Süresi: ${g.avgSessionDur} dk
${eticaretMetin}

Kanal Bazlı Dönüşümler:
${kanalMetin}
${urunMetin}
${firsatMetin}

ÖNEMLİ TALİMAT: Bu GERÇEK GA4 verisidir. Kampanya planını bu verilere dayanarak yap:
- Hangi kanal zayıf dönüşüm yapıyor → nasıl iyileştiririz?
- Hangi ürünler en çok gelir getiriyor → bunlara özel kampanya kur
- Fırsat ürünleri çok görülüyor ama satılmıyor → reklam bütçesi yönlendir
- Ort. sipariş değeri ${et ? `₺${et.ortSiparisD.toLocaleString('tr-TR')}` : 'bilinmiyor'} → upsell/cross-sell fırsatları var mı?`
    } catch {
      return ''
    }
  }

  // GA4 verisini çek (form.hesap veya donem değişince)
  async function ga4Guncelle(hesap: string, donem: number) {
    if (!ga4Aktif) return
    setGa4Yukleniyor(true)
    const ozet = await ga4VerisiCek(hesap, donem)
    setGa4Ozet(ozet)
    setGa4Yukleniyor(false)
  }

  // Google Ads verisi çek
  async function googleVerisiCek(hesap: string, donem: number = 30): Promise<string> {
    try {
      const r = await fetch(`/api/google-ads?hesap=${hesap}&tur=kampanyalar&donem=${donem}`)
      const d = await r.json()
      const kampanyalar = (d.data || []).slice(0, 10)
      if (kampanyalar.length === 0) return ''
      return kampanyalar.map((k: {
        ad: string; tip: string; durum: number; harcama: string
        tiklama: number; ctr: string; donusum: number; gelir: string
        roas: string; ort_cpc: string; gosterim_payi: string | null
      }) => {
        const durumStr = k.durum === 2 ? 'Aktif' : 'Duraklatılmış'
        const aramaPayi = k.gosterim_payi ? ` | Arama Payı: %${k.gosterim_payi}` : ''
        return `${k.ad} | ${k.tip} | ${durumStr} | Harcama: ₺${k.harcama} | CTR: %${k.ctr} | Dönüşüm: ${k.donusum} | Gelir: ₺${k.gelir} | ROAS: ${k.roas}x | Ort.CPC: ₺${k.ort_cpc}${aramaPayi}`
      }).join('\n')
    } catch { return '' }
  }

  // Planlamaya Başla
  async function planlamaBasla() {
    if (yukleniyor) return

    const id = Date.now().toString()
    const baslik = form.urunGrubu
      ? `${form.urunGrubu} — ${form.hedef}`
      : `Yeni Plan — ${new Date().toLocaleDateString('tr-TR')}`

    const ilkMesaj: Mesaj = { rol: 'user', icerik: 'Kampanya planı hazırla.', zaman: simdi() }
    const bilgiler = { ...form }

    const yeniSohbet: Sohbet = {
      id, baslik,
      tarih: new Date().toLocaleDateString('tr-TR'),
      mesajlar: [ilkMesaj],
      kampanyaBilgileri: bilgiler,
      yukleniyor: true
    }
    const yeniListe = [yeniSohbet, ...sohbetler]
    setSohbetler(yeniListe)
    sohbetKaydet(yeniListe)
    setAktifId(id)
    setAktifSekme('sohbet')
    setYukleniyor(true)

    // Performans verisini çek (hızlı)
    let performansOzet = ''
    try {
      performansOzet = bilgiler.platform === 'google'
        ? await googleVerisiCek(bilgiler.hesap, bilgiler.veriDonemi)
        : await metaVerisiCek(bilgiler.hesap, bilgiler.veriDonemi)
    } catch { /* devam */ }

    // Arka planda AI çağrısı — sayfadan çıksan bile devam eder
    apiCagir([ilkMesaj], bilgiler, performansOzet, ga4Aktif ? ga4Ozet : '')
      .then(data => {
        const botMesaji: Mesaj = { rol: 'assistant', icerik: data.icerik || 'Hata oluştu.', zaman: simdi() }
        const guncel = sohbetOku().map(s => s.id !== id ? s : {
          ...s, yukleniyor: false,
          mesajlar: [...s.mesajlar, botMesaji],
          plan: data.plan || s.plan,
          adSetler: data.adSetler || s.adSetler,
          gorselBrief: data.gorselBrief || s.gorselBrief,
          kontrolListesi: data.kontrolListesi || s.kontrolListesi,
          isTakipSureci: data.isTakipSureci || s.isTakipSureci,
        })
        sohbetKaydet(guncel)
        setSohbetler(guncel)
        setYukleniyor(false)
        if (data.plan?.length) setAktifSekme('plan')
        window.dispatchEvent(new CustomEvent('kampanyaGuncellendi'))
      })
      .catch(() => {
        const hataMesaji: Mesaj = { rol: 'assistant', icerik: 'Bağlantı hatası. Tekrar dene.', zaman: simdi() }
        const guncel = sohbetOku().map(s => s.id !== id ? s : {
          ...s, yukleniyor: false,
          mesajlar: [...s.mesajlar, hataMesaji]
        })
        sohbetKaydet(guncel)
        setSohbetler(guncel)
        setYukleniyor(false)
        window.dispatchEvent(new CustomEvent('kampanyaGuncellendi'))
      })

    setTimeout(() => inputRef.current?.focus(), 100)
  }

  // Mesaj gönder
  const gonder = useCallback(async () => {
    if (!mesaj.trim() || yukleniyor || !aktifId || !aktifSohbet) return

    const kullaniciMesaji: Mesaj = { rol: 'user', icerik: mesaj.trim(), zaman: simdi() }
    setMesaj('')

    const guncelMesajlar = [...aktifSohbet.mesajlar, kullaniciMesaji]
    const aktifIdSnapshot = aktifId
    const bilgiler = aktifSohbet.kampanyaBilgileri || form

    // Kullanıcı mesajını hemen kaydet
    const listeIleKullanici = sohbetOku().map(s => s.id !== aktifIdSnapshot ? s : {
      ...s, mesajlar: guncelMesajlar, yukleniyor: true
    })
    sohbetKaydet(listeIleKullanici)
    setSohbetler(listeIleKullanici)
    setYukleniyor(true)

    // Performans verisi (hızlı)
    let performansOzet = ''
    try {
      performansOzet = bilgiler.platform === 'google'
        ? await googleVerisiCek(bilgiler.hesap, bilgiler.veriDonemi)
        : await metaVerisiCek(bilgiler.hesap, bilgiler.veriDonemi)
    } catch { /* devam */ }

    // Arka planda AI çağrısı — sayfadan çıksan bile devam eder
    apiCagir(guncelMesajlar, bilgiler, performansOzet, ga4Aktif ? ga4Ozet : '')
      .then(data => {
        const botMesaji: Mesaj = { rol: 'assistant', icerik: data.icerik || 'Hata oluştu.', zaman: simdi() }
        const guncel = sohbetOku().map(s => s.id !== aktifIdSnapshot ? s : {
          ...s, yukleniyor: false,
          mesajlar: [...guncelMesajlar, botMesaji],
          plan: data.plan || s.plan,
          adSetler: data.adSetler || s.adSetler,
          gorselBrief: data.gorselBrief || s.gorselBrief,
          kontrolListesi: data.kontrolListesi || s.kontrolListesi,
          isTakipSureci: data.isTakipSureci || s.isTakipSureci,
        })
        sohbetKaydet(guncel)
        setSohbetler(guncel)
        setYukleniyor(false)
        if (data.plan?.length) setAktifSekme('plan')
        window.dispatchEvent(new CustomEvent('kampanyaGuncellendi'))
      })
      .catch(() => {
        const hataMesaji: Mesaj = { rol: 'assistant', icerik: 'Bağlantı hatası. Tekrar dene.', zaman: simdi() }
        const guncel = sohbetOku().map(s => s.id !== aktifIdSnapshot ? s : {
          ...s, yukleniyor: false,
          mesajlar: [...guncelMesajlar, hataMesaji]
        })
        sohbetKaydet(guncel)
        setSohbetler(guncel)
        setYukleniyor(false)
        window.dispatchEvent(new CustomEvent('kampanyaGuncellendi'))
      })
  }, [mesaj, yukleniyor, aktifId, aktifSohbet, form, apiCagir])

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); gonder() }
  }

  const secilenModel = MODELLER.find(m => m.id === model) || MODELLER[1]

  // Plan ve brief verilerini tablo formatına çevir
  const planSatirlari: string[][] = (aktifSohbet?.plan || []).map(p => [
    p.kampanyaAdi || '', p.funnel || '', p.butce || '', p.gunlukButce || '',
    p.sure || '', p.kitleler || '', p.optimizasyon || '', p.notlar || ''
  ])

  const adSetSatirlari: string[][] = (aktifSohbet?.adSetler || []).map(a => [
    a.kampanyaAdi || '', a.adSetAdi || '', a.kitle || '', a.butce || '', a.format || ''
  ])

  const briefSatirlari: string[][] = (aktifSohbet?.gorselBrief || []).map(b => [
    b.kampanyaAdi || '', b.format || '', b.boyut || '', b.sure || '',
    b.hook || '', b.anaMesaj || '', b.cta || '', b.notlar || ''
  ])

  // Excel export fonksiyonları
  function planExcelIndir() {
    if (!aktifSohbet?.plan?.length) return
    const data = aktifSohbet.plan.map(p => ({
      'Kampanya Adı': p.kampanyaAdi, 'Funnel': p.funnel, 'Bütçe (TL)': p.butce,
      'Günlük Bütçe': p.gunlukButce, 'Süre': p.sure, 'Kitleler': p.kitleler,
      'Optimizasyon': p.optimizasyon, 'Notlar': p.notlar
    }))
    excelIndir(data, `kampanya-plani-${aktifSohbet.baslik}`)
  }

  function briefExcelIndir() {
    if (!aktifSohbet?.gorselBrief?.length) return
    const data = aktifSohbet.gorselBrief.map(b => ({
      'Kampanya': b.kampanyaAdi, 'Format': b.format, 'Boyut': b.boyut,
      'Süre': b.sure, 'Hook': b.hook, 'Ana Mesaj': b.anaMesaj,
      'CTA': b.cta, 'Notlar': b.notlar
    }))
    excelIndir(data, `gorsel-brief-${aktifSohbet.baslik}`)
  }

  const hedefler = [
    { id: 'satis', ad: 'Satış / Dönüşüm' },
    { id: 'trafik', ad: 'Web Trafiği' },
    { id: 'farkindalik', ad: 'Farkındalık' },
    { id: 'lansman', ad: 'Ürün Lansmanı' },
    { id: 'retargeting', ad: 'Retargeting' },
  ]

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg }}>
      <Sidebar />

      {/* ─── Sol Panel: Form + Geçmiş ─── */}
      <div style={{
        marginLeft: '220px', width: '270px', flexShrink: 0,
        background: C.card, borderRight: `1px solid ${C.border}`,
        display: 'flex', flexDirection: 'column', height: '100vh',
        position: 'sticky', top: 0, overflowY: 'auto'
      }}>
        {/* Başlık */}
        <div style={{ padding: '14px 14px 10px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: C.text }}>🗓️ Kampanya Planlama</div>
          <div style={{ fontSize: '0.65rem', color: C.faint, marginTop: '2px' }}>Bilgileri doldur, AI ile planla</div>
        </div>

        {/* ── FORM ── */}
        <div style={{ padding: '12px 14px', borderBottom: `1px solid ${C.border}` }}>
          {/* Platform */}
          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '0.63rem', fontWeight: 700, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '5px' }}>Platform</div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => setForm(f => ({ ...f, platform: 'meta' }))} style={{
                flex: 1, padding: '5px', borderRadius: '6px', cursor: 'pointer',
                border: `2px solid ${form.platform === 'meta' ? '#1877F2' : C.border}`,
                background: form.platform === 'meta' ? '#1877F215' : 'transparent',
                color: form.platform === 'meta' ? '#1877F2' : C.muted,
                fontSize: '0.7rem', fontWeight: 600
              }}>📘 Meta</button>
              <button onClick={() => setForm(f => ({ ...f, platform: 'google' }))} style={{
                flex: 1, padding: '5px', borderRadius: '6px', cursor: 'pointer',
                border: `2px solid ${form.platform === 'google' ? '#4285F4' : C.border}`,
                background: form.platform === 'google' ? '#4285F415' : 'transparent',
                color: form.platform === 'google' ? '#4285F4' : C.muted,
                fontSize: '0.7rem', fontWeight: 600
              }}>🔵 Google</button>
            </div>
          </div>

          {/* Hesap */}
          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '0.63rem', fontWeight: 700, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '5px' }}>Hesap</div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {HESAPLAR.map(h => (
                <button key={h.id} onClick={() => setForm(f => ({ ...f, hesap: h.id }))} style={{
                  flex: 1, padding: '5px', borderRadius: '6px', cursor: 'pointer',
                  border: `2px solid ${form.hesap === h.id ? h.renk : C.border}`,
                  background: form.hesap === h.id ? h.renk + '18' : 'transparent',
                  color: form.hesap === h.id ? h.renk : C.muted,
                  fontSize: '0.7rem', fontWeight: 600
                }}>{h.emoji} {h.ad}</button>
              ))}
            </div>
          </div>

          {/* Dönem */}
          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '0.63rem', fontWeight: 700, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '5px' }}>Kampanya Dönemi</div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <input type="date" value={form.baslangic} onChange={e => setForm(f => ({ ...f, baslangic: e.target.value }))}
                style={{ flex: 1, padding: '5px 7px', borderRadius: '6px', border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: '0.72rem', outline: 'none' }} />
              <span style={{ color: C.faint, fontSize: '0.7rem' }}>–</span>
              <input type="date" value={form.bitis} onChange={e => setForm(f => ({ ...f, bitis: e.target.value }))}
                style={{ flex: 1, padding: '5px 7px', borderRadius: '6px', border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: '0.72rem', outline: 'none' }} />
            </div>
          </div>

          {/* Bütçe */}
          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '0.63rem', fontWeight: 700, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '5px' }}>Toplam Bütçe (TL)</div>
            <input
              type="number" placeholder="ör: 50000"
              value={form.butce} onChange={e => setForm(f => ({ ...f, butce: e.target.value }))}
              style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          {/* Ürün Grubu */}
          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '0.63rem', fontWeight: 700, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '5px' }}>Ürün / Kategori</div>
            <input
              type="text" placeholder="ör: Shaggy Halılar, Yeni Koleksiyon..."
              value={form.urunGrubu} onChange={e => setForm(f => ({ ...f, urunGrubu: e.target.value }))}
              style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          {/* Hedef */}
          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '0.63rem', fontWeight: 700, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '5px' }}>Kampanya Hedefi</div>
            <select value={form.hedef} onChange={e => setForm(f => ({ ...f, hedef: e.target.value }))}
              style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: '0.8rem', outline: 'none', cursor: 'pointer' }}>
              {hedefler.map(h => <option key={h.id} value={h.id}>{h.ad}</option>)}
            </select>
          </div>

          {/* Geçmiş Veri Dönemi */}
          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '0.63rem', fontWeight: 700, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '5px' }}>
              📊 Geçmiş Veriyi Şu Dönemden Çek
            </div>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {[7, 14, 30, 60, 90].map(gun => (
                <button key={gun} onClick={() => setForm(f => ({ ...f, veriDonemi: gun }))} style={{
                  padding: '4px 10px', borderRadius: '6px', cursor: 'pointer',
                  border: `1.5px solid ${form.veriDonemi === gun ? C.primary : C.border}`,
                  background: form.veriDonemi === gun ? C.primary + '15' : 'transparent',
                  color: form.veriDonemi === gun ? C.primary : C.muted,
                  fontSize: '0.72rem', fontWeight: form.veriDonemi === gun ? 700 : 400,
                  transition: 'all 0.12s'
                }}>
                  Son {gun}g
                </button>
              ))}
            </div>
          </div>

          {/* GA4 Bağlam Paneli */}
          <div style={{ marginBottom: '12px', background: ga4Aktif ? '#f0fdf4' : C.bg, border: `1.5px solid ${ga4Aktif ? '#86efac' : C.border}`, borderRadius: '8px', padding: '10px', transition: 'all 0.2s' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: ga4Aktif ? '8px' : '0' }}>
              <div>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: ga4Aktif ? '#15803d' : C.muted }}>📊 GA4 Bağlamı</div>
                <div style={{ fontSize: '0.6rem', color: ga4Aktif ? '#166534' : C.faint }}>Gerçek veriyle planla</div>
              </div>
              <button onClick={async () => {
                const yeni = !ga4Aktif
                setGa4Aktif(yeni)
                if (yeni && !ga4Ozet) await ga4Guncelle(form.hesap, form.veriDonemi)
              }} style={{
                padding: '3px 10px', borderRadius: '20px', cursor: 'pointer', fontSize: '0.68rem', fontWeight: 700,
                border: `1.5px solid ${ga4Aktif ? '#86efac' : C.border}`,
                background: ga4Aktif ? '#15803d' : '#fff',
                color: ga4Aktif ? '#fff' : C.muted, transition: 'all 0.15s'
              }}>
                {ga4Aktif ? '✓ Açık' : 'Kapat'}
              </button>
            </div>

            {ga4Aktif && (
              <div>
                {ga4Yukleniyor ? (
                  <div style={{ fontSize: '0.68rem', color: '#166534', padding: '4px 0' }}>⏳ GA4 verisi yükleniyor...</div>
                ) : ga4Gorsel ? (
                  <div>
                    <div style={{ fontSize: '0.68rem', color: '#166534', marginBottom: '6px', fontWeight: 600 }}>
                      ✅ {form.hesap === 'karmen' ? 'Karmen Halı' : 'Cotto Home'} · Son {form.veriDonemi}g
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginBottom: '6px' }}>
                      <div style={{ background: '#fff', borderRadius: '5px', padding: '5px 7px' }}>
                        <div style={{ fontSize: '0.6rem', color: '#166534' }}>Oturum</div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#15803d' }}>{ga4Gorsel.sessions.toLocaleString('tr-TR')}</div>
                      </div>
                      <div style={{ background: '#fff', borderRadius: '5px', padding: '5px 7px' }}>
                        <div style={{ fontSize: '0.6rem', color: '#166534' }}>Dönüşüm</div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#15803d' }}>%{ga4Gorsel.donusum}</div>
                      </div>
                      {ga4Gorsel.gelir > 0 && (
                        <div style={{ background: '#fff', borderRadius: '5px', padding: '5px 7px', gridColumn: '1 / -1' }}>
                          <div style={{ fontSize: '0.6rem', color: '#166534' }}>Toplam Gelir</div>
                          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#15803d' }}>
                            ₺{ga4Gorsel.gelir.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </div>
                        </div>
                      )}
                    </div>
                    {ga4Gorsel.kanallar.length > 0 && (
                      <div style={{ background: '#fff', borderRadius: '5px', padding: '5px 7px' }}>
                        <div style={{ fontSize: '0.6rem', color: '#166534', marginBottom: '4px', fontWeight: 600 }}>Kanal Dönüşümleri</div>
                        {ga4Gorsel.kanallar.map((k, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: '#374151', marginBottom: '2px' }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{k.ad === 'Paid Social' ? 'Meta Ads' : k.ad === 'Paid Search' ? 'Google Ads' : k.ad === 'Organic Search' ? 'Organik' : k.ad === 'Cross-network' ? 'PMax' : k.ad}</span>
                            <span style={{ fontWeight: 700, color: k.donusum >= 1.5 ? '#15803d' : k.donusum > 0 ? '#d97706' : '#9ca3af', flexShrink: 0 }}>%{k.donusum}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <button onClick={() => ga4Guncelle(form.hesap, form.veriDonemi)} style={{ marginTop: '6px', width: '100%', padding: '3px', background: 'none', border: `1px solid #86efac`, borderRadius: '5px', color: '#15803d', fontSize: '0.62rem', cursor: 'pointer', fontWeight: 600 }}>
                      🔄 Yenile
                    </button>
                  </div>
                ) : (
                  <button onClick={() => ga4Guncelle(form.hesap, form.veriDonemi)} style={{ width: '100%', padding: '6px', background: '#fff', border: `1px solid #86efac`, borderRadius: '6px', color: '#15803d', fontSize: '0.68rem', cursor: 'pointer', fontWeight: 600 }}>
                    📊 GA4 Verisini Çek
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Notlar */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '0.63rem', fontWeight: 700, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '5px' }}>Özel Notlar <span style={{ fontWeight: 400 }}>(opsiyonel)</span></div>
            <textarea
              placeholder="ör: Bayram indirimi, rakip fiyatına dikkat et..."
              value={form.notlar} onChange={e => setForm(f => ({ ...f, notlar: e.target.value }))}
              rows={2}
              style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: '0.78rem', resize: 'none', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
            />
          </div>

          {/* Planlamaya Başla Butonu */}
          <button onClick={planlamaBasla} disabled={yukleniyor} style={{
            width: '100%', padding: '10px', borderRadius: '8px',
            background: yukleniyor ? C.border : form.platform === 'google' ? '#4285F4' : C.primary,
            color: '#fff', border: 'none', cursor: yukleniyor ? 'not-allowed' : 'pointer',
            fontSize: '0.82rem', fontWeight: 700, transition: 'all 0.15s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px'
          }}>
            {yukleniyor ? '⏳ Hazırlanıyor...' : form.platform === 'google' ? '🔵 Planlamaya Başla' : '🚀 Planlamaya Başla'}
          </button>
        </div>

        {/* ── Geçmiş Sohbetler ── */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ padding: '10px 14px 4px', fontSize: '0.6rem', fontWeight: 700, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Geçmiş Planlar
          </div>
          {sohbetler.length === 0 ? (
            <div style={{ padding: '16px 14px', fontSize: '0.72rem', color: C.faint, textAlign: 'center' }}>Henüz plan yok.</div>
          ) : (
            <div style={{ padding: '4px 8px 12px' }}>
              {sohbetler.map(s => {
                const h = HESAPLAR.find(h => h.id === (s.kampanyaBilgileri?.hesap || s.mesajlar[0]?.icerik))
                const aktif = s.id === aktifId
                return (
                  <div key={s.id} onClick={() => setAktifId(s.id)}
                    style={{
                      padding: '8px 10px', borderRadius: '8px', cursor: 'pointer',
                      background: aktif ? C.primary + '12' : 'transparent',
                      border: `1px solid ${aktif ? C.primary + '30' : 'transparent'}`,
                      marginBottom: '3px', position: 'relative', transition: 'all 0.12s'
                    }}
                    onMouseEnter={e => { if (!aktif) (e.currentTarget as HTMLDivElement).style.background = C.bg }}
                    onMouseLeave={e => { if (!aktif) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
                  >
                    <div style={{ paddingRight: '18px' }}>
                      <div style={{ fontSize: '0.76rem', fontWeight: aktif ? 600 : 400, color: aktif ? C.primary : C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.baslik}
                      </div>
                      <div style={{ fontSize: '0.62rem', color: C.faint, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                        {h ? `${h.emoji} ` : ''}{s.tarih}
                        {s.kampanyaBilgileri?.butce ? ` · ${Number(s.kampanyaBilgileri.butce).toLocaleString('tr-TR')} TL` : ''}
                        {s.kampanyaBilgileri?.platform === 'google'
                          ? <span style={{ fontSize: '0.57rem', fontWeight: 700, color: '#4285F4', background: '#EBF3FE', border: '1px solid #BBDEFB', padding: '0px 5px', borderRadius: '6px' }}>Google</span>
                          : <span style={{ fontSize: '0.57rem', fontWeight: 700, color: '#1877F2', background: '#EBF2FF', border: '1px solid #BFDBFE', padding: '0px 5px', borderRadius: '6px' }}>Meta</span>
                        }
                      </div>
                      {s.yukleniyor && <div style={{ fontSize: '0.58rem', color: '#D97706', marginTop: '2px' }}>⏳ Hazırlanıyor...</div>}
                      {!s.yukleniyor && s.plan && <div style={{ fontSize: '0.58rem', color: '#15803D', marginTop: '2px' }}>✓ Plan hazır</div>}
                    </div>
                    <button onClick={(e) => sohbetSil(s.id, e)} title="Sil"
                      style={{
                        position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: `1px solid ${C.border}`, cursor: 'pointer',
                        color: C.faint, fontSize: '0.6rem', padding: '2px 5px',
                        borderRadius: '4px', lineHeight: 1
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#DC2626'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#DC2626' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = C.faint; (e.currentTarget as HTMLButtonElement).style.borderColor = C.border }}
                    >✕</button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ─── Sağ: Chat + Tablolar ─── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        {!aktifSohbet ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: C.faint }}>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🗓️</div>
            <div style={{ fontSize: '1rem', fontWeight: 600, color: C.muted, marginBottom: '8px' }}>Kampanya Planlama Asistanı</div>
            <div style={{ fontSize: '0.82rem', marginBottom: '6px' }}>Sol taraftan bilgileri doldur ve</div>
            <div style={{ fontSize: '0.82rem', color: C.primary, fontWeight: 600 }}>🚀 Planlamaya Başla'ya tıkla</div>
          </div>
        ) : (
          <>
            {/* Header + Sekmeler */}
            <div style={{ padding: '0', borderBottom: `1px solid ${C.border}`, background: C.card }}>
              {/* Üst başlık */}
              <div style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${C.borderLight}` }}>
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: C.text }}>{aktifSohbet.baslik}</div>
                  <div style={{ fontSize: '0.65rem', color: C.faint, marginTop: '1px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    {aktifSohbet.kampanyaBilgileri && (
                      <>
                        {aktifSohbet.kampanyaBilgileri.platform === 'google'
                          ? <span style={{ fontSize: '0.63rem', fontWeight: 700, color: '#4285F4', background: '#EBF3FE', border: '1px solid #BBDEFB', padding: '1px 6px', borderRadius: '8px' }}>🔵 Google Ads</span>
                          : <span style={{ fontSize: '0.63rem', fontWeight: 700, color: '#1877F2', background: '#EBF2FF', border: '1px solid #BFDBFE', padding: '1px 6px', borderRadius: '8px' }}>📘 Meta Ads</span>
                        }
                        {HESAPLAR.find(h => h.id === aktifSohbet.kampanyaBilgileri?.hesap)?.ad}
                        {aktifSohbet.kampanyaBilgileri.butce && ` · ${Number(aktifSohbet.kampanyaBilgileri.butce).toLocaleString('tr-TR')} TL`}
                        {` · ${aktifSohbet.kampanyaBilgileri.baslangic} → ${aktifSohbet.kampanyaBilgileri.bitis}`}
                      </>
                    )}
                  </div>
                </div>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: C.primary, background: C.primary + '12', padding: '3px 8px', borderRadius: '6px' }}>
                  {secilenModel.icon} {secilenModel.ad}
                </span>
              </div>

              {/* Sekmeler */}
              <div style={{ display: 'flex', padding: '0 20px', overflowX: 'auto' }}>
                {[
                  { id: 'sohbet',  label: '💬 Sohbet',        always: true },
                  { id: 'plan',    label: '📋 Kampanya Planı', always: false },
                  { id: 'brief',   label: aktifSohbet.kampanyaBilgileri?.platform === 'google' ? '📝 Reklam Metni Brief' : '🎨 Görsel Brief', always: false },
                  { id: 'kontrol', label: '✅ Kontrol Listesi', always: false },
                  { id: 'takip',   label: '📅 İş Takip',       always: false },
                ].map(s => {
                  const aktif = aktifSekme === s.id
                  const varMi = s.id === 'sohbet'
                    || (s.id === 'plan'    && aktifSohbet.plan?.length)
                    || (s.id === 'brief'   && aktifSohbet.gorselBrief?.length)
                    || (s.id === 'kontrol' && aktifSohbet.kontrolListesi?.length)
                    || (s.id === 'takip'   && aktifSohbet.isTakipSureci?.length)
                  if (!s.always && !varMi) return null
                  return (
                    <button key={s.id} onClick={() => setAktifSekme(s.id as 'sohbet' | 'plan' | 'brief' | 'kontrol' | 'takip')} style={{
                      padding: '9px 14px', background: 'none', border: 'none',
                      borderBottom: `2px solid ${aktif ? C.primary : 'transparent'}`,
                      color: aktif ? C.primary : C.muted, cursor: 'pointer',
                      fontSize: '0.78rem', fontWeight: aktif ? 700 : 400,
                      transition: 'all 0.15s', marginBottom: '-1px'
                    }}>
                      {s.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* ── Sohbet sekmesi ── */}
            {aktifSekme === 'sohbet' && (
              <>
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
                  {aktifSohbet.mesajlar.map((m, i) => (
                    <div key={i} style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexDirection: m.rol === 'user' ? 'row-reverse' : 'row' }}>
                      <div style={{
                        width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                        background: m.rol === 'user' ? C.primary : '#7C3AED',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', color: '#fff'
                      }}>
                        {m.rol === 'user' ? '👤' : '🤖'}
                      </div>
                      <div style={{ maxWidth: '75%' }}>
                        <div style={{
                          padding: '10px 14px',
                          borderRadius: m.rol === 'user' ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                          background: m.rol === 'user' ? C.primary : C.card,
                          color: m.rol === 'user' ? '#fff' : C.text,
                          border: m.rol === 'user' ? 'none' : `1px solid ${C.border}`,
                          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                        }}>
                          {m.rol === 'user'
                            ? <div style={{ fontSize: '0.85rem', lineHeight: 1.65, whiteSpace: 'pre-wrap', color: '#fff' }}>{m.icerik}</div>
                            : <MarkdownRenderer text={m.icerik} />
                          }
                        </div>
                        <div style={{ fontSize: '0.62rem', color: C.faint, marginTop: '4px', textAlign: m.rol === 'user' ? 'right' : 'left' }}>{m.zaman}</div>
                      </div>
                    </div>
                  ))}
                  {yukleniyor && (
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', color: '#fff', flexShrink: 0 }}>🤖</div>
                      <div style={{ padding: '12px 16px', borderRadius: '4px 16px 16px 16px', background: C.card, border: `1px solid ${C.border}`, display: 'flex', gap: '4px', alignItems: 'center' }}>
                        {[0, 1, 2].map(i => (
                          <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: C.muted, animation: 'bounce 1.2s infinite', animationDelay: `${i * 0.2}s` }} />
                        ))}
                      </div>
                    </div>
                  )}
                  <div ref={mesajSonuRef} />
                </div>

                <div style={{ padding: '14px 24px', borderTop: `1px solid ${C.border}`, background: C.card }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                    <textarea ref={inputRef} value={mesaj} onChange={e => setMesaj(e.target.value)} onKeyDown={onKeyDown}
                      placeholder="Düzeltme veya ek bilgi yaz... (Enter: gönder, Shift+Enter: yeni satır)"
                      rows={2}
                      style={{ flex: 1, padding: '10px 14px', borderRadius: '10px', border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: '0.85rem', resize: 'none', fontFamily: 'inherit', outline: 'none', lineHeight: 1.5 }}
                    />
                    <button onClick={gonder} disabled={yukleniyor || !mesaj.trim()} style={{
                      padding: '10px 18px', borderRadius: '10px',
                      background: yukleniyor || !mesaj.trim() ? C.border : C.primary,
                      color: '#fff', border: 'none', cursor: yukleniyor || !mesaj.trim() ? 'not-allowed' : 'pointer',
                      fontSize: '0.88rem', fontWeight: 700, flexShrink: 0, transition: 'all 0.15s'
                    }}>
                      {yukleniyor ? '⏳' : '↑ Gönder'}
                    </button>
                  </div>
                  <div style={{ fontSize: '0.63rem', color: C.faint, marginTop: '5px' }}>
                    Onay verince AI planı tabloya yazar. Model: {secilenModel.ad}
                  </div>
                </div>
              </>
            )}

            {/* ── Kampanya Planı sekmesi ── */}
            {aktifSekme === 'plan' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: C.text }}>📋 Kampanya Planı</div>
                    <div style={{ fontSize: '0.68rem', color: C.faint, marginTop: '2px' }}>{(aktifSohbet.plan?.length || 0)} kampanya</div>
                  </div>
                  <button onClick={planExcelIndir} style={{
                    padding: '7px 14px', borderRadius: '8px', background: '#16A34A', color: '#fff',
                    border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: '6px'
                  }}>
                    📥 Excel İndir
                  </button>
                </div>

                {planSatirlari.length > 0 ? (
                  <DataTablosu
                    basliklar={aktifSohbet.kampanyaBilgileri?.platform === 'google'
                      ? ['Kampanya Adı', 'Tip', 'Bütçe (TL)', 'Günlük', 'Süre', 'Kitleler/Anahtar Kelimeler', 'Teklif Stratejisi', 'Notlar']
                      : ['Kampanya Adı', 'Funnel', 'Bütçe (TL)', 'Günlük', 'Süre', 'Kitleler', 'Optimizasyon', 'Notlar']
                    }
                    satirlar={planSatirlari}
                  />
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px', color: C.faint, fontSize: '0.82rem' }}>
                    Kampanya planı henüz hazır değil.<br />Sohbet sekmesinden devam et ve AI'ın planı onaylayın.
                  </div>
                )}

                {aktifSohbet.adSetler && aktifSohbet.adSetler.length > 0 && (
                  <div style={{ marginTop: '28px' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: C.text, marginBottom: '12px' }}>
                      {aktifSohbet.kampanyaBilgileri?.platform === 'google' ? 'Reklam Grubu Detayları' : 'Ad Set Detayları'}
                    </div>
                    <DataTablosu
                      basliklar={aktifSohbet.kampanyaBilgileri?.platform === 'google'
                        ? ['Kampanya', 'Reklam Grubu', 'Anahtar Kelimeler', 'Bütçe (TL)', 'Eşleme Tipi']
                        : ['Kampanya', 'Ad Set Adı', 'Kitle', 'Bütçe (TL)', 'Format']
                      }
                      satirlar={adSetSatirlari}
                    />
                  </div>
                )}
              </div>
            )}

            {/* ── Görsel Brief sekmesi ── */}
            {aktifSekme === 'brief' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: C.text }}>
                      {aktifSohbet.kampanyaBilgileri?.platform === 'google' ? '📝 Reklam Metni Brief' : '🎨 Görsel Brief'}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: C.faint, marginTop: '2px' }}>{(aktifSohbet.gorselBrief?.length || 0)} kreatif</div>
                  </div>
                  <button onClick={briefExcelIndir} style={{
                    padding: '7px 14px', borderRadius: '8px', background: '#16A34A', color: '#fff',
                    border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: '6px'
                  }}>
                    📥 Excel İndir
                  </button>
                </div>

                {briefSatirlari.length > 0 ? (
                  <DataTablosu
                    basliklar={aktifSohbet.kampanyaBilgileri?.platform === 'google'
                      ? ['Kampanya', 'Format', 'Boyut', 'Süre', 'Başlıklar (RSA)', 'Açıklamalar', 'CTA', 'Notlar']
                      : ['Kampanya', 'Format', 'Boyut', 'Süre', 'Hook (İlk 3 sn)', 'Ana Mesaj', 'CTA', 'Notlar']
                    }
                    satirlar={briefSatirlari}
                  />
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px', color: C.faint, fontSize: '0.82rem' }}>
                    {aktifSohbet.kampanyaBilgileri?.platform === 'google' ? 'Reklam metni brief' : 'Görsel brief'} henüz hazır değil.<br />Sohbet sekmesinden devam et ve planı onayla.
                  </div>
                )}
              </div>
            )}

            {/* ── Kontrol Listesi sekmesi ── */}
            {aktifSekme === 'kontrol' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: C.text }}>✅ Kontrol Listesi</div>
                  <div style={{ fontSize: '0.68rem', color: C.faint, marginTop: '2px' }}>
                    {aktifSohbet.kampanyaBilgileri?.platform === 'google'
                      ? 'Kampanyayı yayına almadan önce kontrol edilmesi gereken teknik ve içerik adımları'
                      : 'Kampanyayı yayına almadan önce tamamlanması gereken adımlar'}
                  </div>
                </div>
                {aktifSohbet.kontrolListesi && aktifSohbet.kontrolListesi.length > 0 ? (() => {
                  const kategoriler = [...new Set(aktifSohbet.kontrolListesi!.map(m => m.kategori))]
                  return kategoriler.map(kat => (
                    <div key={kat} style={{ marginBottom: '16px' }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: C.primary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', paddingBottom: '4px', borderBottom: `2px solid ${C.primary}20` }}>
                        {kat}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {aktifSohbet.kontrolListesi!.filter(m => m.kategori === kat).map((madde, i) => (
                          <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '10px 12px', background: C.card, border: `1px solid ${C.border}`, borderRadius: '8px' }}>
                            <input type="checkbox" style={{ marginTop: '2px', flexShrink: 0, accentColor: C.primary, width: '15px', height: '15px', cursor: 'pointer' }} />
                            <div>
                              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: C.text, lineHeight: 1.4 }}>{madde.madde}</div>
                              {madde.aciklama && <div style={{ fontSize: '0.75rem', color: C.muted, marginTop: '3px', lineHeight: 1.5 }}>{madde.aciklama}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                })() : (
                  <div style={{ textAlign: 'center', padding: '40px', color: C.faint, fontSize: '0.82rem' }}>
                    Kontrol listesi henüz hazır değil.<br />Sohbet sekmesinde plan oluşturulunca burası dolacak.
                  </div>
                )}
              </div>
            )}

            {/* ── İş Takip sekmesi ── */}
            {aktifSekme === 'takip' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: C.text }}>📅 İş Takip Süreci</div>
                  <div style={{ fontSize: '0.68rem', color: C.faint, marginTop: '2px' }}>
                    {aktifSohbet.kampanyaBilgileri?.platform === 'google'
                      ? 'Kampanya sonrası Google Ads optimizasyon takvimi'
                      : 'Kampanya yayına girdikten sonra haftalık optimizasyon takvimi'}
                  </div>
                </div>
                {aktifSohbet.isTakipSureci && aktifSohbet.isTakipSureci.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {aktifSohbet.isTakipSureci.map((adim, i) => (
                      <div key={i} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                        {/* Zaman badge */}
                        <div style={{ flexShrink: 0, minWidth: '80px', textAlign: 'center' }}>
                          <div style={{ background: C.primary, color: '#fff', borderRadius: '8px', padding: '6px 8px', fontSize: '0.7rem', fontWeight: 700, lineHeight: 1.3 }}>
                            {adim.zaman}
                          </div>
                          {i < aktifSohbet.isTakipSureci!.length - 1 && (
                            <div style={{ width: '2px', height: '100%', background: C.border, margin: '6px auto 0', minHeight: '20px' }} />
                          )}
                        </div>
                        {/* İçerik */}
                        <div style={{ flex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '12px 14px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: adim.metrikler?.length ? '10px' : '0' }}>
                            {adim.gorevler.map((g, gi) => (
                              <div key={gi} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                <span style={{ color: C.primary, fontWeight: 700, flexShrink: 0, marginTop: '1px' }}>→</span>
                                <span style={{ fontSize: '0.85rem', color: C.text, lineHeight: 1.55 }}>{g}</span>
                              </div>
                            ))}
                          </div>
                          {adim.metrikler && adim.metrikler.length > 0 && (
                            <div style={{ borderTop: `1px solid ${C.borderLight}`, paddingTop: '8px' }}>
                              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '5px' }}>Takip Et</div>
                              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                {adim.metrikler.map((m, mi) => (
                                  <span key={mi} style={{ fontSize: '0.72rem', fontWeight: 600, color: C.primary, background: C.primary + '12', padding: '2px 8px', borderRadius: '10px' }}>{m}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px', color: C.faint, fontSize: '0.82rem' }}>
                    İş takip süreci henüz hazır değil.<br />Sohbet sekmesinde plan oluşturulunca burası dolacak.
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
        input[type="date"]::-webkit-calendar-picker-indicator { opacity: 0.5; cursor: pointer; }
      `}</style>
    </div>
  )
}
