import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: Request) {
  try {
    const { onceki, sonraki, yapilanlar, kampanyaAdlari, hesap, model } = await request.json()

    const prompt = `Sen deneyimli bir Meta Ads performans danışmanısın. Aşağıdaki optimizasyon öncesi ve sonrası verileri karşılaştır ve Türkçe kısa bir değerlendirme yaz.

HESAP: ${hesap}
KAMPANYALAR: ${kampanyaAdlari.join(', ')}

YAPILAN OPTİMİZASYONLAR:
${yapilanlar.map((y: string, i: number) => `${i + 1}. ${y}`).join('\n')}

OPTİMİZASYON ÖNCESİ METRİKLER:
- Harcama: ₺${onceki.harcama.toFixed(2)}
- Gelir: ₺${onceki.gelir.toFixed(2)}
- ROAS: ${onceki.roas.toFixed(2)}x
- Dönüşüm: ${onceki.donusum}

OPTİMİZASYON SONRASI METRİKLER (${sonraki.gun} gün sonra):
- Harcama: ₺${sonraki.harcama.toFixed(2)}
- Gelir: ₺${sonraki.gelir.toFixed(2)}
- ROAS: ${sonraki.roas.toFixed(2)}x
- Dönüşüm: ${sonraki.donusum}

ROAS değişimi: ${onceki.roas > 0 ? ((sonraki.roas - onceki.roas) / onceki.roas * 100).toFixed(1) : '—'}%
Gelir değişimi: ${onceki.gelir > 0 ? ((sonraki.gelir - onceki.gelir) / onceki.gelir * 100).toFixed(1) : '—'}%

Aşağıdaki JSON formatında yanıt ver (başka hiçbir şey yazma, sadece JSON):
{
  "sonuc": "iyi" | "karışık" | "kötü",
  "ozet": "2-3 cümle genel değerlendirme. Yapılan optimizasyonların etkisi nedir?",
  "olumlu": ["olumlu sonuç 1", "olumlu sonuç 2"],
  "olumsuz": ["olumsuz sonuç veya dikkat edilmesi gereken nokta"],
  "oneri": "Bundan sonra ne yapılmalı? 1-2 cümle."
}`

    const modelId = model || 'claude-sonnet-4-6'
    const message = await client.messages.create({
      model: modelId,
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }]
    })

    const icerik = message.content[0].type === 'text' ? message.content[0].text : ''
    const jsonMatch = icerik.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'Yanıt formatlanamadı' }, { status: 500 })

    return NextResponse.json(JSON.parse(jsonMatch[0]))
  } catch (error) {
    console.error('AI karşılaştırma hatası:', error)
    return NextResponse.json({ error: 'AI analizi yapılamadı' }, { status: 500 })
  }
}
