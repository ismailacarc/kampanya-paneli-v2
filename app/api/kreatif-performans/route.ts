import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { mod, hesap, donem, model } = body
    const hesapAdi = hesap === 'karmen' ? 'Karmen Halı' : 'Cotto Home'
    const modelId = model || 'claude-sonnet-4-6'

    // ── Tekli kart analizi ──────────────────────────────────────
    if (mod === 'tekli') {
      const { kart } = body
      const prompt = `Sen ${hesapAdi} markası için Meta Ads kreatif analistisisin. Bir reklam kreatifinin performansını analiz et.

## REKLAM BİLGİLERİ
Ad Adı: ${kart.ad}
Format: ${kart.format} | ${kart.video ? 'Video' : 'Statik görsel'}
Başlık: ${kart.baslik || '(yok)'}
Reklam Metni: ${kart.metin || '(yok)'}
CTA: ${kart.cta || '(yok)'}

## PERFORMANS METRİKLERİ (Son ${donem} gün)
CTR: %${kart.ctr}
Satış: ${kart.satis} adet
ROAS: ${kart.roas}x
Harcama: ${kart.harcama} TL
CPC: ${kart.cpc} TL
CPM: ${kart.cpm} TL
Gösterim başı maliyet / Frequency: ${kart.frequency}x

## GÖREV
Bu reklam iyi mi kötü mü performans gösteriyor? Neden?
1. **Metin & Hook analizi** — başlık ve ilk cümle ne kadar ilgi çekici?
2. **Format uyumu** — ${kart.format} için doğru format mu?
3. **Metrik yorumu** — CTR, ROAS ve satış sayısı sektör ortalamasıyla karşılaştır (halı/ev tekstili e-ticaret)
4. **Grafiker için 3 somut öneri** — bu kreatifte ne değiştirilmeli?

Türkçe, kısa ve grafikerin anlayacağı dilde yaz. Madde madde ilerle.`

      const response = await client.messages.create({
        model: modelId, max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }]
      })
      const analiz = response.content[0].type === 'text' ? response.content[0].text : ''
      return NextResponse.json({ analiz })
    }

    // ── Genel karşılaştırmalı analiz ──────────────────────────
    const { iyiler, zayiflar, siralamaMetrigi } = body

    function formatKreatif(k: {
      ad: string; metin: string; ctr: string; satis: string
      roas: string; harcama: string; cpc: string; format: string
    }) {
      return `• ${k.ad} [${k.format}]
  Metin: ${k.metin || '(yok)'}
  CTR: %${k.ctr} | Satış: ${k.satis} | ROAS: ${k.roas}x | Harcama: ${k.harcama} TL | CPC: ${k.cpc} TL`
    }

    const prompt = `Sen ${hesapAdi} markası için Meta Ads kreatif performans analistisisin.

Dönem: Son ${donem} gün | Sıralama metriği: ${siralamaMetrigi}

## EN İYİ KREATİFLER
${iyiler.map(formatKreatif).join('\n\n')}

## EN ZAYIF KREATİFLER
${zayiflar.map(formatKreatif).join('\n\n')}

## GÖREV
1. **En iyi kreatiflerin neden iyi çalıştığı** — hook, metin tonu, format, görsel/metin dengesi
2. **En zayıf kreatiflerin neden düşük performans gösterdiği** — ne eksik veya yanlış?
3. **Grafiker için 5 somut öneri** — bir sonraki kreatifte ne yapmalı?
4. **Pattern özeti** — en iyi çalışan kreatif tipinin tek cümlelik özeti

Türkçe, kısa ve grafikerin anlayacağı dilde yaz.`

    const response = await client.messages.create({
      model: modelId, max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    })
    const analiz = response.content[0].type === 'text' ? response.content[0].text : ''
    return NextResponse.json({ analiz })

  } catch (e) {
    const mesaj = e instanceof Error ? e.message : 'Hata'
    return NextResponse.json({ analiz: `Hata: ${mesaj}` }, { status: 500 })
  }
}
