'use client'

import { useState, useEffect, useCallback } from 'react'
import Sidebar from '../components/Sidebar'
import { C } from '../lib/theme'
import { HESAPLAR } from '../lib/types'

// ─── Tipler ──────────────────────────────────────────────────────────────────
interface GenelData {
  sessions: number; totalUsers: number; newUsers: number
  bounceRate: number; avgSessionDur: number; pagesPerSession: number
}
interface EticaretData {
  gelir: number; islemSayisi: number; satisSayisi: number
  ortSiparisD: number; donusumOrani: number; sepeteEkleme: number; odemeBaslatan: number
}
interface KanalData {
  kanal: string; sessions: number; kullanici: number
  gelir: number; islem: number; bounceRate: number; avgSureDk: number
}
interface SayfaData {
  sayfa: string; sessions: number; bounceRate: number
  gelir: number; islem: number; sepetEkleme: number
  donusumOrani: number; sepetOrani: number; firsatSkor: number
}
interface FunnelAdim { ad: string; sayi: number; oran: number }
interface FunnelData { adimlar: FunnelAdim[]; gelir: number }
interface GunlukData { tarih: string; sessions: number; gelir: number; islem: number }
interface UrunData {
  urun: string; gelir: number; adet: number; gorunum: number
  sepet: number; gelirPay: number; firsatSkor: number
}

// ─── Yardımcılar ─────────────────────────────────────────────────────────────
function para(n: number) {
  if (n >= 1000000) return `₺${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `₺${(n / 1000).toFixed(1)}B`
  return `₺${n.toLocaleString('tr-TR')}`
}
function sayi(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}B`
  return n.toLocaleString('tr-TR')
}
function kanalRenk(kanal: string) {
  const map: Record<string, string> = {
    'Paid Social': '#1877f2', 'Organic Social': '#1877f2',
    'Paid Search': '#fbbc04', 'Organic Search': '#34a853',
    'Organic Shopping': '#34a853', 'Paid Shopping': '#fbbc04',
    'Cross-network': '#ff6d00', 'Direct': '#6b7280',
    'Referral': '#8b5cf6', 'Display': '#06b6d4',
    'Unassigned': '#d1d5db',
  }
  return map[kanal] || '#9ca3af'
}
function kanalTR(kanal: string) {
  const map: Record<string, string> = {
    'Paid Social': 'Ücretli Sosyal (Meta)', 'Organic Social': 'Organik Sosyal',
    'Paid Search': 'Ücretli Arama (Google)', 'Organic Search': 'Organik Arama',
    'Organic Shopping': 'Organik Shopping', 'Paid Shopping': 'Ücretli Shopping',
    'Cross-network': 'Çapraz Ağ (PMax)', 'Direct': 'Direkt',
    'Referral': 'Referans', 'Display': 'Display', 'Paid Other': 'Diğer Ücretli',
    'Unassigned': 'Atanmamış',
  }
  return map[kanal] || kanal
}

// ─── Kart Bileşeni ────────────────────────────────────────────────────────────
function MetrikKart({ baslik, deger, alt, renk = C.primary, icon }: {
  baslik: string; deger: string; alt?: string; renk?: string; icon: string
}) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: '12px', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '1.1rem' }}>{icon}</span>
        <span style={{ fontSize: '0.75rem', color: C.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{baslik}</span>
      </div>
      <div style={{ fontSize: '1.6rem', fontWeight: 800, color: renk, lineHeight: 1.1 }}>{deger}</div>
      {alt && <div style={{ fontSize: '0.72rem', color: C.faint }}>{alt}</div>}
    </div>
  )
}

// ─── Mini Bar Chart ───────────────────────────────────────────────────────────
function MiniBarChart({ data }: { data: GunlukData[] }) {
  const maxGelir = Math.max(...data.map(d => d.gelir), 1)
  const maxSessions = Math.max(...data.map(d => d.sessions), 1)
  const [tooltip, setTooltip] = useState<{ i: number; x: number; y: number } | null>(null)

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '100px', padding: '0 4px' }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', height: '100%', justifyContent: 'flex-end', cursor: 'pointer' }}
            onMouseEnter={e => setTooltip({ i, x: e.currentTarget.getBoundingClientRect().left, y: e.currentTarget.getBoundingClientRect().top })}
            onMouseLeave={() => setTooltip(null)}
          >
            <div style={{ width: '100%', background: C.primary + '30', borderRadius: '2px 2px 0 0', height: `${(d.sessions / maxSessions) * 80}%`, minHeight: '2px' }} />
            <div style={{ width: '100%', background: '#10b981', borderRadius: '2px 2px 0 0', height: `${(d.gelir / maxGelir) * 80}%`, minHeight: '2px', marginTop: '-82px', opacity: 0.7 }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', padding: '0 4px' }}>
        {data.filter((_, i) => i % Math.ceil(data.length / 7) === 0).map((d, i) => (
          <span key={i} style={{ fontSize: '0.62rem', color: C.faint }}>{d.tarih}</span>
        ))}
      </div>
      {tooltip !== null && (
        <div style={{ position: 'fixed', background: '#1f2937', color: '#fff', padding: '8px 12px', borderRadius: '8px', fontSize: '0.72rem', zIndex: 1000, pointerEvents: 'none', top: tooltip.y - 80, left: tooltip.x - 30 }}>
          <div style={{ fontWeight: 700 }}>{data[tooltip.i].tarih}</div>
          <div>Oturum: {sayi(data[tooltip.i].sessions)}</div>
          <div>Gelir: {para(data[tooltip.i].gelir)}</div>
          <div>Satış: {data[tooltip.i].islem}</div>
        </div>
      )}
      <div style={{ display: 'flex', gap: '16px', marginTop: '8px', justifyContent: 'flex-end' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ width: '10px', height: '10px', background: C.primary + '60', borderRadius: '2px' }} />
          <span style={{ fontSize: '0.68rem', color: C.faint }}>Oturum</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ width: '10px', height: '10px', background: '#10b98170', borderRadius: '2px' }} />
          <span style={{ fontSize: '0.68rem', color: C.faint }}>Gelir</span>
        </div>
      </div>
    </div>
  )
}

// ─── Funnel Analizi ───────────────────────────────────────────────────────────
function FunnelAnalizi({ data, markaRenk }: { data: FunnelData; markaRenk: string }) {
  const adimlar = data.adimlar
  const renkler = ['#6366f1', '#f59e0b', '#10b981', '#3b82f6']

  // Adımlar arası geçiş hesapla
  const gecisler = adimlar.slice(0, -1).map((adim, i) => {
    const sonraki   = adimlar[i + 1]
    const devamEden = adim.sayi > 0 ? parseFloat(((sonraki.sayi / adim.sayi) * 100).toFixed(1)) : 0
    const kaybolan  = adim.sayi - sonraki.sayi
    const kayipOran = parseFloat((100 - devamEden).toFixed(1))
    return { devamEden, kaybolan, kayipOran }
  })

  // En kritik kayıp hangi adımda?
  const enKritikIdx = gecisler.reduce((maxI, g, i, arr) => g.kayipOran > arr[maxI].kayipOran ? i : maxI, 0)

  // Tavsiye mesajları
  const tavsiyeler: Record<number, string> = {
    0: 'Ürün sayfalarınız ziyaretçileri sepete çekemiyor. Landing page ve ürün görselleri, fiyat/kargo bilgisi optimize edilmeli.',
    1: 'Sepete ekleyenler ödeme adımına geçmiyor. Checkout sürecine giriş bariyeri yüksek — üye olmadan alışveriş, güven rozetleri eklenebilir.',
    2: 'Ödeme başlatanlar satın almayı tamamlamıyor. Ödeme sayfasında teknik sorun, kargo maliyeti sürprizi veya güven eksikliği olabilir.',
  }

  // Kıyaslama — e-ticaret ortalamaları (genel sektör)
  const kiyaslamalar = [
    { label: 'Sepete Ekleme', deger: gecisler[0]?.devamEden, iyi: 10, orta: 5, birim: '%', aciklama: 'Sektör ortalaması ~%8–12' },
    { label: 'Sepet → Ödeme', deger: gecisler[1]?.devamEden, iyi: 30, orta: 15, birim: '%', aciklama: 'Sektör ortalaması ~%25–40' },
    { label: 'Ödeme → Satış', deger: gecisler[2]?.devamEden, iyi: 40, orta: 20, birim: '%', aciklama: 'Sektör ortalaması ~%35–55' },
  ]

  return (
    <div>
      {/* ── Uyarı Bandı ── */}
      <div style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <span style={{ fontSize: '1rem', flexShrink: 0 }}>⚠️</span>
        <div>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#92400e', marginBottom: '2px' }}>
            En büyük kayıp: {adimlar[enKritikIdx].ad} → {adimlar[enKritikIdx + 1].ad}
            <span style={{ marginLeft: '8px', background: '#ef4444', color: '#fff', borderRadius: '4px', padding: '1px 6px', fontSize: '0.7rem' }}>
              %{gecisler[enKritikIdx].kayipOran} düşüş
            </span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#78350f' }}>{tavsiyeler[enKritikIdx]}</div>
        </div>
      </div>

      {/* ── Huni Görsel ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0', marginBottom: '24px' }}>
        {adimlar.map((adim, i) => {
          const genislik = 100 - i * 15 // Her adım biraz daha dar görünür
          const gecis    = gecisler[i]
          return (
            <div key={i}>
              {/* Adım Bloğu */}
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <div style={{
                  width: `${genislik}%`, background: renkler[i], borderRadius: i === 0 ? '10px 10px 0 0' : i === adimlar.length - 1 ? '0 0 10px 10px' : '0',
                  padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ background: 'rgba(255,255,255,0.25)', color: '#fff', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 800, flexShrink: 0 }}>{i + 1}</span>
                    <div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff' }}>{adim.ad}</div>
                      <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.75)' }}>Toplam ziyaretçinin %{adim.oran}'i</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff', lineHeight: 1 }}>{sayi(adim.sayi)}</div>
                    <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.75)' }}>kişi</div>
                  </div>
                </div>
              </div>

              {/* Geçiş Okları */}
              {gecis && (
                <div style={{ display: 'flex', justifyContent: 'center', margin: '0' }}>
                  <div style={{ width: `${genislik}%`, display: 'grid', gridTemplateColumns: '1fr 1fr', background: '#f9fafb', borderLeft: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb' }}>
                    <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px', borderRight: '1px solid #e5e7eb' }}>
                      <span style={{ color: '#10b981', fontSize: '1rem' }}>✓</span>
                      <div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#10b981' }}>%{gecis.devamEden} devam etti</div>
                        <div style={{ fontSize: '0.65rem', color: C.faint }}>{sayi(adimlar[i + 1].sayi)} kişi bir sonraki adıma geçti</div>
                      </div>
                    </div>
                    <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ color: '#ef4444', fontSize: '1rem' }}>✗</span>
                      <div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#ef4444' }}>%{gecis.kayipOran} düştü</div>
                        <div style={{ fontSize: '0.65rem', color: C.faint }}>{sayi(gecis.kaybolan)} kişi bu adımda ayrıldı</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Kıyaslama Kartları ── */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: C.text, marginBottom: '12px' }}>📊 Sektör Ortalamasıyla Kıyaslama</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          {kiyaslamalar.map((k, i) => {
            const durum = k.deger >= k.iyi ? 'iyi' : k.deger >= k.orta ? 'orta' : 'zayif'
            const renk  = durum === 'iyi' ? '#10b981' : durum === 'orta' ? '#f59e0b' : '#ef4444'
            const etiket = durum === 'iyi' ? '✅ İyi' : durum === 'orta' ? '⚠️ Orta' : '❌ Zayıf'
            return (
              <div key={i} style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: '10px', padding: '14px', borderLeft: `3px solid ${renk}` }}>
                <div style={{ fontSize: '0.7rem', color: C.muted, fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px' }}>{k.label}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '1.6rem', fontWeight: 800, color: renk }}>%{k.deger}</span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: renk }}>{etiket}</span>
                </div>
                <div style={{ fontSize: '0.65rem', color: C.faint }}>{k.aciklama}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Gelir + Genel Dönüşüm ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div style={{ background: '#f0fdf4', borderRadius: '10px', padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.72rem', color: '#15803d', fontWeight: 600, marginBottom: '4px' }}>TOPLAM GELİR</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#15803d' }}>{para(data.gelir)}</div>
        </div>
        <div style={{ background: '#eff6ff', borderRadius: '10px', padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.72rem', color: markaRenk, fontWeight: 600, marginBottom: '4px' }}>GENEL DÖNÜŞÜM</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: markaRenk }}>
            %{adimlar[0].sayi > 0 ? ((adimlar[3].sayi / adimlar[0].sayi) * 100).toFixed(2) : 0}
          </div>
          <div style={{ fontSize: '0.68rem', color: C.faint, marginTop: '4px' }}>Ziyaretçiden satın almaya</div>
        </div>
      </div>
    </div>
  )
}

// ─── Kanallar Tablosu (sıralama destekli) ────────────────────────────────────
type SiralamaKey = 'kanal' | 'sessions' | 'kullanici' | 'gelir' | 'islem' | 'donusum' | 'bounceRate' | 'avgSureDk'

function KanallarTablosu({ kanallar }: { kanallar: KanalData[] }) {
  const [siralama, setSiralama] = useState<SiralamaKey>('gelir')
  const [artan, setArtan]       = useState(false)

  const kolonlar: { key: SiralamaKey; label: string }[] = [
    { key: 'kanal',      label: 'Kanal' },
    { key: 'sessions',   label: 'Oturum' },
    { key: 'kullanici',  label: 'Kullanıcı' },
    { key: 'gelir',      label: 'Gelir' },
    { key: 'islem',      label: 'Satış' },
    { key: 'donusum',    label: 'Dönüşüm' },
    { key: 'bounceRate', label: 'Bounce' },
    { key: 'avgSureDk',  label: 'Ort. Süre' },
  ]

  function tikla(key: SiralamaKey) {
    if (siralama === key) setArtan(a => !a)
    else { setSiralama(key); setArtan(false) }
  }

  const sirali = [...kanallar]
    .map(k => ({ ...k, donusum: k.sessions > 0 ? (k.islem / k.sessions) * 100 : 0 }))
    .sort((a, b) => {
      const va = siralama === 'kanal' ? kanalTR(a.kanal) : (a as Record<string, unknown>)[siralama] as number
      const vb = siralama === 'kanal' ? kanalTR(b.kanal) : (b as Record<string, unknown>)[siralama] as number
      if (typeof va === 'string') return artan ? va.localeCompare(vb as string) : (vb as string).localeCompare(va)
      return artan ? (va as number) - (vb as number) : (vb as number) - (va as number)
    })

  const toplamGelir = kanallar.reduce((s, k) => s + k.gelir, 0)

  return (
    <div>
      {/* Gelir Payı Bar */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '0.75rem', color: C.muted, fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Gelir Dağılımı</div>
        <div style={{ display: 'flex', height: '28px', borderRadius: '6px', overflow: 'hidden', gap: '1px' }}>
          {kanallar.filter(k => k.gelir > 0).map((k, i) => {
            const oran = toplamGelir > 0 ? (k.gelir / toplamGelir) * 100 : 0
            return oran > 2 ? (
              <div key={i} title={`${kanalTR(k.kanal)}: ${para(k.gelir)} (%${oran.toFixed(1)})`}
                style={{ width: `${oran}%`, background: kanalRenk(k.kanal), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {oran > 8 && <span style={{ fontSize: '0.6rem', color: '#fff', fontWeight: 700 }}>{oran.toFixed(0)}%</span>}
              </div>
            ) : null
          })}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
          {kanallar.filter(k => k.gelir > 0).map((k, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: kanalRenk(k.kanal) }} />
              <span style={{ fontSize: '0.68rem', color: C.text }}>{kanalTR(k.kanal)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tablo */}
      <div style={{ overflowX: 'auto', borderRadius: '10px', border: `1px solid ${C.border}` }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ background: C.primary + '10' }}>
              {kolonlar.map(k => (
                <th key={k.key} onClick={() => tikla(k.key)}
                  style={{ padding: '11px 14px', textAlign: 'left', fontWeight: 700, color: siralama === k.key ? C.primary : C.text, borderBottom: `2px solid ${C.border}`, whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none', transition: 'color 0.15s' }}>
                  {k.label} {siralama === k.key ? (artan ? '↑' : '↓') : <span style={{ color: C.faint }}>↕</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sirali.map((k, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${C.borderLight}` }}
                onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = C.bg}
                onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}
              >
                <td style={{ padding: '10px 14px', fontWeight: 600, color: C.text }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: kanalRenk(k.kanal), flexShrink: 0 }} />
                    {kanalTR(k.kanal)}
                  </div>
                </td>
                <td style={{ padding: '10px 14px', color: C.text }}>{sayi(k.sessions)}</td>
                <td style={{ padding: '10px 14px', color: C.text }}>{sayi(k.kullanici)}</td>
                <td style={{ padding: '10px 14px', color: '#10b981', fontWeight: 700 }}>{para(k.gelir)}</td>
                <td style={{ padding: '10px 14px', color: C.text, fontWeight: k.islem > 0 ? 600 : 400 }}>{k.islem}</td>
                <td style={{ padding: '10px 14px', color: k.donusum > 1 ? '#10b981' : k.donusum > 0.1 ? C.text : C.muted, fontWeight: 600 }}>%{k.donusum.toFixed(2)}</td>
                <td style={{ padding: '10px 14px', color: k.bounceRate > 60 ? '#ef4444' : k.bounceRate > 40 ? '#f59e0b' : '#10b981', fontWeight: 600 }}>%{k.bounceRate}</td>
                <td style={{ padding: '10px 14px', color: C.text }}>{k.avgSureDk} dk</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Sayfa Analizi (özet + bar + tablo) ──────────────────────────────────────
type SayfaSiralamaKey = 'sessions' | 'donusumOrani' | 'sepetOrani' | 'gelir' | 'islem' | 'firsatSkor' | 'bounceRate'
const SAYFA_SAYFA_BOYUTU = 20

function SayfaAnalizi({ sayfalar, markaRenk }: { sayfalar: SayfaData[]; markaRenk: string }) {
  const [siralama, setSiralama] = useState<SayfaSiralamaKey>('sessions')
  const [artan, setArtan]       = useState(false)
  const [arama, setArama]       = useState('')
  const [sayfa, setSayfa]       = useState(1)

  // Özet kartlar için hesaplamalar
  const enIyiDonusum  = [...sayfalar].sort((a, b) => b.donusumOrani - a.donusumOrani)[0]
  const enIyiSepet    = [...sayfalar].sort((a, b) => b.sepetOrani - a.sepetOrani)[0]
  const enIyiFirsat   = [...sayfalar].filter(s => s.firsatSkor > 0).sort((a, b) => b.firsatSkor - a.firsatSkor)[0]

  // İlk 5 — dönüşüm bar chart için
  const ilk5Donusum = [...sayfalar]
    .filter(s => s.donusumOrani > 0)
    .sort((a, b) => b.donusumOrani - a.donusumOrani)
    .slice(0, 5)
  const maxDonusum = ilk5Donusum[0]?.donusumOrani || 1

  // Tablo
  const kolonlar: { key: SayfaSiralamaKey; label: string }[] = [
    { key: 'sessions',     label: 'Oturum' },
    { key: 'donusumOrani', label: 'Dönüşüm %' },
    { key: 'sepetOrani',   label: 'Sepete %' },
    { key: 'gelir',        label: 'Gelir' },
    { key: 'islem',        label: 'Satış' },
    { key: 'bounceRate',   label: 'Bounce' },
    { key: 'firsatSkor',   label: 'Fırsat' },
  ]

  function tikla(key: SayfaSiralamaKey) {
    if (siralama === key) setArtan(a => !a)
    else { setSiralama(key); setArtan(false) }
    setSayfa(1)
  }

  function sayfaKisa(url: string) {
    return url.length > 45 ? url.slice(0, 43) + '…' : url
  }

  const filtrelenmis = [...sayfalar]
    .filter(s => s.sayfa.toLowerCase().includes(arama.toLowerCase()))
    .sort((a, b) => {
      const va = a[siralama] as number
      const vb = b[siralama] as number
      return artan ? va - vb : vb - va
    })

  const toplamSayfa  = Math.max(1, Math.ceil(filtrelenmis.length / SAYFA_SAYFA_BOYUTU))
  const sayfadakiler = filtrelenmis.slice((sayfa - 1) * SAYFA_SAYFA_BOYUTU, sayfa * SAYFA_SAYFA_BOYUTU)

  return (
    <div>
      {/* ── 1. Özet Kartlar ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        {/* En iyi dönüşüm */}
        {enIyiDonusum && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '16px' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>🏆 En İyi Dönüşüm</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#15803d', lineHeight: 1 }}>%{enIyiDonusum.donusumOrani}</div>
            <div style={{ fontSize: '0.7rem', color: '#166534', marginTop: '6px', wordBreak: 'break-all' }}>{enIyiDonusum.sayfa}</div>
            <div style={{ fontSize: '0.68rem', color: '#166534', marginTop: '4px', opacity: 0.7 }}>{sayi(enIyiDonusum.sessions)} oturum · {enIyiDonusum.islem} satış</div>
          </div>
        )}
        {/* En iyi sepete ekleme */}
        {enIyiSepet && (
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '16px' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>🛒 En İyi Sepete Ekleme</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1d4ed8', lineHeight: 1 }}>%{enIyiSepet.sepetOrani}</div>
            <div style={{ fontSize: '0.7rem', color: '#1e40af', marginTop: '6px', wordBreak: 'break-all' }}>{enIyiSepet.sayfa}</div>
            <div style={{ fontSize: '0.68rem', color: '#1e40af', marginTop: '4px', opacity: 0.7 }}>{sayi(enIyiSepet.sessions)} oturum · {sayi(enIyiSepet.sepetEkleme)} ekleme</div>
          </div>
        )}
        {/* En büyük fırsat */}
        {enIyiFirsat && (
          <div style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: '12px', padding: '16px' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>🔥 En Büyük Fırsat</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#92400e', lineHeight: 1 }}>Skor {enIyiFirsat.firsatSkor}</div>
            <div style={{ fontSize: '0.7rem', color: '#78350f', marginTop: '6px', wordBreak: 'break-all' }}>{enIyiFirsat.sayfa}</div>
            <div style={{ fontSize: '0.68rem', color: '#78350f', marginTop: '4px', opacity: 0.7 }}>{sayi(enIyiFirsat.sessions)} oturum · %{enIyiFirsat.donusumOrani} dönüşüm</div>
          </div>
        )}
      </div>

      {/* ── 2. Top 5 Dönüşüm Bar Chart ── */}
      {ilk5Donusum.length > 0 && (
        <div style={{ background: C.bg, borderRadius: '12px', padding: '18px', marginBottom: '24px' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: C.text, marginBottom: '14px' }}>🎯 En Çok Dönüşüm Yapan 5 Sayfa</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {ilk5Donusum.map((s, i) => (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '0.75rem', color: C.text, fontWeight: 500, maxWidth: '70%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.sayfa}>
                    <span style={{ color: C.faint, marginRight: '5px', fontSize: '0.68rem' }}>{i + 1}.</span>{s.sayfa}
                  </span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981' }}>%{s.donusumOrani}</span>
                </div>
                <div style={{ background: C.borderLight, borderRadius: '4px', height: '20px', overflow: 'hidden' }}>
                  <div style={{ width: `${(s.donusumOrani / maxDonusum) * 100}%`, background: `linear-gradient(90deg, ${markaRenk}, ${markaRenk}99)`, height: '100%', borderRadius: '4px', display: 'flex', alignItems: 'center', paddingLeft: '8px', transition: 'width 0.5s ease' }}>
                    {(s.donusumOrani / maxDonusum) > 0.3 && (
                      <span style={{ fontSize: '0.65rem', color: '#fff', fontWeight: 700 }}>{sayi(s.islem)} satış · {para(s.gelir)}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 3. Tablo ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
        <div>
          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: C.text }}>📄 Tüm Landing Sayfalar</span>
          <span style={{ fontSize: '0.7rem', color: C.faint, marginLeft: '8px' }}>
            {filtrelenmis.length} sayfa{arama ? ` (${sayfalar.length} içinden)` : ''} · {sayfa}/{toplamSayfa}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', background: '#fff', border: `1px solid ${C.border}`, borderRadius: '8px', padding: '6px 12px', minWidth: '220px' }}>
          <span style={{ fontSize: '0.85rem', color: C.faint }}>🔍</span>
          <input type="text" placeholder="Sayfa URL ara..." value={arama}
            onChange={e => { setArama(e.target.value); setSayfa(1) }}
            style={{ border: 'none', outline: 'none', fontSize: '0.78rem', color: C.text, width: '100%', background: 'transparent' }} />
          {arama && (
            <button onClick={() => { setArama(''); setSayfa(1) }} style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.faint, fontSize: '0.8rem', padding: 0, lineHeight: 1 }}>✕</button>
          )}
        </div>
      </div>

      <div style={{ overflowX: 'auto', borderRadius: '10px', border: `1px solid ${C.border}` }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
          <thead>
            <tr style={{ background: markaRenk + '10' }}>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: C.text, borderBottom: `2px solid ${C.border}`, whiteSpace: 'nowrap', minWidth: '220px' }}>Sayfa</th>
              {kolonlar.map(k => (
                <th key={k.key} onClick={() => tikla(k.key)}
                  style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: siralama === k.key ? markaRenk : C.text, borderBottom: `2px solid ${C.border}`, whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none', transition: 'color 0.15s' }}>
                  {k.label} {siralama === k.key ? (artan ? '↑' : '↓') : <span style={{ color: C.faint }}>↕</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sayfadakiler.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: C.faint, fontSize: '0.8rem' }}>"{arama}" ile eşleşen sayfa bulunamadı</td></tr>
            ) : sayfadakiler.map((s, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${C.borderLight}` }}
                onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = C.bg}
                onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}
              >
                <td style={{ padding: '10px 14px', color: C.text, maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <span style={{ color: C.faint, fontSize: '0.68rem', marginRight: '5px' }}>{(sayfa - 1) * SAYFA_SAYFA_BOYUTU + i + 1}.</span>
                  <span title={s.sayfa}>{sayfaKisa(s.sayfa)}</span>
                </td>
                <td style={{ padding: '10px 14px', color: C.text }}>{sayi(s.sessions)}</td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={{ color: s.donusumOrani >= 2 ? '#10b981' : s.donusumOrani > 0 ? '#f59e0b' : C.faint, fontWeight: s.donusumOrani > 0 ? 700 : 400 }}>
                    %{s.donusumOrani}
                  </span>
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={{ color: s.sepetOrani >= 10 ? '#10b981' : s.sepetOrani > 0 ? C.text : C.faint, fontWeight: s.sepetOrani > 0 ? 600 : 400 }}>
                    %{s.sepetOrani}
                  </span>
                </td>
                <td style={{ padding: '10px 14px', color: s.gelir > 0 ? '#10b981' : C.faint, fontWeight: 700 }}>{s.gelir > 0 ? para(s.gelir) : '—'}</td>
                <td style={{ padding: '10px 14px', color: C.text, fontWeight: s.islem > 0 ? 600 : 400 }}>{s.islem || '—'}</td>
                <td style={{ padding: '10px 14px', color: s.bounceRate > 60 ? '#ef4444' : s.bounceRate > 40 ? '#f59e0b' : '#10b981', fontWeight: 600 }}>%{s.bounceRate}</td>
                <td style={{ padding: '10px 14px' }}>
                  {s.firsatSkor > 70 ? (
                    <span title="Çok oturum, düşük dönüşüm" style={{ background: '#fef3c7', color: '#92400e', borderRadius: '5px', padding: '2px 7px', fontSize: '0.7rem', fontWeight: 700, cursor: 'help' }}>🔥 {s.firsatSkor}</span>
                  ) : s.firsatSkor > 40 ? (
                    <span style={{ fontSize: '0.7rem', color: C.muted, fontWeight: 600 }}>{s.firsatSkor}</span>
                  ) : (
                    <span style={{ fontSize: '0.7rem', color: C.faint }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Sayfalama */}
      {toplamSayfa > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '14px', flexWrap: 'wrap' }}>
          <button onClick={() => setSayfa(1)} disabled={sayfa === 1}
            style={{ padding: '5px 10px', borderRadius: '6px', border: `1px solid ${C.border}`, background: '#fff', cursor: sayfa === 1 ? 'not-allowed' : 'pointer', color: sayfa === 1 ? C.faint : C.text, fontSize: '0.75rem', fontWeight: 600, opacity: sayfa === 1 ? 0.5 : 1 }}>«</button>
          <button onClick={() => setSayfa(p => Math.max(1, p - 1))} disabled={sayfa === 1}
            style={{ padding: '5px 10px', borderRadius: '6px', border: `1px solid ${C.border}`, background: '#fff', cursor: sayfa === 1 ? 'not-allowed' : 'pointer', color: sayfa === 1 ? C.faint : C.text, fontSize: '0.75rem', fontWeight: 600, opacity: sayfa === 1 ? 0.5 : 1 }}>‹ Önceki</button>
          {Array.from({ length: toplamSayfa }, (_, i) => i + 1)
            .filter(p => p === 1 || p === toplamSayfa || Math.abs(p - sayfa) <= 2)
            .reduce<(number | '...')[]>((acc, p, idx, arr) => {
              if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) acc.push('...')
              acc.push(p); return acc
            }, [])
            .map((p, i) => p === '...' ? (
              <span key={`dot-${i}`} style={{ padding: '5px 6px', color: C.faint, fontSize: '0.75rem' }}>…</span>
            ) : (
              <button key={p} onClick={() => setSayfa(p as number)}
                style={{ padding: '5px 10px', borderRadius: '6px', border: `1px solid ${p === sayfa ? markaRenk : C.border}`, background: p === sayfa ? markaRenk : '#fff', color: p === sayfa ? '#fff' : C.text, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, minWidth: '32px', transition: 'all 0.15s' }}>
                {p}
              </button>
            ))}
          <button onClick={() => setSayfa(p => Math.min(toplamSayfa, p + 1))} disabled={sayfa === toplamSayfa}
            style={{ padding: '5px 10px', borderRadius: '6px', border: `1px solid ${C.border}`, background: '#fff', cursor: sayfa === toplamSayfa ? 'not-allowed' : 'pointer', color: sayfa === toplamSayfa ? C.faint : C.text, fontSize: '0.75rem', fontWeight: 600, opacity: sayfa === toplamSayfa ? 0.5 : 1 }}>Sonraki ›</button>
          <button onClick={() => setSayfa(toplamSayfa)} disabled={sayfa === toplamSayfa}
            style={{ padding: '5px 10px', borderRadius: '6px', border: `1px solid ${C.border}`, background: '#fff', cursor: sayfa === toplamSayfa ? 'not-allowed' : 'pointer', color: sayfa === toplamSayfa ? C.faint : C.text, fontSize: '0.75rem', fontWeight: 600, opacity: sayfa === toplamSayfa ? 0.5 : 1 }}>»</button>
        </div>
      )}

      <div style={{ marginTop: '8px', fontSize: '0.68rem', color: C.faint }}>
        🔥 Fırsat skoru: çok oturum gelip az dönüşüm yapan sayfaları işaretler · Dönüşüm rengi: yeşil ≥%2 · sarı &gt;0 · gri sıfır
      </div>
    </div>
  )
}

// ─── Ürünler Tablosu (arama + sayfalama + sıralama + fırsat skoru) ────────────
type UrunSiralamaKey = 'gelir' | 'adet' | 'gorunum' | 'sepet' | 'firsatSkor'
const SAYFA_BOYUTU = 20

function UrunlerTablosu({ urunler, markaRenk }: { urunler: UrunData[]; markaRenk: string }) {
  const [siralama, setSiralama] = useState<UrunSiralamaKey>('gelir')
  const [artan, setArtan]       = useState(false)
  const [arama, setArama]       = useState('')
  const [sayfa, setSayfa]       = useState(1)

  const kolonlar: { key: UrunSiralamaKey; label: string }[] = [
    { key: 'gelir',      label: 'Gelir' },
    { key: 'adet',       label: 'Satış' },
    { key: 'gorunum',    label: 'Görüntülenme' },
    { key: 'sepet',      label: 'Sepete Ekle' },
    { key: 'firsatSkor', label: 'Fırsat' },
  ]

  function tikla(key: UrunSiralamaKey) {
    if (siralama === key) setArtan(a => !a)
    else { setSiralama(key); setArtan(false) }
    setSayfa(1)
  }

  // Arama filtresi + sıralama
  const filtrelenmis = [...urunler]
    .filter(u => u.urun.toLowerCase().includes(arama.toLowerCase()))
    .sort((a, b) => {
      const va = a[siralama] as number
      const vb = b[siralama] as number
      return artan ? va - vb : vb - va
    })

  const toplamSayfa  = Math.max(1, Math.ceil(filtrelenmis.length / SAYFA_BOYUTU))
  const sayfadakiler = filtrelenmis.slice((sayfa - 1) * SAYFA_BOYUTU, sayfa * SAYFA_BOYUTU)

  function aramaDegisti(v: string) { setArama(v); setSayfa(1) }

  return (
    <div style={{ marginTop: '24px' }}>

      {/* Başlık + Arama */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
        <div>
          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: C.text }}>📦 Ürünler</span>
          <span style={{ fontSize: '0.7rem', color: C.faint, marginLeft: '8px' }}>
            {filtrelenmis.length} ürün{arama ? ` (${urunler.length} içinden)` : ''} · sayfa {sayfa}/{toplamSayfa}
          </span>
        </div>
        {/* Arama Kutusu */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', background: '#fff', border: `1px solid ${C.border}`, borderRadius: '8px', padding: '6px 12px', minWidth: '240px' }}>
          <span style={{ fontSize: '0.85rem', color: C.faint }}>🔍</span>
          <input
            type="text"
            placeholder="Ürün adı ara..."
            value={arama}
            onChange={e => aramaDegisti(e.target.value)}
            style={{ border: 'none', outline: 'none', fontSize: '0.78rem', color: C.text, width: '100%', background: 'transparent' }}
          />
          {arama && (
            <button onClick={() => aramaDegisti('')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.faint, fontSize: '0.8rem', padding: 0, lineHeight: 1 }}>✕</button>
          )}
        </div>
      </div>

      {/* Tablo */}
      <div style={{ overflowX: 'auto', borderRadius: '10px', border: `1px solid ${C.border}` }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
          <thead>
            <tr style={{ background: markaRenk + '10' }}>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: C.text, borderBottom: `2px solid ${C.border}`, whiteSpace: 'nowrap', minWidth: '200px' }}>
                Ürün
              </th>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: C.text, borderBottom: `2px solid ${C.border}`, whiteSpace: 'nowrap', minWidth: '110px' }}>
                Gelir Payı
              </th>
              {kolonlar.map(k => (
                <th key={k.key} onClick={() => tikla(k.key)}
                  style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: siralama === k.key ? markaRenk : C.text, borderBottom: `2px solid ${C.border}`, whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none', transition: 'color 0.15s' }}>
                  {k.label} {siralama === k.key ? (artan ? '↑' : '↓') : <span style={{ color: C.faint }}>↕</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sayfadakiler.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: C.faint, fontSize: '0.8rem' }}>
                  "{arama}" ile eşleşen ürün bulunamadı
                </td>
              </tr>
            ) : sayfadakiler.map((u, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${C.borderLight}` }}
                onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = C.bg}
                onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}
              >
                {/* Sıra No + Ürün Adı */}
                <td style={{ padding: '10px 14px', color: C.text, maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <span style={{ color: C.faint, fontSize: '0.68rem', marginRight: '6px', fontWeight: 600 }}>
                    {(sayfa - 1) * SAYFA_BOYUTU + i + 1}.
                  </span>
                  <span title={u.urun} style={{ fontWeight: 500 }}>{u.urun || '—'}</span>
                </td>

                {/* Gelir Payı Bar */}
                <td style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ flex: 1, background: C.borderLight, borderRadius: '3px', height: '8px', overflow: 'hidden', minWidth: '60px' }}>
                      <div style={{ width: `${Math.min(u.gelirPay, 100)}%`, background: markaRenk, height: '100%', borderRadius: '3px', transition: 'width 0.4s ease' }} />
                    </div>
                    <span style={{ fontSize: '0.7rem', color: C.muted, fontWeight: 600, minWidth: '34px', textAlign: 'right' }}>%{u.gelirPay}</span>
                  </div>
                </td>

                <td style={{ padding: '10px 14px', color: '#10b981', fontWeight: 700 }}>{para(u.gelir)}</td>
                <td style={{ padding: '10px 14px', color: C.text, fontWeight: u.adet > 0 ? 600 : 400 }}>{sayi(u.adet)}</td>
                <td style={{ padding: '10px 14px', color: C.text }}>{sayi(u.gorunum)}</td>
                <td style={{ padding: '10px 14px', color: C.text }}>{sayi(u.sepet)}</td>

                {/* Fırsat Skoru */}
                <td style={{ padding: '10px 14px' }}>
                  {u.firsatSkor > 70 ? (
                    <span title={`Fırsat skoru: ${u.firsatSkor} — çok bakılıyor, az satılıyor`}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: '#fef3c7', color: '#92400e', borderRadius: '5px', padding: '2px 7px', fontSize: '0.7rem', fontWeight: 700, cursor: 'help' }}>
                      🔥 {u.firsatSkor}
                    </span>
                  ) : u.firsatSkor > 40 ? (
                    <span style={{ fontSize: '0.7rem', color: C.muted, fontWeight: 600 }}>{u.firsatSkor}</span>
                  ) : (
                    <span style={{ fontSize: '0.7rem', color: C.faint }}>{u.firsatSkor}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Sayfalama */}
      {toplamSayfa > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '14px', flexWrap: 'wrap' }}>
          <button onClick={() => setSayfa(1)} disabled={sayfa === 1}
            style={{ padding: '5px 10px', borderRadius: '6px', border: `1px solid ${C.border}`, background: '#fff', cursor: sayfa === 1 ? 'not-allowed' : 'pointer', color: sayfa === 1 ? C.faint : C.text, fontSize: '0.75rem', fontWeight: 600, opacity: sayfa === 1 ? 0.5 : 1 }}>
            «
          </button>
          <button onClick={() => setSayfa(p => Math.max(1, p - 1))} disabled={sayfa === 1}
            style={{ padding: '5px 10px', borderRadius: '6px', border: `1px solid ${C.border}`, background: '#fff', cursor: sayfa === 1 ? 'not-allowed' : 'pointer', color: sayfa === 1 ? C.faint : C.text, fontSize: '0.75rem', fontWeight: 600, opacity: sayfa === 1 ? 0.5 : 1 }}>
            ‹ Önceki
          </button>

          {Array.from({ length: toplamSayfa }, (_, i) => i + 1)
            .filter(p => p === 1 || p === toplamSayfa || Math.abs(p - sayfa) <= 2)
            .reduce<(number | '...')[]>((acc, p, idx, arr) => {
              if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) acc.push('...')
              acc.push(p)
              return acc
            }, [])
            .map((p, i) => p === '...' ? (
              <span key={`dot-${i}`} style={{ padding: '5px 6px', color: C.faint, fontSize: '0.75rem' }}>…</span>
            ) : (
              <button key={p} onClick={() => setSayfa(p as number)}
                style={{ padding: '5px 10px', borderRadius: '6px', border: `1px solid ${p === sayfa ? markaRenk : C.border}`, background: p === sayfa ? markaRenk : '#fff', color: p === sayfa ? '#fff' : C.text, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, minWidth: '32px', transition: 'all 0.15s' }}>
                {p}
              </button>
            ))}

          <button onClick={() => setSayfa(p => Math.min(toplamSayfa, p + 1))} disabled={sayfa === toplamSayfa}
            style={{ padding: '5px 10px', borderRadius: '6px', border: `1px solid ${C.border}`, background: '#fff', cursor: sayfa === toplamSayfa ? 'not-allowed' : 'pointer', color: sayfa === toplamSayfa ? C.faint : C.text, fontSize: '0.75rem', fontWeight: 600, opacity: sayfa === toplamSayfa ? 0.5 : 1 }}>
            Sonraki ›
          </button>
          <button onClick={() => setSayfa(toplamSayfa)} disabled={sayfa === toplamSayfa}
            style={{ padding: '5px 10px', borderRadius: '6px', border: `1px solid ${C.border}`, background: '#fff', cursor: sayfa === toplamSayfa ? 'not-allowed' : 'pointer', color: sayfa === toplamSayfa ? C.faint : C.text, fontSize: '0.75rem', fontWeight: 600, opacity: sayfa === toplamSayfa ? 0.5 : 1 }}>
            »
          </button>
        </div>
      )}

      <div style={{ marginTop: '8px', fontSize: '0.68rem', color: C.faint }}>
        🔥 Fırsat skoru: çok görüntülenip az satılan ürünleri işaretler (70+ = dikkat gerektiriyor)
      </div>
    </div>
  )
}

// ─── Değişim Badge ───────────────────────────────────────────────────────────
function DegisimBadge({ pct, tersBetter = false }: { pct: number | null; tersBetter?: boolean }) {
  if (pct === null) return null
  const iyi = tersBetter ? pct < 0 : pct > 0
  const renk = pct === 0 ? C.muted : iyi ? '#10b981' : '#ef4444'
  const ok   = pct > 0 ? '↑' : pct < 0 ? '↓' : '→'
  return (
    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: renk, background: renk + '15', borderRadius: '4px', padding: '1px 5px', marginLeft: '4px' }}>
      {ok} {Math.abs(pct)}%
    </span>
  )
}

// Marka renkleri
const MARKA = {
  karmen: { bg: '#7c2d12', hover: '#9a3412', text: '#fff', light: '#fef3c7', dot: '🟠' },
  cotto:  { bg: '#1d4ed8', hover: '#1e40af', text: '#fff', light: '#eff6ff', dot: '🔵' },
}

// Hızlı tarih butonları
function bugunStr() { return new Date().toISOString().split('T')[0] }
function gunOnce(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0] }
function haftaBaslangic() { const d = new Date(); d.setDate(d.getDate() - d.getDay() + 1); return d.toISOString().split('T')[0] }
function ayBaslangic() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01` }

// ─── Ana Sayfa ────────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const [hesap, setHesap]           = useState('cotto')
  const [baslangic, setBaslangic]   = useState(gunOnce(29))
  const [bitis, setBitis]           = useState(bugunStr())
  const [aktifKisaYol, setAktifKisaYol] = useState<string>('30g')
  const [aktifSekme, setAktifSekme] = useState<'genel' | 'eticaret' | 'kanallar' | 'sayfalar' | 'funnel' | 'ai'>('genel')

  const [genel, setGenel]           = useState<GenelData | null>(null)
  const [genelDegisim, setGenelDegisim] = useState<Record<string, number | null>>({})
  const [eticaret, setEticaret]     = useState<EticaretData | null>(null)
  const [eticaretDegisim, setEticaretDegisim] = useState<Record<string, number | null>>({})
  const [kanallar, setKanallar]     = useState<KanalData[]>([])
  const [sayfalar, setSayfalar]     = useState<SayfaData[]>([])
  const [funnel, setFunnel]         = useState<FunnelData | null>(null)
  const [urunler, setUrunler]       = useState<UrunData[]>([])

  const [yukleniyor, setYukleniyor] = useState(false)
  const [hata, setHata]             = useState('')

  // AI analiz state — her sekme için ayrı
  type AiDurum = 'bos' | 'yukleniyor' | 'hazir' | 'hata'
  const [aiSonuc, setAiSonuc]   = useState<Record<string, string>>({})
  const [aiDurum, setAiDurum]   = useState<Record<string, AiDurum>>({})
  // Tarih/marka değişince eski sonuçları temizle
  const [aiAnahtar, setAiAnahtar] = useState('')

  const kisaYollar = [
    { label: 'Bugün',      id: 'bugun',   bas: bugunStr(),        bit: bugunStr() },
    { label: 'Dün',        id: 'dun',     bas: gunOnce(1),        bit: gunOnce(1) },
    { label: 'Bu Hafta',   id: 'hafta',   bas: haftaBaslangic(),  bit: bugunStr() },
    { label: 'Bu Ay',      id: 'ay',      bas: ayBaslangic(),     bit: bugunStr() },
    { label: 'Son 7g',     id: '7g',      bas: gunOnce(6),        bit: bugunStr() },
    { label: 'Son 14g',    id: '14g',     bas: gunOnce(13),       bit: bugunStr() },
    { label: 'Son 30g',    id: '30g',     bas: gunOnce(29),       bit: bugunStr() },
    { label: 'Son 60g',    id: '60g',     bas: gunOnce(59),       bit: bugunStr() },
    { label: 'Son 90g',    id: '90g',     bas: gunOnce(89),       bit: bugunStr() },
  ]

  const veriCek = useCallback(async () => {
    setYukleniyor(true)
    setHata('')
    try {
      const params = `hesap=${hesap}&baslangic=${baslangic}&bitis=${bitis}`
      const [genelRes, eticaretRes, kanallarRes, sayfalarRes, funnelRes, urunlerRes] = await Promise.all([
        fetch(`/api/analytics?${params}&tur=genel`).then(r => r.json()),
        fetch(`/api/analytics?${params}&tur=eticaret`).then(r => r.json()),
        fetch(`/api/analytics?${params}&tur=kanallar`).then(r => r.json()),
        fetch(`/api/analytics?${params}&tur=sayfalar`).then(r => r.json()),
        fetch(`/api/analytics?${params}&tur=funnel`).then(r => r.json()),
        fetch(`/api/analytics?${params}&tur=urunler`).then(r => r.json()),
      ])
      if (genelRes.error) throw new Error(genelRes.error)
      setGenel(genelRes.data)
      setGenelDegisim(genelRes.degisim || {})
      setEticaret(eticaretRes.data)
      setEticaretDegisim(eticaretRes.degisim || {})
      setKanallar(kanallarRes.data || [])
      setSayfalar(sayfalarRes.data || [])
      setFunnel(funnelRes.data)
      setUrunler(urunlerRes.data || [])
    } catch (e) {
      setHata(e instanceof Error ? e.message : 'Veri çekilemedi')
    } finally {
      setYukleniyor(false)
      // Tarih/marka değişince eski AI sonuçlarını sıfırla
      setAiSonuc({})
      setAiDurum({})
      setAiAnahtar(`${hesap}-${baslangic}-${bitis}`)
    }
  }, [hesap, baslangic, bitis])

  useEffect(() => { veriCek() }, [veriCek])

  const marka = MARKA[hesap as 'karmen' | 'cotto']

  // ── AI analiz çağırıcı ──────────────────────────────────────────────────────
  async function aiAnalizCalistir(tip: string, veri: unknown) {
    const key = tip + '-' + aiAnahtar
    setAiDurum(d => ({ ...d, [tip]: 'yukleniyor' }))
    try {
      const res = await fetch('/api/analytics-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tip, hesap, baslangic, bitis, veri }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setAiSonuc(s => ({ ...s, [tip]: data.analiz }))
      setAiDurum(d => ({ ...d, [tip]: 'hazir' }))
    } catch (e) {
      setAiSonuc(s => ({ ...s, [tip]: e instanceof Error ? e.message : 'Hata oluştu' }))
      setAiDurum(d => ({ ...d, [tip]: 'hata' }))
    }
    void key
  }

  // ── Markdown render yardımcıları ─────────────────────────────────────────────
  function inlineFormat(text: string): React.ReactNode {
    const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g)
    return parts.map((p, i) => {
      if (p.startsWith('**') && p.endsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>
      if (p.startsWith('*') && p.endsWith('*')) return <em key={i}>{p.slice(1, -1)}</em>
      if (p.startsWith('`') && p.endsWith('`')) return <code key={i} style={{ background: 'rgba(0,0,0,0.08)', padding: '1px 5px', borderRadius: '3px', fontSize: '0.82em', fontFamily: 'monospace' }}>{p.slice(1, -1)}</code>
      return p
    })
  }

  function MarkdownRenderer({ text }: { text: string }) {
    const lines = text.split('\n')
    const elements: React.ReactNode[] = []
    let i = 0
    while (i < lines.length) {
      const line = lines[i]
      if (line.trim() === '') { elements.push(<div key={i} style={{ height: '6px' }} />); i++; continue }
      if (/^---+$/.test(line.trim())) { elements.push(<hr key={i} style={{ border: 'none', borderTop: `1px solid ${C.border}`, margin: '8px 0' }} />); i++; continue }
      if (line.startsWith('### ')) {
        elements.push(<div key={i} style={{ fontWeight: 700, fontSize: '0.88rem', color: C.text, marginTop: '10px', marginBottom: '4px' }}>{inlineFormat(line.slice(4))}</div>)
        i++; continue
      }
      if (line.startsWith('## ')) {
        elements.push(<div key={i} style={{ fontWeight: 700, fontSize: '0.92rem', color: '#15803d', marginTop: '12px', marginBottom: '6px' }}>{inlineFormat(line.slice(3))}</div>)
        i++; continue
      }
      if (line.startsWith('# ')) {
        elements.push(<div key={i} style={{ fontWeight: 800, fontSize: '1rem', color: '#15803d', marginTop: '12px', marginBottom: '6px' }}>{inlineFormat(line.slice(2))}</div>)
        i++; continue
      }
      if (line.startsWith('|') && lines[i + 1]?.match(/^\|[\s\-:|]+\|/)) {
        const tableLines: string[] = []
        while (i < lines.length && lines[i].startsWith('|')) { tableLines.push(lines[i]); i++ }
        const parseRow = (r: string) => r.split('|').slice(1, -1).map(c => c.trim())
        const headers = parseRow(tableLines[0])
        const rows = tableLines.slice(2).map(parseRow)
        elements.push(
          <div key={i} style={{ overflowX: 'auto', margin: '8px 0', borderRadius: '6px', border: `1px solid ${C.border}` }}>
            <table style={{ borderCollapse: 'collapse', fontSize: '0.78rem', width: '100%' }}>
              <thead>
                <tr style={{ background: '#f0fdf4' }}>
                  {headers.map((h, hi) => <th key={hi} style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700, color: '#15803d', borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => (
                  <tr key={ri} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                    {row.map((cell, ci) => <td key={ci} style={{ padding: '6px 10px', color: C.text }}>{inlineFormat(cell)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
        continue
      }
      if (line.match(/^[-*]\s/)) {
        const items: string[] = []
        while (i < lines.length && lines[i].match(/^[-*]\s/)) { items.push(lines[i].replace(/^[-*]\s/, '')); i++ }
        elements.push(
          <ul key={i} style={{ margin: '4px 0', paddingLeft: '18px', listStyle: 'disc' }}>
            {items.map((item, ii) => <li key={ii} style={{ fontSize: '0.88rem', color: C.text, marginBottom: '3px', lineHeight: 1.7 }}>{inlineFormat(item)}</li>)}
          </ul>
        )
        continue
      }
      if (line.match(/^\d+\.\s/)) {
        const items: string[] = []
        while (i < lines.length && lines[i].match(/^\d+\.\s/)) { items.push(lines[i].replace(/^\d+\.\s/, '')); i++ }
        elements.push(
          <ol key={i} style={{ margin: '4px 0', paddingLeft: '18px' }}>
            {items.map((item, ii) => <li key={ii} style={{ fontSize: '0.88rem', color: C.text, marginBottom: '3px', lineHeight: 1.7 }}>{inlineFormat(item)}</li>)}
          </ol>
        )
        continue
      }
      elements.push(
        <div key={i} style={{ fontSize: '0.88rem', color: C.text, lineHeight: 1.75, marginBottom: '2px' }}>
          {inlineFormat(line)}
        </div>
      )
      i++
    }
    return <div>{elements}</div>
  }

  // ── AI Butonu + Sonuç Kutusu bileşeni ───────────────────────────────────────
  function AiKutusu({ tip, veri, label }: { tip: string; veri: unknown; label?: string }) {
    const durum = aiDurum[tip] || 'bos'
    const sonuc = aiSonuc[tip] || ''

    return (
      <div style={{ marginTop: '20px' }}>
        {durum === 'bos' && (
          <button
            onClick={() => aiAnalizCalistir(tip, veri)}
            style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '8px 16px', background: '#fff', border: `1.5px solid ${marka.bg}`, borderRadius: '8px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, color: marka.bg, transition: 'all 0.15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = marka.bg; (e.currentTarget as HTMLButtonElement).style.color = '#fff' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fff'; (e.currentTarget as HTMLButtonElement).style.color = marka.bg }}
          >
            🤖 {label || 'AI Yorumu Al'}
          </button>
        )}

        {durum === 'yukleniyor' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', background: '#f9fafb', border: `1px solid ${C.border}`, borderRadius: '10px', fontSize: '0.8rem', color: C.muted }}>
            <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</span> AI analiz yapıyor...
          </div>
        )}

        {(durum === 'hazir' || durum === 'hata') && (
          <div style={{ background: durum === 'hata' ? '#fef2f2' : '#f0fdf4', border: `1px solid ${durum === 'hata' ? '#fecaca' : '#86efac'}`, borderRadius: '10px', padding: '16px', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: durum === 'hata' ? '#dc2626' : '#15803d', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                🤖 AI {durum === 'hata' ? 'Hata' : 'Analizi'} — {baslangic} → {bitis}
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => aiAnalizCalistir(tip, veri)}
                  style={{ fontSize: '0.68rem', padding: '2px 8px', border: `1px solid ${durum === 'hata' ? '#fca5a5' : '#86efac'}`, borderRadius: '5px', cursor: 'pointer', background: 'transparent', color: durum === 'hata' ? '#dc2626' : '#15803d', fontWeight: 600 }}
                >
                  🔄 Yenile
                </button>
                <button
                  onClick={() => { setAiDurum(d => ({ ...d, [tip]: 'bos' })); setAiSonuc(s => ({ ...s, [tip]: '' })) }}
                  style={{ fontSize: '0.68rem', padding: '2px 8px', border: `1px solid ${C.border}`, borderRadius: '5px', cursor: 'pointer', background: 'transparent', color: C.faint }}
                >
                  ✕
                </button>
              </div>
            </div>
            <div>
              <MarkdownRenderer text={sonuc} />
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg, fontFamily: 'system-ui, sans-serif' }}>
      <Sidebar />
      <div style={{ flex: 1, marginLeft: '220px', overflowY: 'auto', overflowX: 'hidden', padding: '28px 32px', minWidth: 0 }}>

        {/* Başlık */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
            <div>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: C.text, margin: 0 }}>📈 Google Analytics</h1>
              <p style={{ fontSize: '0.78rem', color: C.muted, margin: '4px 0 0' }}>{baslangic} → {bitis} · Önceki dönemle karşılaştırılıyor</p>
            </div>

            {/* Marka Butonları */}
            <div style={{ display: 'flex', gap: '8px' }}>
              {([
                { id: 'karmen', label: '🟠 Karmen Halı', ...MARKA.karmen },
                { id: 'cotto',  label: '🔵 Cotto Home',  ...MARKA.cotto  },
              ]).map(h => (
                <button key={h.id} onClick={() => setHesap(h.id)} style={{
                  padding: '9px 18px', borderRadius: '10px', cursor: 'pointer',
                  background: hesap === h.id ? h.bg : '#fff',
                  color: hesap === h.id ? h.text : C.muted,
                  fontWeight: 700, fontSize: '0.82rem',
                  boxShadow: hesap === h.id ? `0 4px 14px ${h.bg}40` : `0 1px 4px rgba(0,0,0,0.08)`,
                  border: hesap === h.id ? `2px solid ${h.bg}` : `1px solid ${C.border}`,
                  transition: 'all 0.2s',
                }}>
                  {h.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tarih Kontrolleri */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Hızlı Kısa Yollar */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {kisaYollar.map(k => (
                <button key={k.id} onClick={() => { setBaslangic(k.bas); setBitis(k.bit); setAktifKisaYol(k.id) }}
                  style={{ padding: '5px 11px', borderRadius: '6px', border: `1px solid ${aktifKisaYol === k.id ? marka.bg : C.border}`, background: aktifKisaYol === k.id ? marka.bg : '#fff', color: aktifKisaYol === k.id ? '#fff' : C.text, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}>
                  {k.label}
                </button>
              ))}
            </div>

            {/* Özel Tarih */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#fff', border: `1px solid ${C.border}`, borderRadius: '8px', padding: '4px 10px' }}>
              <span style={{ fontSize: '0.72rem', color: C.muted, fontWeight: 600 }}>Özel:</span>
              <input type="date" value={baslangic} onChange={e => { setBaslangic(e.target.value); setAktifKisaYol('ozel') }}
                style={{ border: 'none', fontSize: '0.75rem', color: C.text, outline: 'none', cursor: 'pointer' }} />
              <span style={{ color: C.faint }}>→</span>
              <input type="date" value={bitis} onChange={e => { setBitis(e.target.value); setAktifKisaYol('ozel') }}
                style={{ border: 'none', fontSize: '0.75rem', color: C.text, outline: 'none', cursor: 'pointer' }} />
            </div>

            <button onClick={veriCek} disabled={yukleniyor} style={{ padding: '6px 14px', background: marka.bg, color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, opacity: yukleniyor ? 0.6 : 1 }}>
              {yukleniyor ? '⏳' : '🔄'} Yenile
            </button>
          </div>
        </div>

        {hata && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px 16px', color: '#dc2626', fontSize: '0.82rem', marginBottom: '20px' }}>
            ⚠️ {hata}
          </div>
        )}

        {/* Özet Kartlar */}
        {genel && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: '10px', marginBottom: '20px' }}>
            {[
              { icon: '👥', baslik: 'Kullanıcı',    deger: sayi(genel.totalUsers),      dgKey: 'totalUsers',      tersBetter: false },
              { icon: '🖥️', baslik: 'Oturum',        deger: sayi(genel.sessions),         dgKey: 'sessions',        tersBetter: false },
              { icon: '⏱️', baslik: 'Ort. Süre',     deger: `${genel.avgSessionDur} dk`,  dgKey: 'avgSessionDur',   tersBetter: false },
              { icon: '🚪', baslik: 'Hemen Çıkma',   deger: `%${genel.bounceRate}`,        dgKey: 'bounceRate',      tersBetter: true  },
              ...(eticaret ? [
                { icon: '💰', baslik: 'Gelir',         deger: para(eticaret.gelir),          dgKey: 'gelir',           tersBetter: false, src: eticaretDegisim },
                { icon: '🛒', baslik: 'Satış',         deger: String(eticaret.satisSayisi),  dgKey: 'islemSayisi',     tersBetter: false, src: eticaretDegisim },
                { icon: '🎯', baslik: 'Dönüşüm',       deger: `%${eticaret.donusumOrani}`,   dgKey: 'donusumOrani',    tersBetter: false, src: eticaretDegisim },
                { icon: '💳', baslik: 'Ort. Sipariş',  deger: para(eticaret.ortSiparisD),    dgKey: 'ortSiparisD',     tersBetter: false, src: eticaretDegisim },
              ] : []),
            ].map((k, i) => {
              const src = (k as { src?: Record<string, number | null> }).src || genelDegisim
              const pct = src[k.dgKey] as number | null ?? null
              return (
                <div key={i} style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: '12px', padding: '14px 16px' }}>
                  <div style={{ fontSize: '0.7rem', color: C.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>{k.icon} {k.baslik}</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: C.text, lineHeight: 1.1 }}>{k.deger}</div>
                  <div style={{ marginTop: '4px', minHeight: '18px' }}>
                    <DegisimBadge pct={pct} tersBetter={k.tersBetter} />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Sekmeler */}
        <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, overflowX: 'auto' }}>
            {([
              { id: 'genel',    label: '🌐 Genel Trafik' },
              { id: 'eticaret', label: '🛒 E-Ticaret' },
              { id: 'kanallar', label: '📣 Kanallar' },
              { id: 'funnel',   label: '🔄 Funnel' },
              { id: 'sayfalar', label: '📄 Sayfalar' },
              { id: 'ai',       label: '🤖 AI Analiz' },
            ] as const).map(s => (
              <button key={s.id} onClick={() => setAktifSekme(s.id)} style={{ padding: '12px 18px', background: 'none', border: 'none', borderBottom: `2px solid ${aktifSekme === s.id ? marka.bg : 'transparent'}`, color: aktifSekme === s.id ? marka.bg : C.muted, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, whiteSpace: 'nowrap', transition: 'all 0.15s' }}>
                {s.label}
              </button>
            ))}
          </div>

          <div style={{ padding: '20px' }}>

            {/* ── Genel Trafik ── */}
            {aktifSekme === 'genel' && genel && (
              <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                {[
                  { baslik: 'Toplam Kullanıcı', deger: sayi(genel.totalUsers), ikon: '👥', dgKey: 'totalUsers',      aciklama: 'Siteye gelen benzersiz kullanıcı sayısı' },
                  { baslik: 'Yeni Kullanıcı',   deger: sayi(genel.newUsers),   ikon: '✨', dgKey: 'newUsers',         aciklama: `Toplam kullanıcının %${genel.totalUsers > 0 ? ((genel.newUsers / genel.totalUsers) * 100).toFixed(0) : 0}'i ilk kez geliyor` },
                  { baslik: 'Oturum',            deger: sayi(genel.sessions),   ikon: '🖥️', dgKey: 'sessions',         aciklama: 'Toplam ziyaret sayısı' },
                  { baslik: 'Sayfa/Oturum',      deger: genel.pagesPerSession.toString(), ikon: '📄', dgKey: 'pagesPerSession', aciklama: 'Her ziyarette ortalama bakılan sayfa' },
                  { baslik: 'Ort. Süre',         deger: `${genel.avgSessionDur} dk`,      ikon: '⏱️', dgKey: 'avgSessionDur',   aciklama: 'Oturum başına geçirilen ortalama süre' },
                  { baslik: 'Hemen Çıkma',       deger: `%${genel.bounceRate}`,            ikon: '🚪', dgKey: 'bounceRate',      aciklama: 'Tek sayfa görüntüleyip çıkan ziyaretçi oranı' },
                ].map((k, i) => (
                  <div key={i} style={{ background: C.bg, borderRadius: '10px', padding: '16px' }}>
                    <div style={{ fontSize: '1.4rem', marginBottom: '8px' }}>{k.ikon}</div>
                    <div style={{ fontSize: '0.72rem', color: C.muted, fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>{k.baslik}</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '1.5rem', fontWeight: 800, color: C.text }}>{k.deger}</span>
                      <DegisimBadge pct={genelDegisim[k.dgKey] as number | null ?? null} tersBetter={k.baslik === 'Hemen Çıkma'} />
                    </div>
                    <div style={{ fontSize: '0.68rem', color: C.faint, marginTop: '6px' }}>{k.aciklama}</div>
                  </div>
                ))}
              </div>
              <AiKutusu tip="genel" veri={genel} label="Bu trafiği AI ile analiz et" />
              </div>
            )}

            {/* ── E-Ticaret ── */}
            {aktifSekme === 'eticaret' && eticaret && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                  {[
                    { baslik: 'Toplam Gelir',    deger: para(eticaret.gelir),           ikon: '💰', renk: '#10b981' },
                    { baslik: 'Satış Sayısı',    deger: sayi(eticaret.satisSayisi),     ikon: '🛒', renk: C.primary },
                    { baslik: 'Ort. Sipariş',    deger: para(eticaret.ortSiparisD),     ikon: '💳', renk: C.primary },
                    { baslik: 'Dönüşüm Oranı',  deger: `%${eticaret.donusumOrani}`,    ikon: '🎯', renk: '#f59e0b' },
                    { baslik: 'Sepete Ekleme',   deger: sayi(eticaret.sepeteEkleme),    ikon: '🛍️', renk: C.primary },
                    { baslik: 'Ödeme Başlatan',  deger: sayi(eticaret.odemeBaslatan),   ikon: '💳', renk: '#f59e0b' },
                  ].map((k, i) => (
                    <div key={i} style={{ background: C.bg, borderRadius: '10px', padding: '16px', borderLeft: `3px solid ${k.renk}` }}>
                      <div style={{ fontSize: '0.72rem', color: C.muted, fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px' }}>{k.ikon} {k.baslik}</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: k.renk }}>{k.deger}</div>
                    </div>
                  ))}
                </div>
                {/* Sepet → Satış oranı */}
                <div style={{ background: C.bg, borderRadius: '10px', padding: '16px' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: C.text, marginBottom: '12px' }}>🛒 Sepet Dönüşüm Analizi</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', textAlign: 'center' }}>
                    {[
                      { ad: 'Sepete Ekleyenler', sayi: eticaret.sepeteEkleme },
                      { ad: 'Ödeme Başlatanlar', sayi: eticaret.odemeBaslatan },
                      { ad: 'Satın Alanlar',     sayi: eticaret.satisSayisi },
                    ].map((adim, i) => (
                      <div key={i} style={{ background: '#fff', borderRadius: '8px', padding: '12px' }}>
                        <div style={{ fontSize: '1.3rem', fontWeight: 800, color: C.text }}>{sayi(adim.sayi)}</div>
                        <div style={{ fontSize: '0.7rem', color: C.muted, marginTop: '4px' }}>{adim.ad}</div>
                        {i > 0 && (
                          <div style={{ fontSize: '0.68rem', color: '#10b981', fontWeight: 700, marginTop: '4px' }}>
                            %{eticaret.sepeteEkleme > 0 ? ((adim.sayi / eticaret.sepeteEkleme) * 100).toFixed(1) : 0} dönüşüm
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Ürün Tablosu */}
                {urunler.length > 0 && <UrunlerTablosu urunler={urunler} markaRenk={marka.bg} />}
                <AiKutusu tip="eticaret" veri={{ ...eticaret, urunler: urunler.slice(0, 20) }} label="E-Ticareti AI ile analiz et" />
              </div>
            )}

            {/* ── Kanallar ── */}
            {aktifSekme === 'kanallar' && kanallar.length > 0 && (
              <div>
                <KanallarTablosu kanallar={kanallar} />
                <AiKutusu tip="kanallar" veri={kanallar} label="Kanalları AI ile analiz et" />
              </div>
            )}

            {/* ── Funnel ── */}
            {aktifSekme === 'funnel' && funnel && (
              <div>
                <FunnelAnalizi data={funnel} markaRenk={marka.bg} />
                <AiKutusu tip="funnel" veri={funnel} label="Funnel'ı AI ile analiz et" />
              </div>
            )}

            {/* ── Landing Sayfalar ── */}
            {aktifSekme === 'sayfalar' && sayfalar.length > 0 && (
              <div>
                <SayfaAnalizi sayfalar={sayfalar} markaRenk={marka.bg} />
                <AiKutusu tip="sayfalar" veri={sayfalar.slice(0, 30)} label="Sayfaları AI ile analiz et" />
              </div>
            )}

            {/* ── AI Analiz (Merkezi) ── */}
            {aktifSekme === 'ai' && (
              <div>
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: C.text, marginBottom: '6px' }}>🤖 Tüm Veriyi AI ile Analiz Et</div>
                  <div style={{ fontSize: '0.78rem', color: C.muted, marginBottom: '16px' }}>
                    Seçili dönemdeki tüm GA4 verisi (trafik, e-ticaret, kanallar, funnel, ürünler) tek seferde analiz edilir. Kapsamlı rapor + öncelikli aksiyon listesi döner.
                  </div>
                  {(genel || eticaret || kanallar.length > 0) ? (
                    <AiKutusu
                      tip="tumu"
                      veri={{ genel, eticaret, kanallar, funnel, urunler: urunler.slice(0, 15) }}
                      label="📊 Tüm Veriyi Analiz Et"
                    />
                  ) : (
                    <div style={{ background: '#fef9c3', border: '1px solid #fde68a', borderRadius: '10px', padding: '16px', fontSize: '0.8rem', color: '#92400e' }}>
                      ⚠️ Önce veri yüklenmesi gerekiyor. Başka bir sekmeye gidip geri dön.
                    </div>
                  )}
                </div>

                {/* Her sekmenin ayrı AI butonu özeti */}
                <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: '20px', marginTop: '8px' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>Ya da Sekme Bazlı Analiz:</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {[
                      { tip: 'genel',    veri: genel,                                           label: '🌐 Genel Trafik',  aktif: !!genel },
                      { tip: 'eticaret', veri: { ...eticaret, urunler: urunler.slice(0, 20) }, label: '🛒 E-Ticaret',    aktif: !!eticaret },
                      { tip: 'kanallar', veri: kanallar,                                        label: '📣 Kanallar',      aktif: kanallar.length > 0 },
                      { tip: 'funnel',   veri: funnel,                                          label: '🔄 Funnel',        aktif: !!funnel },
                      { tip: 'sayfalar', veri: sayfalar.slice(0, 30),                           label: '📄 Sayfalar',      aktif: sayfalar.length > 0 },
                    ].map(s => (
                      <button key={s.tip} onClick={() => s.aktif && aiAnalizCalistir(s.tip, s.veri)}
                        disabled={!s.aktif || aiDurum[s.tip] === 'yukleniyor'}
                        style={{ padding: '7px 14px', borderRadius: '8px', border: `1.5px solid ${aiDurum[s.tip] === 'hazir' ? '#86efac' : aiDurum[s.tip] === 'yukleniyor' ? C.border : marka.bg}`, background: aiDurum[s.tip] === 'hazir' ? '#f0fdf4' : '#fff', color: !s.aktif ? C.faint : aiDurum[s.tip] === 'hazir' ? '#15803d' : marka.bg, cursor: s.aktif ? 'pointer' : 'not-allowed', fontSize: '0.78rem', fontWeight: 600, opacity: s.aktif ? 1 : 0.5 }}>
                        {aiDurum[s.tip] === 'yukleniyor' ? '⏳' : aiDurum[s.tip] === 'hazir' ? '✅' : ''} {s.label}
                      </button>
                    ))}
                  </div>

                  {/* Hazır sonuçları göster */}
                  {['genel', 'eticaret', 'kanallar', 'funnel', 'sayfalar'].filter(t => aiDurum[t] === 'hazir' || aiDurum[t] === 'hata').map(t => (
                    <div key={t} style={{ marginTop: '16px' }}>
                      <AiKutusu tip={t} veri={
                        t === 'genel' ? genel :
                        t === 'eticaret' ? { ...eticaret, urunler: urunler.slice(0, 20) } :
                        t === 'kanallar' ? kanallar :
                        t === 'funnel' ? funnel :
                        sayfalar.slice(0, 30)
                      } />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {yukleniyor && (
              <div style={{ textAlign: 'center', padding: '40px', color: C.faint, fontSize: '0.82rem' }}>
                ⏳ Veriler yükleniyor...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
