import { NextResponse } from 'next/server'
import { XMLParser } from 'fast-xml-parser'

const HESAP: Record<string, { url: string; key: string }> = {
  karmen: { url: process.env.TICIMAX_URL_KARMEN || '', key: process.env.TICIMAX_KEY_KARMEN || '' },
  cotto:  { url: process.env.TICIMAX_URL_COTTO  || '', key: process.env.TICIMAX_KEY_COTTO  || '' },
}

function soapXml(key: string, offset: number, limit: number) {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:tem="http://tempuri.org/"
               xmlns:dat="http://schemas.datacontract.org/2004/07/">
  <soap:Body>
    <tem:SelectUrun>
      <tem:UyeKodu>${key}</tem:UyeKodu>
      <tem:f>
        <dat:Aktif>1</dat:Aktif>
      </tem:f>
      <tem:s>
        <dat:BaslangicIndex>${offset}</dat:BaslangicIndex>
        <dat:KayitSayisi>${limit}</dat:KayitSayisi>
        <dat:SiralamaDegeri>UrunAdi</dat:SiralamaDegeri>
        <dat:SiralamaYonu>ASC</dat:SiralamaYonu>
      </tem:s>
    </tem:SelectUrun>
  </soap:Body>
</soap:Envelope>`
}

function deepFind(obj: unknown, key: string): unknown {
  if (!obj || typeof obj !== 'object') return undefined
  if (key in (obj as Record<string, unknown>)) return (obj as Record<string, unknown>)[key]
  for (const v of Object.values(obj as Record<string, unknown>)) {
    const found = deepFind(v, key)
    if (found !== undefined) return found
  }
  return undefined
}

export interface TicimaxUrun {
  id: number | string
  urunAdi: string
  urunKodu: string
  satisFiyati: number
  stok: number
  seoBaslik: string
  seoAciklama: string
  aciklama: string      // mevcut ürün açıklaması (HTML olabilir)
  resimUrl: string      // ana ürün görseli
  kategori: string
  aktif: boolean
  seoSkor: number
}

function seoSkorHesapla(urun: { seoBaslik: string; seoAciklama: string }): number {
  let skor = 0
  if (urun.seoBaslik && urun.seoBaslik.length >= 30 && urun.seoBaslik.length <= 60) skor += 50
  else if (urun.seoBaslik && urun.seoBaslik.length > 0) skor += 20
  if (urun.seoAciklama && urun.seoAciklama.length >= 120 && urun.seoAciklama.length <= 160) skor += 50
  else if (urun.seoAciklama && urun.seoAciklama.length > 0) skor += 20
  return Math.min(skor, 100)
}

export async function POST(request: Request) {
  try {
    const { hesap, sayfa = 1, sayfaBoyutu = 100, tumunuCek = false } = await request.json()
    const cfg = HESAP[hesap as string]
    if (!cfg?.key) return NextResponse.json({ error: 'Geçersiz hesap veya eksik API key' }, { status: 400 })

    const LIMIT = 100
    let offset = tumunuCek ? 0 : (sayfa - 1) * sayfaBoyutu
    let tumUrunler: Record<string, unknown>[] = []

    while (true) {
      const res = await fetch(`${cfg.url}/Servis/UrunServis.svc`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'http://tempuri.org/IUrunServis/SelectUrun',
        },
        body: soapXml(cfg.key, offset, tumunuCek ? LIMIT : sayfaBoyutu),
      })

      if (!res.ok) {
        const errText = await res.text()
        throw new Error(`Ticimax HTTP ${res.status}: ${errText.slice(0, 200)}`)
      }

      const xml = await res.text()
      const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true, processEntities: false })
      const parsed = parser.parse(xml)

      const rawResult = deepFind(parsed, 'SelectUrunResult')
      const rawUrun = deepFind(rawResult || parsed, 'UrunKarti')

      const sayfa_: Record<string, unknown>[] = rawUrun
        ? (Array.isArray(rawUrun) ? rawUrun : [rawUrun]) as Record<string, unknown>[]
        : []

      tumUrunler = tumUrunler.concat(sayfa_)

      if (!tumunuCek || sayfa_.length < LIMIT) break
      offset += LIMIT
    }

    // ── Temizle & dönüştür ──────────────────────────────────────────────────
    const urunler: TicimaxUrun[] = tumUrunler.map(u => {
      const seoBaslik   = String(u.SeoSayfaBaslik   ?? u.MetaTitle       ?? '')
      const seoAciklama = String(u.SeoSayfaAciklama ?? u.MetaDescription ?? '')
      const urunAdi     = String(u.UrunAdi ?? '')

      // Görsel URL — Ticimax birden fazla alan adıyla gelebilir
      const resimUrl = String(u.AnaResimUrl ?? u.ResimUrl ?? u.KucukResimUrl ?? u.Resim ?? '')

      // Mevcut açıklama (HTML olabilir)
      const aciklama = String(u.Aciklama ?? u.UrunAciklama ?? u.AciklamaKisa ?? '')

      return {
        id:          String(u.UrunID ?? u.ID ?? ''),
        urunAdi,
        urunKodu:    String(u.UrunKodu ?? u.StokKodu ?? ''),
        satisFiyati: parseFloat(String(u.SatisFiyati ?? u.Fiyat ?? 0)) || 0,
        stok:        parseInt(String(u.ToplamStokAdedi ?? u.StokAdedi ?? u.Stok ?? 0)) || 0,
        seoBaslik,
        seoAciklama,
        aciklama,
        resimUrl,
        kategori:    String(u.AnaKategori ?? u.KategoriAdi ?? u.Kategori ?? ''),
        aktif:       u.Aktif === true || u.Aktif === 'true',
        seoSkor:     seoSkorHesapla({ seoBaslik, seoAciklama }),
      }
    })

    // ── SEO özeti ───────────────────────────────────────────────────────────
    const seoOzeti = {
      toplamUrun:       urunler.length,
      seoBaslikEksik:   urunler.filter(u => !u.seoBaslik).length,
      seoAciklamaEksik: urunler.filter(u => !u.seoAciklama).length,
      dusukSkor:        urunler.filter(u => u.seoSkor < 50).length,
      ortSkor:          urunler.length > 0
        ? Math.round(urunler.reduce((s, u) => s + u.seoSkor, 0) / urunler.length)
        : 0,
    }

    return NextResponse.json({ urunler, seoOzeti })

  } catch (e) {
    const mesaj = e instanceof Error ? e.message : String(e)
    console.error('Ticimax Ürün Hatası:', mesaj)
    return NextResponse.json({ error: mesaj }, { status: 500 })
  }
}
