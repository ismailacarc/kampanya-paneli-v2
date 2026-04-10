import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: Request) {
  try {
    const { kampanyalar, hesapAdi, skipStatusFilter } = await request.json()

    if (!kampanyalar || kampanyalar.length === 0) {
      return NextResponse.json({ error: 'Kampanya verisi bulunamadı' }, { status: 400 })
    }

    // skipStatusFilter: kampanya detay sayfasından gelen istekler filtre geçer
    const aktifKampanyalar = skipStatusFilter
      ? kampanyalar
      : kampanyalar.filter((k: { status: string }) => k.status === 'ACTIVE')

    if (aktifKampanyalar.length === 0) {
      return NextResponse.json({ error: 'Aktif kampanya bulunamadı' }, { status: 400 })
    }

    const kampanyaOzeti = aktifKampanyalar.map((k: {
      name: string
      status: string
      insights?: { data: [{
        spend?: string
        impressions?: string
        clicks?: string
        ctr?: string
        cpc?: string
        actions?: { action_type: string; value: string }[]
        action_values?: { action_type: string; value: string }[]
      }] }
    }) => {
      const ins = k.insights?.data[0]
      const purchase = ins?.actions?.find((a) =>
        ['purchase', 'offsite_conversion.fb_pixel_purchase', 'omni_purchase'].includes(a.action_type)
      )
      const gelir = ins?.action_values?.find((a) =>
        ['purchase', 'offsite_conversion.fb_pixel_purchase', 'omni_purchase'].includes(a.action_type)
      )
      const harcama = parseFloat(ins?.spend || '0')
      const gelirDeger = parseFloat(gelir?.value || '0')
      const roas = harcama > 0 ? gelirDeger / harcama : 0

      return {
        kampanya: k.name,
        harcama: `₺${harcama.toFixed(2)}`,
        gelir: `₺${gelirDeger.toFixed(2)}`,
        roas: roas.toFixed(2),
        donusum: purchase?.value || '0',
        gosterim: parseInt(ins?.impressions || '0').toLocaleString('tr-TR'),
        tiklama: parseInt(ins?.clicks || '0').toLocaleString('tr-TR'),
        ctr: `%${parseFloat(ins?.ctr || '0').toFixed(2)}`,
        cpc: `₺${parseFloat(ins?.cpc || '0').toFixed(2)}`,
      }
    })

    const prompt = `Sen 10 yıllık deneyimli bir Meta Ads uzmanısın. ${hesapAdi} markasının aktif kampanyalarını analiz et.

AKTİF KAMPANYA VERİLERİ (${aktifKampanyalar.length} kampanya):
${JSON.stringify(kampanyaOzeti, null, 2)}

Türkiye e-ticaret ortalamaları: İyi ROAS = 3x+, Orta = 1.5-3x, Kötü = 1.5x altı.

Aşağıdaki JSON formatında yanıt ver (başka hiçbir şey yazma, sadece JSON):

{
  "ozet": "2-3 cümle genel değerlendirme",
  "toplamHarcama": "toplam harcama tutarı",
  "toplamGelir": "toplam gelir tutarı",
  "genelRoas": "genel ROAS",
  "acil": [
    {
      "kampanya": "kampanya adı",
      "sorun": "sorunun kısa açıklaması",
      "aksiyonlar": ["aksiyon 1", "aksiyon 2", "aksiyon 3"]
    }
  ],
  "iyilestir": [
    {
      "kampanya": "kampanya adı",
      "sorun": "iyileştirme fırsatı",
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
  "stratejik": ["öneri 1", "öneri 2", "öneri 3", "öneri 4", "öneri 5"],
  "butce": [
    {"kategori": "kategori adı", "yuzde": 40, "aciklama": "kısa açıklama"}
  ]
}`

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    })

    const icerik = message.content[0].type === 'text' ? message.content[0].text : ''

    // JSON parse et
    const jsonMatch = icerik.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ analiz: icerik, ham: true })
    }

    const analizData = JSON.parse(jsonMatch[0])
    return NextResponse.json({ analiz: analizData, ham: false })

  } catch (error) {
    console.error('AI analiz hatası:', error)
    return NextResponse.json({ error: 'AI analizi yapılamadı' }, { status: 500 })
  }
}
