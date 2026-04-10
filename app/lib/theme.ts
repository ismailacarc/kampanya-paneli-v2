// ─── Clean Light Design System ────────────────────────────────────────────────
// Notion / Stripe Dashboard tarzı — Inter font, beyaz zemin, ince border'lar
// Tüm spacing 8px bazlı: 4, 8, 12, 16, 24, 32, 48, 64

export const C = {
  // ── Zemin & Kart ──────────────────────────────────────────────────────────
  bg:          '#F8FAFC',   // slate-50 — sayfa zemini
  card:        '#FFFFFF',   // saf beyaz kart
  cardHover:   '#F8FAFC',   // hover
  border:      '#E2E8F0',   // slate-200 — ana border
  borderLight: '#F1F5F9',   // slate-100 — ayırıcı çizgiler

  // ── Metin Hiyerarşisi ─────────────────────────────────────────────────────
  text:   '#0F172A',        // slate-900 — başlık & kritik veri
  muted:  '#64748B',        // slate-500 — ikincil metin
  faint:  '#94A3B8',        // slate-400 — placeholder & açıklama

  // ── Tablo ─────────────────────────────────────────────────────────────────
  subRow:    '#F8FAFC',
  tableHead: '#F8FAFC',
  input:     '#FFFFFF',

  // ── Marka Renkleri ────────────────────────────────────────────────────────
  primary: '#1D4ED8',       // blue-700 — ana aksiyon rengi
  accent:  '#3B82F6',       // blue-500 — vurgu & link

  // ── Section Arka Planları ─────────────────────────────────────────────────
  sectionPurple: '#F5F3FF',
  sectionRed:    '#FEF2F2',
  sectionYellow: '#FEFCE8',
  sectionGreen:  '#F0FDF4',
  sectionBlue:   '#EFF6FF',
}

// ── Gölge sistemi ─────────────────────────────────────────────────────────────
export const SHADOW = {
  xs: '0 1px 2px rgba(15,23,42,0.04)',
  sm: '0 1px 3px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)',
  md: '0 4px 6px rgba(15,23,42,0.05), 0 2px 4px rgba(15,23,42,0.04)',
  lg: '0 10px 15px rgba(15,23,42,0.06), 0 4px 6px rgba(15,23,42,0.04)',
}

// ── KPI Renk Sistemi (sol aksan border için) ──────────────────────────────────
export const KPI = {
  gelir:   { border: '#16A34A', text: '#15803D', bg: '#F0FDF4', light: '#DCFCE7' },
  harcama: { border: '#DC2626', text: '#B91C1C', bg: '#FEF2F2', light: '#FEE2E2' },
  roas:    { border: '#D97706', text: '#B45309', bg: '#FFFBEB', light: '#FEF3C7' },
  satis:   { border: '#7C3AED', text: '#6D28D9', bg: '#F5F3FF', light: '#EDE9FE' },
}

// ── Metrik renkleri ───────────────────────────────────────────────────────────
export const METRIK_RENK = {
  harcama:  '#DC2626',
  gelir:    '#16A34A',
  donusum:  '#2563EB',
  tiklama:  '#7C3AED',
  gosterim: '#0891B2',
  cpc:      '#1D4ED8',
}
