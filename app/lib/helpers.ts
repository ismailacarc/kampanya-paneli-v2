import { Insights } from './types'

export function para(v: string | number) {
  return `₺${parseFloat(String(v)).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function sayi(v: string | number) {
  return parseInt(String(v)).toLocaleString('tr-TR')
}

export function getDonusum(ins?: Insights) {
  const a = ins?.actions?.find(a =>
    ['purchase', 'offsite_conversion.fb_pixel_purchase', 'omni_purchase'].includes(a.action_type)
  )
  return parseInt(a?.value || '0')
}

export function getGelir(ins?: Insights) {
  const a = ins?.action_values?.find(a =>
    ['purchase', 'offsite_conversion.fb_pixel_purchase', 'omni_purchase'].includes(a.action_type)
  )
  return parseFloat(a?.value || '0')
}

export function getSepet(ins?: Insights) {
  const a = ins?.actions?.find(a =>
    ['add_to_cart', 'offsite_conversion.fb_pixel_add_to_cart', 'omni_add_to_cart'].includes(a.action_type)
  )
  return parseInt(a?.value || '0')
}

export function getGoruntulenme(ins?: Insights) {
  const a = ins?.actions?.find(a =>
    ['view_content', 'offsite_conversion.fb_pixel_view_content', 'omni_view_content'].includes(a.action_type)
  )
  return parseInt(a?.value || '0')
}

export function getCheckout(ins?: Insights) {
  const a = ins?.actions?.find(a =>
    ['initiate_checkout', 'offsite_conversion.fb_pixel_initiate_checkout', 'omni_initiated_checkout'].includes(a.action_type)
  )
  return parseInt(a?.value || '0')
}

export function getRoas(ins?: Insights) {
  const h = parseFloat(ins?.spend || '0')
  const g = getGelir(ins)
  return h > 0 ? g / h : 0
}

export function roasRenk(r: number) {
  if (r >= 4) return '#059669'   // emerald — çok iyi
  if (r >= 2) return '#D97706'   // amber — orta
  if (r > 0) return '#DC2626'    // red — kötü
  return '#9CA3AF'               // gray — veri yok
}

// Kampanya skorlama: ROAS (%50) + CTR (%25) + Dönüşüm Oranı (%25)
// Türkiye e-ticaret ortalamaları baz alınarak hesaplanır
export function kampanyaSkoru(ins?: Insights): { skor: number; harf: string; renk: string } {
  const spend = parseFloat(ins?.spend || '0')
  if (spend === 0 || !ins) return { skor: 0, harf: '—', renk: '#4d6280' }

  const roas = getRoas(ins)
  const ctr = parseFloat(ins?.ctr || '0')
  const clicks = parseInt(ins?.clicks || '0')
  const donusum = getDonusum(ins)

  // ROAS skoru (0-50 puan) — e-ticaret için en kritik metrik
  let roasSkor = 0
  if (roas >= 5) roasSkor = 50
  else if (roas >= 4) roasSkor = 42
  else if (roas >= 3) roasSkor = 34
  else if (roas >= 2) roasSkor = 22
  else if (roas >= 1) roasSkor = 10
  else if (roas > 0) roasSkor = 5

  // CTR skoru (0-25 puan) — trafik kalitesi
  let ctrSkor = 0
  if (ctr >= 3) ctrSkor = 25
  else if (ctr >= 2) ctrSkor = 20
  else if (ctr >= 1) ctrSkor = 14
  else if (ctr >= 0.5) ctrSkor = 8
  else if (ctr > 0) ctrSkor = 3

  // Dönüşüm oranı skoru (0-25 puan) — CVR = dönüşüm / tıklama
  let donusumSkor = 0
  if (clicks > 0 && donusum > 0) {
    const cvr = (donusum / clicks) * 100
    if (cvr >= 3) donusumSkor = 25
    else if (cvr >= 2) donusumSkor = 20
    else if (cvr >= 1) donusumSkor = 14
    else if (cvr >= 0.5) donusumSkor = 8
    else donusumSkor = 4
  }

  const toplam = roasSkor + ctrSkor + donusumSkor

  let harf: string
  let renk: string
  if (toplam >= 80) { harf = 'A'; renk = '#059669' }   // emerald
  else if (toplam >= 65) { harf = 'B'; renk = '#0891B2' } // cyan
  else if (toplam >= 45) { harf = 'C'; renk = '#D97706' } // amber
  else if (toplam >= 25) { harf = 'D'; renk = '#EA580C' } // orange
  else { harf = 'F'; renk = '#DC2626' }                 // red

  return { skor: toplam, harf, renk }
}

// Önceki dönem tarihlerini hesapla (karşılaştırma için)
export function oncekiDonemTarihleri(donem: string): { baslangic: string; bitis: string } | null {
  if (donem === 'ozel' || donem === 'bu_ay') return null
  const gunSayisi = parseInt(donem)
  if (isNaN(gunSayisi)) return null

  const today = new Date()
  const fmt = (d: Date) => d.toISOString().split('T')[0]

  const oncekiBitis = new Date(today)
  oncekiBitis.setDate(today.getDate() - gunSayisi - 1)

  const oncekiBaslangic = new Date(today)
  oncekiBaslangic.setDate(today.getDate() - 2 * gunSayisi)

  return { baslangic: fmt(oncekiBaslangic), bitis: fmt(oncekiBitis) }
}

// Yüzde değişim hesapla
export function yuzdeDesisim(simdiki: number, onceki: number): { deger: number; yukari: boolean } | null {
  if (onceki === 0) return null
  const fark = ((simdiki - onceki) / onceki) * 100
  return { deger: Math.abs(fark), yukari: fark >= 0 }
}
