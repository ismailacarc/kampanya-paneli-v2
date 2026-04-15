'use client'

import { useEffect, useState } from 'react'
import Sidebar, { globalModelOku } from '../components/Sidebar'
import { C } from '../lib/theme'
import { HESAPLAR } from '../lib/types'
import { getDonusum, getGelir, getRoas, para } from '../lib/helpers'
import { kayitlariGetir, vadesiGelenler } from '../lib/gecmis'

// ─── Tipler ──────────────────────────────────────────────────────────────────
interface BrifingItem {
  id: string
  oncelik: 'acil' | 'takip' | 'iyi'
  platform: 'meta' | 'google'
  hesap: 'karmen' | 'cotto'
  hesapAdi: string
  kampanyaAdi: string
  kampanyaId?: string
  sebep: string
  aksiyon: string
  metrikler?: { label: string; deger: string; renk?: string }[]
}

interface GKampanya {
  id: string
  ad: string
  durum: number
  harcama: string
  donusum: number
  gelir: string
  roas: string
  tip: string
}

interface MetaKampanya {
  id: string
  name: string
  status: string
  insights?: { data: { spend?: string; impressions?: string; clicks?: string; ctr?: string; frequency?: string; actions?: { action_type: string; value: string }[]; action_values?: { action_type: string; value: string }[] }[] }
}

// ─── Kurallar Motoru ─────────────────────────────────────────────────────────
function metaKurallariUygula(
  kampanyalar: MetaKampanya[],
  hesap: 'karmen' | 'cotto',
  hesapAdi: string
): BrifingItem[] {
  const items: BrifingItem[] = []

  for (const k of kampanyalar) {
    if (k.status !== 'ACTIVE') continue
    const ins = k.insights?.data?.[0]
    if (!ins) continue

    const harcama = parseFloat(ins.spend || '0')
    if (harcama < 50) continue // Çok düşük harcama, gürültü sayma

    const gelir = getGelir(ins as Parameters<typeof getGelir>[0])
    const roas = harcama > 0 ? gelir / harcama : 0
    const ctr = parseFloat(ins.ctr || '0')
    const frekans = parseFloat(ins.frequency || '0')
    const donusum = getDonusum(ins as Parameters<typeof getDonusum>[0])

    // 🔴 ACİL: Harcama var ama hiç satış gelmemiş
    if (donusum === 0 && harcama > 200) {
      items.push({
        id: `${k.id}-sifir-satis`,
        oncelik: 'acil',
        platform: 'meta',
        hesap,
        hesapAdi,
        kampanyaAdi: k.name,
        kampanyaId: k.id,
        sebep: `₺${harcama.toFixed(0)} harcandı, 0 satış geldi`,
        aksiyon: 'Pixel takibini kontrol et veya kampanyayı durdur',
        metrikler: [
          { label: 'Harcama', deger: para(harcama), renk: '#DC2626' },
          { label: 'Satış', deger: '0', renk: '#DC2626' },
          { label: 'CTR', deger: `%${ctr.toFixed(2)}` },
        ],
      })
      continue
    }

    // 🔴 ACİL: ROAS < 1.5 (zarar ediyor)
    if (roas > 0 && roas < 1.5 && harcama > 300) {
      items.push({
        id: `${k.id}-dusuk-roas`,
        oncelik: 'acil',
        platform: 'meta',
        hesap,
        hesapAdi,
        kampanyaAdi: k.name,
        kampanyaId: k.id,
        sebep: `ROAS ${roas.toFixed(2)}x — her ₺1 harcamaya ₺${roas.toFixed(2)} dönüyor`,
        aksiyon: 'Bütçeyi azalt, kitleleri daralt veya durdur',
        metrikler: [
          { label: 'ROAS', deger: `${roas.toFixed(2)}x`, renk: '#DC2626' },
          { label: 'Harcama', deger: para(harcama) },
          { label: 'Gelir', deger: para(gelir), renk: '#DC2626' },
        ],
      })
      continue
    }

    // 🔴 ACİL: Frekans > 4.0 (kreatif çöküyor)
    if (frekans >= 4.0 && harcama > 100) {
      items.push({
        id: `${k.id}-yuksek-frekans`,
        oncelik: 'acil',
        platform: 'meta',
        hesap,
        hesapAdi,
        kampanyaAdi: k.name,
        kampanyaId: k.id,
        sebep: `Frekans ${frekans.toFixed(1)} — aynı kişi reklamı çok görüyor, kreatif yoruldu`,
        aksiyon: 'Yeni kreatif yükle veya kitleyi genişlet',
        metrikler: [
          { label: 'Frekans', deger: frekans.toFixed(1), renk: '#DC2626' },
          { label: 'CTR', deger: `%${ctr.toFixed(2)}` },
          { label: 'ROAS', deger: `${roas.toFixed(2)}x` },
        ],
      })
      continue
    }

    // 🟡 TAKİP: CTR < 0.8 (kreatif sorunu var)
    if (ctr < 0.8 && ctr > 0 && harcama > 150) {
      items.push({
        id: `${k.id}-dusuk-ctr`,
        oncelik: 'takip',
        platform: 'meta',
        hesap,
        hesapAdi,
        kampanyaAdi: k.name,
        kampanyaId: k.id,
        sebep: `CTR %${ctr.toFixed(2)} — sektör ortalamasının altında (>%1)`,
        aksiyon: 'Kreatifi test et veya hedef kitleyi yeniden değerlendir',
        metrikler: [
          { label: 'CTR', deger: `%${ctr.toFixed(2)}`, renk: '#D97706' },
          { label: 'Harcama', deger: para(harcama) },
          { label: 'ROAS', deger: `${roas.toFixed(2)}x` },
        ],
      })
      continue
    }

    // 🟡 TAKİP: Frekans 3.0-4.0 (yakında kreatif yorgunluğu)
    if (frekans >= 3.0 && frekans < 4.0 && harcama > 100) {
      items.push({
        id: `${k.id}-frekans-uyari`,
        oncelik: 'takip',
        platform: 'meta',
        hesap,
        hesapAdi,
        kampanyaAdi: k.name,
        kampanyaId: k.id,
        sebep: `Frekans ${frekans.toFixed(1)} — kreatif yorgunluğu yaklaşıyor`,
        aksiyon: 'Yeni kreatif hazırlamaya başla, bu hafta yükle',
        metrikler: [
          { label: 'Frekans', deger: frekans.toFixed(1), renk: '#D97706' },
          { label: 'CTR', deger: `%${ctr.toFixed(2)}` },
        ],
      })
      continue
    }

    // 🟡 TAKİP: ROAS 1.5-2.5 (izle)
    if (roas >= 1.5 && roas < 2.5 && harcama > 300) {
      items.push({
        id: `${k.id}-orta-roas`,
        oncelik: 'takip',
        platform: 'meta',
        hesap,
        hesapAdi,
        kampanyaAdi: k.name,
        kampanyaId: k.id,
        sebep: `ROAS ${roas.toFixed(2)}x — orta seviye, iyileştirme potansiyeli var`,
        aksiyon: 'Kitleyi daralt, bid stratejisini gözden geçir',
        metrikler: [
          { label: 'ROAS', deger: `${roas.toFixed(2)}x`, renk: '#D97706' },
          { label: 'Harcama', deger: para(harcama) },
          { label: 'Dönüşüm', deger: String(donusum) },
        ],
      })
      continue
    }

    // ✅ İYİ: ROAS > 4.0 (ölçeklendir)
    if (roas >= 4.0) {
      items.push({
        id: `${k.id}-iyi-roas`,
        oncelik: 'iyi',
        platform: 'meta',
        hesap,
        hesapAdi,
        kampanyaAdi: k.name,
        kampanyaId: k.id,
        sebep: `ROAS ${roas.toFixed(2)}x — güçlü performans`,
        aksiyon: roas >= 5 ? 'Bütçeyi %20-30 artır, momentum koru' : 'İzlemeye devam et, bütçe artırmayı değerlendir',
        metrikler: [
          { label: 'ROAS', deger: `${roas.toFixed(2)}x`, renk: '#059669' },
          { label: 'Gelir', deger: para(gelir), renk: '#059669' },
          { label: 'Dönüşüm', deger: String(donusum) },
        ],
      })
    }
  }

  return items
}

function googleKurallariUygula(
  kampanyalar: GKampanya[],
  hesap: 'karmen' | 'cotto',
  hesapAdi: string
): BrifingItem[] {
  const items: BrifingItem[] = []

  for (const k of kampanyalar) {
    if (k.durum !== 2) continue // Sadece aktif
    const harcama = parseFloat(k.harcama || '0')
    if (harcama < 50) continue

    const gelir = parseFloat(k.gelir || '0')
    const roas = parseFloat(k.roas || '0')
    const donusum = k.donusum || 0

    // 🔴 ACİL: Harcama var, 0 dönüşüm
    if (donusum === 0 && harcama > 200) {
      items.push({
        id: `g-${k.id}-sifir-satis`,
        oncelik: 'acil',
        platform: 'google',
        hesap,
        hesapAdi,
        kampanyaAdi: k.ad,
        kampanyaId: k.id,
        sebep: `₺${harcama.toFixed(0)} harcandı, 0 dönüşüm`,
        aksiyon: 'Dönüşüm takibini kontrol et, negatif kelime ekle',
        metrikler: [
          { label: 'Harcama', deger: para(harcama), renk: '#DC2626' },
          { label: 'Dönüşüm', deger: '0', renk: '#DC2626' },
        ],
      })
      continue
    }

    // 🔴 ACİL: ROAS < 1.5
    if (roas > 0 && roas < 1.5 && harcama > 300) {
      items.push({
        id: `g-${k.id}-dusuk-roas`,
        oncelik: 'acil',
        platform: 'google',
        hesap,
        hesapAdi,
        kampanyaAdi: k.ad,
        kampanyaId: k.id,
        sebep: `ROAS ${roas.toFixed(2)}x — kârsız çalışıyor`,
        aksiyon: 'Bütçeyi düşür, negatif kelime listesini genişlet, bid stratejisini değiştir',
        metrikler: [
          { label: 'ROAS', deger: `${roas.toFixed(2)}x`, renk: '#DC2626' },
          { label: 'Harcama', deger: para(harcama) },
          { label: 'Gelir', deger: para(gelir), renk: '#DC2626' },
        ],
      })
      continue
    }

    // 🟡 TAKİP: ROAS 1.5-2.5
    if (roas >= 1.5 && roas < 2.5 && harcama > 300) {
      items.push({
        id: `g-${k.id}-orta-roas`,
        oncelik: 'takip',
        platform: 'google',
        hesap,
        hesapAdi,
        kampanyaAdi: k.ad,
        kampanyaId: k.id,
        sebep: `ROAS ${roas.toFixed(2)}x — orta seviye, optimize edilebilir`,
        aksiyon: 'Arama terimleri raporunu incele, düşük kaliteli tıklamaları ele',
        metrikler: [
          { label: 'ROAS', deger: `${roas.toFixed(2)}x`, renk: '#D97706' },
          { label: 'Harcama', deger: para(harcama) },
          { label: 'Dönüşüm', deger: String(donusum) },
        ],
      })
      continue
    }

    // ✅ İYİ: ROAS > 4.0
    if (roas >= 4.0) {
      items.push({
        id: `g-${k.id}-iyi-roas`,
        oncelik: 'iyi',
        platform: 'google',
        hesap,
        hesapAdi,
        kampanyaAdi: k.ad,
        kampanyaId: k.id,
        sebep: `ROAS ${roas.toFixed(2)}x — güçlü performans`,
        aksiyon: roas >= 5 ? 'Bütçeyi artır, PMax asset grubunu genişlet' : 'İzle, bütçe artırmayı değerlendir',
        metrikler: [
          { label: 'ROAS', deger: `${roas.toFixed(2)}x`, renk: '#059669' },
          { label: 'Gelir', deger: para(gelir), renk: '#059669' },
          { label: 'Dönüşüm', deger: String(donusum) },
        ],
      })
    }
  }

  return items
}

// ─── Yardımcılar ─────────────────────────────────────────────────────────────
const HESAP_ADI: Record<string, string> = { karmen: 'Karmen Halı', cotto: 'Cotto Home' }
const HESAP_EMOJI: Record<string, string> = { karmen: '🏠', cotto: '🛋️' }
const PLATFORM_ICON: Record<string, string> = { meta: '📘', google: '🟡' }

function bugunTarih(): string {
  const now = new Date()
  return now.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function saat(): string {
  return new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
}

// ─── Ana Sayfa ────────────────────────────────────────────────────────────────
export default function SabahBrifing() {
  const [yukleniyor, setYukleniyor] = useState(true)
  const [items, setItems] = useState<BrifingItem[]>([])
  const [takipItems, setTakipItems] = useState<{ id: string; kampanyaAdlari: string[]; hesap: string; tarih: string; notlar: string }[]>([])
  const [aiOzet, setAiOzet] = useState('')
  const [aiYukleniyor, setAiYukleniyor] = useState(false)
  const [sonGuncelleme, setSonGuncelleme] = useState('')
  const [yenileniyor, setYenileniyor] = useState(false)

  async function verileriYukle() {
    setYukleniyor(true)
    const tumItems: BrifingItem[] = []

    // Her hesap için Meta + Google paralel çek
    const istekler = [
      fetch('/api/meta?hesap=karmen&tur=kampanyalar&donem=7').then(r => r.json()).catch(() => ({ data: [] })),
      fetch('/api/meta?hesap=cotto&tur=kampanyalar&donem=7').then(r => r.json()).catch(() => ({ data: [] })),
      fetch('/api/google-ads?hesap=karmen&donem=7').then(r => r.json()).catch(() => ({ kampanyalar: [] })),
      fetch('/api/google-ads?hesap=cotto&donem=7').then(r => r.json()).catch(() => ({ kampanyalar: [] })),
    ]

    const [metaKarmen, metaCotto, googleKarmen, googleCotto] = await Promise.all(istekler)

    // Meta kurallarını uygula
    tumItems.push(...metaKurallariUygula(metaKarmen.data || [], 'karmen', 'Karmen Halı'))
    tumItems.push(...metaKurallariUygula(metaCotto.data || [], 'cotto', 'Cotto Home'))

    // Google kurallarını uygula
    tumItems.push(...googleKurallariUygula(googleKarmen.kampanyalar || [], 'karmen', 'Karmen Halı'))
    tumItems.push(...googleKurallariUygula(googleCotto.kampanyalar || [], 'cotto', 'Cotto Home'))

    // Önceliğe göre sırala: acil > takip > iyi
    const siralama = { acil: 0, takip: 1, iyi: 2 }
    tumItems.sort((a, b) => siralama[a.oncelik] - siralama[b.oncelik])

    setItems(tumItems)

    // Vadesi gelen hatırlatmaları kontrol et
    const vadesiGelenKayitlar = vadesiGelenler()
    setTakipItems(vadesiGelenKayitlar.map(k => ({
      id: k.id,
      kampanyaAdlari: k.kampanyaAdlari,
      hesap: k.hesap,
      tarih: k.tarih,
      notlar: k.notlar || '',
    })))

    setSonGuncelleme(saat())
    setYukleniyor(false)
    setYenileniyor(false)
  }

  useEffect(() => { verileriYukle() }, [])

  async function aiOzetAl() {
    if (items.length === 0) return
    setAiYukleniyor(true)
    setAiOzet('')
    try {
      const ozet = items.slice(0, 10).map(item =>
        `[${item.oncelik.toUpperCase()}] ${item.hesapAdi} | ${item.platform === 'meta' ? 'Meta Ads' : 'Google Ads'} | ${item.kampanyaAdi}: ${item.sebep} → Aksiyon: ${item.aksiyon}`
      ).join('\n')

      const res = await fetch('/api/ai-sohbet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          soru: `Aşağıdaki sabah brifing verilerini incele ve dijital pazarlama uzmanı olarak bana 3-4 cümlelik kısa, net ve aksiyon odaklı bir özet yaz. Önce en kritik sorunu söyle, sonra en iyi fırsatı belirt. Türkçe yaz, teknik ama anlaşılır ol:\n\n${ozet}`,
          model: globalModelOku(),
        }),
      })
      const data = await res.json()
      setAiOzet(data.yanit || data.error || 'Özet alınamadı.')
    } catch {
      setAiOzet('AI özeti alınamadı, lütfen tekrar deneyin.')
    }
    setAiYukleniyor(false)
  }

  const acilItems = items.filter(i => i.oncelik === 'acil')
  const takipOneriler = items.filter(i => i.oncelik === 'takip')
  const iyiItems = items.filter(i => i.oncelik === 'iyi')

  return (
    <div style={{ display: 'flex', background: C.bg, minHeight: '100vh', color: C.text, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <Sidebar />

      <div style={{ flex: 1, marginLeft: '220px', padding: '0 0 40px 0' }}>

        {/* ── Başlık ── */}
        <div style={{ background: C.card, borderBottom: `1px solid ${C.border}`, padding: '20px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: C.text, display: 'flex', alignItems: 'center', gap: '10px' }}>
              ☀️ Sabah Brifing
            </div>
            <div style={{ fontSize: '0.82rem', color: C.muted, marginTop: '4px' }}>{bugunTarih()}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {sonGuncelleme && (
              <span style={{ fontSize: '0.72rem', color: C.faint }}>🕐 {sonGuncelleme}'de güncellendi</span>
            )}
            <button
              onClick={() => { setYenileniyor(true); setAiOzet(''); verileriYukle() }}
              disabled={yukleniyor || yenileniyor}
              style={{
                padding: '8px 16px', borderRadius: '8px', border: `1px solid ${C.border}`,
                background: C.bg, color: C.muted, cursor: 'pointer', fontSize: '0.82rem',
                display: 'flex', alignItems: 'center', gap: '6px',
              }}>
              {yenileniyor ? '⏳' : '🔄'} Yenile
            </button>
          </div>
        </div>

        {yukleniyor ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px', gap: '16px' }}>
            <div style={{ fontSize: '2.5rem' }}>☀️</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: C.text }}>Veriler toplanıyor...</div>
            <div style={{ fontSize: '0.83rem', color: C.muted }}>Meta Ads ve Google Ads kampanyaları analiz ediliyor</div>
          </div>
        ) : (
          <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

            {/* ── AI Özet Butonu ── */}
            {items.length > 0 && (
              <div style={{ background: 'linear-gradient(135deg, #F5F3FF 0%, #EFF6FF 100%)', border: '1px solid #DDD6FE', borderRadius: '14px', padding: '18px 22px' }}>
                {aiOzet ? (
                  <div>
                    <div style={{ fontSize: '0.68rem', color: '#7C3AED', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.06em' }}>🤖 AI Gün Özeti</div>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#1e1b4b', lineHeight: 1.7 }}>{aiOzet}</p>
                    <button onClick={() => setAiOzet('')} style={{ marginTop: '10px', background: 'transparent', border: 'none', color: '#7C3AED', cursor: 'pointer', fontSize: '0.75rem' }}>✕ Kapat</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#4C1D95' }}>🤖 AI Gün Özeti Al</div>
                      <div style={{ fontSize: '0.78rem', color: '#7C3AED', marginTop: '3px' }}>Tüm brifing verilerini analiz edip 3-4 cümlede özetlesin</div>
                    </div>
                    <button
                      onClick={aiOzetAl}
                      disabled={aiYukleniyor}
                      style={{
                        padding: '9px 20px', borderRadius: '9px', border: 'none',
                        background: aiYukleniyor ? '#9CA3AF' : '#7C3AED',
                        color: '#fff', cursor: aiYukleniyor ? 'not-allowed' : 'pointer',
                        fontSize: '0.85rem', fontWeight: 700, whiteSpace: 'nowrap',
                      }}>
                      {aiYukleniyor ? '⏳ Özetleniyor...' : '⚡ Özetle'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── Özet Sayaçlar ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
              {[
                { label: 'Acil Müdahale', sayi: acilItems.length, renk: '#DC2626', bg: '#FEF2F2', border: '#FECACA', icon: '🔴' },
                { label: 'Takip Gereken', sayi: takipOneriler.length, renk: '#D97706', bg: '#FFFBEB', border: '#FDE68A', icon: '🟡' },
                { label: 'İyi Performans', sayi: iyiItems.length, renk: '#059669', bg: '#F0FDF4', border: '#BBF7D0', icon: '✅' },
                { label: 'Vadesi Gelen Takip', sayi: takipItems.length, renk: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE', icon: '⏰' },
              ].map(s => (
                <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: '12px', padding: '16px 20px' }}>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: s.renk }}>{s.sayi}</div>
                  <div style={{ fontSize: '0.75rem', color: s.renk, fontWeight: 600, marginTop: '2px' }}>{s.icon} {s.label}</div>
                </div>
              ))}
            </div>

            {/* ── Boş Durum ── */}
            {items.length === 0 && takipItems.length === 0 && (
              <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '14px', padding: '40px', textAlign: 'center' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🎉</div>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: '#15803D' }}>Her şey yolunda!</div>
                <div style={{ fontSize: '0.85rem', color: '#166534', marginTop: '6px' }}>Aktif kampanyalarında kritik sorun tespit edilmedi. Güzel bir gün!</div>
              </div>
            )}

            {/* ── VADESİ GELEN TAKİPLER ── */}
            {takipItems.length > 0 && (
              <BrifingBolum
                baslik="Vadesi Gelen Takipler"
                renk="#7C3AED"
                bg="#F5F3FF"
                border="#DDD6FE"
                icon="⏰"
                aciklama={`Optimizasyon Günlüğü'nden ${takipItems.length} takip bugüne geldi`}
              >
                {takipItems.map(t => (
                  <div key={t.id} style={{ background: 'white', border: '1px solid #DDD6FE', borderRadius: '10px', padding: '14px 18px', display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#7C3AED', marginTop: '5px', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem', color: C.text, marginBottom: '4px' }}>
                        {HESAP_EMOJI[t.hesap]} {HESAP_ADI[t.hesap] || t.hesap}
                        <span style={{ fontSize: '0.72rem', color: C.faint, fontWeight: 400, marginLeft: '8px' }}>
                          {t.kampanyaAdlari.slice(0, 2).join(', ')}{t.kampanyaAdlari.length > 2 ? ` +${t.kampanyaAdlari.length - 2}` : ''}
                        </span>
                      </div>
                      {t.notlar && <div style={{ fontSize: '0.8rem', color: C.muted, marginBottom: '6px' }}>📝 {t.notlar}</div>}
                      <a href="/analiz-merkezi" style={{ fontSize: '0.75rem', color: '#7C3AED', textDecoration: 'none', fontWeight: 600 }}>
                        → Analiz Merkezi'nde karşılaştır
                      </a>
                    </div>
                  </div>
                ))}
              </BrifingBolum>
            )}

            {/* ── ACİL ÖNLEM ── */}
            {acilItems.length > 0 && (
              <BrifingBolum
                baslik="Acil Müdahale Gerekiyor"
                renk="#DC2626"
                bg="#FEF2F2"
                border="#FECACA"
                icon="🔴"
                aciklama="Bu kampanyalar bugün mutlaka incelenmeli"
              >
                {acilItems.map(item => (
                  <BrifingKart key={item.id} item={item} />
                ))}
              </BrifingBolum>
            )}

            {/* ── TAKİP ── */}
            {takipOneriler.length > 0 && (
              <BrifingBolum
                baslik="Takip Gereken Kampanyalar"
                renk="#D97706"
                bg="#FFFBEB"
                border="#FDE68A"
                icon="🟡"
                aciklama="Acil değil, ama bugün veya yarın bakılmalı"
              >
                {takipOneriler.map(item => (
                  <BrifingKart key={item.id} item={item} />
                ))}
              </BrifingBolum>
            )}

            {/* ── İYİ PERFORMANS ── */}
            {iyiItems.length > 0 && (
              <BrifingBolum
                baslik="İyi Performans Gösterenler"
                renk="#059669"
                bg="#F0FDF4"
                border="#BBF7D0"
                icon="✅"
                aciklama="Bu kampanyalar fırsatları — bütçeyi buraya kaydır"
              >
                {iyiItems.map(item => (
                  <BrifingKart key={item.id} item={item} />
                ))}
              </BrifingBolum>
            )}

          </div>
        )}
      </div>
    </div>
  )
}

// ─── Bölüm Bileşeni ───────────────────────────────────────────────────────────
function BrifingBolum({ baslik, renk, bg, border, icon, aciklama, children }: {
  baslik: string
  renk: string
  bg: string
  border: string
  icon: string
  aciklama: string
  children: React.ReactNode
}) {
  return (
    <div style={{ background: bg, border: `1.5px solid ${border}`, borderRadius: '14px', overflow: 'hidden' }}>
      <div style={{ padding: '16px 22px', borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '1.1rem' }}>{icon}</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: renk }}>{baslik}</div>
          <div style={{ fontSize: '0.72rem', color: renk + 'AA', marginTop: '2px' }}>{aciklama}</div>
        </div>
      </div>
      <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {children}
      </div>
    </div>
  )
}

// ─── Brifing Kartı ─────────────────────────────────────────────────────────────
function BrifingKart({ item }: { item: BrifingItem }) {
  const renk = item.oncelik === 'acil' ? '#DC2626' : item.oncelik === 'iyi' ? '#059669' : '#D97706'
  const platIcon = PLATFORM_ICON[item.platform]

  return (
    <div style={{ background: 'white', borderRadius: '10px', padding: '14px 18px', border: `1px solid ${renk}20`, display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: renk, marginTop: '5px', flexShrink: 0, boxShadow: `0 0 0 3px ${renk}20` }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Başlık */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '5px' }}>
          <span style={{ fontSize: '0.72rem' }}>{platIcon}</span>
          <span style={{ fontSize: '0.7rem', background: item.hesap === 'karmen' ? '#FFF7ED' : '#EFF6FF', color: item.hesap === 'karmen' ? '#C2410C' : '#1D4ED8', border: `1px solid ${item.hesap === 'karmen' ? '#FED7AA' : '#BFDBFE'}`, borderRadius: '4px', padding: '1px 7px', fontWeight: 600 }}>
            {HESAP_EMOJI[item.hesap]} {item.hesapAdi}
          </span>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: C.text, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.kampanyaAdi}</span>
        </div>

        {/* Sebep */}
        <div style={{ fontSize: '0.82rem', color: C.muted, marginBottom: '8px', lineHeight: 1.5 }}>⚠️ {item.sebep}</div>

        {/* Metrikler */}
        {item.metrikler && item.metrikler.length > 0 && (
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
            {item.metrikler.map((m, i) => (
              <div key={i} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: '6px', padding: '4px 10px' }}>
                <span style={{ fontSize: '0.65rem', color: C.faint, display: 'block' }}>{m.label}</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: m.renk || C.text }}>{m.deger}</span>
              </div>
            ))}
          </div>
        )}

        {/* Aksiyon */}
        <div style={{ fontSize: '0.82rem', color: renk, fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
          → {item.aksiyon}
          {item.kampanyaId && item.platform === 'meta' && (
            <a
              href={`/kampanya/${item.kampanyaId}?hesap=${item.hesap}&name=${encodeURIComponent(item.kampanyaAdi)}`}
              style={{ marginLeft: '8px', fontSize: '0.72rem', color: '#7C3AED', textDecoration: 'none', background: '#EDE9FE', border: '1px solid #DDD6FE', borderRadius: '4px', padding: '2px 8px', fontWeight: 600 }}>
              Detaya Git →
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
