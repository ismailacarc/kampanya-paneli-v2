// Optimizasyon Günlüğü — veri tipi ve localStorage yardımcıları

export interface OptimizasyonKaydi {
  id: string
  tarih: string               // ISO — "2025-01-01T10:30:00"
  hesap: string               // 'karmen' | 'cotto'
  donemAdi: string            // "Son 30 Gün"
  donemId?: string            // "7" | "14" | "30" | "bu_ay" | "90"
  platform?: 'meta' | 'google'
  kaynak: 'ai-merkezi' | 'kampanya-detay'

  kampanyaIds: string[]
  kampanyaAdlari: string[]

  // O anki metrik snapshot'ı (fotoğraf gibi)
  metriks: {
    harcama: number
    gelir: number
    roas: number
    donusum: number
  }

  // Yapılan işlemler (tikli aksiyonlar)
  yapilanlar: string[]
  notlar: string

  // Hatırlatma
  hatirlatmaGun: number           // 0 = yok
  hatirlatmaTarihi: string | null // "2025-01-04"
  hatirlatmaGoruldu: boolean

  // Takip raporu (sonradan doldurulur)
  takipTarihi?: string
  takipMetriks?: {
    harcama: number
    gelir: number
    roas: number
    donusum: number
  }
  takipAiYorumu?: string
}

const DEPO_KEY = 'opt_gunlugu'

export function kayitlariGetir(): OptimizasyonKaydi[] {
  if (typeof window === 'undefined') return []
  try {
    const d = localStorage.getItem(DEPO_KEY)
    return d ? JSON.parse(d) : []
  } catch { return [] }
}

export function kayitEkle(kayit: OptimizasyonKaydi): void {
  const mevcut = kayitlariGetir()
  const yeni = [kayit, ...mevcut]
  try { localStorage.setItem(DEPO_KEY, JSON.stringify(yeni)) } catch {}
}

export function kayitGuncelle(id: string, guncellemeler: Partial<OptimizasyonKaydi>): void {
  const mevcut = kayitlariGetir()
  const yeni = mevcut.map(k => k.id === id ? { ...k, ...guncellemeler } : k)
  try { localStorage.setItem(DEPO_KEY, JSON.stringify(yeni)) } catch {}
}

export function kayitSil(id: string): void {
  const mevcut = kayitlariGetir()
  try { localStorage.setItem(DEPO_KEY, JSON.stringify(mevcut.filter(k => k.id !== id))) } catch {}
}

export function vadesiGelenler(): OptimizasyonKaydi[] {
  const bugun = new Date().toISOString().split('T')[0]
  return kayitlariGetir().filter(k =>
    k.hatirlatmaTarihi &&
    k.hatirlatmaTarihi <= bugun &&
    !k.hatirlatmaGoruldu
  )
}

// Analiz nesnesinden tüm aksiyon maddelerini düz liste olarak çıkar
export function aksiyonlariCikar(analiz: Record<string, unknown>): string[] {
  const liste: string[] = []

  const acil = analiz.acil as { kampanya?: string; aksiyonlar?: string[] }[] | undefined
  if (Array.isArray(acil)) {
    acil.forEach(item => {
      if (Array.isArray(item.aksiyonlar)) {
        item.aksiyonlar.forEach(a => liste.push(item.kampanya ? `[${item.kampanya}] ${a}` : a))
      }
    })
  }

  const iyilestir = analiz.iyilestir as { kampanya?: string; aksiyonlar?: string[] }[] | undefined
  if (Array.isArray(iyilestir)) {
    iyilestir.forEach(item => {
      if (Array.isArray(item.aksiyonlar)) {
        item.aksiyonlar.forEach(a => liste.push(item.kampanya ? `[${item.kampanya}] ${a}` : a))
      }
    })
  }

  const stratejik = analiz.stratejik as string[] | undefined
  if (Array.isArray(stratejik)) {
    stratejik.forEach(a => liste.push(a))
  }

  return liste
}
