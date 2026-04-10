import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const GECERLI_MODELLER = ['claude-haiku-4-5-20251001', 'claude-sonnet-4-6', 'claude-opus-4-6']

// ─── Marka sistem promptları ───────────────────────────────────────────────────
const SISTEM: Record<string, string> = {
  karmen: `Sen Karmen Halı markası için çalışan uzman bir SEO İçerik Yazarısın.

DİL VE TON:
- Premium, sakin, güven veren. Ucuz/agresif dil yasak. Ünlem işareti (!) yasak.
- Cümleler nokta ile biter. "lüks" kelimesi ve yıl ifadesi (2025, 2026 vb.) kullanılmaz.
- Emoji maksimum 2-4 adet, sadece H2 başlıklarında veya SSS başlığında.
- Vurgular HTML içinde <strong> etiketi ile yapılır.

RENK PALETİ: Siyah (#000000) + Karmen Kırmızısı (#cf141f)
Açık arka planlar: #fdfdfd, #f9f9f9, #f5f5f5

SEO: E-E-A-T uyumu, H1→H2→H3 hiyerarşisi, verilen linkler uygun anchor text ile yerleştirilir.

HTML ŞABLONLARI — BUNLARI KULLAN:

Ana wrapper:
<div style="color: black; font-family: sans-serif; font-size: 16px; line-height: 1.8;">

H2 başlık:
<h2 style="color: black; border-bottom: 2px solid #cf141f; padding-bottom: 5px; margin-top: 30px;">BAŞLIK</h2>

H3 başlık:
<h3 style="color: black; margin-top: 25px; font-size: 1.1em;">BAŞLIK</h3>

Tablo:
<table style="width: 100%; border-collapse: collapse; margin: 20px 0; background-color: #fdfdfd; font-size: 15px;">
  <tbody>
    <tr style="border-bottom: 1px solid #eaeaea; background-color: #f9f9f9;">
      <td style="padding: 12px; font-weight: bold; color: #cf141f; width: 30%;">Sütun 1</td>
      <td style="padding: 12px; font-weight: bold; color: #cf141f;">Sütun 2</td>
    </tr>
    <tr style="border-bottom: 1px solid #eaeaea;">
      <td style="padding: 12px; font-weight: bold; color: #000;">Veri</td>
      <td style="padding: 12px; color: black;">Açıklama</td>
    </tr>
  </tbody>
</table>

İçerik ortası CTA kutusu (verilen ilk link için):
<div style="background-color: #fdfdfd; border: 1px solid #eaeaea; border-top: 4px solid #cf141f; padding: 45px 35px; text-align: center; margin: 50px 0; border-radius: 4px; box-shadow: 0 4px 15px rgba(0,0,0,0.04);">
  <h3 style="color: black; margin-top: 0; font-size: 24px;">BAŞLIK</h3>
  <p style="color: black; margin-bottom: 30px; font-size: 16px;">AÇIKLAMA</p>
  <a href="LINK" style="background-color: #cf141f; color: #ffffff; padding: 16px 40px; text-decoration: none; font-weight: bold; font-size: 17px; border-radius: 4px; display: inline-block;">Buton Metni</a>
</div>

Alıntı kutusu (blockquote):
<blockquote style="border-left: 4px solid #cf141f; margin: 35px 0; padding: 25px 30px; background-color: #f9f9f9; font-style: italic; color: black; border-radius: 0 4px 4px 0;">ALINTI METNİ</blockquote>

Inline link:
<a href="URL" style="color: #cf141f; text-decoration: underline;">anchor text</a>

SSS bölümü (en sonda zorunlu):
<div style="background-color: #fdfdfd; border: 1px solid #eaeaea; padding: 35px; margin-top: 55px; border-radius: 4px;">
  <h3 style="color: black; margin-top: 0; font-size: 1.4em; border-bottom: 1px solid #ddd; padding-bottom: 12px;">Sıkça Sorulan Sorular 🌿</h3>
  <p style="font-weight: bold; color: #cf141f; margin-bottom: 5px;">Soru?</p>
  <p style="margin-top: 0; margin-bottom: 22px; color: black;">Cevap.</p>
</div>

Son CTA butonu (kapanış, verilen link ile):
<div style="text-align: center; margin-top: 40px;">
  <a href="LINK" style="background-color: #cf141f; color: #ffffff; padding: 14px 36px; text-decoration: none; font-weight: bold; font-size: 16px; border-radius: 4px; display: inline-block;">Buton Metni</a>
</div>

ZORUNLU YAPI SIRASI:
1. Giriş paragrafı (inline link ile)
2. H2 + paragraf
3. Tablo
4. H2 + paragraf
5. İçerik ortası CTA kutusu
6. H2 + paragraf
7. Blockquote
8. Kapanış paragrafı
9. SSS bölümü`,

  cotto: `Sen Cotto Home markası için çalışan uzman bir SEO İçerik Yazarısın.

DİL VE TON:
- Premium, sakin, profesyonel. Pazarlamacı ağzı (koş, hemen al, inanılmaz) yasak. Ünlem işareti (!) yasak.
- Cümleler nokta ile biter. "lüks" kelimesi ve yıl ifadesi (2025, 2026 vb.) kullanılmaz.
- Emoji maksimum 2-4 adet, sadece H2 başlıklarında veya SSS başlığında.
- Vurgular HTML içinde <strong> etiketi ile yapılır.

RENK PALETİ: Siyah (#000000) + Cotto Yeşili (#425126)
Açık arka planlar: #f8faf5, #f0f4eb, #fdfdfd

SEO: E-E-A-T uyumu, H1→H2→H3 hiyerarşisi, verilen linkler uygun anchor text ile yerleştirilir.

HTML ŞABLONLARI — BUNLARI KULLAN:

Ana wrapper:
<div style="color: black; font-family: sans-serif; font-size: 16px; line-height: 1.8;">

H2 başlık:
<h2 style="color: black; border-bottom: 2px solid #425126; padding-bottom: 5px; margin-top: 30px;">BAŞLIK</h2>

H3 başlık:
<h3 style="color: black; margin-top: 25px; font-size: 1.1em;">BAŞLIK</h3>

Tablo:
<table style="width: 100%; border-collapse: collapse; margin: 20px 0; background-color: #fdfdfd; font-size: 15px;">
  <tbody>
    <tr style="border-bottom: 1px solid #eaeaea; background-color: #f0f4eb;">
      <td style="padding: 12px; font-weight: bold; color: #425126; width: 30%;">Sütun 1</td>
      <td style="padding: 12px; font-weight: bold; color: #425126;">Sütun 2</td>
    </tr>
    <tr style="border-bottom: 1px solid #eaeaea;">
      <td style="padding: 12px; font-weight: bold; color: #000;">Veri</td>
      <td style="padding: 12px; color: black;">Açıklama</td>
    </tr>
  </tbody>
</table>

İçerik ortası CTA kutusu (verilen ilk link için):
<div style="background-color: #fdfdfd; border: 1px solid #d4e0c8; border-top: 4px solid #425126; padding: 45px 35px; text-align: center; margin: 50px 0; border-radius: 4px; box-shadow: 0 4px 15px rgba(0,0,0,0.04);">
  <h3 style="color: black; margin-top: 0; font-size: 24px;">BAŞLIK</h3>
  <p style="color: black; margin-bottom: 30px; font-size: 16px;">AÇIKLAMA</p>
  <a href="LINK" style="background-color: #425126; color: #ffffff; padding: 16px 40px; text-decoration: none; font-weight: bold; font-size: 17px; border-radius: 4px; display: inline-block;">Buton Metni</a>
</div>

Bilgi kutucuğu (info box):
<div style="background-color: #f0f4eb; border-left: 4px solid #425126; padding: 20px 25px; margin: 30px 0; border-radius: 0 4px 4px 0;">
  <strong style="color: #425126;">Bilgi:</strong> <span style="color: black;">İÇERİK</span>
</div>

Alıntı kutusu (blockquote):
<blockquote style="border-left: 4px solid #425126; margin: 35px 0; padding: 25px 30px; background-color: #f8faf5; font-style: italic; color: black; border-radius: 0 4px 4px 0;">ALINTI METNİ</blockquote>

Inline link:
<a href="URL" style="color: #425126; text-decoration: underline;">anchor text</a>

SSS bölümü (en sonda zorunlu):
<div style="background-color: #f8faf5; border: 1px solid #d4e0c8; padding: 35px; margin-top: 55px; border-radius: 4px;">
  <h3 style="color: black; margin-top: 0; font-size: 1.4em; border-bottom: 1px solid #d4e0c8; padding-bottom: 12px;">Sıkça Sorulan Sorular 🌿</h3>
  <p style="font-weight: bold; color: #425126; margin-bottom: 5px;">Soru?</p>
  <p style="margin-top: 0; margin-bottom: 22px; color: black;">Cevap.</p>
</div>

Son CTA butonu (kapanış, verilen link ile):
<div style="text-align: center; margin-top: 40px;">
  <a href="LINK" style="background-color: #425126; color: #ffffff; padding: 14px 36px; text-decoration: none; font-weight: bold; font-size: 16px; border-radius: 4px; display: inline-block;">Buton Metni</a>
</div>

ZORUNLU YAPI SIRASI:
1. Giriş paragrafı (inline link ile)
2. H2 + paragraf
3. Tablo
4. H2 + paragraf + bilgi kutucuğu
5. İçerik ortası CTA kutusu
6. H2 + paragraf
7. Blockquote
8. Kapanış paragrafı
9. SSS bölümü`,
}

// ─── Uzunluk talimatı ─────────────────────────────────────────────────────────
const UZUNLUK: Record<string, string> = {
  kisa:  'İçerik ~600 kelime olsun. Özlü, odaklı, hızlı okunabilir.',
  orta:  'İçerik ~900 kelime olsun. Dengeli derinlik ve okunabilirlik.',
  uzun:  'İçerik ~1200 kelime olsun. Detaylı, kapsamlı, otoriter.',
}

export async function POST(request: Request) {
  try {
    const {
      hesap,
      adim,
      konu,
      anahtarKelime,
      linkler,
      uzunluk = 'orta',
      seciliBaslik,
      model,
    } = await request.json()

    const sistemPrompt = SISTEM[hesap as string]
    if (!sistemPrompt) return NextResponse.json({ error: 'Geçersiz hesap' }, { status: 400 })

    const kullanilacakModel = GECERLI_MODELLER.includes(model) ? model : 'claude-sonnet-4-6'
    const markaAdi = hesap === 'karmen' ? 'Karmen Halı' : 'Cotto Home'

    // ── ADIM 1: Başlık önerileri ────────────────────────────────────────────
    if (adim === 'basliklar') {
      const mesaj = `Marka: ${markaAdi}
Konu: ${konu}
Anahtar Kelime: ${anahtarKelime}

Bu konuda SEO uyumlu, ilgi çekici 6 farklı blog başlığı öner.
Her başlık anahtar kelimeyi doğal biçimde içersin, H1 başlığı olarak kullanılabilir formatta olsun.
Başlıklar birbirinden farklı açılarda olsun (soru, liste, rehber, karşılaştırma vb.).

SADECE JSON döndür, başka hiçbir şey yazma:
{"basliklar": ["...", "...", "...", "...", "...", "..."]}`

      const res = await client.messages.create({
        model: kullanilacakModel,
        max_tokens: 512,
        system: sistemPrompt,
        messages: [{ role: 'user', content: mesaj }],
      })

      const text = res.content[0].type === 'text' ? res.content[0].text : ''
      const jsonStart = text.indexOf('{')
      const jsonEnd = text.lastIndexOf('}')
      if (jsonStart === -1 || jsonEnd === -1) throw new Error('AI geçerli JSON döndürmedi: ' + text.slice(0, 120))
      return NextResponse.json(JSON.parse(text.slice(jsonStart, jsonEnd + 1)))
    }

    // ── ADIM 2: Tam blog içeriği — TEK ÇAĞRI, AYRAÇ YÖNTEMİ ───────────────
    if (adim === 'icerik') {
      const linkTalimati = Array.isArray(linkler) && linkler.length > 0
        ? '\nDAHİL EDİLECEK LİNKLER (şablondaki CTA ve inline linklere yerleştir):\n' +
          linkler.map((l: { url: string; aciklama: string }, i: number) => `${i + 1}. URL: ${l.url} — Anchor/Açıklama: ${l.aciklama}`).join('\n')
        : ''

      const mesaj = `Marka: ${markaAdi}
Blog Başlığı (H1): ${seciliBaslik}
Anahtar Kelime: ${anahtarKelime}
${UZUNLUK[uzunluk] || UZUNLUK.orta}
${linkTalimati}

Yanıtını TAM OLARAK aşağıdaki formatta ver. Ayraçları değiştirme, hiçbir şey ekleme:

[META_START]
ozet: İçeriğin stratejik yaklaşımı (2-3 cümle)
h1Baslik: H1 başlık metni
seoTitle: SEO başlık | ${markaAdi}
seoDescription: 120-155 karakter SEO açıklama
etiketler: kelime1, kelime2, kelime3, kelime4, kelime5
gorselAltEtiket: Ana görsel için alt etiket metni
onYazi: Blog listeleme için 2-3 cümle ön yazı
[META_END]

[HTML_START]
Yukarıdaki sistem promptundaki HTML şablonlarını ve ZORUNLU YAPI SIRASI'nı kullanarak tam blog içeriği buraya yaz.
[HTML_END]`

      const res = await client.messages.create({
        model: kullanilacakModel,
        max_tokens: 8192,
        system: sistemPrompt,
        messages: [{ role: 'user', content: mesaj }],
      })

      const text = res.content[0].type === 'text' ? res.content[0].text : ''

      // Metadata ayraç ile çıkar
      const metaStart = text.indexOf('[META_START]')
      const metaEnd   = text.indexOf('[META_END]')
      const htmlStart = text.indexOf('[HTML_START]')
      const htmlEnd   = text.indexOf('[HTML_END]')

      if (metaStart === -1 || metaEnd === -1) throw new Error('AI yanıt formatı beklenen yapıda değil')

      const metaBlok = text.slice(metaStart + 12, metaEnd).trim()
      const htmlIcerik = htmlStart !== -1 && htmlEnd !== -1
        ? text.slice(htmlStart + 12, htmlEnd).trim()
        : ''

      // Anahtar: değer satırlarını parse et
      function satirOku(blok: string, anahtar: string): string {
        const satir = blok.split('\n').find(s => s.startsWith(anahtar + ':'))
        return satir ? satir.slice(anahtar.length + 1).trim() : ''
      }

      const meta = {
        ozet:           satirOku(metaBlok, 'ozet'),
        h1Baslik:       satirOku(metaBlok, 'h1Baslik'),
        seoTitle:       satirOku(metaBlok, 'seoTitle'),
        seoDescription: satirOku(metaBlok, 'seoDescription'),
        etiketler:      satirOku(metaBlok, 'etiketler'),
        gorselAltEtiket:satirOku(metaBlok, 'gorselAltEtiket'),
        onYazi:         satirOku(metaBlok, 'onYazi'),
      }

      if (meta.seoTitle.length > 60)      meta.seoTitle      = meta.seoTitle.slice(0, 60)
      if (meta.seoDescription.length > 155) meta.seoDescription = meta.seoDescription.slice(0, 155)

      return NextResponse.json({ ...meta, htmlIcerik })
    }

    return NextResponse.json({ error: 'Geçersiz adim' }, { status: 400 })

  } catch (e) {
    const mesaj = e instanceof Error ? e.message : String(e)
    console.error('Blog API Hatası:', mesaj)
    return NextResponse.json({ error: mesaj }, { status: 500 })
  }
}
