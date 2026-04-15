// ─── Birleşik Analiz Deposu ───────────────────────────────────────────────────
// Tüm platformlardan gelen analizler burada toplanır (localStorage)
// Meta kampanya detay + Optimizasyon sayfası + Google Ads analiz

export interface KampanyaAnalizKaydi {
  id: string
  tarih: string                          // "10.04.2026 14:23"
  kaynak: 'kampanya-detay' | 'optimizasyon' | 'meta-hizli'
  platform: 'meta' | 'google'
  hesap: string                          // "karmen" | "cotto"
  donemAdi: string                       // "Son 30 Gün" | "01.01 — 31.01"
  kampanyaAdi?: string                   // kampanya detaydan geliyorsa
  kampanyaId?: string
  model?: string
  durum: 'bekliyor' | 'tamamlandi' | 'hata'
  hataMesaji?: string
  metrikler?: { harcama: number; gelir: number; roas: number; donusum: number }
  // Optimizasyon formatı (optimizasyon sayfası çıktısı)
  sonuc?: {
    ozet: string
    oneriler: Array<{ tip: string; baslik: string; aciklama: string; oncelik: string; kampanya?: string }>
    guclular: string[]
    zayiflar: string[]
    butceVerimliligi: string
    firsat: string
  }
  // Kampanya detay AI formatı (ai-analiz endpoint çıktısı)
  aiAnaliz?: Record<string, unknown>
}

const DEPO_ANAHTARI = 'analiz_merkezi'
const MAX_KAYIT = 50

export function analizleriOku(): KampanyaAnalizKaydi[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(DEPO_ANAHTARI) || '[]') } catch { return [] }
}

export function analizEkle(kayit: KampanyaAnalizKaydi): KampanyaAnalizKaydi[] {
  const mevcut = analizleriOku()
  const yeni = [kayit, ...mevcut].slice(0, MAX_KAYIT)
  localStorage.setItem(DEPO_ANAHTARI, JSON.stringify(yeni))
  window.dispatchEvent(new StorageEvent('storage', { key: DEPO_ANAHTARI, newValue: JSON.stringify(yeni) }))
  return yeni
}

export function analizGuncelle(id: string, guncelleme: Partial<KampanyaAnalizKaydi>): KampanyaAnalizKaydi[] {
  const mevcut = analizleriOku()
  const yeni = mevcut.map(a => a.id === id ? { ...a, ...guncelleme } : a)
  localStorage.setItem(DEPO_ANAHTARI, JSON.stringify(yeni))
  window.dispatchEvent(new StorageEvent('storage', { key: DEPO_ANAHTARI, newValue: JSON.stringify(yeni) }))
  return yeni
}

export function analizSil(id: string): KampanyaAnalizKaydi[] {
  const mevcut = analizleriOku()
  const yeni = mevcut.filter(a => a.id !== id)
  localStorage.setItem(DEPO_ANAHTARI, JSON.stringify(yeni))
  window.dispatchEvent(new StorageEvent('storage', { key: DEPO_ANAHTARI, newValue: JSON.stringify(yeni) }))
  return yeni
}

export function simdi(): string {
  return new Date().toLocaleDateString('tr-TR') + ' ' + new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
}
