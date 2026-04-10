import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ─── Tip bazlı sistem promptları ─────────────────────────────────────────────
function sistemPrompt(tip: string, hesap: string, baslangic: string, bitis: string): string {
  const marka  = hesap === 'karmen' ? 'Karmen Halı' : 'Cotto Home'
  const donem  = `${baslangic} – ${bitis}`
  const ortak  = `Sen deneyimli bir dijital pazarlama ve e-ticaret analistsin.
Marka: ${marka} | Dönem: ${donem}
Yanıtını Türkçe ver. Kısa, net, aksiyon odaklı ol. Genel laflar etme — spesifik sayılara atıfla yap.
Madde madde yaz, başlık kullan, emoji kullanabilirsin.`

  const odaklar: Record<string, string> = {
    genel: `${ortak}
Görevin: Genel trafik verisini analiz et.
Odak: Trafik kalitesi (bounce rate, süre, sayfa/oturum), yeni vs geri dönen kullanıcı dengesi, büyüme potansiyeli.
Format: 3 bölüm — 💪 Güçlü Yanlar | ⚠️ Dikkat Edilmesi Gerekenler | 🎯 3 Aksiyon Önerisi`,

    eticaret: `${ortak}
Görevin: E-ticaret performansını analiz et.
Odak: Gelir trendi, dönüşüm oranı (sektör ortalaması e-ticaret için %1-3), ortalama sipariş değeri, sepet terk oranı, upsell/cross-sell fırsatları.
Format: 3 bölüm — 💪 Güçlü Yanlar | ⚠️ Kayıp Noktaları | 🎯 3 Aksiyon Önerisi`,

    kanallar: `${ortak}
Görevin: Kanal performansını analiz et.
Odak: Hangi kanal en verimli (dönüşüm/harcama oranı), bütçe nereye kaymalı, organik vs ücretli denge, düşük performanslı kanallar.
Format: 3 bölüm — 🏆 En İyi Kanallar | 📉 Zayıf Kanallar | 💸 Bütçe Önerisi`,

    funnel: `${ortak}
Görevin: Dönüşüm hunisini analiz et.
Odak: Her adımdaki kayıp oranı, en kritik düşüş noktası, sektör karşılaştırması (sepete ekleme %5-15, checkout %20-40, satın alma %30-60).
Format: 3 bölüm — 🔍 Kritik Kayıp Noktası | 📊 Adım Analizi | 🛠️ 3 İyileştirme Önerisi`,

    sayfalar: `${ortak}
Görevin: Landing page performansını analiz et.
Odak: Yüksek trafik ama düşük dönüşümlü sayfalar (fırsat), en iyi dönüşüm yapan sayfalardan öğrenilebilecekler, bounce rate yüksek sayfalar.
Format: 3 bölüm — ✅ İyi Performanslı Sayfalar | 🔥 Fırsat Sayfaları | 🛠️ 3 Öneri`,

    tumu: `${ortak}
Görevin: Tüm GA4 verisini bütünsel olarak analiz et ve kapsamlı bir performans raporu hazırla.
Odak: Genel sağlık skoru, en güçlü ve en zayıf nokta, kanallar arası sinerji, ürün-trafik uyumu, öncelikli aksiyonlar.
Format:
## 📊 Genel Sağlık Değerlendirmesi (10 üzerinden puan ver ve gerekçele)
## 💪 En Güçlü 3 Alan
## ⚠️ En Kritik 3 Sorun
## 🎯 Öncelikli 5 Aksiyon (etki büyüklüğüne göre sırala)
## 💡 Öne Çıkan Fırsat (1 tane, en önemli)`,
  }

  return odaklar[tip] || odaklar.tumu
}

// ─── Veriyi okunabilir metne çevir ───────────────────────────────────────────
function veriMetni(tip: string, veri: Record<string, unknown>): string {
  try {
    if (tip === 'genel') {
      const d = veri as { sessions: number; totalUsers: number; newUsers: number; bounceRate: number; avgSessionDur: number; pagesPerSession: number }
      return `Toplam Oturum: ${d.sessions?.toLocaleString('tr-TR')}
Toplam Kullanıcı: ${d.totalUsers?.toLocaleString('tr-TR')}
Yeni Kullanıcı: ${d.newUsers?.toLocaleString('tr-TR')} (%${d.totalUsers > 0 ? ((d.newUsers / d.totalUsers) * 100).toFixed(1) : 0} yeni)
Bounce Rate: %${d.bounceRate}
Ort. Oturum Süresi: ${d.avgSessionDur} dk
Sayfa/Oturum: ${d.pagesPerSession}`
    }

    if (tip === 'eticaret') {
      const d = veri as { gelir: number; satisSayisi: number; ortSiparisD: number; donusumOrani: number; sepeteEkleme: number; odemeBaslatan: number }
      return `Toplam Gelir: ₺${d.gelir?.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
Satış Sayısı: ${d.satisSayisi}
Ort. Sipariş Değeri: ₺${d.ortSiparisD?.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
Dönüşüm Oranı: %${d.donusumOrani}
Sepete Ekleme: ${d.sepeteEkleme?.toLocaleString('tr-TR')}
Ödeme Başlatan: ${d.odemeBaslatan?.toLocaleString('tr-TR')}
Sepet→Ödeme Oranı: %${d.sepeteEkleme > 0 ? ((d.odemeBaslatan / d.sepeteEkleme) * 100).toFixed(1) : 0}
Ödeme→Satış Oranı: %${d.odemeBaslatan > 0 ? ((d.satisSayisi / d.odemeBaslatan) * 100).toFixed(1) : 0}`
    }

    if (tip === 'kanallar') {
      const list = veri as unknown as { kanal: string; sessions: number; gelir: number; islem: number; bounceRate: number; avgSureDk: number }[]
      return list.map(k => {
        const don = k.sessions > 0 ? ((k.islem / k.sessions) * 100).toFixed(2) : '0'
        return `${k.kanal}: ${k.sessions?.toLocaleString('tr-TR')} oturum | ₺${k.gelir?.toLocaleString('tr-TR', { minimumFractionDigits: 0 })} gelir | ${k.islem} satış | %${don} dönüşüm | %${k.bounceRate} bounce | ${k.avgSureDk}dk`
      }).join('\n')
    }

    if (tip === 'funnel') {
      const d = veri as { adimlar: { ad: string; sayi: number; oran: number }[]; gelir: number }
      const adimlar = d.adimlar.map((a, i, arr) => {
        const sonraki = arr[i + 1]
        const gecis = sonraki && a.sayi > 0 ? ((sonraki.sayi / a.sayi) * 100).toFixed(1) : null
        return `${a.ad}: ${a.sayi?.toLocaleString('tr-TR')} kişi (başlangıcın %${a.oran}'i)${gecis ? ` → %${gecis} sonraki adıma geçti` : ''}`
      }).join('\n')
      return `${adimlar}\nToplam Gelir: ₺${d.gelir?.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`
    }

    if (tip === 'sayfalar') {
      const list = veri as unknown as { sayfa: string; sessions: number; donusumOrani: number; sepetOrani: number; gelir: number; islem: number; bounceRate: number; firsatSkor: number }[]
      const top = list.slice(0, 20)
      return top.map(s =>
        `${s.sayfa}: ${s.sessions} oturum | %${s.donusumOrani} dönüşüm | %${s.sepetOrani} sepet | ₺${s.gelir?.toFixed(0)} gelir | %${s.bounceRate} bounce${s.firsatSkor > 70 ? ` | 🔥 Fırsat skoru: ${s.firsatSkor}` : ''}`
      ).join('\n')
    }

    if (tip === 'tumu') {
      const d = veri as Record<string, unknown>
      const bolumler: string[] = []

      if (d.genel) {
        const g = d.genel as { sessions: number; bounceRate: number; avgSessionDur: number }
        bolumler.push(`GENEL TRAFİK:\nOturum: ${g.sessions?.toLocaleString('tr-TR')} | Bounce: %${g.bounceRate} | Süre: ${g.avgSessionDur}dk`)
      }
      if (d.eticaret) {
        const e = d.eticaret as { gelir: number; satisSayisi: number; donusumOrani: number; ortSiparisD: number }
        bolumler.push(`E-TİCARET:\nGelir: ₺${e.gelir?.toLocaleString('tr-TR', { minimumFractionDigits: 0 })} | Satış: ${e.satisSayisi} | Dönüşüm: %${e.donusumOrani} | Ort. Sipariş: ₺${e.ortSiparisD?.toFixed(0)}`)
      }
      if (d.kanallar) {
        const kanallar = d.kanallar as { kanal: string; sessions: number; gelir: number; islem: number }[]
        const top5 = kanallar.slice(0, 5).map(k => {
          const don = k.sessions > 0 ? ((k.islem / k.sessions) * 100).toFixed(2) : '0'
          return `  ${k.kanal}: ${k.sessions?.toLocaleString('tr-TR')} oturum | ₺${k.gelir?.toFixed(0)} gelir | %${don} dönüşüm`
        }).join('\n')
        bolumler.push(`KANALLAR (Top 5):\n${top5}`)
      }
      if (d.funnel) {
        const f = d.funnel as { adimlar: { ad: string; sayi: number; oran: number }[] }
        const ozet = f.adimlar.map(a => `${a.ad}: ${a.sayi?.toLocaleString('tr-TR')} (%${a.oran})`).join(' → ')
        bolumler.push(`FUNNEL:\n${ozet}`)
      }
      if (d.urunler) {
        const urunler = d.urunler as { urun: string; gelir: number; adet: number; gorunum: number; firsatSkor: number }[]
        const top5 = urunler.slice(0, 5).map(u => `  ${u.urun}: ₺${u.gelir?.toFixed(0)} gelir | ${u.adet} satış | ${u.gorunum?.toLocaleString('tr-TR')} görüntülenme`).join('\n')
        const firsatlar = urunler.filter(u => u.firsatSkor > 70).slice(0, 3).map(u => `  ${u.urun}: ${u.gorunum?.toLocaleString('tr-TR')} görüntülenme, ${u.adet} satış`).join('\n')
        bolumler.push(`TOP 5 ÜRÜN:\n${top5}`)
        if (firsatlar) bolumler.push(`FIRSAT ÜRÜNLERİ (çok görülüp az satılan):\n${firsatlar}`)
      }

      return bolumler.join('\n\n')
    }

    return JSON.stringify(veri, null, 2)
  } catch {
    return JSON.stringify(veri)
  }
}

// ─── POST Handler ─────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const { tip, hesap, baslangic, bitis, veri } = await request.json()

    if (!tip || !veri) {
      return NextResponse.json({ error: 'tip ve veri zorunlu' }, { status: 400 })
    }

    const sistem = sistemPrompt(tip, hesap || 'cotto', baslangic || '', bitis || '')
    const veriTxt = veriMetni(tip, veri)

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      system: sistem,
      messages: [{
        role: 'user',
        content: `İşte ${baslangic} – ${bitis} dönemine ait ${hesap === 'karmen' ? 'Karmen Halı' : 'Cotto Home'} GA4 verisi:\n\n${veriTxt}\n\nAnaliz et ve önerilerini ver.`
      }]
    })

    const analiz = response.content[0]?.type === 'text' ? response.content[0].text : ''
    return NextResponse.json({ analiz })

  } catch (e) {
    const mesaj = e instanceof Error ? e.message : String(e)
    console.error('Analytics AI Hatası:', mesaj)
    return NextResponse.json({ error: mesaj }, { status: 500 })
  }
}
