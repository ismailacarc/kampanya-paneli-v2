export interface Insights {
  spend: string
  impressions: string
  clicks: string
  ctr: string
  cpc: string
  frequency?: string
  cpm?: string
  actions?: { action_type: string; value: string }[]
  action_values?: { action_type: string; value: string }[]
}

export interface KirilimSatir {
  publisher_platform?: string
  device_platform?: string
  impression_device?: string
  spend: string
  impressions: string
  clicks: string
  actions?: { action_type: string; value: string }[]
  action_values?: { action_type: string; value: string }[]
}

export interface YasCinsiyetSatir {
  age: string
  gender: string
  spend: string
  impressions: string
  clicks: string
  actions?: { action_type: string; value: string }[]
  action_values?: { action_type: string; value: string }[]
}

export interface BolgeSatir {
  region: string
  spend: string
  impressions: string
  clicks: string
  actions?: { action_type: string; value: string }[]
  action_values?: { action_type: string; value: string }[]
}

export interface GunlukSatir {
  date_start: string
  spend: string
  impressions: string
  clicks: string
  ctr: string
  cpc: string
  actions?: { action_type: string; value: string }[]
  action_values?: { action_type: string; value: string }[]
}

export interface UrunSatir {
  product_id: string
  product_name?: string
  spend?: string
  impressions?: string
  actions?: { action_type: string; value: string }[]
  action_values?: { action_type: string; value: string }[]
}

export interface KreatifSatir {
  id: string
  name: string
  status: string
  creative?: {
    thumbnail_url?: string
    image_url?: string
    title?: string
    body?: string
    video_id?: string
    object_type?: string
  }
  insights?: { data: Insights[] }
}

export interface Satir {
  id: string
  name: string
  status: string
  daily_budget?: string
  insights?: { data: Insights[] }
}

export interface AnalizGecmis {
  id: string
  tarih: string
  hesapAdi: string
  donemAdi: string
  analiz: Record<string, unknown>
  platform?: 'meta' | 'google'
}

export const HESAPLAR = [
  { id: 'karmen', ad: 'Karmen Halı', emoji: '🏠', renk: '#c07a3a' },
  { id: 'cotto', ad: 'Cotto Home', emoji: '🛋️', renk: '#3a7ab5' },
]

export const PRESETLER = [
  { id: '1', ad: 'Bugün' },
  { id: '7', ad: 'Son 7 Gün' },
  { id: '14', ad: 'Son 14 Gün' },
  { id: '30', ad: 'Son 30 Gün' },
  { id: 'bu_ay', ad: 'Bu Ay' },
  { id: '90', ad: 'Son 90 Gün' },
  { id: '180', ad: 'Son 6 Ay' },
]
