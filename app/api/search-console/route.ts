import { google } from 'googleapis'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GA4_CLIENT_EMAIL,
      private_key: process.env.GA4_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  })
}

function getSiteUrl(hesap: string) {
  return hesap === 'karmen'
    ? process.env.GSC_SITE_URL_KARMEN || 'https://karmenhali.com/'
    : process.env.GSC_SITE_URL_COTTO  || 'https://cottohome.com.tr/'
}

function tarihAraligi(donem: string, basOzel?: string, bitOzel?: string) {
  if (donem === 'ozel' && basOzel && bitOzel) return { baslangic: basOzel, bitis: bitOzel }
  const gun   = parseInt(donem) || 28
  const bitis = new Date(); bitis.setDate(bitis.getDate() - 3)
  const bas   = new Date(bitis); bas.setDate(bas.getDate() - (gun - 1))
  return { baslangic: bas.toISOString().split('T')[0], bitis: bitis.toISOString().split('T')[0] }
}

function oncekiDonem(baslangic: string, bitis: string) {
  const bas = new Date(baslangic), bit = new Date(bitis)
  const gun = Math.round((bit.getTime() - bas.getTime()) / 86400000) + 1
  const prevBit = new Date(bas); prevBit.setDate(prevBit.getDate() - 1)
  const prevBas = new Date(prevBit); prevBas.setDate(prevBas.getDate() - (gun - 1))
  return { baslangic: prevBas.toISOString().split('T')[0], bitis: prevBit.toISOString().split('T')[0] }
}

function degisim(simdiki: number, onceki: number) {
  if (!onceki) return null
  return parseFloat(((simdiki - onceki) / onceki * 100).toFixed(1))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sorgula(sc: any, siteUrl: string, requestBody: object) {
  const res = await sc.searchanalytics.query({ siteUrl, requestBody })
  return res.data as {
    rows?: { keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number }[]
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { hesap, tur, donem = '28', baslangic: basOzel, bitis: bitOzel } = body

    if (!hesap || !tur) return NextResponse.json({ error: 'hesap ve tur zorunlu' }, { status: 400 })

    const siteUrl = getSiteUrl(hesap)
    const { baslangic, bitis } = tarihAraligi(donem, basOzel, bitOzel)

    // AI analizi — API key yeterli, GSC auth gerekmez
    if (tur === 'ai') {
      const { veriler, marka } = body
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const model  = body.model || 'claude-sonnet-4-6'

      const prompt = `Sen bir SEO uzmanısın. Aşağıdaki Google Search Console verilerini analiz et.

Marka: ${marka === 'karmen' ? 'Karmen Halı (karmenhali.com)' : 'Cotto Home (cottohome.com.tr)'}
Dönem: ${veriler.tarihAralik?.baslangic} - ${veriler.tarihAralik?.bitis}

GENEL PERFORMANS:
- Tıklama: ${veriler.genel?.tiklamalar?.toLocaleString('tr-TR')} (önceki dönem: ${veriler.genel?.oncekiTiklamalar?.toLocaleString('tr-TR') || 'bilinmiyor'})
- Gösterim: ${veriler.genel?.gösterimler?.toLocaleString('tr-TR')}
- Ort. CTR: %${veriler.genel?.ctr}
- Ort. Sıralama: #${veriler.genel?.pozisyon}

TOP 10 ANAHTAR KELİME (tıklamaya göre):
${(veriler.kelimeler || []).slice(0, 10).map((k: {kelime: string; tiklamalar: number; gösterimler: number; ctr: number; pozisyon: number}, i: number) => `${i+1}. "${k.kelime}" - ${k.tiklamalar} tıklama, %${k.ctr} CTR, #${k.pozisyon} sıralama`).join('\n')}

TOP 5 FIRSAT KELİMESİ (sıralama 4-20, yüksek gösterim):
${(veriler.firsatlar || []).slice(0, 5).map((k: {kelime: string; gösterimler: number; pozisyon: number; ctr: number}, i: number) => `${i+1}. "${k.kelime}" - ${k.gösterimler} gösterim, #${k.pozisyon} sıralama, %${k.ctr} CTR`).join('\n')}

CİHAZ DAĞILIMI:
${(veriler.cihazlar || []).map((c: {cihaz: string; tiklamalar: number; ctr: number; pozisyon: number}) => `- ${c.cihaz}: ${c.tiklamalar} tıklama, %${c.ctr} CTR, #${c.pozisyon} sıralama`).join('\n')}

JSON formatında yanıt ver (başka hiçbir şey yazma):
{
  "gucluNoktalar": ["madde1", "madde2", "madde3"],
  "dikkatNoktalar": ["madde1", "madde2", "madde3"],
  "firsatOnerileri": ["madde1", "madde2", "madde3"],
  "eylemListesi": ["eylem1", "eylem2", "eylem3", "eylem4", "eylem5"],
  "ozet": "2-3 cümlelik genel değerlendirme"
}`

      const msg = await client.messages.create({
        model, max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      })
      const text = (msg.content[0] as { text: string }).text
      const jsonStart = text.indexOf('{'), jsonEnd = text.lastIndexOf('}')
      if (jsonStart === -1 || jsonEnd === -1) throw new Error('AI geçerli JSON döndürmedi')
      return NextResponse.json(JSON.parse(text.slice(jsonStart, jsonEnd + 1)))
    }

    const auth = getAuth()
    const sc   = google.searchconsole({ version: 'v1', auth })

    // ── GENEL (önceki dönem karşılaştırmalı) ──────────────────────────────────
    if (tur === 'genel') {
      const { baslangic: prevBas, bitis: prevBit } = oncekiDonem(baslangic, bitis)
      const [cur, prev] = await Promise.all([
        sorgula(sc, siteUrl, { startDate: baslangic, endDate: bitis, dimensions: [], rowLimit: 1 }),
        sorgula(sc, siteUrl, { startDate: prevBas, endDate: prevBit, dimensions: [], rowLimit: 1 }),
      ])
      const r  = cur.rows?.[0],  p  = prev.rows?.[0]
      const tiklamalar  = r?.clicks       ?? 0
      const gösterimler = r?.impressions  ?? 0
      const ctr         = r?.ctr          ? parseFloat((r.ctr * 100).toFixed(2)) : 0
      const pozisyon    = r?.position     ? parseFloat(r.position.toFixed(1))    : 0
      const pTiklamalar  = p?.clicks       ?? 0
      const pGösterimler = p?.impressions  ?? 0
      const pCtr         = p?.ctr          ? parseFloat((p.ctr * 100).toFixed(2)) : 0
      const pPozisyon    = p?.position     ? parseFloat(p.position.toFixed(1))    : 0
      return NextResponse.json({
        tiklamalar, gösterimler, ctr, pozisyon,
        oncekiTiklamalar: pTiklamalar, oncekiGösterimler: pGösterimler, oncekiCtr: pCtr, oncekiPozisyon: pPozisyon,
        degisimTiklamalar: degisim(tiklamalar, pTiklamalar),
        degisimGösterimler: degisim(gösterimler, pGösterimler),
        degisimCtr: degisim(ctr, pCtr),
        degisimPozisyon: degisim(pozisyon, pPozisyon),
        tarihAralik: { baslangic, bitis },
        oncekiTarih: { baslangic: prevBas, bitis: prevBit },
      })
    }

    // ── ANAHTAR KELİMELER ──────────────────────────────────────────────────────
    if (tur === 'kelimeler') {
      const data = await sorgula(sc, siteUrl, { startDate: baslangic, endDate: bitis, dimensions: ['query'], rowLimit: 100 })
      const kelimeler = (data.rows || [])
        .map(r => ({ kelime: r.keys?.[0] ?? '', tiklamalar: r.clicks ?? 0, gösterimler: r.impressions ?? 0, ctr: r.ctr ? parseFloat((r.ctr * 100).toFixed(2)) : 0, pozisyon: r.position ? parseFloat(r.position.toFixed(1)) : 0 }))
        .sort((a, b) => b.tiklamalar - a.tiklamalar).slice(0, 50)
      return NextResponse.json({ kelimeler })
    }

    // ── SAYFALAR ───────────────────────────────────────────────────────────────
    if (tur === 'sayfalar') {
      const data = await sorgula(sc, siteUrl, { startDate: baslangic, endDate: bitis, dimensions: ['page'], rowLimit: 100 })
      const sayfalar = (data.rows || [])
        .map(r => ({ url: r.keys?.[0] ?? '', tiklamalar: r.clicks ?? 0, gösterimler: r.impressions ?? 0, ctr: r.ctr ? parseFloat((r.ctr * 100).toFixed(2)) : 0, pozisyon: r.position ? parseFloat(r.position.toFixed(1)) : 0 }))
        .sort((a, b) => b.tiklamalar - a.tiklamalar).slice(0, 30)
      return NextResponse.json({ sayfalar })
    }

    // ── FIRSAT ─────────────────────────────────────────────────────────────────
    if (tur === 'firsat') {
      const data = await sorgula(sc, siteUrl, { startDate: baslangic, endDate: bitis, dimensions: ['query'], rowLimit: 500 })
      const firsatlar = (data.rows || [])
        .map(r => ({ kelime: r.keys?.[0] ?? '', tiklamalar: r.clicks ?? 0, gösterimler: r.impressions ?? 0, ctr: r.ctr ? parseFloat((r.ctr * 100).toFixed(2)) : 0, pozisyon: r.position ? parseFloat(r.position.toFixed(1)) : 0 }))
        .filter(r => r.pozisyon >= 4 && r.pozisyon <= 20 && r.gösterimler >= 50)
        .sort((a, b) => b.gösterimler - a.gösterimler).slice(0, 30)
      return NextResponse.json({ firsatlar })
    }

    // ── CİHAZLAR ───────────────────────────────────────────────────────────────
    if (tur === 'cihazlar') {
      const data = await sorgula(sc, siteUrl, { startDate: baslangic, endDate: bitis, dimensions: ['device'], rowLimit: 10 })
      const cihazlar = (data.rows || []).map(r => ({
        cihaz:       r.keys?.[0] ?? '',
        tiklamalar:  r.clicks      ?? 0,
        gösterimler: r.impressions ?? 0,
        ctr:         r.ctr        ? parseFloat((r.ctr * 100).toFixed(2)) : 0,
        pozisyon:    r.position   ? parseFloat(r.position.toFixed(1))    : 0,
      })).sort((a, b) => b.tiklamalar - a.tiklamalar)
      return NextResponse.json({ cihazlar })
    }

    // ── ÜLKELER ────────────────────────────────────────────────────────────────
    if (tur === 'ulkeler') {
      const data = await sorgula(sc, siteUrl, { startDate: baslangic, endDate: bitis, dimensions: ['country'], rowLimit: 20 })
      const ulkeler = (data.rows || []).map(r => ({
        ulke:        r.keys?.[0] ?? '',
        tiklamalar:  r.clicks      ?? 0,
        gösterimler: r.impressions ?? 0,
        ctr:         r.ctr        ? parseFloat((r.ctr * 100).toFixed(2)) : 0,
        pozisyon:    r.position   ? parseFloat(r.position.toFixed(1))    : 0,
      })).sort((a, b) => b.tiklamalar - a.tiklamalar)
      return NextResponse.json({ ulkeler })
    }

    // ── GÜNLÜK TREND ───────────────────────────────────────────────────────────
    if (tur === 'trend') {
      const data = await sorgula(sc, siteUrl, { startDate: baslangic, endDate: bitis, dimensions: ['date'], rowLimit: 500 })
      const trend = (data.rows || [])
        .map(r => ({ tarih: r.keys?.[0] ?? '', tiklamalar: r.clicks ?? 0, gösterimler: r.impressions ?? 0, ctr: r.ctr ? parseFloat((r.ctr * 100).toFixed(2)) : 0, pozisyon: r.position ? parseFloat(r.position.toFixed(1)) : 0 }))
        .sort((a, b) => a.tarih.localeCompare(b.tarih))
      return NextResponse.json({ trend })
    }

    // ── SAYFA + KELİME ──────────────────────────────────────────────────────────
    if (tur === 'sayfa_kelime') {
      const data = await sorgula(sc, siteUrl, { startDate: baslangic, endDate: bitis, dimensions: ['page', 'query'], rowLimit: 200 })
      const satirlar = (data.rows || [])
        .map(r => ({ url: r.keys?.[0] ?? '', kelime: r.keys?.[1] ?? '', tiklamalar: r.clicks ?? 0, gösterimler: r.impressions ?? 0, ctr: r.ctr ? parseFloat((r.ctr * 100).toFixed(2)) : 0, pozisyon: r.position ? parseFloat(r.position.toFixed(1)) : 0 }))
        .sort((a, b) => b.tiklamalar - a.tiklamalar)
      return NextResponse.json({ satirlar })
    }

    return NextResponse.json({ error: 'Geçersiz tur: ' + tur }, { status: 400 })

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('Search Console API hatası:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
