import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ─── Tool Tanımı (Anthropic Function Calling) ────────────────────────────────
// AI bu "formu doldurmak" zorunda — hatalı JSON üretmesi artık mümkün değil
const KAMPANYA_TOOL = {
  name: 'kampanya_plani_kaydet',
  description: 'Kampanya planı oluştururken yapılandırılmış veriyi kaydet. Metin yanıtınla AYNI ANDA bu aracı çağır.',
  input_schema: {
    type: 'object' as const,
    properties: {
      kampanyalar: {
        type: 'array',
        description: 'Kampanya listesi',
        items: {
          type: 'object',
          properties: {
            kampanyaAdi:   { type: 'string', description: 'Kampanya adı' },
            funnel:        { type: 'string', description: 'TOFU | MOFU | BOFU veya Demand Gen | Search | Shopping | PMax' },
            butce:         { type: 'string', description: 'Toplam bütçe (TL)' },
            gunlukButce:   { type: 'string', description: 'Günlük bütçe (TL/gün)' },
            sure:          { type: 'string', description: 'Kampanya süresi, ör: 7 gün / Sürekli' },
            kitleler:      { type: 'string', description: 'Hedef kitle açıklaması' },
            optimizasyon:  { type: 'string', description: 'Optimizasyon hedefi, ör: Dönüşüm / Target ROAS' },
            notlar:        { type: 'string', description: 'Ek notlar ve teknik gereksinimler' }
          },
          required: ['kampanyaAdi', 'funnel', 'butce', 'gunlukButce', 'sure', 'kitleler', 'optimizasyon', 'notlar']
        }
      },
      adSetler: {
        type: 'array',
        description: 'Reklam seti / reklam grubu listesi',
        items: {
          type: 'object',
          properties: {
            kampanyaAdi: { type: 'string', description: 'Bağlı kampanya adı' },
            adSetAdi:    { type: 'string', description: 'Reklam seti adı' },
            kitle:       { type: 'string', description: 'Kitle veya anahtar kelimeler' },
            butce:       { type: 'string', description: 'Bütçe veya oransal dağılım' },
            format:      { type: 'string', description: 'Format, ör: Feed + Reels / Exact Match / Custom Intent' }
          },
          required: ['kampanyaAdi', 'adSetAdi', 'kitle', 'butce', 'format']
        }
      },
      gorselBriefler: {
        type: 'array',
        description: 'Görsel brief veya reklam metni brief listesi',
        items: {
          type: 'object',
          properties: {
            kampanyaAdi: { type: 'string', description: 'Bağlı kampanya adı' },
            format:      { type: 'string', description: 'Feed | Story | Reels | Katalog | RSA | PMax Asset | Demand Gen' },
            boyut:       { type: 'string', description: 'Boyut, ör: 1080x1080 / 9:16 / metin için: —' },
            sure:        { type: 'string', description: 'Video süresi, metin için: —' },
            hook:        { type: 'string', description: 'İlk 3 saniye mesajı veya RSA başlıklar (1-3)' },
            anaMesaj:    { type: 'string', description: 'Ana içerik veya RSA başlıklar (4+) ve açıklamalar' },
            cta:         { type: 'string', description: 'Call to action, ör: Şimdi Al / Ücretsiz Kargo' },
            notlar:      { type: 'string', description: 'Tasarımcı veya reklamcı için ek notlar' }
          },
          required: ['kampanyaAdi', 'format', 'boyut', 'sure', 'hook', 'anaMesaj', 'cta', 'notlar']
        }
      },
      kontrolListesi: {
        type: 'array',
        description: 'Kampanya öncesi kontrol listesi maddeleri',
        items: {
          type: 'object',
          properties: {
            kategori:   { type: 'string', description: 'ör: Teknik Kurulum | Kreatiifler | Bütçe | Hedefleme | Onay' },
            madde:      { type: 'string', description: 'Yapılacak iş — net ve kısa' },
            aciklama:   { type: 'string', description: 'Neden önemli veya nasıl yapılır (opsiyonel)' }
          },
          required: ['kategori', 'madde']
        }
      },
      isTakipSureci: {
        type: 'array',
        description: 'Kampanya sonrası iş takip süreci',
        items: {
          type: 'object',
          properties: {
            zaman:     { type: 'string', description: 'ör: Gün 1-3 | 1. Hafta | 2. Hafta | 1. Ay' },
            gorevler:  { type: 'array', items: { type: 'string' }, description: 'Bu dönemde yapılacaklar' },
            metrikler: { type: 'array', items: { type: 'string' }, description: 'Takip edilecek metrikler' }
          },
          required: ['zaman', 'gorevler']
        }
      }
    },
    required: ['kampanyalar', 'adSetler', 'gorselBriefler', 'kontrolListesi', 'isTakipSureci']
  }
}

// ─── Meta Ads Sistem Promptu ─────────────────────────────────────────────────
const SISTEM_META = `Sen bir Meta Ads kampanya planlama asistanısın. Türkiye'de halı ve ev tekstili e-ticaret sektöründe uzmanlaşmışsın (Karmen Halı ve Cotto Home markaları).

## KAMPANYA KURALLARIN (VARSAYILAN — DURUMA GÖRE ESNEKTİR)
- Funnel: TOFU (soğuk/farkındalık) → MOFU (sıcak/değerlendirme) → BOFU (DPA/dönüşüm)
- Bütçe türü: CBO (Campaign Budget Optimization)
- Varsayılan bütçe dağılımı: TOFU %40 / MOFU %35 / BOFU %25 (değişebilir)
- TOFU kitleleri: Broad Advantage+ (K 25-55) + LAL Satın Alanlar 180G %1-3
- MOFU kitleleri: Video İzleyenler %50 + IG Etkileşim 90G / Site Ziyaretçileri 30G
- BOFU kitleleri: Sepete Ekleyenler 14G + Ürün Sayfası 30G (satın alanlar hariç)
- TOFU metin: Hook → fayda → ücretsiz kargo
- MOFU metin: Müşteri sorusu → çözüm → 9 taksit + kargo
- BOFU metin: Kısa, "sizi bekliyor" + kargo + taksit
- Başlık max 40 karakter
- İlk 72 saat değişiklik yapma
- UTM: utm_source={{site_source_name}}&utm_medium=paid_social&utm_campaign={{campaign.name}}&utm_content={{ad.name}}

## SOHBET AKIŞIN
Kullanıcı formu doldurarak geldi — temel bilgiler (hesap, bütçe, dönem, ürün, hedef) zaten sağlandı.

**Eğer kampanya bilgileri sağlanmışsa (ilk mesaj veya düzeltme):**
- Keşfet ve onay aşamalarını ATLA
- Direkt TAM PLANI YAZ: strateji özeti + kampanya detayları
- Yanıtının YANINDA kampanya_plani_kaydet aracını MUTLAKA çağır (sekmeler için)

**Eğer kullanıcı düzeltme isterse:**
- Değişikliği açıkla ve kampanya_plani_kaydet aracını güncel verilerle YENİDEN çağır

**ASLA onay bekleme — form dolu ise direkt plan yaz + aracı çağır.**

## ÖNEMLİ KURALLAR
- Türkçe konuş, samimi ve profesyonel ol
- Performans verisi varsa değin: "Mevcut veriye göre..."
- Kullanıcı farklı isterse esnek ol
- kontrolListesi: en az 8 madde, kampanyaya özel somut adımlar
- isTakipSureci: en az 4 zaman dilimi, her birinde 2-4 görev ve 2-3 metrik`

// ─── Google Ads Sistem Promptu ───────────────────────────────────────────────
const SISTEM_GOOGLE = `Sen bir Google Ads kampanya planlama asistanısın. Türkiye'de halı ve ev tekstili e-ticaret sektöründe uzmanlaşmışsın (Karmen Halı ve Cotto Home markaları).

## GOOGLE ADS FUNNEL STRATEJİSİ
Ürün grubuna özel mikro funnel (micro-funnel) kurmak, bütçe verimliliği açısından en etkili yaklaşımdır.

### TOFU (Top of Funnel — Talep Yaratma) 🎯
- **Kampanya tipi:** Demand Gen (Talep Yaratma)
- **Kitle:** Custom Intent Audiences — rakip URL'leri veya ilgi alanı kelimeleri
- **Mesaj:** Ürünü satmaya çalışma — estetik, yaşam tarzı, pratiklik göster

### MOFU (Middle of Funnel — Arama Niyeti) 🔍
- **Kampanya tipi:** Search + Standart Shopping
- **Search:** Exact Match (marka) + Phrase Match (kategori kelimeleri)
- **Shopping:** Merchant Center'da custom_label_0 ile ürün grubunu ayır

### BOFU (Bottom of Funnel — Dönüşüm) 🛒
- **Kampanya tipi:** Performance Max (PMax)
- **Asset Group:** Sadece o ürün grubuna ait görseller ve metinler
- **Kitle sinyali:** TOFU + MOFU'dan gelen ziyaretçiler ve sepete ekleyenler
- **Dynamic Remarketing:** ecomm_prodid, ecomm_pagetype, ecomm_totalvalue parametreleri

## FUNNEL ÖNCESİ TEKNİK GEREKSİNİMLER
1. **Merchant Center Custom Labels:** custom_label_0 ile ürün grubu etiketleme
2. **Audience Manager:** Ziyaretçi, sepet, satın alan listelerini önceden kur
3. **Dynamic Remarketing Tag:** GST e-ticaret parametrelerini eksiksiz gönder

## GENEL GOOGLE ADS KURALLARI
- Target ROAS (min 30 dönüşüm/ay), aksi halde Maximize Conversions ile başla
- RSA: 15 başlık (max 30 kar), 4 açıklama (max 90 kar), min 3 Pinned başlık
- Arama payı hedefi: %40+
- UTM: utm_source=google&utm_medium=cpc&utm_campaign={campaignid}&utm_term={keyword}
- Türkiye e-ticaret: iyi ROAS = 3x+
- Bu kurallar kılavuzdur — gerekirse değiştir ve nedenini açıkla

## SOHBET AKIŞIN
**Eğer kampanya bilgileri sağlanmışsa:**
- Onay aşamalarını ATLA
- Direkt TAM PLANI YAZ: strateji özeti + TOFU/MOFU/BOFU detayları
- Yanıtının YANINDA kampanya_plani_kaydet aracını MUTLAKA çağır (sekmeler için)

**Eğer kullanıcı düzeltme isterse:**
- Değişikliği açıkla ve kampanya_plani_kaydet aracını güncel verilerle YENİDEN çağır

**ASLA onay bekleme — form dolu ise direkt plan yaz + aracı çağır.**

## ÖNEMLİ KURALLAR
- Türkçe konuş, samimi ve profesyonel ol
- Mevcut Google Ads verisine göre öneriler yap
- kontrolListesi: en az 10 madde, Google teknik kurulum adımları dahil
- isTakipSureci: en az 5 zaman dilimi — ilk 72 saat kritik`

// ─── POST Handler ────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const { mesajlar, hesap, platform, model, performansOzet, kampanyaBilgileri, ga4Ozet } = await request.json()

    const hesapAdi = hesap === 'karmen' ? 'Karmen Halı' : 'Cotto Home'
    const isGoogle = platform === 'google'

    let sistemMesaji = `${isGoogle ? SISTEM_GOOGLE : SISTEM_META}\n\n## MEVCUT HESAP: ${hesapAdi}`

    if (kampanyaBilgileri) {
      sistemMesaji += `\n\n## KAMPANYA BİLGİLERİ (Kullanıcı Formu)\n${kampanyaBilgileri}`
    }

    if (ga4Ozet) {
      sistemMesaji += `\n\n${ga4Ozet}`
    }

    if (performansOzet) {
      sistemMesaji += `\n\n## MEVCUT ${isGoogle ? 'GOOGLE ADS' : 'META ADS'} PERFORMANS VERİSİ\n${performansOzet}`
    } else {
      sistemMesaji += `\n\n## MEVCUT PERFORMANS VERİSİ\nVeri çekilemedi, genel bilgiyle devam et.`
    }

    const gecmis = mesajlar.map((m: { rol: string; icerik: string }) => ({
      role: m.rol === 'user' ? 'user' : 'assistant',
      content: m.icerik
    }))

    const temizGecmis = gecmis.filter((_: { role: string; content: string }, i: number) => !(i === 0 && gecmis[0].role === 'assistant'))

    const modelId = model || 'claude-sonnet-4-6'

    const response = await client.messages.create({
      model: modelId,
      max_tokens: 8000,
      system: sistemMesaji,
      tools: [KAMPANYA_TOOL],
      tool_choice: { type: 'auto' },
      messages: temizGecmis.length > 0 ? temizGecmis : [{ role: 'user', content: 'Merhaba' }]
    })

    // ── Yanıtı parse et ────────────────────────────────────────────────────
    let icerik = ''
    let plan = null
    let adSetler = null
    let gorselBrief = null
    let kontrolListesi = null
    let isTakipSureci = null

    for (const block of response.content) {
      if (block.type === 'text') {
        icerik += block.text
      } else if (block.type === 'tool_use' && block.name === 'kampanya_plani_kaydet') {
        // Tool use: Anthropic API garantili geçerli JSON — hiç parse hatası olmaz
        const input = block.input as {
          kampanyalar?: unknown[]
          adSetler?: unknown[]
          gorselBriefler?: unknown[]
          kontrolListesi?: unknown[]
          isTakipSureci?: unknown[]
        }
        plan           = input.kampanyalar    || null
        adSetler       = input.adSetler       || null
        gorselBrief    = input.gorselBriefler || null
        kontrolListesi = input.kontrolListesi || null
        isTakipSureci  = input.isTakipSureci  || null
      }
    }

    icerik = icerik.trim()

    return NextResponse.json({ icerik, plan, adSetler, gorselBrief, kontrolListesi, isTakipSureci })

  } catch (e) {
    const status = (e as { status?: number }).status
    const mesaj = e instanceof Error ? e.message : String(e)

    if (status === 529 || mesaj.includes('overloaded')) {
      return NextResponse.json({
        icerik: '⚠️ AI şu anda çok yoğun, 1-2 dakika bekleyip tekrar dene. Bu Anthropic tarafında geçici bir durum.',
        plan: null
      }, { status: 200 })
    }

    return NextResponse.json({ icerik: `Hata: ${mesaj}`, plan: null }, { status: 500 })
  }
}
