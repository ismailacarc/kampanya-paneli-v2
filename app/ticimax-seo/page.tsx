'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import * as XLSX from 'xlsx'
import Sidebar from '../components/Sidebar'
import { C } from '../lib/theme'

function globalModelOku(): string {
  if (typeof window === 'undefined') return 'claude-sonnet-4-6'
  return localStorage.getItem('global_ai_model') || 'claude-sonnet-4-6'
}

// ─── Tipler ──────────────────────────────────────────────────────────────────
interface Urun {
  id: string
  urunAdi: string
  urunKodu: string
  satisFiyati: number
  stok: number
  seoBaslik: string
  seoAciklama: string
  aciklama: string
  resimUrl: string
  kategori: string
  aktif: boolean
  seoSkor: number
}

interface SeoOzeti {
  toplamUrun: number
  seoBaslikEksik: number
  seoAciklamaEksik: number
  dusukSkor: number
  ortSkor: number
}

interface AiSonuc {
  seoBaslik: string
  seoAciklama: string
  urunAciklama: string  // ürün için
  icerik: string        // kategori için (HTML)
  durum: 'bos' | 'yukleniyor' | 'hazir' | 'hata'
  hata?: string
}

interface Kategori {
  id: number
  pid: number
  tanim: string
  url: string
  aktif: boolean
  icerik: string
  seoBaslik: string
  seoAciklama: string
  seoAnahtarKelime: string
  altKategoriSayisi: number
  seoSkor: number
  seviye: number
}

interface KategoriSeoOzeti {
  toplamKategori: number
  aktifKategori: number
  seoBaslikEksik: number
  seoAciklamaEksik: number
  icerikEksik: number
  dusukSkor: number
  ortSkor: number
}

type Filtre = 'hepsi' | 'eksik' | 'zayif' | 'iyi' | 'ai_hazir'
type Sekme = 'urunler' | 'kategoriler' | 'blog'

interface BlogLink { url: string; aciklama: string }
interface BlogSonuc {
  ozet: string
  h1Baslik: string
  seoTitle: string
  seoDescription: string
  etiketler: string
  gorselAltEtiket: string
  onYazi: string
  htmlIcerik: string
}
interface BlogGecmisKayit {
  id: string
  tarih: string
  hesap: string
  baslik: string
  konu: string
  sonuc: BlogSonuc
}

const MARKA = {
  karmen: { ad: 'Karmen Halı', renk: '#C2410C', bg: '#FFF7ED' },
  cotto:  { ad: 'Cotto Home',  renk: '#0F4C81', bg: '#EFF6FF' },
}

// ─── Yardımcılar ─────────────────────────────────────────────────────────────
function SkorBadge({ skor }: { skor: number }) {
  const renk = skor >= 70 ? '#15803d' : skor >= 40 ? '#B45309' : '#DC2626'
  const bg   = skor >= 70 ? '#F0FDF4' : skor >= 40 ? '#FFFBEB' : '#FEF2F2'
  const etiket = skor >= 70 ? 'İyi' : skor >= 40 ? 'Zayıf' : 'Eksik'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
      <div style={{ flex: 1, background: C.borderLight, borderRadius: '3px', height: '6px', width: '50px', overflow: 'hidden' }}>
        <div style={{ width: `${skor}%`, height: '100%', background: renk, borderRadius: '3px', transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: '0.68rem', fontWeight: 700, color: renk, background: bg, padding: '1px 5px', borderRadius: '4px', minWidth: '34px', textAlign: 'center' }}>{etiket}</span>
    </div>
  )
}

// ─── Ana Sayfa ────────────────────────────────────────────────────────────────
export default function TicimaxSeoPage() {
  const [sekme, setSekme] = useState<Sekme>('urunler')
  const [hesap, setHesap] = useState<'karmen' | 'cotto'>('karmen')

  // Ürün state
  const [urunler, setUrunler] = useState<Urun[]>([])
  const [seoOzeti, setSeoOzeti] = useState<SeoOzeti | null>(null)
  const [yukleniyor, setYukleniyor] = useState(false)

  // Kategori state
  const [kategoriler, setKategoriler] = useState<Kategori[]>([])
  const [katSeoOzeti, setKatSeoOzeti] = useState<KategoriSeoOzeti | null>(null)
  const [katYukleniyor, setKatYukleniyor] = useState(false)
  const [katAiSonuclar, setKatAiSonuclar] = useState<Record<number, AiSonuc>>(() => {
    try { return JSON.parse(localStorage.getItem('ai_kat_karmen') || '{}') } catch { return {} }
  })
  const [katAiTs, setKatAiTs] = useState(() => {
    try { return localStorage.getItem('ai_kat_ts_karmen') || '' } catch { return '' }
  })
  const [katGenisletilmis, setKatGenisletilmis] = useState<Set<number>>(new Set())
  const [katSecilenler, setKatSecilenler] = useState<Set<number>>(new Set())
  const [katTopluCalisıyor, setKatTopluCalisıyor] = useState(false)
  const [katTopluIlerleme, setKatTopluIlerleme] = useState({ tamamlanan: 0, toplam: 0 })
  const [katGonderModal, setKatGonderModal] = useState(false)
  const [katGonderDurum, setKatGonderDurum] = useState<'bekliyor' | 'gonderiyor' | 'bitti'>('bekliyor')
  const [katGonderSonuc, setKatGonderSonuc] = useState<{ basarili: number; hatali: number } | null>(null)

  // ── Blog state (localStorage ile kalıcı) ─────────────────────────────────
  const [blogKonu, setBlogKonu] = useState(() => {
    try { return localStorage.getItem('blog_konu') || '' } catch { return '' }
  })
  const [blogAnahtar, setBlogAnahtar] = useState(() => {
    try { return localStorage.getItem('blog_anahtar') || '' } catch { return '' }
  })
  const [blogUzunluk, setBlogUzunluk] = useState<'kisa' | 'orta' | 'uzun'>(() => {
    try { return (localStorage.getItem('blog_uzunluk') as 'kisa' | 'orta' | 'uzun') || 'orta' } catch { return 'orta' }
  })
  const [blogLinkler, setBlogLinkler] = useState<BlogLink[]>(() => {
    try { return JSON.parse(localStorage.getItem('blog_linkler') || 'null') || [{ url: '', aciklama: '' }] } catch { return [{ url: '', aciklama: '' }] }
  })
  const [blogBasliklar, setBlogBasliklar] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('blog_basliklar') || '[]') } catch { return [] }
  })
  const [blogSeciliBaslik, setBlogSeciliBaslik] = useState(() => {
    try { return localStorage.getItem('blog_secili_baslik') || '' } catch { return '' }
  })
  const [blogSonuc, setBlogSonuc] = useState<BlogSonuc | null>(() => {
    try { return JSON.parse(localStorage.getItem('blog_sonuc') || 'null') } catch { return null }
  })
  const [blogAdim, setBlogAdim] = useState<'giris' | 'basliklar' | 'icerik' | 'sonuc'>(() => {
    try { return (localStorage.getItem('blog_adim') as 'giris' | 'basliklar' | 'icerik' | 'sonuc') || 'giris' } catch { return 'giris' }
  })
  const [blogYukleniyor, setBlogYukleniyor] = useState(false)
  const [blogHata, setBlogHata] = useState('')
  const [blogGecmis, setBlogGecmis] = useState<BlogGecmisKayit[]>(() => {
    try { return JSON.parse(localStorage.getItem('blog_gecmis') || '[]') } catch { return [] }
  })
  const [gecmisAcik, setGecmisAcik] = useState(false)

  // Blog state'i localStorage'a kaydet
  useEffect(() => { try { localStorage.setItem('blog_konu', blogKonu) } catch {} }, [blogKonu])
  useEffect(() => { try { localStorage.setItem('blog_anahtar', blogAnahtar) } catch {} }, [blogAnahtar])
  useEffect(() => { try { localStorage.setItem('blog_uzunluk', blogUzunluk) } catch {} }, [blogUzunluk])
  useEffect(() => { try { localStorage.setItem('blog_linkler', JSON.stringify(blogLinkler)) } catch {} }, [blogLinkler])
  useEffect(() => { try { localStorage.setItem('blog_basliklar', JSON.stringify(blogBasliklar)) } catch {} }, [blogBasliklar])
  useEffect(() => { try { localStorage.setItem('blog_secili_baslik', blogSeciliBaslik) } catch {} }, [blogSeciliBaslik])
  useEffect(() => { try { localStorage.setItem('blog_sonuc', JSON.stringify(blogSonuc)) } catch {} }, [blogSonuc])
  useEffect(() => { try { localStorage.setItem('blog_adim', blogAdim === 'icerik' ? 'basliklar' : blogAdim) } catch {} }, [blogAdim])
  useEffect(() => { try { localStorage.setItem('blog_gecmis', JSON.stringify(blogGecmis)) } catch {} }, [blogGecmis])

  // Filtre & arama
  const [filtre, setFiltre] = useState<Filtre>('hepsi')
  const [kategori, setKategori] = useState('')
  const [arama, setArama] = useState('')

  // AI hedef anahtar kelime (opsiyonel)
  const [hedefAnahtar, setHedefAnahtar] = useState('')

  // Seçim
  const [secilenler, setSecilenler] = useState<Set<string>>(new Set())

  // AI sonuçları (id → AiSonuc) — localStorage'dan yükle
  const [aiSonuclar, setAiSonuclar] = useState<Record<string, AiSonuc>>(() => {
    try { return JSON.parse(localStorage.getItem('ai_urun_karmen') || '{}') } catch { return {} }
  })
  const [aiUrunTs, setAiUrunTs] = useState(() => {
    try { return localStorage.getItem('ai_urun_ts_karmen') || '' } catch { return '' }
  })

  // Genişletilmiş satırlar
  const [genisletilmis, setGenisletilmis] = useState<Set<string>>(new Set())

  // Toplu AI ilerleme
  const [topluCalisıyor, setTopluCalisıyor] = useState(false)
  const [topluIlerleme, setTopluIlerleme] = useState({ tamamlanan: 0, toplam: 0 })

  // Onay modali
  const [gonderModal, setGonderModal] = useState(false)
  const [gonderDurum, setGonderDurum] = useState<'bekliyor' | 'gonderiyor' | 'bitti'>('bekliyor')
  const [gonderSonuc, setGonderSonuc] = useState<{ basarili: number; hatali: number } | null>(null)

  // AI sonuçları localStorage kayıt (hesap değişince doğru key'e yazsın diye ref kullanıyoruz)
  const hesapRef = useRef(hesap)
  useEffect(() => { hesapRef.current = hesap }, [hesap])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { try { localStorage.setItem(`ai_urun_${hesapRef.current}`, JSON.stringify(aiSonuclar)) } catch {} }, [aiSonuclar])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { try { localStorage.setItem(`ai_kat_${hesapRef.current}`, JSON.stringify(katAiSonuclar)) } catch {} }, [katAiSonuclar])

  // ── Hesap değişince ürün/kategori listesini sıfırla, AI sonuçlarını localStorage'dan yükle
  useEffect(() => {
    setUrunler([])
    setSeoOzeti(null)
    setSecilenler(new Set())
    setGenisletilmis(new Set())
    setFiltre('hepsi')
    setKategori('')
    setArama('')
    setKategoriler([])
    setKatSeoOzeti(null)
    setKatGenisletilmis(new Set())
    setKatSecilenler(new Set())
    try {
      setAiSonuclar(JSON.parse(localStorage.getItem(`ai_urun_${hesap}`) || '{}'))
      setAiUrunTs(localStorage.getItem(`ai_urun_ts_${hesap}`) || '')
      setKatAiSonuclar(JSON.parse(localStorage.getItem(`ai_kat_${hesap}`) || '{}'))
      setKatAiTs(localStorage.getItem(`ai_kat_ts_${hesap}`) || '')
    } catch {
      setAiSonuclar({})
      setAiUrunTs('')
      setKatAiSonuclar({})
      setKatAiTs('')
    }
  }, [hesap])

  // ── Ürün çek ─────────────────────────────────────────────────────────────
  async function urunleriCek() {
    setYukleniyor(true)
    try {
      const res = await fetch('/api/ticimax/urunler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hesap, tumunuCek: true }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setUrunler(data.urunler || [])
      setSeoOzeti(data.seoOzeti || null)
    } catch (e) {
      alert('Hata: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setYukleniyor(false)
    }
  }

  // ── Kategorileri çek ──────────────────────────────────────────────────────
  async function kategorileriCek() {
    setKatYukleniyor(true)
    try {
      const res = await fetch('/api/ticimax/kategoriler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hesap }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setKategoriler(data.kategoriler || [])
      setKatSeoOzeti(data.seoOzeti || null)
    } catch (e) {
      alert('Hata: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setKatYukleniyor(false)
    }
  }

  // ── Kategori AI üret ───────────────────────────────────────────────────────
  const tekKategoriAiUret = useCallback(async (kat: Kategori) => {
    const ustKat = kategoriler.find(k => k.id === kat.pid)
    setKatAiSonuclar(prev => ({ ...prev, [kat.id]: { seoBaslik: '', seoAciklama: '', urunAciklama: '', icerik: '', durum: 'yukleniyor' } }))
    setKatGenisletilmis(prev => new Set([...prev, kat.id]))
    try {
      const res = await fetch('/api/ticimax/seo-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hesap, tip: 'kategori', kategoriAdi: kat.tanim, ustKategoriAdi: ustKat?.tanim, hedefAnahtar: hedefAnahtar.trim() || undefined, model: globalModelOku() }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setKatAiSonuclar(prev => ({ ...prev, [kat.id]: { ...data, urunAciklama: '', durum: 'hazir' } }))
      const ts = new Date().toLocaleString('tr-TR')
      setKatAiTs(ts)
      try { localStorage.setItem(`ai_kat_ts_${hesap}`, ts) } catch {}
    } catch (e) {
      setKatAiSonuclar(prev => ({ ...prev, [kat.id]: { seoBaslik: '', seoAciklama: '', urunAciklama: '', icerik: '', durum: 'hata', hata: e instanceof Error ? e.message : String(e) } }))
    }
  }, [hesap, kategoriler])

  async function topluKategoriAiUret() {
    const seciliKatlar = kategoriler.filter(k => katSecilenler.has(k.id))
    if (!seciliKatlar.length) return
    setKatTopluCalisıyor(true)
    setKatTopluIlerleme({ tamamlanan: 0, toplam: seciliKatlar.length })
    for (let i = 0; i < seciliKatlar.length; i++) {
      await tekKategoriAiUret(seciliKatlar[i])
      setKatTopluIlerleme({ tamamlanan: i + 1, toplam: seciliKatlar.length })
    }
    setKatTopluCalisıyor(false)
  }

  function katAiAlaniGuncelle(id: number, alan: keyof AiSonuc, deger: string) {
    setKatAiSonuclar(prev => ({ ...prev, [id]: { ...prev[id], [alan]: deger } }))
  }

  async function ticimaxaKategoriGonder() {
    const gonderilenler = kategoriler
      .filter(k => katSecilenler.has(k.id) && katAiSonuclar[k.id]?.durum === 'hazir')
      .map(k => ({
        id: k.id,
        seoBaslik: katAiSonuclar[k.id].seoBaslik,
        seoAciklama: katAiSonuclar[k.id].seoAciklama,
        anahtarKelimeler: '',
        icerik: katAiSonuclar[k.id].icerik,
      }))
    if (!gonderilenler.length) { alert('Önce AI ile SEO üret.'); return }
    setKatGonderDurum('gonderiyor')
    try {
      const res = await fetch('/api/ticimax/guncelle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hesap, tip: 'kategori', kategoriler: gonderilenler }),
      })
      const data = await res.json()
      setKatGonderSonuc({ basarili: data.basarili, hatali: data.hatali })
      setKatGonderDurum('bitti')
    } catch (e) {
      alert('Gönderme hatası: ' + (e instanceof Error ? e.message : String(e)))
      setKatGonderDurum('bekliyor')
    }
  }

  function katExcelIndir() {
    const liste = katSecilenler.size > 0
      ? kategoriler.filter(k => katSecilenler.has(k.id))
      : kategoriler
    const satirlar = liste.map(k => {
      const ai = katAiSonuclar[k.id]
      return {
        'ID': k.id,
        'Üst ID': k.pid,
        'Kategori Adı': k.tanim,
        'URL': k.url,
        'Aktif': k.aktif ? 'Evet' : 'Hayır',
        'SEO Skoru': k.seoSkor,
        'Mevcut SEO Başlık': k.seoBaslik,
        'AI SEO Başlık': ai?.seoBaslik || '',
        'Mevcut Meta Açıklama': k.seoAciklama,
        'AI Meta Açıklama': ai?.seoAciklama || '',
        'AI Kategori İçeriği (HTML)': ai?.icerik || '',
      }
    })
    const ws = XLSX.utils.json_to_sheet(satirlar)
    ws['!cols'] = [{ wch: 6 }, { wch: 6 }, { wch: 20 }, { wch: 30 }, { wch: 6 }, { wch: 8 }, { wch: 40 }, { wch: 40 }, { wch: 50 }, { wch: 50 }, { wch: 80 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Kategori SEO')
    const marka = hesap === 'karmen' ? 'Karmen' : 'Cotto'
    XLSX.writeFile(wb, `${marka}_Kategori_SEO_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  // ── Blog fonksiyonları ────────────────────────────────────────────────────
  async function blogBasliklariGetir() {
    if (!blogKonu.trim() || !blogAnahtar.trim()) { setBlogHata('Konu ve anahtar kelime zorunludur.'); return }
    setBlogHata(''); setBlogYukleniyor(true)
    try {
      const res = await fetch('/api/ticimax/blog', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hesap, adim: 'basliklar', konu: blogKonu, anahtarKelime: blogAnahtar, model: globalModelOku() }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setBlogBasliklar(data.basliklar || [])
      setBlogSeciliBaslik(data.basliklar?.[0] || '')
      setBlogAdim('basliklar')
    } catch (e) { setBlogHata(e instanceof Error ? e.message : String(e)) }
    finally { setBlogYukleniyor(false) }
  }

  async function blogIcerikYaz() {
    if (!blogSeciliBaslik) { setBlogHata('Lütfen bir başlık seçin.'); return }
    setBlogHata(''); setBlogYukleniyor(true); setBlogAdim('icerik')
    try {
      const gecerliLinkler = blogLinkler.filter(l => l.url.trim())
      const res = await fetch('/api/ticimax/blog', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hesap, adim: 'icerik', konu: blogKonu, anahtarKelime: blogAnahtar, linkler: gecerliLinkler, uzunluk: blogUzunluk, seciliBaslik: blogSeciliBaslik, model: globalModelOku() }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setBlogSonuc(data)
      setBlogAdim('sonuc')
      // Geçmişe kaydet (en fazla 30 kayıt)
      const yeniKayit: BlogGecmisKayit = {
        id: Date.now().toString(),
        tarih: new Date().toLocaleString('tr-TR'),
        hesap,
        baslik: blogSeciliBaslik,
        konu: blogKonu,
        sonuc: data,
      }
      setBlogGecmis(prev => [yeniKayit, ...prev].slice(0, 30))
    } catch (e) { setBlogHata(e instanceof Error ? e.message : String(e)); setBlogAdim('basliklar') }
    finally { setBlogYukleniyor(false) }
  }

  function blogSifirla() {
    setBlogAdim('giris'); setBlogBasliklar([]); setBlogSonuc(null)
    setBlogSeciliBaslik(''); setBlogHata(''); setBlogKonu(''); setBlogAnahtar('')
    setBlogLinkler([{ url: '', aciklama: '' }]); setBlogUzunluk('orta')
    try {
      ['blog_konu','blog_anahtar','blog_uzunluk','blog_linkler','blog_basliklar','blog_secili_baslik','blog_sonuc','blog_adim'].forEach(k => localStorage.removeItem(k))
    } catch {}
  }

  function gecmisteYukle(kayit: BlogGecmisKayit) {
    setBlogSonuc(kayit.sonuc)
    setBlogSeciliBaslik(kayit.baslik)
    setBlogKonu(kayit.konu)
    setBlogAdim('sonuc')
    setGecmisAcik(false)
  }

  function gecmisSil(id: string) {
    setBlogGecmis(prev => prev.filter(k => k.id !== id))
  }

  function blogWordIndir() {
    if (!blogSonuc) return
    const markaAdi = hesap === 'karmen' ? 'Karmen Hali' : 'Cotto Home'
    const icerik = `Blog Başlığı (H1)\n${blogSonuc.h1Baslik}\n\nSEO Title\n${blogSonuc.seoTitle}\n\nSEO Description\n${blogSonuc.seoDescription}\n\nEtiketler\n${blogSonuc.etiketler}\n\nGörsel Alt Etiketi\n${blogSonuc.gorselAltEtiket}\n\nÖn Yazı (Excerpt)\n${blogSonuc.onYazi}\n\nStratejik Özet\n${blogSonuc.ozet}\n\nHTML İçerik\n${blogSonuc.htmlIcerik}`
    const blob = new Blob([icerik], { type: 'application/msword' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `${markaAdi}_Blog_${new Date().toISOString().slice(0, 10)}.doc`
    a.click(); URL.revokeObjectURL(url)
  }

  // ── Ürün kategorileri (dropdown için) ────────────────────────────────────
  const urunKategorileri = useMemo(() => {
    const set = new Set(urunler.map(u => u.kategori).filter(Boolean))
    return Array.from(set).sort()
  }, [urunler])

  // ── Filtrelenmiş ürünler ──────────────────────────────────────────────────
  const filtrelenmis = useMemo(() => {
    let list = urunler
    if (filtre === 'eksik')    list = list.filter(u => !u.seoBaslik || !u.seoAciklama)
    if (filtre === 'zayif')    list = list.filter(u => u.seoSkor > 0 && u.seoSkor < 50)
    if (filtre === 'iyi')      list = list.filter(u => u.seoSkor >= 70)
    if (filtre === 'ai_hazir') list = list.filter(u => aiSonuclar[u.id]?.durum === 'hazir')
    if (kategori)              list = list.filter(u => u.kategori === kategori)
    if (arama)                 list = list.filter(u => u.urunAdi.toLowerCase().includes(arama.toLowerCase()))
    return list
  }, [urunler, filtre, kategori, arama, aiSonuclar])

  // ── Seçim yönetimi ────────────────────────────────────────────────────────
  function secimToggle(id: string) {
    setSecilenler(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function tumunuSec() {
    const filtrelenmisIds = filtrelenmis.map(u => u.id)
    const hepsiSecili = filtrelenmisIds.every(id => secilenler.has(id))
    if (hepsiSecili) setSecilenler(new Set())
    else setSecilenler(new Set(filtrelenmisIds))
  }

  // ── Satır genişlet/daralt ─────────────────────────────────────────────────
  function genisletToggle(id: string) {
    setGenisletilmis(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // ── AI alanı güncelle (kullanıcı düzenleme) ───────────────────────────────
  function aiAlaniGuncelle(id: string, alan: keyof AiSonuc, deger: string) {
    setAiSonuclar(prev => ({
      ...prev,
      [id]: { ...prev[id], [alan]: deger },
    }))
  }

  // ── Tek ürün AI üret ──────────────────────────────────────────────────────
  const tekUrunAiUret = useCallback(async (urun: Urun) => {
    setAiSonuclar(prev => ({ ...prev, [urun.id]: { seoBaslik: '', seoAciklama: '', urunAciklama: '', icerik: '', durum: 'yukleniyor' } }))
    setGenisletilmis(prev => new Set([...prev, urun.id]))
    try {
      const res = await fetch('/api/ticimax/seo-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hesap, urunAdi: urun.urunAdi, kategori: urun.kategori, hedefAnahtar: hedefAnahtar.trim() || undefined, model: globalModelOku() }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setAiSonuclar(prev => ({ ...prev, [urun.id]: { ...data, icerik: '', durum: 'hazir' } }))
      const ts = new Date().toLocaleString('tr-TR')
      setAiUrunTs(ts)
      try { localStorage.setItem(`ai_urun_ts_${hesap}`, ts) } catch {}
    } catch (e) {
      setAiSonuclar(prev => ({ ...prev, [urun.id]: { seoBaslik: '', seoAciklama: '', urunAciklama: '', icerik: '', durum: 'hata', hata: e instanceof Error ? e.message : String(e) } }))
    }
  }, [hesap])

  // ── Toplu AI üret ─────────────────────────────────────────────────────────
  async function topluAiUret() {
    const seciliUrunler = urunler.filter(u => secilenler.has(u.id))
    if (seciliUrunler.length === 0) return

    setTopluCalisıyor(true)
    setTopluIlerleme({ tamamlanan: 0, toplam: seciliUrunler.length })

    for (let i = 0; i < seciliUrunler.length; i++) {
      await tekUrunAiUret(seciliUrunler[i])
      setTopluIlerleme({ tamamlanan: i + 1, toplam: seciliUrunler.length })
    }

    setTopluCalisıyor(false)
  }

  // ── Excel indir ───────────────────────────────────────────────────────────
  function excelIndir(sadeceSecliler = false) {
    const liste = sadeceSecliler
      ? urunler.filter(u => secilenler.has(u.id))
      : filtrelenmis

    const satirlar = liste.map(u => {
      const ai = aiSonuclar[u.id]
      return {
        'ID': u.id,
        'Ürün Adı': u.urunAdi,
        'Kategori': u.kategori,
        'Stok': u.stok,
        'SEO Skoru': u.seoSkor,
        'Mevcut SEO Başlık': u.seoBaslik,
        'AI SEO Başlık': ai?.seoBaslik || '',
        'Mevcut Meta Açıklama': u.seoAciklama,
        'AI Meta Açıklama': ai?.seoAciklama || '',
        'Mevcut Açıklama': u.aciklama,
        'AI Ürün Açıklaması': ai?.urunAciklama || '',
      }
    })

    const ws = XLSX.utils.json_to_sheet(satirlar)
    ws['!cols'] = [
      { wch: 8 }, { wch: 30 }, { wch: 14 }, { wch: 6 }, { wch: 8 },
      { wch: 40 }, { wch: 40 }, { wch: 50 }, { wch: 50 },
      { wch: 60 }, { wch: 60 },
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'SEO Verileri')
    const marka = hesap === 'karmen' ? 'Karmen' : 'Cotto'
    XLSX.writeFile(wb, `${marka}_SEO_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  // ── Ticimax'a gönder ──────────────────────────────────────────────────────
  async function ticimaxaGonder() {
    const gonderilenler = urunler
      .filter(u => secilenler.has(u.id) && aiSonuclar[u.id]?.durum === 'hazir')
      .map(u => ({
        id: u.id,
        seoBaslik: aiSonuclar[u.id].seoBaslik,
        seoAciklama: aiSonuclar[u.id].seoAciklama,
        anahtarKelimeler: '',
        urunAciklama: aiSonuclar[u.id].urunAciklama,
      }))

    if (gonderilenler.length === 0) {
      alert('Göndermek için önce AI ile SEO üret.')
      return
    }

    setGonderDurum('gonderiyor')
    try {
      const res = await fetch('/api/ticimax/guncelle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hesap, urunler: gonderilenler }),
      })
      const data = await res.json()
      setGonderSonuc({ basarili: data.basarili, hatali: data.hatali })
      setGonderDurum('bitti')
    } catch (e) {
      alert('Gönderme hatası: ' + (e instanceof Error ? e.message : String(e)))
      setGonderDurum('bekliyor')
    }
  }

  // ── AI hazır seçili sayılar ───────────────────────────────────────────────
  const aiHazirSecili = urunler.filter(u => secilenler.has(u.id) && aiSonuclar[u.id]?.durum === 'hazir').length
  const katAiHazirSecili = kategoriler.filter(k => katSecilenler.has(k.id) && katAiSonuclar[k.id]?.durum === 'hazir').length
  const marka = MARKA[hesap]

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg, fontFamily: 'system-ui, sans-serif' }}>
      <Sidebar />
      <div style={{ flex: 1, marginLeft: '220px', padding: '28px 32px', minWidth: 0 }}>

        {/* ── Başlık ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: C.text, margin: 0 }}>🛒 Ticimax SEO Yönetimi</h1>
            <p style={{ fontSize: '0.78rem', color: C.muted, margin: '4px 0 0' }}>Ürün ve kategori SEO içeriklerini görüntüle, AI ile üret ve Ticimax&apos;a gönder</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {(['karmen', 'cotto'] as const).map(h => (
              <button key={h} onClick={() => setHesap(h)} style={{
                padding: '8px 16px', borderRadius: '8px', border: `1.5px solid ${hesap === h ? MARKA[h].renk : C.border}`,
                background: hesap === h ? MARKA[h].bg : '#fff', color: hesap === h ? MARKA[h].renk : C.muted,
                fontWeight: hesap === h ? 700 : 400, cursor: 'pointer', fontSize: '0.82rem',
              }}>
                {MARKA[h].ad}
              </button>
            ))}
          </div>
        </div>

        {/* ── Sekme Toggle ── */}
        <div style={{ display: 'flex', marginBottom: '20px', background: C.card, borderRadius: '10px', border: `1px solid ${C.border}`, padding: '4px', width: 'fit-content' }}>
          {([
            { id: 'urunler' as Sekme, label: '📦 Ürünler', sayac: urunler.length },
            { id: 'kategoriler' as Sekme, label: '🗂 Kategoriler', sayac: kategoriler.length },
            { id: 'blog' as Sekme, label: '📝 Blog Yazısı', sayac: 0 },
          ]).map(s => (
            <button key={s.id} onClick={() => setSekme(s.id)} style={{
              padding: '7px 20px', borderRadius: '7px', border: 'none', cursor: 'pointer',
              background: sekme === s.id ? marka.renk : 'transparent',
              color: sekme === s.id ? '#fff' : C.muted,
              fontWeight: sekme === s.id ? 700 : 400, fontSize: '0.82rem', transition: 'all 0.15s',
            }}>
              {s.label}{s.sayac > 0 && <span style={{ fontSize: '0.7rem', opacity: 0.8, marginLeft: '4px' }}>({s.sayac})</span>}
            </button>
          ))}
        </div>

        {/* ══ ÜRÜNLER SEKMESİ ══ */}
        {sekme === 'urunler' && (
          <>
            {urunler.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px 0' }}>
                <div style={{ fontSize: '3rem', marginBottom: '12px' }}>📦</div>
                <div style={{ fontSize: '1rem', fontWeight: 600, color: C.text, marginBottom: '6px' }}>{marka.ad} ürünleri yükle</div>
                <div style={{ fontSize: '0.82rem', color: C.muted, marginBottom: '20px' }}>Ticimax&apos;tan tüm aktif ürünler ve SEO durumları çekilecek</div>
                <button onClick={urunleriCek} disabled={yukleniyor} style={{
                  padding: '10px 28px', borderRadius: '8px', background: marka.renk, color: '#fff',
                  border: 'none', fontWeight: 700, cursor: yukleniyor ? 'wait' : 'pointer', fontSize: '0.88rem',
                }}>
                  {yukleniyor ? '⏳ Yükleniyor...' : '⬇ Ürünleri Çek'}
                </button>
              </div>
            )}

            {urunler.length > 0 && (
              <>
                {seoOzeti && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
                    {[
                      { label: 'Toplam Ürün', deger: seoOzeti.toplamUrun, renk: C.primary, ikon: '📦' },
                      { label: 'SEO Başlık Eksik', deger: seoOzeti.seoBaslikEksik, renk: '#DC2626', ikon: '❌' },
                      { label: 'Meta Açıklama Eksik', deger: seoOzeti.seoAciklamaEksik, renk: '#DC2626', ikon: '❌' },
                      { label: 'Ortalama SEO Skoru', deger: `${seoOzeti.ortSkor}/100`, renk: seoOzeti.ortSkor >= 70 ? '#15803d' : '#DC2626', ikon: '📊' },
                    ].map((k, i) => (
                      <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '14px 16px' }}>
                        <div style={{ fontSize: '0.68rem', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>{k.ikon} {k.label}</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: k.renk }}>{k.deger}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Filtre + Hedef Anahtar Kelime */}
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '12px 16px', marginBottom: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {([
                    { id: 'hepsi', label: `Tümü (${urunler.length})` },
                    { id: 'eksik', label: `Başlık/Desc Eksik (${urunler.filter(u => !u.seoBaslik || !u.seoAciklama).length})` },
                    { id: 'zayif', label: `Zayıf (${urunler.filter(u => u.seoSkor > 0 && u.seoSkor < 50).length})` },
                    { id: 'iyi',   label: `İyi (${urunler.filter(u => u.seoSkor >= 70).length})` },
                    { id: 'ai_hazir', label: `AI Hazır (${Object.values(aiSonuclar).filter(a => a.durum === 'hazir').length})` },
                  ] as { id: Filtre; label: string }[]).map(f => (
                    <button key={f.id} onClick={() => setFiltre(f.id)} style={{
                      padding: '5px 12px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: filtre === f.id ? 700 : 400,
                      border: `1px solid ${filtre === f.id ? marka.renk : C.border}`,
                      background: filtre === f.id ? marka.bg : 'transparent',
                      color: filtre === f.id ? marka.renk : C.muted, cursor: 'pointer',
                    }}>
                      {f.label}
                    </button>
                  ))}
                  <div style={{ width: '1px', height: '20px', background: C.border }} />
                  <select value={kategori} onChange={e => setKategori(e.target.value)} style={{
                    padding: '5px 10px', borderRadius: '6px', border: `1px solid ${C.border}`,
                    fontSize: '0.75rem', color: C.text, background: '#fff', cursor: 'pointer',
                  }}>
                    <option value=''>Tüm Kategoriler</option>
                    {urunKategorileri.map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                  <input value={arama} onChange={e => setArama(e.target.value)} placeholder='Ürün ara...' style={{
                    padding: '5px 10px', borderRadius: '6px', border: `1px solid ${C.border}`,
                    fontSize: '0.75rem', color: C.text, width: '140px', outline: 'none',
                  }} />
                  <div style={{ flex: 1 }} />
                  {aiUrunTs && <span style={{ fontSize: '0.68rem', color: C.faint }}>AI: {aiUrunTs}</span>}
                  {Object.values(aiSonuclar).some(a => a.durum === 'hazir') && (
                    <button onClick={() => {
                      setAiSonuclar({})
                      setAiUrunTs('')
                      try { localStorage.removeItem(`ai_urun_${hesap}`); localStorage.removeItem(`ai_urun_ts_${hesap}`) } catch {}
                    }} style={{ padding: '5px 10px', borderRadius: '6px', border: `1px solid #FCA5A5`, fontSize: '0.72rem', cursor: 'pointer', background: '#FEF2F2', color: '#DC2626', fontWeight: 600 }}>
                      🗑 AI Temizle
                    </button>
                  )}
                  <button onClick={() => excelIndir(false)} style={{ padding: '5px 14px', borderRadius: '6px', border: `1px solid ${C.border}`, fontSize: '0.75rem', cursor: 'pointer', background: '#fff', color: C.text, fontWeight: 600 }}>
                    ⬇ Excel ({filtrelenmis.length})
                  </button>
                  <button onClick={urunleriCek} disabled={yukleniyor} style={{ padding: '5px 12px', borderRadius: '6px', border: `1px solid ${C.border}`, fontSize: '0.75rem', cursor: 'pointer', background: '#fff', color: C.muted }}>
                    {yukleniyor ? '⏳' : '🔄'}
                  </button>
                </div>


                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '10px', overflow: 'hidden', marginBottom: secilenler.size > 0 ? '80px' : '0' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '36px 44px 1fr 100px 60px 130px 80px', gap: '0', background: C.tableHead, borderBottom: `1px solid ${C.border}`, padding: '8px 14px', fontSize: '0.68rem', fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <input type='checkbox' checked={filtrelenmis.length > 0 && filtrelenmis.every(u => secilenler.has(u.id))} onChange={tumunuSec} style={{ cursor: 'pointer' }} />
                    </div>
                    <div></div>
                    <div>Ürün Adı</div><div>Kategori</div><div>Stok</div><div>SEO Durumu</div><div>İşlem</div>
                  </div>

                  {filtrelenmis.length === 0 && (
                    <div style={{ padding: '40px', textAlign: 'center', color: C.muted, fontSize: '0.82rem' }}>Bu kriterlere uygun ürün bulunamadı.</div>
                  )}

                  {filtrelenmis.map(urun => {
                    const secili = secilenler.has(urun.id)
                    const genisletildi = genisletilmis.has(urun.id)
                    const ai = aiSonuclar[urun.id]
                    return (
                      <div key={urun.id}>
                        <div style={{ display: 'grid', gridTemplateColumns: '36px 44px 1fr 100px 60px 130px 80px', gap: '0', padding: '8px 14px', borderBottom: `1px solid ${C.borderLight}`, background: secili ? marka.bg : genisletildi ? '#FAFBFC' : '#fff', cursor: 'pointer', transition: 'background 0.1s', alignItems: 'center' }}>
                          <div onClick={e => e.stopPropagation()}>
                            <input type='checkbox' checked={secili} onChange={() => secimToggle(urun.id)} style={{ cursor: 'pointer' }} />
                          </div>
                          {/* Ürün görseli */}
                          <div onClick={() => genisletToggle(urun.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {urun.resimUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={urun.resimUrl} alt={urun.urunAdi} style={{ width: '36px', height: '36px', objectFit: 'cover', borderRadius: '6px', border: `1px solid ${C.borderLight}` }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                            ) : (
                              <div style={{ width: '36px', height: '36px', background: C.borderLight, borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>🖼</div>
                            )}
                          </div>
                          <div onClick={() => genisletToggle(urun.id)}>
                            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: C.text, lineHeight: 1.3 }}>{urun.urunAdi}</div>
                            <div style={{ fontSize: '0.68rem', color: C.faint, marginTop: '1px' }}>{urun.urunKodu}</div>
                            {ai?.durum === 'hazir' && <div style={{ fontSize: '0.68rem', color: '#15803d', marginTop: '2px' }}>✅ AI SEO hazır</div>}
                            {ai?.durum === 'hata' && <div style={{ fontSize: '0.68rem', color: '#DC2626', marginTop: '2px' }}>❌ {ai.hata}</div>}
                          </div>
                          <div onClick={() => genisletToggle(urun.id)} style={{ fontSize: '0.75rem', color: C.muted }}>{urun.kategori || '—'}</div>
                          <div onClick={() => genisletToggle(urun.id)} style={{ fontSize: '0.75rem', color: C.text }}>{urun.stok}</div>
                          <div onClick={() => genisletToggle(urun.id)}><SkorBadge skor={urun.seoSkor} /></div>
                          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                            {ai?.durum === 'yukleniyor' ? <span style={{ fontSize: '0.72rem', color: C.muted }}>⏳</span> : (
                              <button onClick={e => { e.stopPropagation(); tekUrunAiUret(urun) }} style={{ padding: '4px 8px', borderRadius: '5px', fontSize: '0.7rem', fontWeight: 600, border: `1px solid ${ai?.durum === 'hazir' ? '#86efac' : marka.renk + '60'}`, background: ai?.durum === 'hazir' ? '#F0FDF4' : marka.bg, color: ai?.durum === 'hazir' ? '#15803d' : marka.renk, cursor: 'pointer' }}>
                                {ai?.durum === 'hazir' ? '✅ AI' : '✨ AI'}
                              </button>
                            )}
                            <button onClick={e => { e.stopPropagation(); genisletToggle(urun.id) }} style={{ padding: '4px 6px', borderRadius: '5px', border: `1px solid ${C.border}`, background: '#fff', color: C.muted, cursor: 'pointer', fontSize: '0.7rem' }}>{genisletildi ? '▲' : '▼'}</button>
                          </div>
                        </div>

                        {genisletildi && (
                          <div style={{ background: '#F8FAFC', borderBottom: `1px solid ${C.border}`, padding: '16px 20px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: urun.resimUrl ? '120px 1fr 1fr' : '1fr 1fr', gap: '16px' }}>
                              {/* Ürün görseli (büyük) */}
                              {urun.resimUrl && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={urun.resimUrl} alt={urun.urunAdi} style={{ width: '110px', height: '110px', objectFit: 'cover', borderRadius: '8px', border: `1px solid ${C.border}` }} onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = 'none' }} />
                                  <div style={{ fontSize: '0.68rem', color: C.faint, textAlign: 'center' }}>{urun.satisFiyati > 0 ? `${urun.satisFiyati.toLocaleString('tr-TR')} ₺` : ''}</div>
                                </div>
                              )}
                              {/* Mevcut SEO */}
                              <div>
                                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Mevcut SEO (Ticimax&apos;taki)</div>
                                <div style={{ fontSize: '0.75rem', color: C.text, marginBottom: '4px' }}><strong>Başlık:</strong> {urun.seoBaslik || <em style={{ color: C.faint }}>Boş</em>}</div>
                                <div style={{ fontSize: '0.75rem', color: C.text, marginBottom: '4px' }}><strong>Açıklama:</strong> {urun.seoAciklama || <em style={{ color: C.faint }}>Boş</em>}</div>
                                {urun.aciklama && (
                                  <div style={{ marginTop: '8px' }}>
                                    <div style={{ fontSize: '0.68rem', fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Mevcut Ürün Açıklaması</div>
                                    <div style={{ fontSize: '0.7rem', color: C.muted, background: C.bg, padding: '6px 8px', borderRadius: '5px', maxHeight: '80px', overflow: 'hidden', lineHeight: 1.5 }}
                                      dangerouslySetInnerHTML={{ __html: urun.aciklama.slice(0, 400) + (urun.aciklama.length > 400 ? '...' : '') }}
                                    />
                                  </div>
                                )}
                              </div>
                              {/* AI üretim alanı */}
                              <div>
                                <div style={{ marginBottom: '8px' }}>
                                  <div style={{ fontSize: '0.68rem', fontWeight: 700, color: marka.renk, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>{ai?.durum === 'hazir' ? '✅ AI Üretilen (düzenlenebilir)' : '✨ AI ile Üret'}</div>
                                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                    <input
                                      value={hedefAnahtar}
                                      onChange={e => setHedefAnahtar(e.target.value)}
                                      placeholder='🎯 Hedef anahtar kelime (opsiyonel)'
                                      style={{ flex: 1, padding: '5px 8px', borderRadius: '5px', border: `1px solid ${hedefAnahtar ? marka.renk + '80' : C.border}`, fontSize: '0.72rem', color: C.text, outline: 'none', background: hedefAnahtar ? marka.bg : '#fff' }}
                                    />
                                    {ai?.durum !== 'yukleniyor' && (
                                      <button onClick={() => tekUrunAiUret(urun)} style={{ padding: '5px 12px', borderRadius: '5px', fontSize: '0.7rem', fontWeight: 600, border: `1px solid ${marka.renk}`, background: marka.bg, color: marka.renk, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                        {ai?.durum === 'hazir' ? '🔄 Yenile' : '✨ AI ile Yaz'}
                                      </button>
                                    )}
                                  </div>
                                </div>
                                {ai?.durum === 'yukleniyor' && <div style={{ fontSize: '0.78rem', color: C.muted, padding: '16px 0' }}>⏳ AI içerik üretiyor...</div>}
                                {(ai?.durum === 'hazir' || ai?.durum === 'hata') && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div>
                                      <label style={{ fontSize: '0.68rem', color: C.muted, display: 'block', marginBottom: '3px' }}>SEO Başlık ({(ai.seoBaslik || '').length}/60 kar)</label>
                                      <input value={ai.seoBaslik || ''} onChange={e => aiAlaniGuncelle(urun.id, 'seoBaslik', e.target.value)} maxLength={60} style={{ width: '100%', padding: '5px 8px', borderRadius: '5px', border: `1px solid ${(ai.seoBaslik || '').length > 60 ? '#FCA5A5' : C.border}`, fontSize: '0.78rem', color: C.text, boxSizing: 'border-box' }} />
                                    </div>
                                    <div>
                                      <label style={{ fontSize: '0.68rem', color: C.muted, display: 'block', marginBottom: '3px' }}>Meta Açıklama ({(ai.seoAciklama || '').length}/155 kar)</label>
                                      <textarea value={ai.seoAciklama || ''} onChange={e => aiAlaniGuncelle(urun.id, 'seoAciklama', e.target.value)} maxLength={155} rows={2} style={{ width: '100%', padding: '5px 8px', borderRadius: '5px', border: `1px solid ${(ai.seoAciklama || '').length > 155 ? '#FCA5A5' : C.border}`, fontSize: '0.75rem', color: C.text, resize: 'vertical', boxSizing: 'border-box' }} />
                                    </div>
                                    <div>
                                      <label style={{ fontSize: '0.68rem', color: C.muted, display: 'block', marginBottom: '3px' }}>Ürün Açıklaması</label>
                                      <textarea value={ai.urunAciklama || ''} onChange={e => aiAlaniGuncelle(urun.id, 'urunAciklama', e.target.value)} rows={3} style={{ width: '100%', padding: '5px 8px', borderRadius: '5px', border: `1px solid ${C.border}`, fontSize: '0.75rem', color: C.text, resize: 'vertical', boxSizing: 'border-box' }} />
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {secilenler.size > 0 && (
                  <div style={{ position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)', background: '#1F2937', borderRadius: '12px', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.25)', zIndex: 200, whiteSpace: 'nowrap' }}>
                    <span style={{ color: '#fff', fontSize: '0.82rem', fontWeight: 700 }}>{secilenler.size} ürün seçildi</span>
                    <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.2)' }} />
                    {topluCalisıyor ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '120px', height: '6px', background: 'rgba(255,255,255,0.2)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${(topluIlerleme.tamamlanan / topluIlerleme.toplam) * 100}%`, height: '100%', background: '#34D399', borderRadius: '3px', transition: 'width 0.3s' }} />
                        </div>
                        <span style={{ color: '#34D399', fontSize: '0.75rem', fontWeight: 700 }}>{topluIlerleme.tamamlanan}/{topluIlerleme.toplam}</span>
                      </div>
                    ) : (
                      <button onClick={topluAiUret} style={{ padding: '7px 16px', borderRadius: '8px', background: '#6366F1', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}>✨ AI ile SEO Yaz</button>
                    )}
                    <button onClick={() => excelIndir(true)} style={{ padding: '7px 14px', borderRadius: '8px', background: '#065F46', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}>⬇ Excel</button>
                    {aiHazirSecili > 0 && (
                      <button onClick={() => { setGonderModal(true); setGonderDurum('bekliyor'); setGonderSonuc(null) }} style={{ padding: '7px 14px', borderRadius: '8px', background: '#15803d', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}>
                        ✅ Ticimax&apos;a Gönder ({aiHazirSecili})
                      </button>
                    )}
                    <button onClick={() => setSecilenler(new Set())} style={{ padding: '7px 10px', borderRadius: '8px', background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', border: 'none', cursor: 'pointer', fontSize: '0.8rem' }}>✕</button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ══ KATEGORİLER SEKMESİ ══ */}
        {sekme === 'kategoriler' && (
          <>
            {kategoriler.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px 0' }}>
                <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🗂</div>
                <div style={{ fontSize: '1rem', fontWeight: 600, color: C.text, marginBottom: '6px' }}>{marka.ad} kategorileri yükle</div>
                <div style={{ fontSize: '0.82rem', color: C.muted, marginBottom: '20px' }}>Ticimax&apos;tan tüm kategoriler ve SEO durumları çekilecek</div>
                <button onClick={kategorileriCek} disabled={katYukleniyor} style={{
                  padding: '10px 28px', borderRadius: '8px', background: marka.renk, color: '#fff',
                  border: 'none', fontWeight: 700, cursor: katYukleniyor ? 'wait' : 'pointer', fontSize: '0.88rem',
                }}>
                  {katYukleniyor ? '⏳ Yükleniyor...' : '⬇ Kategorileri Çek'}
                </button>
              </div>
            )}

            {kategoriler.length > 0 && (
              <>
                {katSeoOzeti && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
                    {[
                      { label: 'Toplam Kategori', deger: katSeoOzeti.toplamKategori, renk: C.primary, ikon: '🗂' },
                      { label: 'Aktif Kategori', deger: katSeoOzeti.aktifKategori, renk: '#15803d', ikon: '✅' },
                      { label: 'SEO Başlık Eksik', deger: katSeoOzeti.seoBaslikEksik, renk: '#DC2626', ikon: '❌' },
                      { label: 'Ortalama SEO Skoru', deger: `${katSeoOzeti.ortSkor}/100`, renk: katSeoOzeti.ortSkor >= 70 ? '#15803d' : '#DC2626', ikon: '📊' },
                    ].map((k, i) => (
                      <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '14px 16px' }}>
                        <div style={{ fontSize: '0.68rem', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>{k.ikon} {k.label}</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: k.renk }}>{k.deger}</div>
                      </div>
                    ))}
                  </div>
                )}


                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '12px 16px', marginBottom: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <button onClick={() => {
                    const hepsiSecili = kategoriler.every(k => katSecilenler.has(k.id))
                    setKatSecilenler(hepsiSecili ? new Set() : new Set(kategoriler.map(k => k.id)))
                  }} style={{ padding: '5px 12px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, border: `1px solid ${C.border}`, background: '#fff', color: C.muted, cursor: 'pointer' }}>
                    {kategoriler.every(k => katSecilenler.has(k.id)) ? '☑ Tümünü Kaldır' : '☐ Tümünü Seç'}
                  </button>
                  <div style={{ width: '1px', height: '20px', background: C.border }} />
                  <button onClick={() => setKatSecilenler(new Set(kategoriler.filter(k => !k.seoBaslik || !k.seoAciklama).map(k => k.id)))} style={{ padding: '5px 12px', borderRadius: '6px', fontSize: '0.75rem', border: `1px solid ${C.border}`, background: '#fff', color: C.muted, cursor: 'pointer' }}>
                    SEO Eksikleri Seç ({kategoriler.filter(k => !k.seoBaslik || !k.seoAciklama).length})
                  </button>
                  <div style={{ flex: 1 }} />
                  {katAiTs && <span style={{ fontSize: '0.68rem', color: C.faint }}>AI: {katAiTs}</span>}
                  {Object.values(katAiSonuclar).some(a => a.durum === 'hazir') && (
                    <button onClick={() => {
                      setKatAiSonuclar({})
                      setKatAiTs('')
                      try { localStorage.removeItem(`ai_kat_${hesap}`); localStorage.removeItem(`ai_kat_ts_${hesap}`) } catch {}
                    }} style={{ padding: '5px 10px', borderRadius: '6px', border: `1px solid #FCA5A5`, fontSize: '0.72rem', cursor: 'pointer', background: '#FEF2F2', color: '#DC2626', fontWeight: 600 }}>
                      🗑 AI Temizle
                    </button>
                  )}
                  <button onClick={katExcelIndir} style={{ padding: '5px 14px', borderRadius: '6px', border: `1px solid ${C.border}`, fontSize: '0.75rem', cursor: 'pointer', background: '#fff', color: C.text, fontWeight: 600 }}>
                    ⬇ Excel ({katSecilenler.size > 0 ? katSecilenler.size : kategoriler.length})
                  </button>
                  <button onClick={kategorileriCek} disabled={katYukleniyor} style={{ padding: '5px 12px', borderRadius: '6px', border: `1px solid ${C.border}`, fontSize: '0.75rem', cursor: 'pointer', background: '#fff', color: C.muted }}>
                    {katYukleniyor ? '⏳' : '🔄'}
                  </button>
                </div>

                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '10px', overflow: 'hidden', marginBottom: katSecilenler.size > 0 ? '80px' : '0' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 80px 70px 130px 80px', gap: '0', background: C.tableHead, borderBottom: `1px solid ${C.border}`, padding: '8px 14px', fontSize: '0.68rem', fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <div /><div>Kategori Adı</div><div>Seviye</div><div>Aktif</div><div>SEO Durumu</div><div>İşlem</div>
                  </div>

                  {kategoriler.map(kat => {
                    const katSecili = katSecilenler.has(kat.id)
                    const katGenisletildi = katGenisletilmis.has(kat.id)
                    const katAi = katAiSonuclar[kat.id]
                    const toggleKatGenislet = () => setKatGenisletilmis(prev => { const next = new Set(prev); next.has(kat.id) ? next.delete(kat.id) : next.add(kat.id); return next })
                    return (
                      <div key={kat.id}>
                        <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 80px 70px 130px 80px', gap: '0', padding: '10px 14px', borderBottom: `1px solid ${C.borderLight}`, background: katSecili ? marka.bg : katGenisletildi ? '#FAFBFC' : '#fff', cursor: 'pointer', transition: 'background 0.1s', alignItems: 'center' }}>
                          <div onClick={e => e.stopPropagation()}>
                            <input type='checkbox' checked={katSecili} onChange={() => setKatSecilenler(prev => { const next = new Set(prev); next.has(kat.id) ? next.delete(kat.id) : next.add(kat.id); return next })} style={{ cursor: 'pointer' }} />
                          </div>
                          <div onClick={toggleKatGenislet}>
                            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: C.text, paddingLeft: `${kat.seviye * 14}px` }}>
                              {kat.seviye > 0 && <span style={{ color: C.faint, marginRight: '4px', fontFamily: 'monospace' }}>{'└'}</span>}
                              {kat.tanim}
                            </div>
                            {katAi?.durum === 'hazir' && <div style={{ fontSize: '0.68rem', color: '#15803d', marginTop: '2px', paddingLeft: `${kat.seviye * 14}px` }}>✅ AI SEO hazır</div>}
                            {katAi?.durum === 'hata' && <div style={{ fontSize: '0.68rem', color: '#DC2626', marginTop: '2px', paddingLeft: `${kat.seviye * 14}px` }}>❌ {katAi.hata}</div>}
                          </div>
                          <div onClick={toggleKatGenislet} style={{ fontSize: '0.72rem', color: C.muted }}>{kat.seviye === 0 ? 'Kök' : `Seviye ${kat.seviye}`}</div>
                          <div onClick={toggleKatGenislet}>
                            <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px', background: kat.aktif ? '#F0FDF4' : '#FEF2F2', color: kat.aktif ? '#15803d' : '#DC2626', fontWeight: 600 }}>
                              {kat.aktif ? 'Aktif' : 'Pasif'}
                            </span>
                          </div>
                          <div onClick={toggleKatGenislet}><SkorBadge skor={kat.seoSkor} /></div>
                          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                            {katAi?.durum === 'yukleniyor' ? <span style={{ fontSize: '0.72rem', color: C.muted }}>⏳</span> : (
                              <button onClick={e => { e.stopPropagation(); tekKategoriAiUret(kat) }} style={{ padding: '4px 8px', borderRadius: '5px', fontSize: '0.7rem', fontWeight: 600, border: `1px solid ${katAi?.durum === 'hazir' ? '#86efac' : marka.renk + '60'}`, background: katAi?.durum === 'hazir' ? '#F0FDF4' : marka.bg, color: katAi?.durum === 'hazir' ? '#15803d' : marka.renk, cursor: 'pointer' }}>
                                {katAi?.durum === 'hazir' ? '✅ AI' : '✨ AI'}
                              </button>
                            )}
                            <button onClick={e => { e.stopPropagation(); toggleKatGenislet() }} style={{ padding: '4px 6px', borderRadius: '5px', border: `1px solid ${C.border}`, background: '#fff', color: C.muted, cursor: 'pointer', fontSize: '0.7rem' }}>{katGenisletildi ? '▲' : '▼'}</button>
                          </div>
                        </div>

                        {katGenisletildi && (
                          <div style={{ background: '#F8FAFC', borderBottom: `1px solid ${C.border}`, padding: '16px 20px 16px 52px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                              <div>
                                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Mevcut SEO (Ticimax&apos;taki)</div>
                                <div style={{ fontSize: '0.75rem', color: C.text, marginBottom: '4px' }}><strong>Başlık:</strong> {kat.seoBaslik || <em style={{ color: C.faint }}>Boş</em>}</div>
                                <div style={{ fontSize: '0.75rem', color: C.text, marginBottom: '4px' }}><strong>Açıklama:</strong> {kat.seoAciklama || <em style={{ color: C.faint }}>Boş</em>}</div>
                                <div style={{ fontSize: '0.75rem', color: C.text, marginBottom: '4px' }}><strong>Anahtar:</strong> {kat.seoAnahtarKelime || <em style={{ color: C.faint }}>Boş</em>}</div>
                                {kat.icerik && (
                                  <div style={{ fontSize: '0.75rem', color: C.text, marginTop: '8px' }}>
                                    <strong>İçerik (HTML):</strong>
                                    <div style={{ fontSize: '0.7rem', color: C.muted, marginTop: '4px', maxHeight: '80px', overflow: 'hidden', background: C.bg, padding: '4px 8px', borderRadius: '4px', fontFamily: 'monospace' }}>
                                      {kat.icerik.slice(0, 200)}{kat.icerik.length > 200 ? '...' : ''}
                                    </div>
                                  </div>
                                )}
                              </div>
                              <div>
                                <div style={{ marginBottom: '8px' }}>
                                  <div style={{ fontSize: '0.68rem', fontWeight: 700, color: marka.renk, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>{katAi?.durum === 'hazir' ? '✅ AI Üretilen (düzenlenebilir)' : '✨ AI ile Üret'}</div>
                                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                    <input
                                      value={hedefAnahtar}
                                      onChange={e => setHedefAnahtar(e.target.value)}
                                      placeholder='🎯 Hedef anahtar kelime (opsiyonel)'
                                      style={{ flex: 1, padding: '5px 8px', borderRadius: '5px', border: `1px solid ${hedefAnahtar ? marka.renk + '80' : C.border}`, fontSize: '0.72rem', color: C.text, outline: 'none', background: hedefAnahtar ? marka.bg : '#fff' }}
                                    />
                                    {katAi?.durum !== 'yukleniyor' && (
                                      <button onClick={() => tekKategoriAiUret(kat)} style={{ padding: '5px 12px', borderRadius: '5px', fontSize: '0.7rem', fontWeight: 600, border: `1px solid ${marka.renk}`, background: marka.bg, color: marka.renk, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                        {katAi?.durum === 'hazir' ? '🔄 Yenile' : '✨ AI ile Yaz'}
                                      </button>
                                    )}
                                  </div>
                                </div>
                                {katAi?.durum === 'yukleniyor' && <div style={{ fontSize: '0.78rem', color: C.muted, padding: '16px 0' }}>⏳ AI içerik üretiyor...</div>}
                                {(katAi?.durum === 'hazir' || katAi?.durum === 'hata') && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div>
                                      <label style={{ fontSize: '0.68rem', color: C.muted, display: 'block', marginBottom: '3px' }}>SEO Başlık ({(katAi.seoBaslik || '').length}/60 kar)</label>
                                      <input value={katAi.seoBaslik || ''} onChange={e => katAiAlaniGuncelle(kat.id, 'seoBaslik', e.target.value)} maxLength={60} style={{ width: '100%', padding: '5px 8px', borderRadius: '5px', border: `1px solid ${(katAi.seoBaslik || '').length > 60 ? '#FCA5A5' : C.border}`, fontSize: '0.78rem', color: C.text, boxSizing: 'border-box' }} />
                                    </div>
                                    <div>
                                      <label style={{ fontSize: '0.68rem', color: C.muted, display: 'block', marginBottom: '3px' }}>Meta Açıklama ({(katAi.seoAciklama || '').length}/155 kar)</label>
                                      <textarea value={katAi.seoAciklama || ''} onChange={e => katAiAlaniGuncelle(kat.id, 'seoAciklama', e.target.value)} maxLength={155} rows={2} style={{ width: '100%', padding: '5px 8px', borderRadius: '5px', border: `1px solid ${(katAi.seoAciklama || '').length > 155 ? '#FCA5A5' : C.border}`, fontSize: '0.75rem', color: C.text, resize: 'vertical', boxSizing: 'border-box' }} />
                                    </div>
                                    <div>
                                      <label style={{ fontSize: '0.68rem', color: C.muted, display: 'block', marginBottom: '3px' }}>Kategori İçeriği (HTML)</label>
                                      <textarea value={katAi.icerik || ''} onChange={e => katAiAlaniGuncelle(kat.id, 'icerik', e.target.value)} rows={4} style={{ width: '100%', padding: '5px 8px', borderRadius: '5px', border: `1px solid ${C.border}`, fontSize: '0.72rem', color: C.text, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'monospace' }} />
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {katSecilenler.size > 0 && (
                  <div style={{ position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)', background: '#1F2937', borderRadius: '12px', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.25)', zIndex: 200, whiteSpace: 'nowrap' }}>
                    <span style={{ color: '#fff', fontSize: '0.82rem', fontWeight: 700 }}>{katSecilenler.size} kategori seçildi</span>
                    <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.2)' }} />
                    {katTopluCalisıyor ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '120px', height: '6px', background: 'rgba(255,255,255,0.2)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${(katTopluIlerleme.tamamlanan / katTopluIlerleme.toplam) * 100}%`, height: '100%', background: '#34D399', borderRadius: '3px', transition: 'width 0.3s' }} />
                        </div>
                        <span style={{ color: '#34D399', fontSize: '0.75rem', fontWeight: 700 }}>{katTopluIlerleme.tamamlanan}/{katTopluIlerleme.toplam}</span>
                      </div>
                    ) : (
                      <button onClick={topluKategoriAiUret} style={{ padding: '7px 16px', borderRadius: '8px', background: '#6366F1', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}>✨ AI ile SEO Yaz</button>
                    )}
                    <button onClick={katExcelIndir} style={{ padding: '7px 14px', borderRadius: '8px', background: '#065F46', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}>⬇ Excel</button>
                    {katAiHazirSecili > 0 && (
                      <button onClick={() => { setKatGonderModal(true); setKatGonderDurum('bekliyor'); setKatGonderSonuc(null) }} style={{ padding: '7px 14px', borderRadius: '8px', background: '#15803d', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}>
                        ✅ Ticimax&apos;a Gönder ({katAiHazirSecili})
                      </button>
                    )}
                    <button onClick={() => setKatSecilenler(new Set())} style={{ padding: '7px 10px', borderRadius: '8px', background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', border: 'none', cursor: 'pointer', fontSize: '0.8rem' }}>✕</button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ══ BLOG SEKMESİ ══ */}
        {sekme === 'blog' && (
          <div style={{ maxWidth: '860px' }}>

            {/* Adım göstergesi + Geçmiş butonu */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <div style={{ display: 'flex', gap: '0', background: C.card, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '4px', width: 'fit-content' }}>
              {[
                { id: 'giris', label: '1. Bilgiler' },
                { id: 'basliklar', label: '2. Başlık Seç' },
                { id: 'icerik', label: '3. Yazılıyor...' },
                { id: 'sonuc', label: '4. İçerik Hazır' },
              ].map(a => (
                <div key={a.id} style={{ padding: '6px 16px', borderRadius: '7px', fontSize: '0.75rem', fontWeight: blogAdim === a.id ? 700 : 400, background: blogAdim === a.id ? marka.renk : 'transparent', color: blogAdim === a.id ? '#fff' : C.faint }}>
                  {a.label}
                </div>
              ))}
              </div>
              {/* Geçmiş butonu */}
              <button onClick={() => setGecmisAcik(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 16px', borderRadius: '8px', border: `1px solid ${C.border}`, background: gecmisAcik ? marka.bg : '#fff', color: marka.renk, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}>
                🕐 Geçmiş {blogGecmis.length > 0 && <span style={{ background: marka.renk, color: '#fff', borderRadius: '10px', padding: '1px 7px', fontSize: '0.68rem' }}>{blogGecmis.length}</span>}
              </button>
            </div>

            {/* ── Geçmiş paneli ── */}
            {gecmisAcik && (
              <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: '12px', padding: '16px', marginBottom: '20px', maxHeight: '340px', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: C.text }}>🕐 Blog Geçmişi</div>
                  {blogGecmis.length > 0 && (
                    <button onClick={() => { setBlogGecmis([]); }} style={{ fontSize: '0.7rem', color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Tümünü Temizle</button>
                  )}
                </div>
                {blogGecmis.length === 0 ? (
                  <div style={{ fontSize: '0.78rem', color: C.faint, textAlign: 'center', padding: '20px' }}>Henüz kaydedilmiş blog yok.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {blogGecmis.map(kayit => (
                      <div key={kayit.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '8px' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{kayit.baslik}</div>
                          <div style={{ fontSize: '0.67rem', color: C.faint, marginTop: '2px' }}>{kayit.hesap === 'karmen' ? '🟠 Karmen' : '🔵 Cotto'} · {kayit.konu} · {kayit.tarih}</div>
                        </div>
                        <div style={{ display: 'flex', gap: '6px', marginLeft: '12px', flexShrink: 0 }}>
                          <button onClick={() => gecmisteYukle(kayit)} style={{ padding: '4px 12px', borderRadius: '6px', border: `1px solid ${marka.renk}`, background: marka.bg, color: marka.renk, cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}>Aç</button>
                          <button onClick={() => gecmisSil(kayit.id)} style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#DC2626', cursor: 'pointer', fontSize: '0.72rem' }}>✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {blogHata && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '0.8rem', color: '#DC2626' }}>
                ❌ {blogHata}
              </div>
            )}

            {/* ── Adım 1: Giriş formu ── */}
            {(blogAdim === 'giris' || blogAdim === 'basliklar') && (
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '24px', marginBottom: '20px' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: C.text, marginBottom: '16px' }}>Blog Bilgileri</div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                  <div>
                    <label style={{ fontSize: '0.7rem', color: C.muted, display: 'block', marginBottom: '4px', fontWeight: 600 }}>Konu *</label>
                    <input value={blogKonu} onChange={e => setBlogKonu(e.target.value)} placeholder='Örn: Salon halısı seçimi rehberi' style={{ width: '100%', padding: '8px 10px', borderRadius: '7px', border: `1px solid ${C.border}`, fontSize: '0.8rem', color: C.text, boxSizing: 'border-box', outline: 'none' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.7rem', color: C.muted, display: 'block', marginBottom: '4px', fontWeight: 600 }}>Odak Anahtar Kelime *</label>
                    <input value={blogAnahtar} onChange={e => setBlogAnahtar(e.target.value)} placeholder='Örn: salon halısı' style={{ width: '100%', padding: '8px 10px', borderRadius: '7px', border: `1px solid ${C.border}`, fontSize: '0.8rem', color: C.text, boxSizing: 'border-box', outline: 'none' }} />
                  </div>
                </div>

                {/* İçerik uzunluğu */}
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ fontSize: '0.7rem', color: C.muted, display: 'block', marginBottom: '6px', fontWeight: 600 }}>İçerik Uzunluğu</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {([
                      { id: 'kisa', label: 'Kısa (~600 kelime)' },
                      { id: 'orta', label: 'Orta (~900 kelime)' },
                      { id: 'uzun', label: 'Uzun (~1200 kelime)' },
                    ] as { id: 'kisa' | 'orta' | 'uzun'; label: string }[]).map(u => (
                      <button key={u.id} onClick={() => setBlogUzunluk(u.id)} style={{ padding: '6px 14px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: blogUzunluk === u.id ? 700 : 400, border: `1px solid ${blogUzunluk === u.id ? marka.renk : C.border}`, background: blogUzunluk === u.id ? marka.bg : '#fff', color: blogUzunluk === u.id ? marka.renk : C.muted, cursor: 'pointer' }}>
                        {u.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Linkler */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '0.7rem', color: C.muted, display: 'block', marginBottom: '6px', fontWeight: 600 }}>Yönlendirme Linkleri (CTA & İç Link)</label>
                  {blogLinkler.map((link, i) => (
                    <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '6px', alignItems: 'center' }}>
                      <input value={link.url} onChange={e => setBlogLinkler(prev => prev.map((l, j) => j === i ? { ...l, url: e.target.value } : l))} placeholder='https://...' style={{ flex: '0 0 280px', padding: '7px 9px', borderRadius: '6px', border: `1px solid ${C.border}`, fontSize: '0.75rem', color: C.text, outline: 'none' }} />
                      <input value={link.aciklama} onChange={e => setBlogLinkler(prev => prev.map((l, j) => j === i ? { ...l, aciklama: e.target.value } : l))} placeholder='Anchor text / açıklama (Örn: salon halıları)' style={{ flex: 1, padding: '7px 9px', borderRadius: '6px', border: `1px solid ${C.border}`, fontSize: '0.75rem', color: C.text, outline: 'none' }} />
                      {blogLinkler.length > 1 && (
                        <button onClick={() => setBlogLinkler(prev => prev.filter((_, j) => j !== i))} style={{ padding: '6px 8px', borderRadius: '5px', border: `1px solid ${C.border}`, background: '#fff', color: C.muted, cursor: 'pointer', fontSize: '0.7rem' }}>✕</button>
                      )}
                    </div>
                  ))}
                  {blogLinkler.length < 5 && (
                    <button onClick={() => setBlogLinkler(prev => [...prev, { url: '', aciklama: '' }])} style={{ padding: '5px 12px', borderRadius: '6px', border: `1px dashed ${C.border}`, background: 'transparent', color: C.muted, cursor: 'pointer', fontSize: '0.72rem' }}>
                      + Link Ekle
                    </button>
                  )}
                </div>

                <button onClick={blogBasliklariGetir} disabled={blogYukleniyor || !blogKonu.trim() || !blogAnahtar.trim()} style={{ padding: '10px 28px', borderRadius: '8px', background: marka.renk, color: '#fff', border: 'none', fontWeight: 700, cursor: blogYukleniyor ? 'wait' : 'pointer', fontSize: '0.85rem', opacity: !blogKonu.trim() || !blogAnahtar.trim() ? 0.5 : 1 }}>
                  {blogYukleniyor && blogAdim === 'giris' ? '⏳ Başlıklar üretiliyor...' : '✨ Başlık Önerileri Al'}
                </button>
              </div>
            )}

            {/* ── Adım 2: Başlık seçimi ── */}
            {blogAdim === 'basliklar' && blogBasliklar.length > 0 && (
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '24px', marginBottom: '20px' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: C.text, marginBottom: '4px' }}>Blog Başlığı Seç</div>
                <div style={{ fontSize: '0.72rem', color: C.muted, marginBottom: '16px' }}>AI {blogBasliklar.length} farklı başlık önerdi. Birini seç veya düzenle.</div>

                {blogBasliklar.map((b, i) => (
                  <div key={i} onClick={() => setBlogSeciliBaslik(b)} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 12px', borderRadius: '8px', marginBottom: '6px', border: `1px solid ${blogSeciliBaslik === b ? marka.renk : C.border}`, background: blogSeciliBaslik === b ? marka.bg : '#fff', cursor: 'pointer', transition: 'all 0.1s' }}>
                    <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: `2px solid ${blogSeciliBaslik === b ? marka.renk : C.border}`, background: blogSeciliBaslik === b ? marka.renk : '#fff', flexShrink: 0, marginTop: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {blogSeciliBaslik === b && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fff' }} />}
                    </div>
                    <span style={{ fontSize: '0.82rem', color: C.text, lineHeight: 1.4 }}>{b}</span>
                  </div>
                ))}

                {/* Manuel başlık düzenleme */}
                <div style={{ marginTop: '12px' }}>
                  <label style={{ fontSize: '0.7rem', color: C.muted, display: 'block', marginBottom: '4px' }}>Seçilen başlığı düzenle:</label>
                  <input value={blogSeciliBaslik} onChange={e => setBlogSeciliBaslik(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: '7px', border: `1px solid ${marka.renk + '80'}`, fontSize: '0.82rem', color: C.text, boxSizing: 'border-box', outline: 'none', background: marka.bg }} />
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                  <button onClick={blogIcerikYaz} disabled={blogYukleniyor || !blogSeciliBaslik} style={{ padding: '10px 28px', borderRadius: '8px', background: marka.renk, color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}>
                    ✍️ Blog Yaz
                  </button>
                  <button onClick={blogSifirla} style={{ padding: '10px 18px', borderRadius: '8px', border: `1px solid ${C.border}`, background: '#fff', color: C.muted, cursor: 'pointer', fontSize: '0.82rem' }}>
                    ← Geri
                  </button>
                </div>
              </div>
            )}

            {/* ── Adım 3: Yazılıyor ── */}
            {blogAdim === 'icerik' && (
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '48px', textAlign: 'center' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>✍️</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: C.text, marginBottom: '8px' }}>Blog içeriği yazılıyor...</div>
                <div style={{ fontSize: '0.8rem', color: C.muted, marginBottom: '20px' }}>AI seçilen başlık ve kurallara göre tam içerik üretiyor. Bu birkaç saniye sürebilir.</div>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: marka.renk, background: marka.bg, padding: '8px 16px', borderRadius: '6px', display: 'inline-block' }}>
                  {blogSeciliBaslik}
                </div>
              </div>
            )}

            {/* ── Adım 4: Sonuç ── */}
            {blogAdim === 'sonuc' && blogSonuc && (
              <div>
                {/* Aksiyon çubuğu */}
                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', alignItems: 'center' }}>
                  <button onClick={blogWordIndir} style={{ padding: '9px 20px', borderRadius: '8px', background: '#1D4ED8', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem' }}>
                    📄 Word İndir
                  </button>
                  <button onClick={() => { setBlogAdim('basliklar') }} style={{ padding: '9px 16px', borderRadius: '8px', border: `1px solid ${C.border}`, background: '#fff', color: C.muted, cursor: 'pointer', fontSize: '0.82rem' }}>
                    ← Başlığı Değiştir
                  </button>
                  <button onClick={blogSifirla} style={{ padding: '9px 16px', borderRadius: '8px', border: `1px solid ${C.border}`, background: '#fff', color: C.muted, cursor: 'pointer', fontSize: '0.82rem' }}>
                    🔄 Yeni Blog
                  </button>
                </div>

                {/* Meta bilgiler */}
                {[
                  { label: 'Stratejik Özet', deger: blogSonuc.ozet, renk: '#6366F1' },
                  { label: 'Blog Başlığı (H1)', deger: blogSonuc.h1Baslik, renk: C.primary },
                  { label: `SEO Title (${blogSonuc.seoTitle.length} kar)`, deger: blogSonuc.seoTitle, renk: blogSonuc.seoTitle.length > 60 ? '#DC2626' : '#15803d' },
                  { label: `SEO Description (${blogSonuc.seoDescription.length} kar)`, deger: blogSonuc.seoDescription, renk: blogSonuc.seoDescription.length > 155 ? '#DC2626' : '#15803d' },
                  { label: 'Etiketler', deger: blogSonuc.etiketler, renk: C.muted },
                  { label: 'Görsel Alt Etiketi', deger: blogSonuc.gorselAltEtiket, renk: C.muted },
                  { label: 'Ön Yazı (Excerpt)', deger: blogSonuc.onYazi, renk: C.text },
                ].map((alan, i) => (
                  <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '14px 16px', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <div style={{ fontSize: '0.68rem', fontWeight: 700, color: alan.renk, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{alan.label}</div>
                      <button onClick={() => navigator.clipboard.writeText(alan.deger)} style={{ padding: '2px 8px', borderRadius: '4px', border: `1px solid ${C.border}`, background: '#fff', color: C.muted, cursor: 'pointer', fontSize: '0.65rem' }}>Kopyala</button>
                    </div>
                    <div style={{ fontSize: '0.82rem', color: C.text, lineHeight: 1.6 }}>{alan.deger}</div>
                  </div>
                ))}

                {/* HTML İçerik */}
                <div style={{ background: C.card, border: `1px solid ${marka.renk + '40'}`, borderRadius: '10px', padding: '16px', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: 700, color: marka.renk, textTransform: 'uppercase', letterSpacing: '0.05em' }}>HTML İçerik (Ticimax&apos;a yapıştır)</div>
                    <button onClick={() => navigator.clipboard.writeText(blogSonuc.htmlIcerik)} style={{ padding: '4px 12px', borderRadius: '5px', border: `1px solid ${marka.renk}`, background: marka.bg, color: marka.renk, cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}>📋 HTML Kopyala</button>
                  </div>
                  <textarea
                    readOnly
                    value={blogSonuc.htmlIcerik}
                    rows={20}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: `1px solid ${C.border}`, fontSize: '0.72rem', color: C.text, fontFamily: 'monospace', resize: 'vertical', boxSizing: 'border-box', background: '#F8FAFC', lineHeight: 1.5 }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Ürün onay modali ── */}
        {gonderModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: '#fff', borderRadius: '14px', padding: '28px', width: '420px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
              {gonderDurum === 'bekliyor' && (
                <>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: C.text, marginBottom: '8px' }}>⚠️ Ticimax&apos;a Gönder</div>
                  <div style={{ fontSize: '0.82rem', color: C.muted, marginBottom: '16px', lineHeight: 1.6 }}>
                    <strong style={{ color: '#DC2626' }}>{aiHazirSecili} ürünün</strong> SEO verisi ({marka.ad}) Ticimax&apos;a kaydedilecek.<br />Bu işlem mevcut SEO içeriklerinin üzerine yazar. Emin misin?
                  </div>
                  <div style={{ background: '#F8FAFC', borderRadius: '8px', padding: '10px 12px', marginBottom: '16px', maxHeight: '160px', overflowY: 'auto' }}>
                    {urunler.filter(u => secilenler.has(u.id) && aiSonuclar[u.id]?.durum === 'hazir').slice(0, 6).map(u => (
                      <div key={u.id} style={{ fontSize: '0.75rem', color: C.text, marginBottom: '6px' }}>
                        <strong>{u.urunAdi}</strong>
                        <div style={{ color: C.muted, fontSize: '0.7rem' }}>{aiSonuclar[u.id]?.seoBaslik}</div>
                      </div>
                    ))}
                    {aiHazirSecili > 6 && <div style={{ fontSize: '0.7rem', color: C.faint }}>...ve {aiHazirSecili - 6} ürün daha</div>}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button onClick={() => setGonderModal(false)} style={{ padding: '8px 18px', borderRadius: '8px', border: `1px solid ${C.border}`, background: '#fff', color: C.muted, cursor: 'pointer', fontSize: '0.82rem' }}>İptal</button>
                    <button onClick={ticimaxaGonder} style={{ padding: '8px 18px', borderRadius: '8px', background: '#15803d', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem' }}>Evet, Gönder</button>
                  </div>
                </>
              )}
              {gonderDurum === 'gonderiyor' && (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '12px' }}>⏳</div>
                  <div style={{ fontSize: '0.88rem', color: C.text, fontWeight: 600 }}>Ticimax&apos;a gönderiliyor...</div>
                  <div style={{ fontSize: '0.75rem', color: C.muted, marginTop: '6px' }}>Lütfen bekleyin, sayfayı kapatmayın.</div>
                </div>
              )}
              {gonderDurum === 'bitti' && gonderSonuc && (
                <>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: C.text, marginBottom: '12px' }}>{gonderSonuc.hatali === 0 ? '✅ Tamamlandı' : '⚠️ Kısmen Tamamlandı'}</div>
                  <div style={{ fontSize: '0.82rem', color: C.text, marginBottom: '16px', lineHeight: 1.8 }}>
                    <div style={{ color: '#15803d' }}>✓ Başarılı: {gonderSonuc.basarili} ürün</div>
                    {gonderSonuc.hatali > 0 && <div style={{ color: '#DC2626' }}>✗ Hatalı: {gonderSonuc.hatali} ürün</div>}
                  </div>
                  <button onClick={() => setGonderModal(false)} style={{ width: '100%', padding: '9px', borderRadius: '8px', background: C.primary, color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem' }}>Kapat</button>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Kategori onay modali ── */}
        {katGonderModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: '#fff', borderRadius: '14px', padding: '28px', width: '420px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
              {katGonderDurum === 'bekliyor' && (
                <>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: C.text, marginBottom: '8px' }}>⚠️ Ticimax&apos;a Gönder</div>
                  <div style={{ fontSize: '0.82rem', color: C.muted, marginBottom: '16px', lineHeight: 1.6 }}>
                    <strong style={{ color: '#DC2626' }}>{katAiHazirSecili} kategorinin</strong> SEO verisi ({marka.ad}) Ticimax&apos;a kaydedilecek.<br />Bu işlem mevcut SEO içeriklerinin üzerine yazar. Emin misin?
                  </div>
                  <div style={{ background: '#F8FAFC', borderRadius: '8px', padding: '10px 12px', marginBottom: '16px', maxHeight: '160px', overflowY: 'auto' }}>
                    {kategoriler.filter(k => katSecilenler.has(k.id) && katAiSonuclar[k.id]?.durum === 'hazir').slice(0, 6).map(k => (
                      <div key={k.id} style={{ fontSize: '0.75rem', color: C.text, marginBottom: '6px' }}>
                        <strong>{k.tanim}</strong>
                        <div style={{ color: C.muted, fontSize: '0.7rem' }}>{katAiSonuclar[k.id]?.seoBaslik}</div>
                      </div>
                    ))}
                    {katAiHazirSecili > 6 && <div style={{ fontSize: '0.7rem', color: C.faint }}>...ve {katAiHazirSecili - 6} kategori daha</div>}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button onClick={() => setKatGonderModal(false)} style={{ padding: '8px 18px', borderRadius: '8px', border: `1px solid ${C.border}`, background: '#fff', color: C.muted, cursor: 'pointer', fontSize: '0.82rem' }}>İptal</button>
                    <button onClick={ticimaxaKategoriGonder} style={{ padding: '8px 18px', borderRadius: '8px', background: '#15803d', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem' }}>Evet, Gönder</button>
                  </div>
                </>
              )}
              {katGonderDurum === 'gonderiyor' && (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '12px' }}>⏳</div>
                  <div style={{ fontSize: '0.88rem', color: C.text, fontWeight: 600 }}>Ticimax&apos;a gönderiliyor...</div>
                  <div style={{ fontSize: '0.75rem', color: C.muted, marginTop: '6px' }}>Lütfen bekleyin, sayfayı kapatmayın.</div>
                </div>
              )}
              {katGonderDurum === 'bitti' && katGonderSonuc && (
                <>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: C.text, marginBottom: '12px' }}>{katGonderSonuc.hatali === 0 ? '✅ Tamamlandı' : '⚠️ Kısmen Tamamlandı'}</div>
                  <div style={{ fontSize: '0.82rem', color: C.text, marginBottom: '16px', lineHeight: 1.8 }}>
                    <div style={{ color: '#15803d' }}>✓ Başarılı: {katGonderSonuc.basarili} kategori</div>
                    {katGonderSonuc.hatali > 0 && <div style={{ color: '#DC2626' }}>✗ Hatalı: {katGonderSonuc.hatali} kategori</div>}
                  </div>
                  <button onClick={() => setKatGonderModal(false)} style={{ width: '100%', padding: '9px', borderRadius: '8px', background: C.primary, color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem' }}>Kapat</button>
                </>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
