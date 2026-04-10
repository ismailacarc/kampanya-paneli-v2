import { NextResponse } from 'next/server'
import { XMLParser } from 'fast-xml-parser'

const HESAP: Record<string, { url: string; key: string }> = {
  karmen: { url: process.env.TICIMAX_URL_KARMEN || '', key: process.env.TICIMAX_KEY_KARMEN || '' },
  cotto:  { url: process.env.TICIMAX_URL_COTTO  || '', key: process.env.TICIMAX_KEY_COTTO  || '' },
}

function soapXml(key: string, bas: string, son: string, offset: number, limit: number) {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:tem="http://tempuri.org/"
               xmlns:dat="http://schemas.datacontract.org/2004/07/">
  <soap:Body>
    <tem:SelectSiparis>
      <tem:UyeKodu>${key}</tem:UyeKodu>
      <tem:f>
        <dat:SiparisTarihiBas>${bas}T00:00:00</dat:SiparisTarihiBas>
        <dat:SiparisTarihiSon>${son}T23:59:59</dat:SiparisTarihiSon>
        <dat:SiparisDurumu>-1</dat:SiparisDurumu>
      </tem:f>
      <tem:s>
        <dat:BaslangicIndex>${offset}</dat:BaslangicIndex>
        <dat:KayitSayisi>${limit}</dat:KayitSayisi>
        <dat:SiralamaDegeri>SiparisTarihi</dat:SiralamaDegeri>
        <dat:SiralamaYonu>ASC</dat:SiralamaYonu>
      </tem:s>
    </tem:SelectSiparis>
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

export async function POST(request: Request) {
  try {
    const { hesap, baslangic, bitis } = await request.json()
    const cfg = HESAP[hesap as string]
    if (!cfg?.key) return NextResponse.json({ error: 'Geçersiz hesap veya eksik API key' }, { status: 400 })

    // Ticimax max 500 kayıt döndürür — büyük aralıklar için döngü
    const LIMIT = 500
    let offset = 0
    let tumSiparisler: Record<string, unknown>[] = []

    while (true) {
      const res = await fetch(`${cfg.url}/Servis/SiparisServis.svc`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'http://tempuri.org/ISiparisServis/SelectSiparis',
        },
        body: soapXml(cfg.key, baslangic, bitis, offset, LIMIT),
      })

      if (!res.ok) {
        const errText = await res.text()
        throw new Error(`Ticimax HTTP ${res.status}: ${errText.slice(0, 200)}`)
      }

      const xml = await res.text()
      const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true, processEntities: false })
      const parsed = parser.parse(xml)

      // SOAP cevabının derinindeki WebSiparis listesini bul
      const rawResult = deepFind(parsed, 'SelectSiparisResult')
      const rawSiparis = deepFind(rawResult || parsed, 'WebSiparis')

      const sayfa: Record<string, unknown>[] = rawSiparis
        ? (Array.isArray(rawSiparis) ? rawSiparis : [rawSiparis]) as Record<string, unknown>[]
        : []

      tumSiparisler = tumSiparisler.concat(sayfa)

      // Sayfa dolu değilse bitti
      if (sayfa.length < LIMIT) break
      offset += LIMIT
    }

    // ── Agregasyon ──────────────────────────────────────────────────────────
    let toplamGelir = 0
    let siparisSayisi = 0
    const gunlukMap: Record<string, { gelir: number; sayi: number }> = {}

    for (const s of tumSiparisler) {
      const tutar = parseFloat(String(s.SiparisToplamTutari ?? s.Tutar ?? 0))
      if (isNaN(tutar)) continue

      // Tarih: "2026-01-15T10:30:00" → "2026-01-15"
      const tarih = String(s.SiparisTarihi ?? '').substring(0, 10)

      toplamGelir += tutar
      siparisSayisi++

      if (tarih) {
        if (!gunlukMap[tarih]) gunlukMap[tarih] = { gelir: 0, sayi: 0 }
        gunlukMap[tarih].gelir += tutar
        gunlukMap[tarih].sayi++
      }
    }

    const gunlukDetay = Object.entries(gunlukMap)
      .map(([tarih, d]) => ({ tarih, gelir: Math.round(d.gelir * 100) / 100, sayi: d.sayi }))
      .sort((a, b) => a.tarih.localeCompare(b.tarih))

    return NextResponse.json({
      toplamGelir: Math.round(toplamGelir * 100) / 100,
      siparisSayisi,
      gunlukDetay,
    })

  } catch (e) {
    const mesaj = e instanceof Error ? e.message : String(e)
    console.error('Ticimax Sipariş Hatası:', mesaj)
    return NextResponse.json({ error: mesaj }, { status: 500 })
  }
}
