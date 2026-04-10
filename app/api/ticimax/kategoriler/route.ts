import { NextResponse } from 'next/server'
import { XMLParser } from 'fast-xml-parser'

const HESAP: Record<string, { url: string; key: string }> = {
  karmen: { url: process.env.TICIMAX_URL_KARMEN || '', key: process.env.TICIMAX_KEY_KARMEN || '' },
  cotto:  { url: process.env.TICIMAX_URL_COTTO  || '', key: process.env.TICIMAX_KEY_COTTO  || '' },
}

export interface TicimaxKategori {
  id: number
  pid: number        // üst kategori ID (0 = kök)
  tanim: string      // kategori adı
  url: string
  aktif: boolean
  icerik: string     // HTML kategori açıklama içeriği
  seoBaslik: string
  seoAciklama: string
  seoAnahtarKelime: string
  altKategoriSayisi: number
  seoSkor: number
  seviye: number     // ağaç derinliği (0 = kök)
}

function seoSkorHesapla(k: TicimaxKategori): number {
  let skor = 0
  const baslik = k.seoBaslik || ''
  const aciklama = k.seoAciklama || ''
  if (baslik.length >= 30 && baslik.length <= 60) skor += 40
  else if (baslik.length > 0) skor += 15
  if (aciklama.length >= 120 && aciklama.length <= 155) skor += 40
  else if (aciklama.length > 0) skor += 15
  if (k.icerik && k.icerik.length > 50) skor += 20
  return Math.min(skor, 100)
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

export async function POST(request: Request) {
  try {
    const { hesap } = await request.json()
    const cfg = HESAP[hesap as string]
    if (!cfg?.key) return NextResponse.json({ error: 'Geçersiz hesap' }, { status: 400 })

    const res = await fetch(`${cfg.url}/Servis/UrunServis.svc`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://tempuri.org/IUrunServis/SelectKategori',
      },
      body: `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">
  <soap:Body>
    <tem:SelectKategori>
      <tem:UyeKodu>${cfg.key}</tem:UyeKodu>
    </tem:SelectKategori>
  </soap:Body>
</soap:Envelope>`,
    })

    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const xml = await res.text()
    const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true, processEntities: false })
    const parsed = parser.parse(xml)

    const rawKat = deepFind(parsed, 'Kategori')
    const rawList: Record<string, unknown>[] = rawKat
      ? (Array.isArray(rawKat) ? rawKat : [rawKat]) as Record<string, unknown>[]
      : []

    // Seviye hesabı için önce ID→PID map oluştur
    const pidMap: Record<number, number> = {}
    rawList.forEach(k => { pidMap[Number(k.ID)] = Number(k.PID ?? 0) })

    function seviyeHesapla(id: number, depth = 0): number {
      if (depth > 10) return 0
      const pid = pidMap[id]
      if (!pid || pid === 0) return 0
      return 1 + seviyeHesapla(pid, depth + 1)
    }

    const kategoriler: TicimaxKategori[] = rawList.map(k => {
      const id = Number(k.ID ?? 0)
      const partial: TicimaxKategori = {
        id,
        pid:              Number(k.PID ?? 0),
        tanim:            String(k.Tanim ?? ''),
        url:              String(k.Url ?? ''),
        aktif:            k.Aktif === true || k.Aktif === 'true',
        icerik:           String(k.Icerik ?? ''),
        seoBaslik:        String(k.SeoSayfaBaslik ?? ''),
        seoAciklama:      String(k.SeoSayfaAciklama ?? ''),
        seoAnahtarKelime: String(k.SeoAnahtarKelime ?? ''),
        altKategoriSayisi: Number(k.AltKategoriSayisi ?? 0),
        seviye:           seviyeHesapla(id),
        seoSkor:          0,
      }
      partial.seoSkor = seoSkorHesapla(partial)
      return partial
    })

    // Ağaç sıralaması: üst kategoriler önce
    kategoriler.sort((a, b) => {
      if (a.seviye !== b.seviye) return a.seviye - b.seviye
      return a.tanim.localeCompare(b.tanim, 'tr')
    })

    // Özet
    const seoOzeti = {
      toplamKategori:    kategoriler.length,
      aktifKategori:     kategoriler.filter(k => k.aktif).length,
      seoBaslikEksik:    kategoriler.filter(k => !k.seoBaslik).length,
      seoAciklamaEksik:  kategoriler.filter(k => !k.seoAciklama).length,
      icerikEksik:       kategoriler.filter(k => !k.icerik).length,
      dusukSkor:         kategoriler.filter(k => k.seoSkor < 50).length,
      ortSkor:           kategoriler.length > 0
        ? Math.round(kategoriler.reduce((s, k) => s + k.seoSkor, 0) / kategoriler.length)
        : 0,
    }

    return NextResponse.json({ kategoriler, seoOzeti })

  } catch (e) {
    const mesaj = e instanceof Error ? e.message : String(e)
    console.error('Ticimax Kategoriler Hatası:', mesaj)
    return NextResponse.json({ error: mesaj }, { status: 500 })
  }
}
