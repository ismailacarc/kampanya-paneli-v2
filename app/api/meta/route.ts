import { NextResponse } from 'next/server'

const TOKEN = process.env.META_ACCESS_TOKEN

const HESAPLAR: Record<string, string> = {
  karmen: process.env.META_ACCOUNT_ID || '',
  cotto: process.env.COTTO_ACCOUNT_ID || '',
}

const INSIGHTS = 'spend,impressions,clicks,ctr,cpc,frequency,cpm,actions,action_values'
const KREATIF_INSIGHTS = 'spend,impressions,clicks,ctr,cpc,frequency,cpm,actions,action_values'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const hesap = searchParams.get('hesap') || 'karmen'
  const tur = searchParams.get('tur') || 'kampanyalar'
  const kampanyaId = searchParams.get('kampanya_id')
  const setId = searchParams.get('set_id')
  const donem = searchParams.get('donem') || '30'
  const baslangic = searchParams.get('baslangic')
  const bitis = searchParams.get('bitis')

  const ACCOUNT_ID = HESAPLAR[hesap]
  if (!ACCOUNT_ID) return NextResponse.json({ error: 'Geçersiz hesap' }, { status: 400 })

  // Tarih aralığı veya preset
  let insightsParam = ''
  if (baslangic && bitis) {
    insightsParam = `insights.time_range({'since':'${baslangic}','until':'${bitis}'}){${INSIGHTS}}`
  } else {
    const preset = donem === '1' ? 'today' : donem === '7' ? 'last_7d' : donem === '14' ? 'last_14d' : donem === '90' ? 'last_90d' : donem === '180' ? 'last_180d' : donem === 'bu_ay' ? 'this_month' : 'last_30d'
    insightsParam = `insights.date_preset(${preset}){${INSIGHTS}}`
  }

  try {
    let url = ''

    if (tur === 'kampanyalar') {
      url = `https://graph.facebook.com/v19.0/act_${ACCOUNT_ID}/campaigns?fields=name,status,daily_budget,lifetime_budget,${insightsParam}&limit=50&access_token=${TOKEN}`
    } else if (tur === 'reklam-setleri' && kampanyaId) {
      url = `https://graph.facebook.com/v19.0/${kampanyaId}/adsets?fields=name,status,daily_budget,${insightsParam}&limit=50&access_token=${TOKEN}`
    } else if (tur === 'reklamlar' && setId) {
      url = `https://graph.facebook.com/v19.0/${setId}/ads?fields=name,status,${insightsParam}&limit=50&access_token=${TOKEN}`
    } else if (tur === 'kreatifler' && kampanyaId) {
      // Kampanyadaki tüm reklamları kreatif bilgileriyle birlikte çek
      url = `https://graph.facebook.com/v19.0/act_${ACCOUNT_ID}/ads?filtering=[{"field":"campaign.id","operator":"EQUAL","value":"${kampanyaId}"}]&fields=name,status,creative{thumbnail_url,image_url,title,body,video_id,object_type},${insightsParam}&limit=100&access_token=${TOKEN}`
    } else if (tur === 'kirilim' && kampanyaId) {
      const kirilimTur = searchParams.get('kirilim') || 'publisher_platform'
      let timeParam = ''
      if (baslangic && bitis) {
        timeParam = `since=${baslangic}&until=${bitis}`
      } else {
        const preset = donem === '1' ? 'today' : donem === '7' ? 'last_7d' : donem === '14' ? 'last_14d' : donem === '90' ? 'last_90d' : donem === '180' ? 'last_180d' : donem === 'bu_ay' ? 'this_month' : 'last_30d'
        timeParam = `date_preset=${preset}`
      }
      if (kirilimTur === 'gunluk') {
        // Zaman bazlı kırılım — her gün ayrı satır
        url = `https://graph.facebook.com/v19.0/${kampanyaId}/insights?fields=spend,impressions,clicks,ctr,cpc,actions,action_values&time_increment=1&${timeParam}&limit=90&access_token=${TOKEN}`
      } else {
        // Breakdown kırılımları
        const breakdown = kirilimTur === 'age_gender' ? 'age,gender' : kirilimTur
        url = `https://graph.facebook.com/v19.0/${kampanyaId}/insights?fields=spend,impressions,clicks,actions,action_values&breakdowns=${breakdown}&${timeParam}&limit=200&access_token=${TOKEN}`
      }
    } else if (tur === 'kreatif-analiz') {
      // Hesap genelinde tüm reklamlar — kreatif + insight
      let kreatifInsightsParam = ''
      if (baslangic && bitis) {
        kreatifInsightsParam = `insights.time_range({'since':'${baslangic}','until':'${bitis}'}){${KREATIF_INSIGHTS}}`
      } else {
        const preset = donem === '7' ? 'last_7d' : donem === '14' ? 'last_14d' : donem === '90' ? 'last_90d' : donem === '60' ? 'last_60d' : 'last_30d'
        kreatifInsightsParam = `insights.date_preset(${preset}){${KREATIF_INSIGHTS}}`
      }
      url = `https://graph.facebook.com/v19.0/act_${ACCOUNT_ID}/ads?fields=name,status,creative{thumbnail_url,image_url,picture,title,body,video_id,object_type,call_to_action_type,object_story_spec{link_data{picture,image_hash},video_data{image_url,thumbnail_url}}},${kreatifInsightsParam}&limit=100&filtering=[{"field":"effective_status","operator":"IN","value":["ACTIVE","PAUSED"]}]&access_token=${TOKEN}`
    } else if (tur === 'urun-kirilim') {
      // Ürün bazlı performans — kampanya veya hesap geneli
      const cursor = searchParams.get('cursor') || ''
      let timeParam = ''
      if (baslangic && bitis) {
        timeParam = `since=${baslangic}&until=${bitis}`
      } else {
        const preset = donem === '1' ? 'today' : donem === '7' ? 'last_7d' : donem === '14' ? 'last_14d' : donem === '90' ? 'last_90d' : donem === '180' ? 'last_180d' : donem === 'bu_ay' ? 'this_month' : 'last_30d'
        timeParam = `date_preset=${preset}`
      }
      const hedef = kampanyaId
        ? `https://graph.facebook.com/v19.0/${kampanyaId}/insights`
        : `https://graph.facebook.com/v19.0/act_${ACCOUNT_ID}/insights`
      const cursorParam = cursor ? `&after=${cursor}` : ''
      url = `${hedef}?fields=spend,impressions,actions,action_values&breakdowns=product_id&${timeParam}&limit=20${cursorParam}&access_token=${TOKEN}`
    } else {
      return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 })
    }

    const response = await fetch(url)
    const data = await response.json()

    if (data.error) return NextResponse.json({ error: data.error.message }, { status: 400 })
    return NextResponse.json(data)

  } catch {
    return NextResponse.json({ error: 'API bağlantısı kurulamadı' }, { status: 500 })
  }
}
