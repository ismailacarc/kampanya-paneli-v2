import { BetaAnalyticsDataClient } from '@google-analytics/data'
import { NextResponse } from 'next/server'

function getClient() {
  const privateKey = process.env.GA4_PRIVATE_KEY?.replace(/\\n/g, '\n')
  const clientEmail = process.env.GA4_CLIENT_EMAIL
  return new BetaAnalyticsDataClient({
    credentials: { client_email: clientEmail, private_key: privateKey }
  })
}

function getPropertyId(hesap: string) {
  if (hesap === 'karmen') return process.env.GA4_PROPERTY_ID_KARMEN || ''
  return process.env.GA4_PROPERTY_ID_COTTO || ''
}

// Tarih aralığı hesapla — önceki dönem için de kullan
function dateRanges(baslangic: string, bitis: string) {
  const start = new Date(baslangic)
  const end   = new Date(bitis)
  const gun   = Math.round((end.getTime() - start.getTime()) / 86400000) + 1

  const prevEnd   = new Date(start); prevEnd.setDate(prevEnd.getDate() - 1)
  const prevStart = new Date(prevEnd); prevStart.setDate(prevStart.getDate() - gun + 1)

  return {
    suanki:  { startDate: baslangic, endDate: bitis },
    onceki:  { startDate: prevStart.toISOString().split('T')[0], endDate: prevEnd.toISOString().split('T')[0] },
  }
}

function metrikleri(row: { value?: string | null }[] | null | undefined, idx: number, carpan = 1, ondalik = 0) {
  const v = parseFloat(row?.[idx]?.value || '0') * carpan
  return ondalik > 0 ? parseFloat(v.toFixed(ondalik)) : Math.round(v)
}

function degisim(simdiki: number, onceki: number) {
  if (onceki === 0) return null
  return parseFloat(((simdiki - onceki) / onceki * 100).toFixed(1))
}

// GET /api/analytics?hesap=cotto&tur=genel&baslangic=2024-01-01&bitis=2024-01-31
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const hesap     = searchParams.get('hesap')     || 'cotto'
  const tur       = searchParams.get('tur')       || 'genel'
  const baslangic = searchParams.get('baslangic') || ''
  const bitis     = searchParams.get('bitis')     || ''
  const donem     = parseInt(searchParams.get('donem') || '30')

  // Tarih aralığı: özel tarih varsa kullan, yoksa donem gün öncesi
  const bugun     = new Date().toISOString().split('T')[0]
  const bslangic  = baslangic || (() => { const d = new Date(); d.setDate(d.getDate() - donem); return d.toISOString().split('T')[0] })()
  const bts       = bitis || bugun

  const propertyId = getPropertyId(hesap)
  if (!propertyId) return NextResponse.json({ error: 'Property ID bulunamadı' }, { status: 400 })

  const client = getClient()
  const { suanki, onceki } = dateRanges(bslangic, bts)

  try {

    // ── Genel Trafik (karşılaştırmalı) ───────────────────────────────────────
    if (tur === 'genel') {
      const [res] = await client.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [suanki, onceki],
        metrics: [
          { name: 'sessions' },
          { name: 'totalUsers' },
          { name: 'newUsers' },
          { name: 'bounceRate' },
          { name: 'averageSessionDuration' },
          { name: 'screenPageViewsPerSession' },
        ],
      })

      // GA4 iki dateRange için satırları iç içe döndürür: date_range_0 ve date_range_1
      const s = res.rows?.find(r => r.dimensionValues?.[0]?.value === 'date_range_0')?.metricValues
               ?? res.rows?.[0]?.metricValues
      const o = res.rows?.find(r => r.dimensionValues?.[0]?.value === 'date_range_1')?.metricValues
               ?? res.rows?.[1]?.metricValues

      const simdiki = {
        sessions:        metrikleri(s, 0),
        totalUsers:      metrikleri(s, 1),
        newUsers:        metrikleri(s, 2),
        bounceRate:      metrikleri(s, 3, 100, 1),
        avgSessionDur:   metrikleri(s, 4, 1/60, 1),
        pagesPerSession: metrikleri(s, 5, 1, 1),
      }
      const oncekiD = {
        sessions:        metrikleri(o, 0),
        totalUsers:      metrikleri(o, 1),
        newUsers:        metrikleri(o, 2),
        bounceRate:      metrikleri(o, 3, 100, 1),
        avgSessionDur:   metrikleri(o, 4, 1/60, 1),
        pagesPerSession: metrikleri(o, 5, 1, 1),
      }

      return NextResponse.json({
        tur: 'genel',
        data: simdiki,
        onceki: oncekiD,
        degisim: {
          sessions:        degisim(simdiki.sessions, oncekiD.sessions),
          totalUsers:      degisim(simdiki.totalUsers, oncekiD.totalUsers),
          newUsers:        degisim(simdiki.newUsers, oncekiD.newUsers),
          bounceRate:      degisim(simdiki.bounceRate, oncekiD.bounceRate),
          avgSessionDur:   degisim(simdiki.avgSessionDur, oncekiD.avgSessionDur),
          pagesPerSession: degisim(simdiki.pagesPerSession, oncekiD.pagesPerSession),
        }
      })
    }

    // ── E-Ticaret (karşılaştırmalı) ───────────────────────────────────────────
    if (tur === 'eticaret') {
      const [res] = await client.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [suanki, onceki],
        metrics: [
          { name: 'purchaseRevenue' },
          { name: 'transactions' },
          { name: 'ecommercePurchases' },
          { name: 'averagePurchaseRevenue' },
          { name: 'purchaseToViewRate' },
          { name: 'addToCarts' },
          { name: 'checkouts' },
        ],
      })

      const s = res.rows?.find(r => r.dimensionValues?.[0]?.value === 'date_range_0')?.metricValues ?? res.rows?.[0]?.metricValues
      const o = res.rows?.find(r => r.dimensionValues?.[0]?.value === 'date_range_1')?.metricValues ?? res.rows?.[1]?.metricValues

      const simdiki = {
        gelir:         metrikleri(s, 0, 1, 2),
        islemSayisi:   metrikleri(s, 1),
        satisSayisi:   metrikleri(s, 2),
        ortSiparisD:   metrikleri(s, 3, 1, 2),
        donusumOrani:  metrikleri(s, 4, 100, 2),
        sepeteEkleme:  metrikleri(s, 5),
        odemeBaslatan: metrikleri(s, 6),
      }
      const oncekiD = {
        gelir:         metrikleri(o, 0, 1, 2),
        islemSayisi:   metrikleri(o, 1),
        satisSayisi:   metrikleri(o, 2),
        ortSiparisD:   metrikleri(o, 3, 1, 2),
        donusumOrani:  metrikleri(o, 4, 100, 2),
        sepeteEkleme:  metrikleri(o, 5),
        odemeBaslatan: metrikleri(o, 6),
      }

      return NextResponse.json({
        tur: 'eticaret',
        data: simdiki,
        onceki: oncekiD,
        degisim: {
          gelir:        degisim(simdiki.gelir, oncekiD.gelir),
          islemSayisi:  degisim(simdiki.islemSayisi, oncekiD.islemSayisi),
          ortSiparisD:  degisim(simdiki.ortSiparisD, oncekiD.ortSiparisD),
          donusumOrani: degisim(simdiki.donusumOrani, oncekiD.donusumOrani),
        }
      })
    }

    // ── Kanallar ──────────────────────────────────────────────────────────────
    if (tur === 'kanallar') {
      const [res] = await client.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [suanki],
        dimensions: [{ name: 'sessionDefaultChannelGroup' }],
        metrics: [
          { name: 'sessions' },
          { name: 'totalUsers' },
          { name: 'purchaseRevenue' },
          { name: 'transactions' },
          { name: 'bounceRate' },
          { name: 'averageSessionDuration' },
        ],
        orderBys: [{ metric: { metricName: 'purchaseRevenue' }, desc: true }],
      })

      const data = (res.rows || []).map(row => ({
        kanal:      row.dimensionValues?.[0]?.value || '',
        sessions:   metrikleri(row.metricValues, 0),
        kullanici:  metrikleri(row.metricValues, 1),
        gelir:      metrikleri(row.metricValues, 2, 1, 2),
        islem:      metrikleri(row.metricValues, 3),
        bounceRate: metrikleri(row.metricValues, 4, 100, 1),
        avgSureDk:  metrikleri(row.metricValues, 5, 1/60, 1),
      }))
      return NextResponse.json({ tur: 'kanallar', data })
    }

    // ── Sayfalar ──────────────────────────────────────────────────────────────
    if (tur === 'sayfalar') {
      const [res] = await client.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [suanki],
        dimensions: [{ name: 'landingPagePlusQueryString' }],
        metrics: [
          { name: 'sessions' },
          { name: 'bounceRate' },
          { name: 'purchaseRevenue' },
          { name: 'transactions' },
          { name: 'addToCarts' },
        ],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 200,
      })

      const data = (res.rows || []).map(row => {
        const sessions    = metrikleri(row.metricValues, 0)
        const bounceRate  = metrikleri(row.metricValues, 1, 100, 1)
        const gelir       = metrikleri(row.metricValues, 2, 1, 2)
        const islem       = metrikleri(row.metricValues, 3)
        const sepetEkleme = metrikleri(row.metricValues, 4)
        const donusumOrani   = sessions > 0 ? parseFloat(((islem / sessions) * 100).toFixed(2)) : 0
        const sepetOrani     = sessions > 0 ? parseFloat(((sepetEkleme / sessions) * 100).toFixed(1)) : 0
        // Fırsat: çok oturum, düşük dönüşüm → yüksek skor
        const firsatSkor = sessions > 50 && donusumOrani === 0 ? 100
          : sessions > 0 && donusumOrani < 2 ? parseFloat(((1 - donusumOrani / 5) * 100).toFixed(0))
          : 0
        return { sayfa: row.dimensionValues?.[0]?.value || '', sessions, bounceRate, gelir, islem, sepetEkleme, donusumOrani, sepetOrani, firsatSkor }
      })
      return NextResponse.json({ tur: 'sayfalar', data })
    }

    // ── Funnel ────────────────────────────────────────────────────────────────
    if (tur === 'funnel') {
      const [res] = await client.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [suanki],
        metrics: [
          { name: 'sessions' },
          { name: 'addToCarts' },
          { name: 'checkouts' },
          { name: 'transactions' },
          { name: 'purchaseRevenue' },
        ],
      })

      const row = res.rows?.[0]?.metricValues
      const sessions = metrikleri(row, 0)
      const sepet    = metrikleri(row, 1)
      const odeme    = metrikleri(row, 2)
      const satis    = metrikleri(row, 3)
      const gelir    = metrikleri(row, 4, 1, 2)

      return NextResponse.json({
        tur: 'funnel',
        data: {
          adimlar: [
            { ad: 'Oturum',       sayi: sessions, oran: 100 },
            { ad: 'Sepete Ekle',  sayi: sepet,    oran: sessions > 0 ? parseFloat(((sepet / sessions) * 100).toFixed(1)) : 0 },
            { ad: 'Ödeme Başlat', sayi: odeme,    oran: sessions > 0 ? parseFloat(((odeme / sessions) * 100).toFixed(1)) : 0 },
            { ad: 'Satın Alma',   sayi: satis,    oran: sessions > 0 ? parseFloat(((satis / sessions) * 100).toFixed(1)) : 0 },
          ],
          gelir,
        }
      })
    }

    // ── Ürünler (Top 20) ─────────────────────────────────────────────────────
    if (tur === 'urunler') {
      const [res] = await client.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [suanki],
        dimensions: [{ name: 'itemName' }],
        metrics: [
          { name: 'itemRevenue' },
          { name: 'itemsPurchased' },
          { name: 'itemsViewed' },
          { name: 'itemsAddedToCart' },
        ],
        orderBys: [{ metric: { metricName: 'itemRevenue' }, desc: true }],
        limit: 200,
      })

      const toplamGelir = (res.rows || []).reduce((s, r) => s + parseFloat(r.metricValues?.[0]?.value || '0'), 0)

      const data = (res.rows || []).map(row => {
        const gelir     = metrikleri(row.metricValues, 0, 1, 2)
        const adet      = metrikleri(row.metricValues, 1)
        const gorunum   = metrikleri(row.metricValues, 2)
        const sepet     = metrikleri(row.metricValues, 3)
        const gelirPay  = toplamGelir > 0 ? parseFloat(((gelir / toplamGelir) * 100).toFixed(1)) : 0
        // Fırsat skoru: çok görülüp az satılıyorsa yüksek
        const firsatSkor = gorunum > 0 && adet === 0 ? 100 : gorunum > 0 ? parseFloat(((1 - adet / gorunum) * 100).toFixed(0)) : 0

        return {
          urun:       row.dimensionValues?.[0]?.value || '',
          gelir,
          adet,
          gorunum,
          sepet,
          gelirPay,
          firsatSkor,
        }
      })

      return NextResponse.json({ tur: 'urunler', data, toplamGelir: parseFloat(toplamGelir.toFixed(2)) })
    }

    return NextResponse.json({ error: 'Geçersiz tür' }, { status: 400 })

  } catch (e) {
    const mesaj = e instanceof Error ? e.message : String(e)
    console.error('GA4 API Hatası:', mesaj)
    return NextResponse.json({ error: mesaj }, { status: 500 })
  }
}
