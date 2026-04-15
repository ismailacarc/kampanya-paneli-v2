import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: Request) {
  try {
    const { analiz, soru, hesapAdi, model } = await request.json()

    if (!soru?.trim()) {
      return NextResponse.json({ error: 'Soru boş olamaz' }, { status: 400 })
    }

    const analizOzeti = analiz ? `
MEVCUT ANALİZ SONUÇLARI:
- Genel Değerlendirme: ${analiz.ozet || '—'}
- Toplam Harcama: ${analiz.toplamHarcama || '—'}
- Toplam Gelir: ${analiz.toplamGelir || '—'}
- Genel ROAS: ${analiz.genelRoas || '—'}
- Acil müdahale gereken kampanya sayısı: ${Array.isArray(analiz.acil) ? analiz.acil.length : 0}
- İyileştirme fırsatı olan kampanya sayısı: ${Array.isArray(analiz.iyilestir) ? analiz.iyilestir.length : 0}
- İyi performans gösteren kampanya sayısı: ${Array.isArray(analiz.iyi) ? analiz.iyi.length : 0}
` : 'Henüz analiz yapılmamış.'

    const prompt = `Sen deneyimli bir Meta Ads uzmanısın. ${hesapAdi || 'Marka'} için çalışıyorsun.

${analizOzeti}

Kullanıcının sorusu: "${soru}"

Soruyu Türkçe, kısa ve net şekilde yanıtla. Dijital pazarlama alanında değil gibi bilgi sahibi olduğunu varsay ama teknik terimleri sade dille açıkla. Maksimum 3-4 cümle. Gerekirse somut örnek ver.`

    const modelId = model || 'claude-sonnet-4-6'
    const message = await client.messages.create({
      model: modelId,
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }]
    })

    const yanit = message.content[0].type === 'text' ? message.content[0].text : ''
    return NextResponse.json({ yanit })

  } catch (error) {
    console.error('AI sohbet hatası:', error)
    return NextResponse.json({ error: 'Yanıt alınamadı' }, { status: 500 })
  }
}
