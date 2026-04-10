import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: Request) {
  try {
    const { kampanyalar, hesapAdi, donem, model } = await request.json()

    if (!kampanyalar || kampanyalar.length === 0) {
      return NextResponse.json({ error: 'Kampanya verisi bulunamadı' }, { status: 400 })
    }

    // durum: 2 = ENABLED (Google Ads API sayısal enum döndürür)
    const aktifKampanyalar = kampanyalar.filter((k: { durum: number }) => k.durum === 2)
    const analizKampanyalar = aktifKampanyalar.length > 0 ? aktifKampanyalar : kampanyalar

    const ozet = analizKampanyalar.slice(0, 20).map((k: {
      ad: string; tip: string; harcama: string; tiklama: number
      gosterim: number; ctr: string; donusum: number; gelir: string
      roas: string; ort_cpc: string; donusum_maliyet: string
    }) => ({
      kampanya: k.ad,
      tip: k.tip,
      harcama: `₺${k.harcama}`,
      tiklama: k.tiklama,
      gosterim: k.gosterim,
      ctr: `%${k.ctr}`,
      donusum: k.donusum,
      gelir: `₺${k.gelir}`,
      roas: `${k.roas}x`,
      cpc: `₺${k.ort_cpc}`,
      donusum_maliyet: `₺${k.donusum_maliyet}`,
    }))

    const toplamHarcama = analizKampanyalar.reduce((a: number, k: { harcama: string }) => a + parseFloat(k.harcama), 0)
    const toplamGelir = analizKampanyalar.reduce((a: number, k: { gelir: string }) => a + parseFloat(k.gelir), 0)
    const toplamRoas = toplamHarcama > 0 ? toplamGelir / toplamHarcama : 0
    const toplamDonusum = analizKampanyalar.reduce((a: number, k: { donusum: number }) => a + k.donusum, 0)

    const prompt = `Sen 10 yıllık deneyimli bir Google Ads uzmanısın. ${hesapAdi} markasının Google Ads kampanyalarını analiz et.

Dönem: ${donem}
Toplam Harcama: ₺${toplamHarcama.toFixed(2)}
Toplam Gelir: ₺${toplamGelir.toFixed(2)}
Genel ROAS: ${toplamRoas.toFixed(2)}x
Toplam Dönüşüm: ${toplamDonusum}

Kampanya Detayları (${analizKampanyalar.length} kampanya):
${JSON.stringify(ozet, null, 2)}

Türkiye e-ticaret ortalamaları: İyi ROAS = 3x+, Orta = 1.5-3x, Kötü = 1.5x altı. Google Ads'de Search kampanyaları için CTR %3+ iyi, PMax için ROAS odaklanılmalı.

Aşağıdaki JSON formatında yanıt ver (başka hiçbir şey yazma, sadece JSON):

{
  "ozet": "2-3 cümle genel değerlendirme. Dönem, toplam harcama ve ROAS yorumu içersin.",
  "toplamHarcama": "₺X.XXX",
  "toplamGelir": "₺X.XXX",
  "genelRoas": "X.XX",
  "acil": [
    {
      "kampanya": "kampanya adı",
      "sorun": "sorunun kısa açıklaması (düşük ROAS, yüksek CPC, negatif ROAS vb.)",
      "aksiyonlar": ["somut aksiyon 1", "somut aksiyon 2", "somut aksiyon 3"]
    }
  ],
  "iyilestir": [
    {
      "kampanya": "kampanya adı",
      "sorun": "iyileştirme fırsatı açıklaması",
      "aksiyonlar": ["aksiyon 1", "aksiyon 2"]
    }
  ],
  "iyi": [
    {
      "kampanya": "kampanya adı",
      "neden": "neden iyi performans gösteriyor",
      "oneri": "bütçe artırma veya ölçekleme önerisi"
    }
  ],
  "stratejik": [
    "Google Ads hesabı geneline yönelik stratejik öneri 1",
    "stratejik öneri 2",
    "stratejik öneri 3",
    "stratejik öneri 4",
    "stratejik öneri 5"
  ],
  "butce": [
    {"kategori": "Search", "yuzde": 40, "aciklama": "kısa açıklama"},
    {"kategori": "PMax", "yuzde": 35, "aciklama": "kısa açıklama"},
    {"kategori": "Diğer", "yuzde": 25, "aciklama": "kısa açıklama"}
  ]
}`

    const usedModel = model || 'claude-haiku-4-5-20251001'
    const response = await client.messages.create({
      model: usedModel,
      max_tokens: 2500,
      messages: [{ role: 'user', content: prompt }]
    })

    const icerik = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = icerik.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'AI yanıtı geçersiz format döndürdü' }, { status: 500 })
    }

    const analizData = JSON.parse(jsonMatch[0])
    return NextResponse.json({ analiz: analizData })

  } catch (e) {
    const mesaj = e instanceof Error ? e.message : JSON.stringify(e)
    return NextResponse.json({ error: mesaj }, { status: 500 })
  }
}
