import { NextResponse } from 'next/server'
import { XMLParser } from 'fast-xml-parser'

const HESAP: Record<string, { url: string; key: string }> = {
  karmen: { url: process.env.TICIMAX_URL_KARMEN || '', key: process.env.TICIMAX_KEY_KARMEN || '' },
  cotto:  { url: process.env.TICIMAX_URL_COTTO  || '', key: process.env.TICIMAX_KEY_COTTO  || '' },
}

export interface GuncellenecekUrun {
  id: string
  seoBaslik: string
  seoAciklama: string
  anahtarKelimeler: string
  urunAciklama: string
}

function soapXml(key: string, urun: GuncellenecekUrun): string {
  const esc = (s: string) => s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:tem="http://tempuri.org/"
               xmlns:dat="http://schemas.datacontract.org/2004/07/">
  <soap:Body>
    <tem:UpdateUrunDil>
      <tem:UyeKodu>${key}</tem:UyeKodu>
      <tem:liste>
        <dat:UrunDil>
          <dat:UrunID>${urun.id}</dat:UrunID>
          <dat:Dil>tr</dat:Dil>
          <dat:SeoSayfaBaslik>${esc(urun.seoBaslik)}</dat:SeoSayfaBaslik>
          <dat:SeoSayfaAciklama>${esc(urun.seoAciklama)}</dat:SeoSayfaAciklama>
          <dat:SeoAnahtarKelime>${esc(urun.anahtarKelimeler)}</dat:SeoAnahtarKelime>
          <dat:Aciklama>${esc(urun.urunAciklama)}</dat:Aciklama>
        </dat:UrunDil>
      </tem:liste>
    </tem:UpdateUrunDil>
  </soap:Body>
</soap:Envelope>`
}

async function urunGuncelle(cfg: { url: string; key: string }, urun: GuncellenecekUrun): Promise<{ basarili: boolean; hata?: string }> {
  try {
    const res = await fetch(`${cfg.url}/Servis/UrunServis.svc`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://tempuri.org/IUrunServis/UpdateUrunDil',
      },
      body: soapXml(cfg.key, urun),
    })

    const xml = await res.text()
    const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true, processEntities: false })
    const parsed = parser.parse(xml)

    // Fault kontrolü
    const fault = parsed?.Envelope?.Body?.Fault || parsed?.['s:Envelope']?.['s:Body']?.['s:Fault']
    if (fault) {
      const mesaj = fault?.faultstring || fault?.Reason?.Text || 'SOAP Fault'
      return { basarili: false, hata: String(mesaj) }
    }

    return { basarili: true }
  } catch (e) {
    return { basarili: false, hata: e instanceof Error ? e.message : String(e) }
  }
}

export interface GuncellenecekKategori {
  id: number
  seoBaslik: string
  seoAciklama: string
  anahtarKelimeler: string
  icerik: string
}

function soapKategoriXml(key: string, k: GuncellenecekKategori): string {
  const esc = (s: string) => s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:tem="http://tempuri.org/"
               xmlns:dat="http://schemas.datacontract.org/2004/07/">
  <soap:Body>
    <tem:UpdateKategoriDil>
      <tem:UyeKodu>${key}</tem:UyeKodu>
      <tem:liste>
        <dat:KategoriDil>
          <dat:KategoriID>${k.id}</dat:KategoriID>
          <dat:Dil>tr</dat:Dil>
          <dat:SeoSayfaBaslik>${esc(k.seoBaslik)}</dat:SeoSayfaBaslik>
          <dat:SeoSayfaAciklama>${esc(k.seoAciklama)}</dat:SeoSayfaAciklama>
          <dat:SeoAnahtarKelime>${esc(k.anahtarKelimeler)}</dat:SeoAnahtarKelime>
          <dat:Icerik>${esc(k.icerik)}</dat:Icerik>
        </dat:KategoriDil>
      </tem:liste>
    </tem:UpdateKategoriDil>
  </soap:Body>
</soap:Envelope>`
}

async function kategoriGuncelle(cfg: { url: string; key: string }, k: GuncellenecekKategori): Promise<{ basarili: boolean; hata?: string }> {
  try {
    const res = await fetch(`${cfg.url}/Servis/UrunServis.svc`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://tempuri.org/IUrunServis/UpdateKategoriDil',
      },
      body: soapKategoriXml(cfg.key, k),
    })
    const xml = await res.text()
    const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true, processEntities: false })
    const parsed = parser.parse(xml)
    const fault = parsed?.Envelope?.Body?.Fault
    if (fault) return { basarili: false, hata: String(fault?.faultstring || 'SOAP Fault') }
    return { basarili: true }
  } catch (e) {
    return { basarili: false, hata: e instanceof Error ? e.message : String(e) }
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { hesap, tip = 'urun' } = body as { hesap: string; tip?: string }

    const cfg = HESAP[hesap]
    if (!cfg?.key) return NextResponse.json({ error: 'Geçersiz hesap veya eksik API key' }, { status: 400 })

    // ── Kategori güncelleme ────────────────────────────────────────────────
    if (tip === 'kategori') {
      const { kategoriler } = body as { kategoriler: GuncellenecekKategori[] }
      if (!Array.isArray(kategoriler) || kategoriler.length === 0) {
        return NextResponse.json({ error: 'Güncellenecek kategori yok' }, { status: 400 })
      }
      const sonuclar: { id: number; basarili: boolean; hata?: string }[] = []
      for (const k of kategoriler) {
        const sonuc = await kategoriGuncelle(cfg, k)
        sonuclar.push({ id: k.id, ...sonuc })
      }
      return NextResponse.json({
        basarili: sonuclar.filter(s => s.basarili).length,
        hatali: sonuclar.filter(s => !s.basarili).length,
        sonuclar,
      })
    }

    // ── Ürün güncelleme ────────────────────────────────────────────────────
    const { urunler } = body as { urunler: GuncellenecekUrun[] }
    if (!Array.isArray(urunler) || urunler.length === 0) {
      return NextResponse.json({ error: 'Güncellenecek ürün yok' }, { status: 400 })
    }

    const sonuclar: { id: string; basarili: boolean; hata?: string }[] = []
    for (const urun of urunler) {
      const sonuc = await urunGuncelle(cfg, urun)
      sonuclar.push({ id: urun.id, ...sonuc })
    }

    const basarili = sonuclar.filter(s => s.basarili).length
    const hatali = sonuclar.filter(s => !s.basarili).length

    return NextResponse.json({ basarili, hatali, sonuclar })

  } catch (e) {
    const mesaj = e instanceof Error ? e.message : String(e)
    console.error('Ticimax Güncelleme Hatası:', mesaj)
    return NextResponse.json({ error: mesaj }, { status: 500 })
  }
}
