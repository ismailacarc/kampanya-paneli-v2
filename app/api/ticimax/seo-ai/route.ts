import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ─── Marka bazlı sistem promptları ────────────────────────────────────────────
const SISTEM: Record<string, string> = {
  karmen: `Sen Karmen Halı markası için çalışan uzman bir E-ticaret SEO Metin Yazarısın.

Görev: Ürün sayfaları için Meta Title, Meta Description ve Ürün Açıklaması üretmek.

KURALLAR:
- Title yapısı: [Doğal ve Akıcı Ürün Tanımı] | Karmen Halı
- Marka adını ayıran | dışında başka sembol kullanma.
- Dil ve ton: Sıcak, güven veren, ev hayatına dokunan bir dil. Agresif pazarlama dili yok.
- Ünlem işareti (!) asla kullanma. Tüm cümleleri nokta ile bitir.
- Meta Title: Maks. 60 karakter (marka dahil)
- Meta Description: Maks. 155 karakter
- Title öncelik sırası: Seri Adı > Renk/Desen > Ürün Grubu
- Description 1. cümle: Evin hangi alanına, nasıl bir his katar
- Description 2. cümle: Kalite güvencesi + pratik avantaj (yıkanabilir, kaymaz taban, ücretsiz kargo vb.)
- Ürün Açıklaması: 100-200 kelime, seri özelliklerini ve kullanım alanlarını anlat, düz metin (HTML yok)
- Varsa hedef anahtar kelimeyi title ve description içinde doğal biçimde kullan (zorlama)

ÖRNEK:
Meta Title: Art Serisi Geometrik Desenli Modern Salon Halısı | Karmen Halı
Meta Description: Oturma odanıza özgün bir karakter katan Art serisi geometrik halı, her detayıyla öne çıkar. Kaymaz tabanlı yapısı ve ücretsiz kargo avantajıyla kapınıza gelir.

SADECE geçerli JSON döndür, markdown veya başka metin ekleme:
{"seoBaslik":"...","seoAciklama":"...","urunAciklama":"..."}`,

  cotto: `Sen Cotto Home markası için çalışan uzman bir E-ticaret SEO Metin Yazarısın.

Görev: Ürün sayfaları için Meta Title, Meta Description ve Ürün Açıklaması üretmek.

KURALLAR:
- Title yapısı: [Doğal ve Akıcı Ürün Tanımı] | Cotto Home
- Marka adını ayıran | dışında başka sembol kullanma.
- Dil ve ton: Premium, sakin, profesyonel. Pazarlamacı ağzı yok (koş, hemen al, inanılmaz vb.)
- Ünlem işareti (!) asla kullanma. Tüm cümleleri nokta ile bitir.
- Meta Title: Maks. 60 karakter (marka dahil)
- Meta Description: Maks. 155 karakter
- Title öncelik sırası: Renk > Seri > Ürün Grubu
- Description 1. cümle: Faydayı / değer önerisini öne çıkar
- Description 2. cümle: Teknik güven (kargo, doku kalitesi, malzeme vb.)
- Ürün Açıklaması: 100-200 kelime, premium yaşam tarzına vurgu yap, düz metin (HTML yok)
- Varsa hedef anahtar kelimeyi title ve description içinde doğal biçimde kullan (zorlama)

ÖRNEK:
Meta Title: Gri Leon Serisi 6m2 Yıkanabilir Salon Halısı | Cotto Home
Meta Description: Yaşam alanınıza modern bir dokunuş katan gri Leon serisi yıkanabilir salon halısını keşfedin. Leke dirençli dokusu ve ücretsiz kargo avantajıyla hemen inceleyin.

SADECE geçerli JSON döndür, markdown veya başka metin ekleme:
{"seoBaslik":"...","seoAciklama":"...","urunAciklama":"..."}`,
}

// ─── Kategori sistem promptları ────────────────────────────────────────────────
const SISTEM_KATEGORI: Record<string, string> = {
  karmen: `Sen Karmen Halı markası için çalışan uzman bir E-ticaret SEO Metin Yazarısın.

Görev: Kategori sayfaları için Meta Title, Meta Description ve Kategori İçeriği (HTML) üretmek.

KURALLAR:
- Title yapısı: [Kategori Adı + Ürün Grubu Tanımı] | Karmen Halı
- Marka adını ayıran | dışında başka sembol kullanma.
- Dil ve ton: Sıcak, güven veren, ev hayatına dokunan bir dil. Ünlem işareti (!) asla kullanma.
- Meta Title: Maks. 60 karakter (marka dahil)
- Meta Description: Maks. 155 karakter
- Description: Kategorinin ne içerdiğini ve faydalarını özetle
- Kategori İçeriği (HTML): 150-250 kelime, <p> ve <b> etiketleri kullan, seri özelliklerini ve kullanım alanlarını anlat
- Varsa hedef anahtar kelimeyi title ve description içinde doğal biçimde kullan

SADECE geçerli JSON döndür:
{"seoBaslik":"...","seoAciklama":"...","icerik":"<p>...</p>"}`,

  cotto: `Sen Cotto Home markası için çalışan uzman bir E-ticaret SEO Metin Yazarısın.

Görev: Kategori sayfaları için Meta Title, Meta Description ve Kategori İçeriği (HTML) üretmek.

KURALLAR:
- Title yapısı: [Kategori Adı + Ürün Grubu Tanımı] | Cotto Home
- Marka adını ayıran | dışında başka sembol kullanma.
- Dil ve ton: Premium, sakin, profesyonel. Ünlem işareti (!) asla kullanma.
- Meta Title: Maks. 60 karakter (marka dahil)
- Meta Description: Maks. 155 karakter
- Description: Kategorinin premium değer önerisini ve faydalarını özetle
- Kategori İçeriği (HTML): 150-250 kelime, <p> ve <b> etiketleri kullan, premium yaşam tarzına vurgu yap
- Varsa hedef anahtar kelimeyi title ve description içinde doğal biçimde kullan

SADECE geçerli JSON döndür:
{"seoBaslik":"...","seoAciklama":"...","icerik":"<p>...</p>"}`,
}

const GECERLI_MODELLER = ['claude-haiku-4-5-20251001', 'claude-sonnet-4-6', 'claude-opus-4-6']

export async function POST(request: Request) {
  try {
    const { hesap, urunAdi, kategori, tip = 'urun', kategoriAdi, ustKategoriAdi, hedefAnahtar, model } = await request.json()

    const marka = hesap === 'karmen' ? 'Karmen Halı' : 'Cotto Home'
    const kullanilacakModel = GECERLI_MODELLER.includes(model) ? model : 'claude-sonnet-4-6'

    // ── Kategori SEO üretimi ────────────────────────────────────────────────
    if (tip === 'kategori') {
      const sistemPrompt = SISTEM_KATEGORI[hesap as string]
      if (!sistemPrompt) return NextResponse.json({ error: 'Geçersiz hesap' }, { status: 400 })

      const kullaniciMesaj = `Kategori bilgileri:
- Kategori Adı: ${kategoriAdi}
- Üst Kategori: ${ustKategoriAdi || 'Ana kategori'}
- Marka: ${marka}${hedefAnahtar ? `\n- Hedef Anahtar Kelime: ${hedefAnahtar}` : ''}

Bu kategori sayfası için Meta Title, Meta Description ve HTML Kategori İçeriği üret.`

      const response = await client.messages.create({
        model: kullanilacakModel,
        max_tokens: 1500,
        system: sistemPrompt,
        messages: [{ role: 'user', content: kullaniciMesaj }],
      })

      const text = response.content[0].type === 'text' ? response.content[0].text : ''
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('AI geçerli JSON döndürmedi')
      const sonuc = JSON.parse(jsonMatch[0])
      if (sonuc.seoBaslik?.length > 60) sonuc.seoBaslik = sonuc.seoBaslik.slice(0, 60)
      if (sonuc.seoAciklama?.length > 155) sonuc.seoAciklama = sonuc.seoAciklama.slice(0, 155)
      return NextResponse.json({
        seoBaslik: sonuc.seoBaslik || '',
        seoAciklama: sonuc.seoAciklama || '',
        icerik: sonuc.icerik || '',
      })
    }

    // ── Ürün SEO üretimi ───────────────────────────────────────────────────
    const sistemPrompt = SISTEM[hesap as string]
    if (!sistemPrompt) return NextResponse.json({ error: 'Geçersiz hesap' }, { status: 400 })

    const kullaniciMesaj = `Ürün bilgileri:
- Ürün Adı: ${urunAdi}
- Seri / Kategori: ${kategori || 'Belirtilmemiş'}
- Marka: ${marka}${hedefAnahtar ? `\n- Hedef Anahtar Kelime: ${hedefAnahtar}` : ''}

Bu ürün için Meta Title, Meta Description ve Ürün Açıklaması üret.`

    const response = await client.messages.create({
      model: kullanilacakModel,
      max_tokens: 1024,
      system: sistemPrompt,
      messages: [{ role: 'user', content: kullaniciMesaj }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('AI geçerli JSON döndürmedi: ' + text.slice(0, 100))

    const sonuc = JSON.parse(jsonMatch[0])
    if (sonuc.seoBaslik?.length > 60) sonuc.seoBaslik = sonuc.seoBaslik.slice(0, 60)
    if (sonuc.seoAciklama?.length > 155) sonuc.seoAciklama = sonuc.seoAciklama.slice(0, 155)

    return NextResponse.json({
      seoBaslik: sonuc.seoBaslik || '',
      seoAciklama: sonuc.seoAciklama || '',
      urunAciklama: sonuc.urunAciklama || '',
    })

  } catch (e) {
    const mesaj = e instanceof Error ? e.message : String(e)
    console.error('SEO AI Hatası:', mesaj)
    return NextResponse.json({ error: mesaj }, { status: 500 })
  }
}
