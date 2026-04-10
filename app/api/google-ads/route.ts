import { NextResponse } from 'next/server'
import { GoogleAdsApi } from 'google-ads-api'

const client = new GoogleAdsApi({
  client_id: process.env.GOOGLE_CLIENT_ID!,
  client_secret: process.env.GOOGLE_CLIENT_SECRET!,
  developer_token: process.env.GOOGLE_DEVELOPER_TOKEN!,
})

const HESAPLAR: Record<string, string> = {
  karmen: '4728177550',
  cotto: '3460842992',
}

// Kampanya tipi kodu → okunabilir ad
const KAMPANYA_TIPI: Record<number, string> = {
  2:  'Search',
  3:  'Display',
  4:  'Shopping',
  5:  'Hotel',
  6:  'Video',
  10: 'Performance Max',
  12: 'Local',
  13: 'Smart',
  14: 'Demand Gen',
  15: 'Travel',
}

// Dönem → GAQL
function donemSql(donem: string, baslangic?: string, bitis?: string): string {
  if (baslangic && bitis) return `segments.date BETWEEN '${baslangic}' AND '${bitis}'`
  const preset: Record<string, string> = {
    '0': 'TODAY',
    '1': 'YESTERDAY',
    '7': 'LAST_7_DAYS',
    '14': 'LAST_14_DAYS',
    '30': 'LAST_30_DAYS',
    'bu_ay': 'THIS_MONTH',
    '90': 'LAST_90_DAYS',
    '180': 'LAST_180_DAYS',
  }
  return `segments.date DURING ${preset[donem] || 'LAST_30_DAYS'}`
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const hesap     = searchParams.get('hesap') || 'karmen'
  const tur       = searchParams.get('tur') || 'kampanyalar'
  const donem     = searchParams.get('donem') || '30'
  const baslangic = searchParams.get('baslangic') || ''
  const bitis     = searchParams.get('bitis') || ''
  const customerId = HESAPLAR[hesap]

  if (!customerId) return NextResponse.json({ error: 'Geçersiz hesap' }, { status: 400 })

  try {
    const customer = client.Customer({
      customer_id: customerId,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN!,
    })

    const tarihKosul = donemSql(donem, baslangic, bitis)

    // ── Kampanyalar ───────────────────────────────────────────────
    if (tur === 'kampanyalar') {
      // Ana sorgu + konversiyon kırılım sorgusunu paralel çek
      const [rows, konvRows] = await Promise.all([
        customer.query(`
          SELECT
            campaign.id,
            campaign.name,
            campaign.status,
            campaign.advertising_channel_type,
            campaign.bidding_strategy_type,
            metrics.cost_micros,
            metrics.clicks,
            metrics.impressions,
            metrics.ctr,
            metrics.conversions,
            metrics.conversions_value,
            metrics.average_cpc,
            metrics.average_cpm,
            metrics.cost_per_conversion,
            metrics.all_conversions,
            metrics.all_conversions_value,
            metrics.view_through_conversions,
            metrics.search_impression_share,
            metrics.search_top_impression_share,
            metrics.search_absolute_top_impression_share
          FROM campaign
          WHERE ${tarihKosul}
            AND campaign.status != 'REMOVED'
          ORDER BY metrics.cost_micros DESC
          LIMIT 100
        `),
        customer.query(`
          SELECT
            campaign.id,
            segments.conversion_action_category,
            metrics.conversions
          FROM campaign
          WHERE ${tarihKosul}
            AND campaign.status != 'REMOVED'
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        `).catch(() => [] as any[])
      ])

      // Kampanya bazlı satın alma ve sepete ekle sayılarını ayır
      const konvMap: Record<string, { satin_alma: number; sepet: number }> = {}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const row of konvRows as any[]) {
        const cid = String(row.campaign?.id)
        if (!konvMap[cid]) konvMap[cid] = { satin_alma: 0, sepet: 0 }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cat = (row.segments as any)?.conversion_action_category
        const val = row.metrics?.conversions || 0
        if (cat === 'PURCHASE') konvMap[cid].satin_alma += val
        else if (cat === 'ADD_TO_CART') konvMap[cid].sepet += val
      }

      const data = rows.map(r => {
        const harcama = (r.metrics?.cost_micros || 0) / 1_000_000
        const gelir   = r.metrics?.conversions_value || 0
        const cid = String(r.campaign?.id)
        const konv = konvMap[cid] || { satin_alma: 0, sepet: 0 }

        // Eğer konversiyon kırılımı geldiyse sadece purchase say, yoksa genel conversions kullan
        const satinAlma = konv.satin_alma > 0 || konv.sepet > 0
          ? konv.satin_alma
          : (r.metrics?.conversions || 0)

        return {
          id:           r.campaign?.id,
          ad:           r.campaign?.name,
          durum:        r.campaign?.status,
          tip:          KAMPANYA_TIPI[r.campaign?.advertising_channel_type as number] || 'Diğer',
          tipKod:       r.campaign?.advertising_channel_type,
          teklif:       r.campaign?.bidding_strategy_type,
          harcama:      harcama.toFixed(2),
          tiklama:      r.metrics?.clicks || 0,
          gosterim:     r.metrics?.impressions || 0,
          ctr:          ((r.metrics?.ctr || 0) * 100).toFixed(2),
          donusum:      Number(satinAlma.toFixed(1)),          // sadece satın alma
          sepet:        Math.round(konv.sepet),                // sepete ekle
          gelir:        gelir.toFixed(2),
          roas:         harcama > 0 ? (gelir / harcama).toFixed(2) : '0',
          ort_cpc:      ((r.metrics?.average_cpc || 0) / 1_000_000).toFixed(2),
          ort_cpm:      ((r.metrics?.average_cpm || 0) / 1_000_000).toFixed(2),
          donusum_maliyet: ((r.metrics?.cost_per_conversion || 0) / 1_000_000).toFixed(2),
          donusum_orani:   '0',
          tum_donusum:     Number((r.metrics?.all_conversions || 0).toFixed(1)),
          tum_gelir:       (r.metrics?.all_conversions_value || 0).toFixed(2),
          gorunum_donusum: r.metrics?.view_through_conversions || 0,
          gosterim_payi:   r.metrics?.search_impression_share != null
            ? ((r.metrics.search_impression_share) * 100).toFixed(1)
            : null,
          ust_gosterim_payi: r.metrics?.search_top_impression_share != null
            ? ((r.metrics.search_top_impression_share) * 100).toFixed(1)
            : null,
        }
      })

      return NextResponse.json({ data })
    }

    // ── Reklam Grupları ───────────────────────────────────────────
    if (tur === 'reklam-gruplari') {
      const kampanyaId = searchParams.get('kampanya_id')
      const where = kampanyaId
        ? `campaign.id = '${kampanyaId}' AND`
        : ''

      const rows = await customer.query(`
        SELECT
          ad_group.id,
          ad_group.name,
          ad_group.status,
          campaign.name,
          metrics.cost_micros,
          metrics.clicks,
          metrics.impressions,
          metrics.ctr,
          metrics.conversions,
          metrics.conversions_value,
          metrics.average_cpc
        FROM ad_group
        WHERE ${where} ${tarihKosul}
          AND ad_group.status != 'REMOVED'
        ORDER BY metrics.cost_micros DESC
        LIMIT 100
      `)

      const data = rows.map(r => {
        const harcama = (r.metrics?.cost_micros || 0) / 1_000_000
        const gelir   = r.metrics?.conversions_value || 0
        return {
          id:       r.ad_group?.id,
          ad:       r.ad_group?.name,
          kampanya: r.campaign?.name,
          durum:    r.ad_group?.status,
          harcama:  harcama.toFixed(2),
          tiklama:  r.metrics?.clicks || 0,
          gosterim: r.metrics?.impressions || 0,
          ctr:      ((r.metrics?.ctr || 0) * 100).toFixed(2),
          donusum:  Number((r.metrics?.conversions || 0).toFixed(1)),
          gelir:    gelir.toFixed(2),
          roas:     harcama > 0 ? (gelir / harcama).toFixed(2) : '0',
          ort_cpc:  ((r.metrics?.average_cpc || 0) / 1_000_000).toFixed(2),
        }
      })

      return NextResponse.json({ data })
    }

    // ── Anahtar Kelimeler ─────────────────────────────────────────
    if (tur === 'anahtar-kelimeler') {
      const kampanyaId = searchParams.get('kampanya_id')
      const where = kampanyaId ? `campaign.id = '${kampanyaId}' AND` : ''

      const rows = await customer.query(`
        SELECT
          ad_group_criterion.keyword.text,
          ad_group_criterion.keyword.match_type,
          ad_group_criterion.status,
          ad_group_criterion.quality_info.quality_score,
          ad_group_criterion.quality_info.search_predicted_ctr,
          ad_group_criterion.quality_info.ad_relevance,
          ad_group_criterion.quality_info.landing_page_experience,
          ad_group.name,
          campaign.name,
          metrics.cost_micros,
          metrics.clicks,
          metrics.impressions,
          metrics.ctr,
          metrics.conversions,
          metrics.conversions_value,
          metrics.average_cpc,
          metrics.search_impression_share
        FROM keyword_view
        WHERE ${where} ${tarihKosul}
          AND campaign.status != 'REMOVED'
          AND ad_group.status != 'REMOVED'
          AND ad_group_criterion.status != 'REMOVED'
        ORDER BY metrics.cost_micros DESC
        LIMIT 150
      `)

      const ESLEME: Record<string, string> = { EXACT: 'Tam', PHRASE: 'İfade', BROAD: 'Geniş' }
      const QS_LABEL: Record<string, string> = {
        BELOW_AVERAGE: 'Düşük', AVERAGE: 'Orta', ABOVE_AVERAGE: 'Yüksek', UNKNOWN: '—', UNSPECIFIED: '—'
      }
      const data = rows.map(r => {
        const harcama = (r.metrics?.cost_micros || 0) / 1_000_000
        const gelir = r.metrics?.conversions_value || 0
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const qi = (r.ad_group_criterion as any)?.quality_info
        return {
          kelime:      r.ad_group_criterion?.keyword?.text || '',
          esleme:      ESLEME[(r.ad_group_criterion?.keyword?.match_type as string) || ''] || '—',
          grup:        r.ad_group?.name || '',
          kampanya:    r.campaign?.name || '',
          durum:       r.ad_group_criterion?.status,
          harcama:     harcama.toFixed(2),
          tiklama:     r.metrics?.clicks || 0,
          gosterim:    r.metrics?.impressions || 0,
          ctr:         ((r.metrics?.ctr || 0) * 100).toFixed(2),
          donusum:     Number((r.metrics?.conversions || 0).toFixed(1)),
          gelir:       gelir.toFixed(2),
          roas:        harcama > 0 ? (gelir / harcama).toFixed(2) : '0',
          ort_cpc:     ((r.metrics?.average_cpc || 0) / 1_000_000).toFixed(2),
          gosterim_payi: r.metrics?.search_impression_share != null
            ? ((r.metrics.search_impression_share) * 100).toFixed(1) : null,
          qs:              qi?.quality_score ?? null,
          qs_ctr:          QS_LABEL[qi?.search_predicted_ctr || ''] || null,
          qs_alakalilik:   QS_LABEL[qi?.ad_relevance || ''] || null,
          qs_landing:      QS_LABEL[qi?.landing_page_experience || ''] || null,
        }
      })
      return NextResponse.json({ data })
    }

    // ── Cihaz Kırılımı ────────────────────────────────────────────
    if (tur === 'cihaz-kirilim') {
      const kampanyaId = searchParams.get('kampanya_id')
      const where = kampanyaId ? `campaign.id = '${kampanyaId}' AND` : ''

      const rows = await customer.query(`
        SELECT
          segments.device,
          metrics.cost_micros,
          metrics.clicks,
          metrics.impressions,
          metrics.ctr,
          metrics.conversions,
          metrics.conversions_value,
          metrics.average_cpc
        FROM campaign
        WHERE ${where} ${tarihKosul}
          AND campaign.status != 'REMOVED'
      `)

      const CIHAZ: Record<string, string> = {
        DESKTOP: 'Masaüstü', MOBILE: 'Mobil', TABLET: 'Tablet', OTHER: 'Diğer'
      }
      const map: Record<string, { harcama: number; tiklama: number; gosterim: number; donusum: number; gelir: number }> = {}
      for (const r of rows) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cihaz = CIHAZ[(r.segments as any)?.device] || 'Diğer'
        if (!map[cihaz]) map[cihaz] = { harcama: 0, tiklama: 0, gosterim: 0, donusum: 0, gelir: 0 }
        map[cihaz].harcama  += (r.metrics?.cost_micros || 0) / 1_000_000
        map[cihaz].tiklama  += r.metrics?.clicks || 0
        map[cihaz].gosterim += r.metrics?.impressions || 0
        map[cihaz].donusum  += r.metrics?.conversions || 0
        map[cihaz].gelir    += r.metrics?.conversions_value || 0
      }
      const data = Object.entries(map).map(([cihaz, m]) => ({
        cihaz,
        harcama:  m.harcama.toFixed(2),
        tiklama:  m.tiklama,
        gosterim: m.gosterim,
        ctr:      m.gosterim > 0 ? ((m.tiklama / m.gosterim) * 100).toFixed(2) : '0',
        donusum:  Number(m.donusum.toFixed(1)),
        gelir:    m.gelir.toFixed(2),
        roas:     m.harcama > 0 ? (m.gelir / m.harcama).toFixed(2) : '0',
        ort_cpc:  m.tiklama > 0 ? (m.harcama / m.tiklama).toFixed(2) : '0',
      })).sort((a, b) => parseFloat(b.harcama) - parseFloat(a.harcama))
      return NextResponse.json({ data })
    }

    // ── Günlük Trend ──────────────────────────────────────────────
    if (tur === 'gunluk') {
      const kampanyaId = searchParams.get('kampanya_id')
      const where = kampanyaId ? `campaign.id = '${kampanyaId}' AND` : ''

      const rows = await customer.query(`
        SELECT
          segments.date,
          metrics.cost_micros,
          metrics.clicks,
          metrics.impressions,
          metrics.conversions,
          metrics.conversions_value
        FROM campaign
        WHERE ${where} ${tarihKosul}
          AND campaign.status != 'REMOVED'
        ORDER BY segments.date ASC
      `)

      const map: Record<string, { harcama: number; tiklama: number; gosterim: number; donusum: number; gelir: number }> = {}
      for (const r of rows) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tarih = (r.segments as any)?.date || ''
        if (!map[tarih]) map[tarih] = { harcama: 0, tiklama: 0, gosterim: 0, donusum: 0, gelir: 0 }
        map[tarih].harcama  += (r.metrics?.cost_micros || 0) / 1_000_000
        map[tarih].tiklama  += r.metrics?.clicks || 0
        map[tarih].gosterim += r.metrics?.impressions || 0
        map[tarih].donusum  += r.metrics?.conversions || 0
        map[tarih].gelir    += r.metrics?.conversions_value || 0
      }
      const data = Object.entries(map).map(([tarih, m]) => ({
        tarih,
        harcama:  m.harcama.toFixed(2),
        tiklama:  m.tiklama,
        gosterim: m.gosterim,
        donusum:  Number(m.donusum.toFixed(1)),
        gelir:    m.gelir.toFixed(2),
        roas:     m.harcama > 0 ? (m.gelir / m.harcama).toFixed(2) : '0',
      }))
      return NextResponse.json({ data })
    }

    // ── Reklam Metinleri ─────────────────────────────────────────
    if (tur === 'reklam-metinleri') {
      const kampanyaId = searchParams.get('kampanya_id')
      const where = kampanyaId ? `campaign.id = '${kampanyaId}' AND` : ''

      const rows = await customer.query(`
        SELECT
          ad_group_ad.ad.id,
          ad_group_ad.status,
          ad_group_ad.ad.type,
          ad_group_ad.ad.responsive_search_ad.headlines,
          ad_group_ad.ad.responsive_search_ad.descriptions,
          ad_group_ad.ad.expanded_text_ad.headline_part1,
          ad_group_ad.ad.expanded_text_ad.headline_part2,
          ad_group_ad.ad.expanded_text_ad.headline_part3,
          ad_group_ad.ad.expanded_text_ad.description,
          ad_group_ad.ad.expanded_text_ad.description2,
          ad_group_ad.ad.final_urls,
          ad_group.name,
          metrics.cost_micros,
          metrics.clicks,
          metrics.impressions,
          metrics.ctr,
          metrics.conversions,
          metrics.conversions_value,
          metrics.average_cpc
        FROM ad_group_ad
        WHERE ${where} ${tarihKosul}
          AND campaign.status != 'REMOVED'
          AND ad_group_ad.status != 'REMOVED'
        ORDER BY metrics.cost_micros DESC
        LIMIT 50
      `)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = rows.map((r: any) => {
        const harcama = (r.metrics?.cost_micros || 0) / 1_000_000
        const gelir   = r.metrics?.conversions_value || 0
        const ad      = r.ad_group_ad?.ad
        const tip     = ad?.type

        // RSA başlıkları ve açıklamaları
        const rsaBasliklar: string[] = (ad?.responsive_search_ad?.headlines || [])
          .map((h: { text?: string }) => h.text || '').filter(Boolean)
        const rsaAciklamalar: string[] = (ad?.responsive_search_ad?.descriptions || [])
          .map((d: { text?: string }) => d.text || '').filter(Boolean)

        // ETA (eski genişletilmiş metin reklamı)
        const etaBaslik = [
          ad?.expanded_text_ad?.headline_part1,
          ad?.expanded_text_ad?.headline_part2,
          ad?.expanded_text_ad?.headline_part3,
        ].filter(Boolean).join(' | ')
        const etaAciklama = [
          ad?.expanded_text_ad?.description,
          ad?.expanded_text_ad?.description2,
        ].filter(Boolean).join(' ')

        return {
          id:          ad?.id,
          grup:        r.ad_group?.name || '',
          tip:         tip === 15 ? 'RSA' : tip === 3 ? 'ETA' : 'Diğer',
          basliklar:   rsaBasliklar.length > 0 ? rsaBasliklar : etaBaslik ? [etaBaslik] : [],
          aciklamalar: rsaAciklamalar.length > 0 ? rsaAciklamalar : etaAciklama ? [etaAciklama] : [],
          url:         (ad?.final_urls || [])[0] || '',
          harcama:     harcama.toFixed(2),
          tiklama:     r.metrics?.clicks || 0,
          gosterim:    r.metrics?.impressions || 0,
          ctr:         ((r.metrics?.ctr || 0) * 100).toFixed(2),
          donusum:     Number((r.metrics?.conversions || 0).toFixed(1)),
          gelir:       gelir.toFixed(2),
          roas:        harcama > 0 ? (gelir / harcama).toFixed(2) : '0',
          ort_cpc:     ((r.metrics?.average_cpc || 0) / 1_000_000).toFixed(2),
        }
      })
      return NextResponse.json({ data })
    }

    // ── Arama Terimleri ──────────────────────────────────────────
    if (tur === 'arama-terimleri') {
      const kampanyaId = searchParams.get('kampanya_id')
      const where = kampanyaId ? `campaign.id = '${kampanyaId}' AND` : ''

      const rows = await customer.query(`
        SELECT
          search_term_view.search_term,
          search_term_view.status,
          ad_group.name,
          campaign.name,
          metrics.cost_micros,
          metrics.clicks,
          metrics.impressions,
          metrics.ctr,
          metrics.conversions,
          metrics.conversions_value,
          metrics.average_cpc
        FROM search_term_view
        WHERE ${where} ${tarihKosul}
          AND campaign.status != 'REMOVED'
        ORDER BY metrics.cost_micros DESC
        LIMIT 200
      `)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = rows.map((r: any) => {
        const harcama = (r.metrics?.cost_micros || 0) / 1_000_000
        const gelir   = r.metrics?.conversions_value || 0
        const donusum = r.metrics?.conversions || 0
        const tiklama = r.metrics?.clicks || 0
        const gosterim = r.metrics?.impressions || 0

        // Negatif aday: yüksek harcama + 0 dönüşüm VEYA çok düşük CTR
        const ctr = (r.metrics?.ctr || 0) * 100
        const negatifAday = (harcama > 50 && donusum === 0) || (gosterim > 500 && ctr < 0.5)

        return {
          terim:       r.search_term_view?.search_term || '',
          durum:       r.search_term_view?.status || '',   // ADDED, EXCLUDED, ADDED_EXCLUDED, NONE
          grup:        r.ad_group?.name || '',
          harcama:     harcama.toFixed(2),
          tiklama,
          gosterim,
          ctr:         ctr.toFixed(2),
          donusum:     Number(donusum.toFixed(1)),
          gelir:       gelir.toFixed(2),
          roas:        harcama > 0 ? (gelir / harcama).toFixed(2) : '0',
          ort_cpc:     ((r.metrics?.average_cpc || 0) / 1_000_000).toFixed(2),
          negatifAday,
        }
      })
      return NextResponse.json({ data })
    }

    // ── Asset Grupları (PMax) ────────────────────────────────────
    if (tur === 'asset-gruplari') {
      const kampanyaId = searchParams.get('kampanya_id')
      const where = kampanyaId ? `campaign.id = '${kampanyaId}' AND` : ''

      const AD_STRENGTH: Record<string, string> = {
        EXCELLENT: 'Mükemmel', GOOD: 'İyi', FAIR: 'Orta',
        POOR: 'Zayıf', PENDING: 'Bekleniyor', NO_ADS: 'Reklam Yok',
        UNSPECIFIED: '—', UNKNOWN: '—',
      }

      const [grpRows, assetRows] = await Promise.all([
        customer.query(`
          SELECT
            asset_group.id,
            asset_group.name,
            asset_group.status,
            asset_group.ad_strength,
            metrics.impressions,
            metrics.clicks,
            metrics.conversions,
            metrics.conversions_value,
            metrics.cost_micros
          FROM asset_group
          WHERE ${where} asset_group.status != 'REMOVED'
          ORDER BY metrics.cost_micros DESC
          LIMIT 20
        `),
        customer.query(`
          SELECT
            asset_group.id,
            asset_group.name,
            asset_group_asset.field_type,
            asset_group_asset.performance_label,
            asset.type,
            asset.text_asset.text,
            asset.image_asset.full_size.url,
            asset.youtube_video_asset.youtube_video_id
          FROM asset_group_asset
          WHERE ${where} asset_group_asset.status != 'REMOVED'
          LIMIT 300
        `).catch(() => [] as unknown[])
      ])

      const PERF_LABEL: Record<string, string> = {
        BEST: 'En İyi', GOOD: 'İyi', LOW: 'Düşük',
        PENDING: 'Öğreniyor', UNSPECIFIED: '—', UNKNOWN: '—',
      }
      const FIELD_TYPE: Record<string, string> = {
        HEADLINE: 'Başlık', LONG_HEADLINE: 'Uzun Başlık', DESCRIPTION: 'Açıklama',
        MARKETING_IMAGE: 'Görsel', SQUARE_MARKETING_IMAGE: 'Kare Görsel',
        PORTRAIT_MARKETING_IMAGE: 'Dikey Görsel', LOGO: 'Logo',
        YOUTUBE_VIDEO: 'Video', CALL_TO_ACTION_SELECTION: 'CTA',
        BUSINESS_NAME: 'Marka Adı', SITELINK: 'Site Bağlantısı',
      }

      // Asset'leri grup id'sine göre gruplandır
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const assetMap: Record<string, { tur: string; metin: string; perf: string; perfLabel: string }[]> = {}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const r of assetRows as any[]) {
        const grpId = String(r.asset_group?.id || '')
        if (!assetMap[grpId]) assetMap[grpId] = []
        const asset = r.asset
        let metin = ''
        if (asset?.text_asset?.text) metin = asset.text_asset.text
        else if (asset?.image_asset?.full_size?.url) metin = asset.image_asset.full_size.url
        else if (asset?.youtube_video_asset?.youtube_video_id) metin = `youtube:${asset.youtube_video_asset.youtube_video_id}`

        const perfRaw = r.asset_group_asset?.performance_label || ''
        assetMap[grpId].push({
          tur:       FIELD_TYPE[r.asset_group_asset?.field_type || ''] || r.asset_group_asset?.field_type || '—',
          metin,
          perf:      perfRaw,
          perfLabel: PERF_LABEL[perfRaw] || '—',
        })
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = (grpRows as any[]).map(r => {
        const harcama = (r.metrics?.cost_micros || 0) / 1_000_000
        const gelir   = r.metrics?.conversions_value || 0
        const grpId   = String(r.asset_group?.id || '')
        return {
          id:         grpId,
          ad:         r.asset_group?.name || '',
          guc:        AD_STRENGTH[r.asset_group?.ad_strength || ''] || '—',
          harcama:    harcama.toFixed(2),
          tiklama:    r.metrics?.clicks || 0,
          gosterim:   r.metrics?.impressions || 0,
          donusum:    Number((r.metrics?.conversions || 0).toFixed(1)),
          gelir:      gelir.toFixed(2),
          roas:       harcama > 0 ? (gelir / harcama).toFixed(2) : '0',
          assetler:   assetMap[grpId] || [],
        }
      })
      return NextResponse.json({ data })
    }

    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 })

  } catch (e) {
    let mesaj = 'Bilinmeyen hata'
    if (e instanceof Error) {
      mesaj = e.message
    } else if (typeof e === 'object' && e !== null) {
      mesaj = JSON.stringify(e)
    } else if (typeof e === 'string') {
      mesaj = e
    }
    return NextResponse.json({ error: mesaj }, { status: 500 })
  }
}
