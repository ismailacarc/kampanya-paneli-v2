import { NextResponse } from 'next/server'

const TOKEN = process.env.META_ACCESS_TOKEN

const HESAPLAR: Record<string, string> = {
  karmen: process.env.META_ACCOUNT_ID || '',
  cotto: process.env.COTTO_ACCOUNT_ID || '',
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const hesap = searchParams.get('hesap') || 'karmen'
  const ACCOUNT_ID = HESAPLAR[hesap]

  if (!ACCOUNT_ID) {
    return NextResponse.json({ error: 'Geçersiz hesap' }, { status: 400 })
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v19.0/act_${ACCOUNT_ID}/campaigns?fields=name,status,daily_budget,lifetime_budget,insights{spend,impressions,clicks,ctr,cpc,actions}&access_token=${TOKEN}`
    )

    const data = await response.json()

    if (data.error) {
      return NextResponse.json({ error: data.error.message }, { status: 400 })
    }

    return NextResponse.json(data)

  } catch {
    return NextResponse.json({ error: 'API bağlantısı kurulamadı' }, { status: 500 })
  }
}
