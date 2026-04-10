import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: Request) {
  try {
    const { kampanyalar, hesap, donem, model } = await request.json()

    const hesapAdi = hesap === 'karmen' ? 'Karmen Halı' : 'Cotto Home'

    // Kampanya verisini özetle
    const kampanyaOzeti = kampanyalar.map((k: {
      name: string; status: string;
      insights?: { data: { spend?: string; impressions?: string; clicks?: string; ctr?: string; frequency?: string; actions?: { action_type: string; value: string }[]; action_values?: { action_type: string; value: string }[] }[] }
    }) => {
      const ins = k.insights?.data?.[0]
      const satis = ins?.actions?.find(a =>
        ['purchase', 'omni_purchase', 'offsite_conversion.fb_pixel_purchase'].includes(a.action_type)
      )?.value || '0'
      const gelir = ins?.action_values?.find(a =>
        ['purchase', 'omni_purchase', 'offsite_conversion.fb_pixel_purchase'].includes(a.action_type)
      )?.value || '0'
      const harcama = parseFloat(ins?.spend || '0')
      const gelirSayi = parseFloat(gelir)
      const roas = harcama > 0 ? (gelirSayi / harcama).toFixed(2) : '0'
      return `Kampanya: ${k.name} | Durum: ${k.status} | Harcama: ${ins?.spend || 0} TL | Gösterim: ${ins?.impressions || 0} | Tıklama: ${ins?.clicks || 0} | CTR: ${ins?.ctr || 0}% | Satış: ${satis} | Gelir: ${gelir} TL | ROAS: ${roas}x | Frekans: ${ins?.frequency || '—'}`
    }).join('\n')

    const prompt = `Sen ${hesapAdi} markasının Meta Ads hesabını analiz eden bir dijital pazarlama uzmanısın.

## HESAP VERİSİ (Son ${donem} Gün)
${kampanyaOzeti}

## GÖREVİN
Bu verileri analiz edip aşağıdaki JSON formatında somut öneriler üret.

SADECE JSON döndür, başka metin ekleme:

{
  "ozet": "string — hesabın genel performansını 3-4 cümleyle anlat. Güçlü ve zayıf noktalara değin.",
  "guclular": ["string", "string", "string"],
  "zayiflar": ["string", "string", "string"],
  "butceVerimliligi": "string — bütçe dağılımı ve verimliliği hakkında 1-2 cümle",
  "firsat": "string — en önemli büyüme veya iyileştirme fırsatı",
  "oneriler": [
    {
      "tip": "artir" | "azalt" | "kapat" | "kreatif" | "uyari" | "firsat",
      "baslik": "string — kısa aksiyon başlığı",
      "aciklama": "string — neden ve nasıl yapılacağı",
      "kampanya": "string — ilgili kampanya adı (opsiyonel)",
      "oncelik": "yuksek" | "orta" | "dusuk"
    }
  ]
}

## KURALLARIN
- ROAS < 1.5 → kapat veya kreatif değiştir (yüksek öncelik)
- ROAS 1.5–2.5 → izle veya optimize et (orta öncelik)
- ROAS > 3.0 → bütçe artır (fırsat)
- CTR < 0.8% → kreatif sorunu (yüksek öncelik)
- Frekans > 3.5 → kreatif yorgunluğu (yüksek öncelik)
- Harcama var ama satış yok → kapat (yüksek öncelik)
- En az 5 öneri üret, maksimum 10
- Önerileri öncelik sırasına göre sırala`

    const modelId = model || 'claude-sonnet-4-6'

    const message = await client.messages.create({
      model: modelId,
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    })

    const icerik = message.content[0].type === 'text' ? message.content[0].text : ''

    // JSON parse
    const mdMatch = icerik.match(/```(?:json)?\s*([\s\S]*?)```/)
    let jsonStr = mdMatch ? mdMatch[1] : icerik
    const start = jsonStr.indexOf('{')
    const end = jsonStr.lastIndexOf('}')
    if (start !== -1 && end !== -1) jsonStr = jsonStr.slice(start, end + 1)

    jsonStr = jsonStr
      .replace(/,\s*([}\]])/g, '$1')
      .replace(/\/\/[^\n]*/g, '')
      .trim()

    let sonuc
    try {
      sonuc = JSON.parse(jsonStr)
    } catch {
      return NextResponse.json({ error: 'AI geçerli analiz üretemedi. Tekrar dene.' }, { status: 500 })
    }

    return NextResponse.json({ sonuc })

  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Hata' }, { status: 500 })
  }
}
