import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: Request) {
  try {
    const { kampanyalar, hesap, donem, model } = await request.json()

    const hesapAdi = hesap === 'karmen' ? 'Karmen Halı' : 'Cotto Home'

    // Kampanya özetini hazırla
    const kampanyaOzeti = kampanyalar.map((k: {
      ad: string; tip: string; durum: number; harcama: string; tiklama: number
      gosterim: number; ctr: string; donusum: number; gelir: string; roas: string
      ort_cpc: string; donusum_maliyet: string; gosterim_payi: string | null
      ust_gosterim_payi: string | null
    }) => {
      const durumStr = k.durum === 2 ? 'Aktif' : 'Duraklatılmış'
      const arama = k.gosterim_payi ? `%${k.gosterim_payi}` : 'N/A'
      const ustArama = k.ust_gosterim_payi ? `%${k.ust_gosterim_payi}` : 'N/A'
      return `Kampanya: ${k.ad} | Tip: ${k.tip} | Durum: ${durumStr} | Harcama: ₺${k.harcama} | Tıklama: ${k.tiklama} | Gösterim: ${k.gosterim} | CTR: %${k.ctr} | Dönüşüm: ${k.donusum} | Gelir: ₺${k.gelir} | ROAS: ${k.roas}x | Ort.CPC: ₺${k.ort_cpc} | D.Maliyeti: ₺${k.donusum_maliyet} | Arama Payı: ${arama} | Üst Arama Payı: ${ustArama}`
    }).join('\n')

    const toplamHarcama = kampanyalar.reduce((t: number, k: { harcama: string }) => t + parseFloat(k.harcama), 0)
    const toplamGelir   = kampanyalar.reduce((t: number, k: { gelir: string }) => t + parseFloat(k.gelir), 0)
    const toplamRoas    = toplamHarcama > 0 ? toplamGelir / toplamHarcama : 0
    const toplamDonusum = kampanyalar.reduce((t: number, k: { donusum: number }) => t + k.donusum, 0)

    const prompt = `Sen ${hesapAdi} markasının Google Ads hesabını analiz eden 10 yıllık deneyimli bir dijital pazarlama uzmanısın.

## HESAP VERİSİ (Son ${donem} gün)
Toplam Harcama: ₺${toplamHarcama.toFixed(2)}
Toplam Gelir: ₺${toplamGelir.toFixed(2)}
Genel ROAS: ${toplamRoas.toFixed(2)}x
Toplam Dönüşüm: ${toplamDonusum}

## KAMPANYA DETAYLARI
${kampanyaOzeti}

## SADECE JSON DÖNDÜR — başka hiçbir metin yazma:

{
  "ozet": "3-4 cümle genel performans değerlendirmesi. ROAS, harcama ve öne çıkan sorunları belirt.",
  "guclular": ["iyi giden şey 1", "iyi giden şey 2", "iyi giden şey 3"],
  "zayiflar": ["sorun 1", "sorun 2", "sorun 3"],
  "butceVerimliligi": "Bütçe dağılımı ve verimlilik hakkında 1-2 cümle. Hangi kampanyalar bütçe israf ediyor, hangisi underinvested.",
  "firsat": "En önemli büyüme veya iyileştirme fırsatı.",
  "oneriler": [
    {
      "tip": "artir" | "azalt" | "kapat" | "kreatif" | "uyari" | "firsat" | "negatif" | "teklif" | "butce_kaydir",
      "baslik": "Kısa aksiyon başlığı",
      "aciklama": "Neden ve nasıl yapılacağını açıkla. Somut rakamlar ver.",
      "kampanya": "İlgili kampanya adı (varsa)",
      "oncelik": "yuksek" | "orta" | "dusuk"
    }
  ]
}

## GOOGLE ADS KURALLARI (bu kurallara göre öneriler üret):
- ROAS < 1.5 → kapat veya bütçeyi düşür (yüksek öncelik)
- ROAS 1.5–2.5 → izle, teklif optimize et (orta öncelik)
- ROAS > 3.5 → bütçe artır, ölçekle (fırsat)
- CTR < %2 Search kampanyalarda → reklam metni sorunlu, kalite skoru düşük olabilir (kreatif veya uyari)
- Dönüşüm yokken harcama var → negatif anahtar kelime ekle (negatif, yüksek öncelik)
- Arama Payı < %40 → rakipler önde, teklif artır veya bütçe kaydir (teklif veya butce_kaydir)
- Yüksek CPC (₺10+) düşük ROAS → teklif stratejisi değiştir (teklif, yüksek öncelik)
- PMax kampanya düşük ROAS → sinyal ve asset kalitesini gözden geçir
- Search kampanya performans iyiyse PMax bütçesini buraya kaydır (butce_kaydir)
- En az 5, maksimum 10 öneri üret. Öncelik sırasına göre sırala.
- Türkiye e-ticaret ortalamaları: İyi ROAS = 3x+, Orta = 2-3x, Kötü = 2x altı`

    const modelId = model || 'claude-haiku-4-5-20251001'

    const message = await client.messages.create({
      model: modelId,
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    })

    const icerik = message.content[0].type === 'text' ? message.content[0].text : ''

    const mdMatch = icerik.match(/```(?:json)?\s*([\s\S]*?)```/)
    let jsonStr = mdMatch ? mdMatch[1] : icerik
    const start = jsonStr.indexOf('{')
    const end = jsonStr.lastIndexOf('}')
    if (start !== -1 && end !== -1) jsonStr = jsonStr.slice(start, end + 1)
    jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1').replace(/\/\/[^\n]*/g, '').trim()

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
