import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const KAMPANYA_KURALLARI = `
## KAMPANYA KURALLARI (VARSAYILAN — DURUMA GÖRE ESNEKTİR)

### Funnel Yapısı
- 3 CBO kampanya: TOFU (soğuk/farkındalık) → MOFU (sıcak/değerlendirme) → BOFU (DPA/dönüşüm)
- Her kampanyada genellikle 2 reklam seti (duruma göre 1–3 olabilir, kullanıcının özel notlarına bak)
- Bütçe bölüşümü varsayılanı: TOFU %40 / MOFU %35 / BOFU %25 (duruma göre değiştir)

### Kitle Kurulumu
- TOFU: Broad — Advantage+ Audience (K 25-55, Türkiye) + LAL Satın Alanlar 180G %1-3
- MOFU: Video İzleyenler %50 + IG Etkileşim 90G kümesi / Site Ziyaretçileri 30G (satın alanlar hariç)
- BOFU: Sepete Ekleyenler 14G (satın alanlar hariç) / Ürün Sayfası Görüntüleyenler 30G (satın alanlar hariç)

### Metin Yapısı
- TOFU: Hook (duygusal/merak uyandıran cümle) → ürün faydası → ücretsiz kargo CTA'sı
- MOFU: Müşteri sorusu veya endişesi → somut çözüm/özellik → 9 taksit + ücretsiz kargo
- BOFU: Çok kısa, "sizi bekliyor" / "hâlâ yerinde" tarzı hatırlatma + kargo + taksit
- Başlık: maksimum 40 karakter

### Teknik Zorunluluklar
- UTM: utm_source={{site_source_name}}&utm_medium=paid_social&utm_campaign={{campaign.name}}&utm_content={{ad.name}}
- Dönüşüm penceresi: 7 gün tıklama / 1 gün görüntüleme
- Yerleşim: Advantage+ Placements (otomatik)

### Bütçe ve Optimizasyon Kuralları
- İlk 72 saat: KESİNLİKLE değişiklik yapma — öğrenme aşaması sıfırlanır
- Artış: ROAS hedefin %50 üstündeyse ve ≥14 günlük veri varsa — maksimum 2 katına artır
- Düşüş: ROAS < 1.5 veya CPA ≥ 2.000 TL ise → önce kreatiifi değiştir, 72 saat bekle
- 21. gün: Frekans < 2.5 kontrol et; > 3.5 ise yeni kreatif varyantı ekle

### Görsel Format Kuralları
- Her reklam için Feed (1:1, 1080×1080) VE Story/Reels (9:16, 1080×1920) ayrı görseller
- TOFU: ev ortamı fotoğrafı, doğal ışık, ürün kullanımda
- MOFU: ürün yakın çekim + özellik vurgusu
- BOFU: DPA otomatik ürün görseli (katalogdan)
`

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      hesap, urunGrubu, urunUrl, indirim, indirimsiz,
      butce, butceTuru, baslangic, bitis,
      hedef, notlar, model, performansVerisi
    } = body

    // Ürün URL içeriğini çek
    let urunIcerik = ''
    if (urunUrl && urunUrl.startsWith('http')) {
      try {
        const res = await fetch(urunUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CampaignBot/1.0)' },
          signal: AbortSignal.timeout(8000)
        })
        const html = await res.text()
        // HTML taglarını temizle, ilk 2500 karakter al
        urunIcerik = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 2500)
      } catch {
        urunIcerik = 'URL içeriği çekilemedi, genel sektör bilgisiyle devam et.'
      }
    }

    // Performans verisi özeti
    const perfOzet = performansVerisi
      ? `Mevcut kampanya performansı:\n${JSON.stringify(performansVerisi, null, 2).slice(0, 3000)}`
      : 'Performans verisi sağlanmadı.'

    const modelId = model === 'opus' ? 'claude-opus-4-6' : 'claude-sonnet-4-6'

    const donemBilgisi = baslangic && bitis
      ? `${baslangic} — ${bitis}`
      : 'Tarih belirtilmedi'

    const indirimsizBilgi = indirimsiz
      ? 'İndirim YOK — tam fiyat kampanyası'
      : `İndirim: %${indirim || 0}`

    const prompt = `Sen bir Meta Ads stratejisti ve reklam uzmanısın. Türkiye'de halı ve ev tekstili e-ticaret sektörünü iyi biliyorsun. Türkçe e-ticaret tüketici davranışlarına hakimsin.

${KAMPANYA_KURALLARI}

---

## MEVCUT PERFORMANS VERİSİ
${perfOzet}

---

## ÜRÜN BİLGİSİ
Hesap: ${hesap === 'karmen' ? 'Karmen Halı' : 'Cotto Home'}
Ürün Grubu: ${urunGrubu}
${urunUrl ? `Ürün URL: ${urunUrl}` : ''}
${urunIcerik ? `Sayfa İçeriği (özet):\n${urunIcerik}` : ''}

---

## KAMPANYA TALEBİ
- Dönem: ${donemBilgisi}
- Toplam Bütçe: ${butce} TL (${butceTuru === 'gunluk' ? 'günlük' : 'aylık'})
- Kampanya Hedefi: ${hedef}
- Fiyat Durumu: ${indirimsizBilgi}
${notlar ? `- Özel Notlar / Kurallar: ${notlar}` : ''}

---

## GÖREVİN

Yukarıdaki bilgilere dayanarak tam bir kampanya planı ve görsel brief oluştur.

ÇIKTIYI TAMAMEN JSON OLARAK VER. Başka hiçbir metin ekleme — sadece aşağıdaki yapıda tek bir JSON objesi:

{
  "analiz": "string — mevcut performans ve bu kampanya için 3-4 cümlelik strateji notu. Performans verisi varsa ona değin.",
  "strateji": "string — neden bu funnel dağılımı ve kitle yapısı seçildi, 2-3 cümle.",
  "butceDagilimi": {
    "tofu": number,
    "mofu": number,
    "bofu": number,
    "aciklama": "string — neden bu dağılım"
  },
  "kampanyalar": [
    {
      "sira": 1,
      "ad": "string — tarih|TOFU|ürün grubu|CBO formatında",
      "funnel": "TOFU" | "MOFU" | "BOFU",
      "hedef": "string — Sales / Katalog Satışları vb.",
      "butceTuru": "CBO",
      "gunlukButce": "string — TL",
      "reklamSetleri": [
        {
          "ad": "string",
          "kitle": "string — kitle açıklaması",
          "hariçTut": "string — hariç tutulacak kitle (varsa)",
          "optimizasyon": "string",
          "yerlesim": "Advantage+ Placements (Otomatik)",
          "donusumPenceresi": "7 gün tıklama / 1 gün görüntüleme",
          "reklamlar": [
            {
              "ad": "string — funnel|kategori|format|v1 şeklinde",
              "format": "string — Video + Tek Görsel / Carousel / DPA",
              "baslik": "string — max 40 karakter",
              "metin": "string — tam reklam metni, gerçekçi ve kopyalanabilir",
              "cta": "string",
              "utm": "utm_source={{site_source_name}}&utm_medium=paid_social&utm_campaign={{campaign.name}}&utm_content={{ad.name}}",
              "gorselRef": "string — G01, G02 vb."
            }
          ]
        }
      ]
    }
  ],
  "gorselBriefler": [
    {
      "ref": "G01",
      "format": "Feed (1:1)" | "Story/Reels (9:16)",
      "boyut": "1080x1080" | "1080x1920",
      "funnel": "TOFU" | "MOFU" | "BOFU",
      "kategori": "string",
      "anaMesaj": "string — görselin ana iletisi",
      "ton": "string — renk, ışık, atmosfer tarifi",
      "metinOverlay": "string — görsele yazılacak metin varsa ne yazılmalı, yoksa 'Yok'",
      "not": "string — tasarımcıya özel not (boş olabilir)"
    }
  ],
  "optimizasyonTakvimi": [
    {
      "gun": "string — örn: 1-3. Gün",
      "kontrol": "string",
      "aksiyon": "string"
    }
  ],
  "kurulumKontrolListesi": [
    "string — kurulmadan önce tamamlanması gereken madde"
  ]
}

ÖNEMLI KURALLAR:
- Ürün URL'si verilmişse sayfadaki ürün bilgilerini (fiyat, özellik, kategori) metinlere yansıt
- İndirim varsa MOFU ve BOFU metinlerinde mutlaka vurgula
- Performans verisi varsa zayıf/güçlü kampanyaları analize ekle
- Kullanıcının özel notlarındaki kuralları standart kurallara göre önceliklendir
- Her TOFU ve MOFU reklamı için hem Feed hem Story/Reels görseli oluştur (BOFU DPA otomatik)
- Metinler Türkçe, doğal ve gerçekçi olsun — copy-paste hazır
- JSON içinde string değerlerde çift tırnak kullanırsan mutlaka escape et: \" şeklinde
- JSON sonuna kesinlikle açıklama, yorum veya başka metin ekleme
- Tüm array ve object'lerin son elemanından sonra virgül KOYMA`

    const message = await client.messages.create({
      model: modelId,
      max_tokens: 8000,
      messages: [{ role: 'user', content: prompt }]
    })

    const icerik = message.content[0].type === 'text' ? message.content[0].text : ''

    // JSON parse — markdown code block veya düz JSON destekle
    let jsonStr = icerik
    // ```json ... ``` bloğu varsa çıkar
    const mdMatch = icerik.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (mdMatch) jsonStr = mdMatch[1]
    else {
      // İlk { ile son } arasını al
      const start = icerik.indexOf('{')
      const end = icerik.lastIndexOf('}')
      if (start !== -1 && end !== -1) jsonStr = icerik.slice(start, end + 1)
    }

    // Yaygın JSON bozuklukları temizle
    jsonStr = jsonStr
      .replace(/,\s*([}\]])/g, '$1')        // trailing comma
      .replace(/\/\/[^\n]*/g, '')            // // yorumları
      .replace(/\/\*[\s\S]*?\*\//g, '')      // /* */ yorumları
      .trim()

    let plan
    try {
      plan = JSON.parse(jsonStr)
    } catch {
      return NextResponse.json({ error: 'AI geçerli JSON üretemedi. Tekrar dene.', ham: icerik.slice(0, 500) }, { status: 500 })
    }

    return NextResponse.json({ plan, model: modelId })

  } catch (e) {
    const mesaj = e instanceof Error ? e.message : 'Bilinmeyen hata'
    return NextResponse.json({ error: mesaj }, { status: 500 })
  }
}
