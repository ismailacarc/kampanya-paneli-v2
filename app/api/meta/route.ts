import { NextResponse } from 'next/server'

const TOKEN = process.env.META_ACCESS_TOKEN

const HESAPLAR: Record<string, string> = {
  karmen: process.env.META_ACCOUNT_ID || '',
  cotto: process.env.COTTO_ACCOUNT_ID || '',
}

const INSIGHTS = 'spend,impressions,clicks,ctr,cpc,actions,action_values'

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
    const preset = donem === '7' ? 'last_7d' : donem === '14' ? 'last_14d' : donem === '90' ? 'last_90d' : donem === '180' ? 'last_180d' : 'last_30d'
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
