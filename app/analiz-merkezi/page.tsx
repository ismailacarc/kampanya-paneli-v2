'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Sidebar, { globalModelOku } from '../components/Sidebar'
import { C } from '../lib/theme'
import { HESAPLAR, PRESETLER, Satir } from '../lib/types'
import { getGelir, getDonusum, para, getRoas } from '../lib/helpers'
import {
  OptimizasyonKaydi, kayitlariGetir, kayitEkle, kayitGuncelle, kayitSil,
} from '../lib/gecmis'

// ─── Tipler ──────────────────────────────────────────────────────────────────
interface OneriKart {
  tip: string
  baslik: string
  aciklama: string
  kampanya?: string
  oncelik: 'yuksek' | 'orta' | 'dusuk'
}

interface AnalizSonuc {
  ozet: string
  oneriler: OneriKart[]
  guclular: string[]
  zayiflar: string[]
  butceVerimliligi: string
  firsat: string
}

interface KarsilastirSonuc {
  sonuc: 'iyi' | 'karışık' | 'kötü'
  ozet: string
  olumlu: string[]
  olumsuz: string[]
  oneri: string
}

type GKampanya = { id: string; ad: string; durum: number; harcama: string; donusum: number; gelir: string; roas: string; tip: string }

// ─── Sabitler ────────────────────────────────────────────────────────────────
const SAYFA_PRESETLER = [
  ...PRESETLER.filter(p => ['7', '14', '30', 'bu_ay', '90'].includes(p.id)),
  { id: 'ozel', ad: 'Özel Tarih' },
]

const ONERI_RENK: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  artir:        { bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0', icon: '📈' },
  azalt:        { bg: '#FFFBEB', text: '#B45309', border: '#FDE68A', icon: '📉' },
  kapat:        { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA', icon: '🛑' },
  kreatif:      { bg: '#F5F3FF', text: '#7C3AED', border: '#DDD6FE', icon: '🎨' },
  uyari:        { bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA', icon: '⚠️' },
  firsat:       { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE', icon: '💡' },
  negatif:      { bg: '#F0FDF4', text: '#166534', border: '#BBF7D0', icon: '🚫' },
  teklif:       { bg: '#FDF4FF', text: '#7E22CE', border: '#E9D5FF', icon: '🎯' },
  butce_kaydir: { bg: '#EFF6FF', text: '#1E40AF', border: '#BFDBFE', icon: '🔀' },
  default:      { bg: C.bg, text: C.text, border: C.border, icon: '💬' },
}

const ONCELIK: Record<string, { renk: string; label: string }> = {
  yuksek: { renk: '#DC2626', label: '🔴 Öncelikli' },
  orta:   { renk: '#D97706', label: '🟡 Orta' },
  dusuk:  { renk: '#6B7280', label: '⚪ Düşük' },
}

const KARSILASTIR_RENK = { iyi: '#059669', 'karışık': '#D97706', kötü: '#DC2626' }
const KARSILASTIR_ICON = { iyi: '✅', 'karışık': '⚠️', kötü: '❌' }

// ─── Yardımcılar ─────────────────────────────────────────────────────────────
function aksiyonCikar(sonuc: AnalizSonuc): string[] {
  if (!sonuc?.oneriler) return []
  return sonuc.oneriler.map(o => o.kampanya ? `[${o.kampanya}] ${o.baslik}` : o.baslik)
}

function donemIdBul(donemAdi: string): string {
  return PRESETLER.find(p => p.ad === donemAdi)?.id || '30'
}

function metriksHesapla(kampanyalar: Satir[]): { harcama: number; gelir: number; roas: number; donusum: number } {
  const harcama = kampanyalar.reduce((s, k) => s + parseFloat(k.insights?.data[0]?.spend || '0'), 0)
  const gelir   = kampanyalar.reduce((s, k) => s + getGelir(k.insights?.data[0]), 0)
  const donusum = kampanyalar.reduce((s, k) => s + getDonusum(k.insights?.data[0]), 0)
  const roas    = harcama > 0 ? gelir / harcama : 0
  return { harcama, gelir, roas, donusum }
}

function tarihFormatla(iso: string): string {
  const d = new Date(iso)
  return `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')}.${d.getFullYear()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`
}

function farkRenk(oran: number): string {
  if (oran > 5)  return '#059669'
  if (oran < -5) return '#DC2626'
  return '#D97706'
}

function farkIcon(oran: number): string {
  if (oran > 5)  return '↑'
  if (oran < -5) return '↓'
  return '→'
}

// ─── KampanyaDropdown ─────────────────────────────────────────────────────────
function KampanyaDropdown({ kampanyalar, seciliIds, onChange, yukleniyor }: {
  kampanyalar: Satir[]
  seciliIds: string[]
  onChange: (ids: string[]) => void
  yukleniyor: boolean
}) {
  const [acik, setAcik] = useState(false)
  const [statusFiltre, setStatusFiltre] = useState<'hepsi' | 'aktif' | 'pasif'>('hepsi')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function tiklama(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAcik(false)
    }
    document.addEventListener('mousedown', tiklama)
    return () => document.removeEventListener('mousedown', tiklama)
  }, [])

  function toggle(id: string) {
    onChange(seciliIds.includes(id) ? seciliIds.filter(x => x !== id) : [...seciliIds, id])
  }

  const aktifSayisi = kampanyalar.filter(k => k.status === 'ACTIVE').length
  const pasifSayisi = kampanyalar.length - aktifSayisi

  const gorunenler = kampanyalar.filter(k => {
    if (statusFiltre === 'aktif') return k.status === 'ACTIVE'
    if (statusFiltre === 'pasif') return k.status !== 'ACTIVE'
    return true
  })

  const label = yukleniyor ? '⏳ Yükleniyor...'
    : kampanyalar.length === 0 ? 'Kampanya yok'
    : seciliIds.length === 0   ? 'Kampanya seç'
    : seciliIds.length === kampanyalar.length ? `Tümü (${kampanyalar.length})`
    : `${seciliIds.length} kampanya seçili`

  return (
    <div ref={ref} style={{ position: 'relative', minWidth: '200px' }}>
      <button onClick={() => !yukleniyor && kampanyalar.length > 0 && setAcik(!acik)} style={{
        padding: '8px 14px', borderRadius: '8px', border: `1.5px solid ${acik ? C.primary : C.border}`,
        background: C.card, color: C.text, cursor: kampanyalar.length === 0 ? 'not-allowed' : 'pointer',
        fontSize: '0.83rem', display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
        transition: 'border-color 0.15s', fontWeight: seciliIds.length > 0 ? 600 : 400,
      }}>
        <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        <span style={{ fontSize: '0.65rem', color: C.faint, flexShrink: 0 }}>{acik ? '▲' : '▼'}</span>
      </button>

      {acik && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, minWidth: '300px',
          background: C.card, border: `1px solid ${C.border}`, borderRadius: '10px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 200, overflow: 'hidden',
        }}>
          {/* Aktif / Pasif / Hepsi filtresi */}
          <div style={{ display: 'flex', gap: '4px', padding: '8px 10px', borderBottom: `1px solid ${C.borderLight}`, background: C.bg }}>
            {([
              { id: 'hepsi', label: `Tümü (${kampanyalar.length})` },
              { id: 'aktif', label: `🟢 Aktif (${aktifSayisi})` },
              { id: 'pasif', label: `⚫ Pasif (${pasifSayisi})` },
            ] as const).map(f => (
              <button key={f.id} onClick={() => setStatusFiltre(f.id)} style={{
                flex: 1, padding: '5px 6px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600,
                border: `1px solid ${statusFiltre === f.id ? C.primary : C.border}`,
                background: statusFiltre === f.id ? C.primary + '15' : 'transparent',
                color: statusFiltre === f.id ? C.primary : C.muted,
                transition: 'all 0.1s',
              }}>{f.label}</button>
            ))}
          </div>

          {/* Tümünü Seç / Temizle */}
          <div style={{ display: 'flex', gap: '6px', padding: '6px 10px', borderBottom: `1px solid ${C.borderLight}` }}>
            <button onClick={() => onChange([...new Set([...seciliIds, ...gorunenler.map(k => k.id)])])} style={{
              flex: 1, padding: '5px', borderRadius: '6px', border: `1px solid ${C.border}`,
              background: C.bg, cursor: 'pointer', fontSize: '0.7rem', color: C.primary, fontWeight: 600,
            }}>Görünenleri Seç</button>
            <button onClick={() => onChange(seciliIds.filter(id => !gorunenler.find(k => k.id === id)))} style={{
              flex: 1, padding: '5px', borderRadius: '6px', border: `1px solid ${C.border}`,
              background: C.bg, cursor: 'pointer', fontSize: '0.7rem', color: C.muted,
            }}>Görünenleri Kaldır</button>
          </div>

          {/* Liste */}
          <div style={{ maxHeight: '260px', overflowY: 'auto' }}>
            {gorunenler.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', fontSize: '0.8rem', color: C.faint }}>Kampanya yok</div>
            ) : gorunenler.map(k => {
              const secili = seciliIds.includes(k.id)
              const aktif  = k.status === 'ACTIVE'
              return (
                <label key={k.id} style={{
                  display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px',
                  cursor: 'pointer', background: secili ? C.primary + '0D' : 'transparent',
                  borderBottom: `1px solid ${C.borderLight}`, transition: 'background 0.1s',
                }}>
                  <input type="checkbox" checked={secili} onChange={() => toggle(k.id)}
                    style={{ accentColor: C.primary, width: '14px', height: '14px', flexShrink: 0 }} />
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0,
                    background: aktif ? '#059669' : '#9CA3AF',
                    boxShadow: aktif ? '0 0 0 2px #D1FAE5' : 'none',
                  }} />
                  <span style={{ fontSize: '0.8rem', color: aktif ? C.text : C.muted, flex: 1, lineHeight: 1.4 }}>{k.name}</span>
                </label>
              )
            })}
          </div>

          {/* Alt bilgi */}
          <div style={{ padding: '6px 12px', borderTop: `1px solid ${C.borderLight}`, fontSize: '0.68rem', color: C.faint, display: 'flex', justifyContent: 'space-between' }}>
            <span>{seciliIds.length} kampanya seçili</span>
            <span>{gorunenler.length} / {kampanyalar.length} gösteriliyor</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Kaydet Drawer ─────────────────────────────────────────────────────────────
function KaydetDrawer({ sonuc, hesap, donemAdi, donemId, platform, kampanyaAdlari, kampanyaIds, metrikler, seciliBaslangic, onKapat, onKaydet }: {
  sonuc: AnalizSonuc
  hesap: string
  donemAdi: string
  donemId: string
  platform: 'meta' | 'google'
  kampanyaAdlari: string[]
  kampanyaIds: string[]
  metrikler: { harcama: number; gelir: number; roas: number; donusum: number }
  seciliBaslangic?: Set<number>
  onKapat: () => void
  onKaydet: () => void
}) {
  const tumAksiyonlar = aksiyonCikar(sonuc)
  const [secili, setSecili] = useState<Set<number>>(
    seciliBaslangic ?? new Set(tumAksiyonlar.map((_, i) => i))
  )
  const [notlar, setNotlar] = useState('')
  const [hatGun, setHatGun] = useState(7)
  const [hatAktif, setHatAktif] = useState(false)

  function toggle(i: number) {
    setSecili(prev => { const y = new Set(prev); y.has(i) ? y.delete(i) : y.add(i); return y })
  }

  function kaydet() {
    const hatirlatmaTarihi = hatAktif
      ? (() => { const t = new Date(); t.setDate(t.getDate() + hatGun); return t.toISOString().split('T')[0] })()
      : null
    kayitEkle({
      id: Date.now().toString(),
      tarih: new Date().toISOString(),
      hesap, donemAdi, donemId, platform,
      kaynak: 'ai-merkezi',
      kampanyaIds, kampanyaAdlari,
      metriks: metrikler,
      yapilanlar: tumAksiyonlar.filter((_, i) => secili.has(i)),
      notlar,
      hatirlatmaGun: hatAktif ? hatGun : 0,
      hatirlatmaTarihi,
      hatirlatmaGoruldu: false,
    })
    onKaydet()
  }

  const hesapAdi = HESAPLAR.find(h => h.id === hesap)?.ad || hesap

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end' }}
      onClick={e => { if (e.target === e.currentTarget) onKapat() }}>
      <div style={{ width: '500px', height: '100vh', background: C.card, borderLeft: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column' }}>

        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${C.border}`, background: '#F5F3FF', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#4C1D95' }}>📥 Optimizasyon Günlüğüne Kaydet</div>
            <div style={{ fontSize: '0.75rem', color: '#7C3AED', marginTop: '2px' }}>{donemAdi} · {hesapAdi}</div>
          </div>
          <button onClick={onKapat} style={{ background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', fontSize: '1.4rem' }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>

          {/* Metrik snapshot */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {[
              { l: 'Harcama', v: para(metrikler.harcama), r: '#DC2626' },
              { l: 'Gelir',   v: para(metrikler.gelir),   r: '#059669' },
              { l: 'ROAS',    v: `${metrikler.roas.toFixed(2)}x`, r: '#0284C7' },
              { l: 'Dönüşüm',v: String(metrikler.donusum), r: '#7C3AED' },
            ].map(m => (
              <div key={m.l} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '10px 14px' }}>
                <div style={{ fontSize: '0.63rem', color: C.faint, textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>{m.l}</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: m.r }}>{m.v}</div>
              </div>
            ))}
          </div>

          {/* Aksiyonlar */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ fontSize: '0.7rem', color: C.muted, textTransform: 'uppercase', fontWeight: 700 }}>Yapılacak Aksiyonlar</div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => setSecili(new Set(tumAksiyonlar.map((_, i) => i)))}
                  style={{ fontSize: '0.68rem', color: '#7C3AED', background: '#EDE9FE', border: '1px solid #DDD6FE', borderRadius: '4px', padding: '2px 7px', cursor: 'pointer' }}>Tümü</button>
                <button onClick={() => setSecili(new Set())}
                  style={{ fontSize: '0.68rem', color: C.muted, background: C.bg, border: `1px solid ${C.border}`, borderRadius: '4px', padding: '2px 7px', cursor: 'pointer' }}>Temizle</button>
              </div>
            </div>
            {tumAksiyonlar.length === 0
              ? <div style={{ fontSize: '0.82rem', color: C.faint, fontStyle: 'italic' }}>Aksiyon yok.</div>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {tumAksiyonlar.map((a, i) => (
                    <label key={i} style={{
                      display: 'flex', gap: '10px', padding: '8px 10px', borderRadius: '8px', cursor: 'pointer',
                      background: secili.has(i) ? '#EDE9FE' : C.bg, border: `1px solid ${secili.has(i) ? '#DDD6FE' : C.border}`,
                    }}>
                      <input type="checkbox" checked={secili.has(i)} onChange={() => toggle(i)}
                        style={{ marginTop: '2px', accentColor: '#7C3AED', width: '14px', height: '14px', flexShrink: 0 }} />
                      <span style={{ fontSize: '0.81rem', color: C.text, lineHeight: '1.5' }}>{a}</span>
                    </label>
                  ))}
                </div>
            }
          </div>

          {/* Notlar */}
          <div>
            <div style={{ fontSize: '0.7rem', color: C.muted, textTransform: 'uppercase', fontWeight: 700, marginBottom: '8px' }}>
              Notlar <span style={{ color: C.faint, fontWeight: 400, textTransform: 'none' }}>— isteğe bağlı</span>
            </div>
            <textarea value={notlar} onChange={e => setNotlar(e.target.value)}
              placeholder="Gözlemlerini, karar gerekçelerini not al..."
              rows={3} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: '0.83rem', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }} />
          </div>

          {/* Hatırlatma */}
          <div style={{ background: hatAktif ? '#EFF6FF' : C.bg, border: `1px solid ${hatAktif ? '#BAE6FD' : C.border}`, borderRadius: '10px', padding: '14px 16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginBottom: hatAktif ? '12px' : '0' }}>
              <input type="checkbox" checked={hatAktif} onChange={e => setHatAktif(e.target.checked)}
                style={{ accentColor: '#0284C7', width: '16px', height: '16px' }} />
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: C.text }}>⏰ Takip hatırlatması kur</div>
                <div style={{ fontSize: '0.72rem', color: C.muted, marginTop: '1px' }}>X gün sonra sonucu kontrol et diye hatırlatayım</div>
              </div>
            </label>
            {hatAktif && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: '26px' }}>
                <input type="number" min={1} max={90} value={hatGun} onChange={e => setHatGun(parseInt(e.target.value) || 1)}
                  style={{ width: '65px', padding: '6px 10px', borderRadius: '7px', border: '1.5px solid #0284C7', background: '#fff', color: C.text, fontSize: '1rem', fontWeight: 700, textAlign: 'center' }} />
                <span style={{ fontSize: '0.85rem', color: '#0369A1', fontWeight: 500 }}>gün sonra hatırlat</span>
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: '16px 24px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: '10px' }}>
          <button onClick={onKapat} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, cursor: 'pointer', fontSize: '0.85rem' }}>İptal</button>
          <button onClick={kaydet} style={{ flex: 2, padding: '10px', borderRadius: '8px', border: 'none', background: '#7C3AED', color: '#fff', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 700 }}>📥 Günlüğe Kaydet</button>
        </div>
      </div>
    </div>
  )
}

// ─── Günlük Kartı ─────────────────────────────────────────────────────────────
function GunlukKart({ kayit, onSil, onKarsilastir, karsilastirYuk }: {
  kayit: OptimizasyonKaydi
  onSil: (id: string) => void
  onKarsilastir: (kayit: OptimizasyonKaydi) => void
  karsilastirYuk: string | null
}) {
  const [acik, setAcik] = useState(false)
  const hesapObj = HESAPLAR.find(h => h.id === kayit.hesap)
  const platIcon = (kayit.platform || 'meta') === 'meta' ? '📘' : '🟡'
  const takipVar = !!kayit.takipMetriks

  function farkHesapla(onceki: number, sonraki: number) {
    if (onceki === 0) return null
    return ((sonraki - onceki) / onceki) * 100
  }

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', overflow: 'hidden' }}>

      {/* Kart başlığı */}
      <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
        onClick={() => setAcik(!acik)}>
        <span style={{ fontSize: '1.2rem' }}>{platIcon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: '0.88rem', color: C.text, display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {hesapObj?.emoji} {hesapObj?.ad}
            <span style={{ fontSize: '0.72rem', color: C.faint, fontWeight: 400 }}>· {kayit.donemAdi}</span>
            {takipVar && (
              <span style={{ fontSize: '0.68rem', background: '#D1FAE5', color: '#065F46', border: '1px solid #A7F3D0', borderRadius: '4px', padding: '1px 6px', fontWeight: 600 }}>✓ Karşılaştırıldı</span>
            )}
          </div>
          <div style={{ fontSize: '0.72rem', color: C.faint, marginTop: '3px' }}>
            📅 {tarihFormatla(kayit.tarih)} &nbsp;·&nbsp; {kayit.kampanyaAdlari.length} kampanya
          </div>
        </div>

        {/* Özet metrikler */}
        <div style={{ display: 'flex', gap: '16px', flexShrink: 0 }}>
          {[
            { l: 'Harcama', v: para(kayit.metriks.harcama), r: '#DC2626' },
            { l: 'ROAS', v: `${kayit.metriks.roas.toFixed(2)}x`, r: '#0284C7' },
          ].map(m => (
            <div key={m.l} style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.6rem', color: C.faint, textTransform: 'uppercase' }}>{m.l}</div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: m.r }}>{m.v}</div>
            </div>
          ))}
        </div>

        {/* Sil butonu — her zaman görünür */}
        <button
          onClick={e => { e.stopPropagation(); if (confirm('Bu kayıt silinsin mi?')) onSil(kayit.id) }}
          title="Kaydı sil"
          style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '7px', color: '#DC2626', cursor: 'pointer', fontSize: '0.75rem', padding: '5px 9px', flexShrink: 0 }}>
          🗑️
        </button>

        <span style={{ color: C.faint, fontSize: '0.8rem', flexShrink: 0 }}>{acik ? '▲' : '▼'}</span>
      </div>

      {/* Detay */}
      {acik && (
        <div style={{ borderTop: `1px solid ${C.borderLight}`, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Kampanyalar */}
          <div>
            <div style={{ fontSize: '0.65rem', color: C.faint, textTransform: 'uppercase', fontWeight: 700, marginBottom: '6px' }}>Kampanyalar</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
              {kayit.kampanyaAdlari.map((ad, i) => (
                <span key={i} style={{ fontSize: '0.75rem', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '5px', padding: '3px 9px', color: C.text }}>{ad}</span>
              ))}
            </div>
          </div>

          {/* Anlık metrikler + Karşılaştırma */}
          <div>
            <div style={{ fontSize: '0.65rem', color: C.faint, textTransform: 'uppercase', fontWeight: 700, marginBottom: '8px' }}>
              {takipVar ? 'Karşılaştırma' : 'Analiz Anı Metrikleri'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: takipVar ? '1fr 1fr' : 'repeat(4, 1fr)', gap: '8px' }}>
              {takipVar ? (
                // Önce / Sonra göster
                <>
                  <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', padding: '12px 14px' }}>
                    <div style={{ fontSize: '0.65rem', color: '#DC2626', fontWeight: 700, marginBottom: '8px', textTransform: 'uppercase' }}>📸 Önce ({kayit.donemAdi})</div>
                    {[
                      { l: 'Harcama', v: para(kayit.metriks.harcama) },
                      { l: 'Gelir',   v: para(kayit.metriks.gelir) },
                      { l: 'ROAS',    v: `${kayit.metriks.roas.toFixed(2)}x` },
                      { l: 'Dönüşüm',v: String(kayit.metriks.donusum) },
                    ].map(m => (
                      <div key={m.l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                        <span style={{ color: C.muted }}>{m.l}</span>
                        <span style={{ fontWeight: 700, color: C.text }}>{m.v}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '10px', padding: '12px 14px' }}>
                    <div style={{ fontSize: '0.65rem', color: '#059669', fontWeight: 700, marginBottom: '8px', textTransform: 'uppercase' }}>📊 Sonra ({kayit.donemAdi})</div>
                    {[
                      { l: 'Harcama', v: para(kayit.takipMetriks!.harcama),              f: farkHesapla(kayit.metriks.harcama, kayit.takipMetriks!.harcama) },
                      { l: 'Gelir',   v: para(kayit.takipMetriks!.gelir),                f: farkHesapla(kayit.metriks.gelir, kayit.takipMetriks!.gelir) },
                      { l: 'ROAS',    v: `${kayit.takipMetriks!.roas.toFixed(2)}x`,      f: farkHesapla(kayit.metriks.roas, kayit.takipMetriks!.roas) },
                      { l: 'Dönüşüm',v: String(kayit.takipMetriks!.donusum),             f: farkHesapla(kayit.metriks.donusum, kayit.takipMetriks!.donusum) },
                    ].map(m => (
                      <div key={m.l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px', alignItems: 'center' }}>
                        <span style={{ color: C.muted }}>{m.l}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 700, color: C.text }}>{m.v}</span>
                          {m.f !== null && (
                            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: farkRenk(m.f) }}>
                              {farkIcon(m.f)}{Math.abs(m.f).toFixed(1)}%
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                [
                  { l: 'Harcama', v: para(kayit.metriks.harcama), r: '#DC2626' },
                  { l: 'Gelir',   v: para(kayit.metriks.gelir),   r: '#059669' },
                  { l: 'ROAS',    v: `${kayit.metriks.roas.toFixed(2)}x`, r: '#0284C7' },
                  { l: 'Dönüşüm',v: String(kayit.metriks.donusum), r: '#7C3AED' },
                ].map(m => (
                  <div key={m.l} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '10px 12px' }}>
                    <div style={{ fontSize: '0.6rem', color: C.faint, textTransform: 'uppercase', fontWeight: 600, marginBottom: '3px' }}>{m.l}</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: m.r }}>{m.v}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* AI Yorumu (karşılaştırma sonucu) */}
          {kayit.takipAiYorumu && (() => {
            let yorum: KarsilastirSonuc | null = null
            try { yorum = JSON.parse(kayit.takipAiYorumu) } catch { return null }
            if (!yorum) return null
            const renk = KARSILASTIR_RENK[yorum.sonuc] || '#6B7280'
            const icon = KARSILASTIR_ICON[yorum.sonuc] || '—'
            return (
              <div style={{ background: renk + '10', border: `1px solid ${renk}30`, borderRadius: '10px', padding: '14px 16px' }}>
                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: renk, marginBottom: '6px' }}>
                  {icon} AI Değerlendirmesi
                </div>
                <p style={{ margin: '0 0 10px', fontSize: '0.83rem', color: C.text, lineHeight: 1.6 }}>{yorum.ozet}</p>
                {yorum.olumlu?.length > 0 && (
                  <div style={{ marginBottom: '6px' }}>
                    {yorum.olumlu.map((o, i) => <div key={i} style={{ fontSize: '0.78rem', color: '#059669', marginBottom: '2px' }}>✓ {o}</div>)}
                  </div>
                )}
                {yorum.olumsuz?.length > 0 && (
                  <div style={{ marginBottom: '8px' }}>
                    {yorum.olumsuz.map((o, i) => <div key={i} style={{ fontSize: '0.78rem', color: '#DC2626', marginBottom: '2px' }}>✗ {o}</div>)}
                  </div>
                )}
                {yorum.oneri && (
                  <div style={{ fontSize: '0.78rem', color: '#1D4ED8', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '6px', padding: '8px 10px' }}>
                    💡 {yorum.oneri}
                  </div>
                )}
              </div>
            )
          })()}

          {/* Yapılanlar */}
          {kayit.yapilanlar?.length > 0 && (
            <div>
              <div style={{ fontSize: '0.65rem', color: C.faint, textTransform: 'uppercase', fontWeight: 700, marginBottom: '6px' }}>Yapılan Aksiyonlar</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {kayit.yapilanlar.map((y, i) => (
                  <div key={i} style={{ fontSize: '0.78rem', color: C.text, display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    <span style={{ color: '#7C3AED', flexShrink: 0 }}>✓</span>{y}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notlar */}
          {kayit.notlar && (
            <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '8px', padding: '10px 14px', fontSize: '0.82rem', color: '#92400E' }}>
              📝 {kayit.notlar}
            </div>
          )}

          {/* Hatırlatma */}
          {kayit.hatirlatmaTarihi && (
            <div style={{ fontSize: '0.75rem', color: C.muted, display: 'flex', alignItems: 'center', gap: '6px' }}>
              ⏰ Hatırlatma: {kayit.hatirlatmaTarihi}
              {kayit.hatirlatmaGoruldu && <span style={{ color: '#059669' }}>· Görüldü ✓</span>}
            </div>
          )}

          {/* Butonlar */}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', paddingTop: '4px' }}>
            <button onClick={() => onKarsilastir(kayit)} disabled={karsilastirYuk === kayit.id}
              style={{
                padding: '8px 16px', borderRadius: '8px', border: `1px solid ${C.primary}30`,
                background: C.primary + '10', color: C.primary, cursor: karsilastirYuk === kayit.id ? 'not-allowed' : 'pointer',
                fontSize: '0.82rem', fontWeight: 600, opacity: karsilastirYuk === kayit.id ? 0.7 : 1,
              }}>
              {karsilastirYuk === kayit.id ? '⏳ Karşılaştırılıyor...' : takipVar ? '🔄 Yeniden Karşılaştır' : '📊 Güncel Veri ile Karşılaştır'}
            </button>
            <button onClick={() => { if (confirm('Bu kayıt silinsin mi?')) onSil(kayit.id) }}
              style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626', cursor: 'pointer', fontSize: '0.82rem' }}>
              Sil
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Ana Sayfa ────────────────────────────────────────────────────────────────
export default function AnalizMerkezi() {
  // Filtre state
  const [platform, setPlatform] = useState<'meta' | 'google'>('meta')
  const [hesap, setHesap] = useState('cotto')
  const [donem, setDonem] = useState('30')
  const [baslangic, setBaslangic] = useState('')
  const [bitis, setBitis] = useState('')

  // Kampanya state
  const [kampanyalar, setKampanyalar] = useState<Satir[]>([])
  const [seciliIds, setSeciliIds] = useState<string[]>([])
  const [gKampanyalar, setGKampanyalar] = useState<GKampanya[]>([])
  const [gSeciliIds, setGSeciliIds] = useState<string[]>([])
  const [kampYuk, setKampYuk] = useState(false)

  // Analiz state
  const [model, setModel] = useState(globalModelOku())
  const [sonuc, setSonuc] = useState<AnalizSonuc | null>(null)
  const [analizMeta, setAnalizMeta] = useState<{ harcama: number; gelir: number; roas: number; donusum: number } | null>(null)
  const [yukleniyor, setYukleniyor] = useState(false)
  const [hata, setHata] = useState<string | null>(null)
  const [seciliOneri, setSeciliOneri] = useState<Set<number>>(new Set())
  function oneriToggle(idx: number) {
    setSeciliOneri(prev => { const y = new Set(prev); y.has(idx) ? y.delete(idx) : y.add(idx); return y })
  }

  // Tab & Drawer
  const [aktifTab, setAktifTab] = useState<'analiz' | 'gunluk'>('analiz')
  const [kaydetAcik, setKaydetAcik] = useState(false)

  // Günlük state
  const [kayitlar, setKayitlar] = useState<OptimizasyonKaydi[]>([])
  const [karsilastirYuk, setKarsilastirYuk] = useState<string | null>(null)

  // ─── Model takip ───
  useEffect(() => {
    setModel(globalModelOku())
    function onModel(e: Event) { setModel((e as CustomEvent).detail) }
    window.addEventListener('modelDegisti', onModel)
    return () => window.removeEventListener('modelDegisti', onModel)
  }, [])

  // ─── Günlük yükle ───
  useEffect(() => { setKayitlar(kayitlariGetir()) }, [])

  // ─── Kampanya yükle (Meta) ───
  const yukleKampanyalar = useCallback(async () => {
    if (platform !== 'meta') return
    if (donem === 'ozel' && (!baslangic || !bitis)) return  // özel tarih seçilmemiş, bekleme
    setKampYuk(true)
    setSeciliIds([])
    setSonuc(null)
    try {
      const url = donem === 'ozel' && baslangic && bitis
        ? `/api/meta?hesap=${hesap}&tur=kampanyalar&baslangic=${baslangic}&bitis=${bitis}`
        : `/api/meta?hesap=${hesap}&tur=kampanyalar&donem=${donem}`
      const res = await fetch(url)
      const data = await res.json()
      const liste: Satir[] = (data.data || []).sort((a: Satir, b: Satir) =>
        parseFloat(b.insights?.data[0]?.spend || '0') - parseFloat(a.insights?.data[0]?.spend || '0')
      )
      setKampanyalar(liste)
      setSeciliIds(liste.filter(k => k.status === 'ACTIVE').map(k => k.id))
    } catch { setKampanyalar([]) }
    finally { setKampYuk(false) }
  }, [platform, hesap, donem, baslangic, bitis])

  // ─── Kampanya yükle (Google) ───
  const yukleGKampanyalar = useCallback(async () => {
    if (platform !== 'google') return
    if (donem === 'ozel' && (!baslangic || !bitis)) return
    setKampYuk(true)
    setGSeciliIds([])
    setSonuc(null)
    try {
      const url = donem === 'ozel' && baslangic && bitis
        ? `/api/google-ads?hesap=${hesap}&baslangic=${baslangic}&bitis=${bitis}`
        : `/api/google-ads?hesap=${hesap}&donem=${donem}`
      const res = await fetch(url)
      const data = await res.json()
      const liste: GKampanya[] = data.kampanyalar || []
      setGKampanyalar(liste)
      setGSeciliIds(liste.filter(k => k.durum === 2).map(k => k.id))
    } catch { setGKampanyalar([]) }
    finally { setKampYuk(false) }
  }, [platform, hesap, donem])

  useEffect(() => {
    if (platform === 'meta') yukleKampanyalar()
    else yukleGKampanyalar()
  }, [platform, hesap, donem, yukleKampanyalar, yukleGKampanyalar])

  // ─── Analiz Et ───
  async function analizEt() {
    if (yukleniyor) return
    const aktifIds   = platform === 'meta' ? seciliIds : gSeciliIds
    if (aktifIds.length === 0) { setHata('En az bir kampanya seçin.'); return }
    setYukleniyor(true)
    setHata(null)
    setSonuc(null)

    try {
      const hesapAdi = HESAPLAR.find(h => h.id === hesap)?.ad || hesap
      const donemAdi = donem === 'ozel' && baslangic && bitis
        ? `${baslangic} → ${bitis}`
        : (PRESETLER.find(p => p.id === donem)?.ad || donem)

      if (platform === 'meta') {
        const seciliKampanyalar = kampanyalar.filter(k => seciliIds.includes(k.id))
        const res = await fetch('/api/optimizasyon', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kampanyalar: seciliKampanyalar, hesapAdi, donemAdi, model }),
        })
        const data = await res.json()
        if (data.error) throw new Error(data.error)
        const metaSonuc: AnalizSonuc = data.sonuc ?? data
        setSonuc(metaSonuc)
        setSeciliOneri(new Set()) // Hiçbiri seçili değil — kullanıcı günlüğe eklemek istediklerini işaretler
        const m = metriksHesapla(seciliKampanyalar)
        setAnalizMeta(m)
      } else {
        const seciliGK = gKampanyalar.filter(k => gSeciliIds.includes(k.id))
        const res = await fetch('/api/optimizasyon-google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kampanyalar: seciliGK, hesapAdi, donemAdi, model }),
        })
        const data = await res.json()
        if (data.error) throw new Error(data.error)
        const googleSonuc: AnalizSonuc = data.sonuc ?? data
        setSonuc(googleSonuc)
        setSeciliOneri(new Set()) // Hiçbiri seçili değil — kullanıcı işaretler
        const harcama  = seciliGK.reduce((s, k) => s + parseFloat(k.harcama || '0'), 0)
        const gelir    = seciliGK.reduce((s, k) => s + parseFloat(k.gelir || '0'), 0)
        const donusum  = seciliGK.reduce((s, k) => s + (k.donusum || 0), 0)
        setAnalizMeta({ harcama, gelir, roas: harcama > 0 ? gelir / harcama : 0, donusum })
      }
      setAktifTab('analiz')
    } catch (e) {
      setHata(e instanceof Error ? e.message : 'Analiz yapılamadı')
    } finally {
      setYukleniyor(false)
    }
  }

  // ─── Karşılaştır ───
  async function karsilastir(kayit: OptimizasyonKaydi) {
    setKarsilastirYuk(kayit.id)
    try {
      const donemId = kayit.donemId || donemIdBul(kayit.donemAdi)
      const plat    = kayit.platform || 'meta'

      let yeniMetriks: { harcama: number; gelir: number; roas: number; donusum: number }

      if (plat === 'meta') {
        // Tüm kampanyaları çek, seçilileri filtrele
        const res  = await fetch(`/api/meta?hesap=${kayit.hesap}&tur=kampanyalar&donem=${donemId}`)
        const data = await res.json()
        const tumKamp: Satir[] = data.data || []
        const seciliKamp = tumKamp.filter(k => kayit.kampanyaIds.includes(k.id))
        if (seciliKamp.length === 0) throw new Error('Kampanyalar bulunamadı veya silinmiş')
        yeniMetriks = metriksHesapla(seciliKamp)
      } else {
        const res  = await fetch(`/api/google-ads?hesap=${kayit.hesap}&donem=${donemId}`)
        const data = await res.json()
        const tumGK: GKampanya[] = data.kampanyalar || []
        const seciliGK = tumGK.filter(k => kayit.kampanyaIds.includes(k.id))
        if (seciliGK.length === 0) throw new Error('Kampanyalar bulunamadı veya silinmiş')
        const harcama = seciliGK.reduce((s, k) => s + parseFloat(k.harcama || '0'), 0)
        const gelir   = seciliGK.reduce((s, k) => s + parseFloat(k.gelir || '0'), 0)
        const donusum = seciliGK.reduce((s, k) => s + (k.donusum || 0), 0)
        yeniMetriks = { harcama, gelir, roas: harcama > 0 ? gelir / harcama : 0, donusum }
      }

      // AI yorumu al
      const hesapAdi = HESAPLAR.find(h => h.id === kayit.hesap)?.ad || kayit.hesap
      const aiRes = await fetch('/api/ai-karsilastir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          onceki: kayit.metriks,
          sonraki: { ...yeniMetriks, gun: kayit.donemAdi },
          yapilanlar: kayit.yapilanlar,
          kampanyaAdlari: kayit.kampanyaAdlari,
          hesap: hesapAdi,
          model: globalModelOku(),
        }),
      })
      const aiData = await aiRes.json()

      kayitGuncelle(kayit.id, {
        takipTarihi: new Date().toISOString(),
        takipMetriks: yeniMetriks,
        takipAiYorumu: aiData.error ? undefined : JSON.stringify(aiData),
      })
      setKayitlar(kayitlariGetir())
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Karşılaştırma yapılamadı')
    } finally {
      setKarsilastirYuk(null)
    }
  }

  // ─── Günlük sil ───
  function kayitSilFn(id: string) {
    kayitSil(id)
    setKayitlar(kayitlariGetir())
  }

  // ─── Kaydet drawer sonrası ───
  function kaydetTamamlandi() {
    setKaydetAcik(false)
    setKayitlar(kayitlariGetir())
  }

  // ─── Mevcut kampanya adları ve ID'leri ───
  const aktifPlatKamp  = platform === 'meta' ? kampanyalar : gKampanyalar.map(k => ({ id: k.id, name: k.ad, status: k.durum === 2 ? 'ACTIVE' : 'PAUSED', insights: undefined }))
  const aktifSeciliIds = platform === 'meta' ? seciliIds : gSeciliIds
  const aktifSetSecili = platform === 'meta' ? setSeciliIds : setGSeciliIds

  const seciliKampAdi  = platform === 'meta'
    ? kampanyalar.filter(k => seciliIds.includes(k.id)).map(k => k.name)
    : gKampanyalar.filter(k => gSeciliIds.includes(k.id)).map(k => k.ad)

  const donemAdi = PRESETLER.find(p => p.id === donem)?.ad || donem
  const hatirlatmaSayisi = kayitlar.filter(k => {
    const bugun = new Date().toISOString().split('T')[0]
    return k.hatirlatmaTarihi && k.hatirlatmaTarihi <= bugun && !k.hatirlatmaGoruldu
  }).length

  // ─── JSX ─────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', background: C.bg, minHeight: '100vh' }}>
      <Sidebar />

      <div style={{ marginLeft: '220px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>

        {/* ── Sticky Üst Bar ── */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 50,
          background: C.card, borderBottom: `1px solid ${C.border}`,
          padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
          boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
        }}>
          {/* Başlık */}
          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: C.text, marginRight: '6px', whiteSpace: 'nowrap' }}>⚡ Analiz Merkezi</div>
          <div style={{ width: '1px', height: '28px', background: C.border, marginRight: '2px' }} />

          {/* Platform */}
          <select value={platform} onChange={e => { setPlatform(e.target.value as 'meta' | 'google'); setSonuc(null) }}
            style={{ padding: '8px 12px', borderRadius: '8px', border: `1px solid ${C.border}`, background: C.card, color: C.text, fontSize: '0.83rem', cursor: 'pointer', outline: 'none' }}>
            <option value="meta">📘 Meta Ads</option>
            <option value="google">🟡 Google Ads</option>
          </select>

          {/* Hesap */}
          <select value={hesap} onChange={e => { setHesap(e.target.value); setSonuc(null) }}
            style={{ padding: '8px 12px', borderRadius: '8px', border: `1px solid ${C.border}`, background: C.card, color: C.text, fontSize: '0.83rem', cursor: 'pointer', outline: 'none' }}>
            {HESAPLAR.map(h => <option key={h.id} value={h.id}>{h.emoji} {h.ad}</option>)}
          </select>

          {/* Dönem */}
          <select value={donem} onChange={e => { setDonem(e.target.value); setSonuc(null); setBaslangic(''); setBitis('') }}
            style={{ padding: '8px 12px', borderRadius: '8px', border: `1px solid ${C.border}`, background: C.card, color: C.text, fontSize: '0.83rem', cursor: 'pointer', outline: 'none' }}>
            {SAYFA_PRESETLER.map(p => <option key={p.id} value={p.id}>{p.ad}</option>)}
          </select>

          {/* Özel Tarih Aralığı */}
          {donem === 'ozel' && (
            <>
              <input type="date" value={baslangic} onChange={e => { setBaslangic(e.target.value); setSonuc(null) }}
                style={{ padding: '8px 10px', borderRadius: '8px', border: `1.5px solid ${C.primary}40`, background: C.card, color: C.text, fontSize: '0.82rem', outline: 'none', cursor: 'pointer' }} />
              <span style={{ color: C.faint, fontSize: '0.8rem', flexShrink: 0 }}>→</span>
              <input type="date" value={bitis} onChange={e => { setBitis(e.target.value); setSonuc(null) }}
                style={{ padding: '8px 10px', borderRadius: '8px', border: `1.5px solid ${C.primary}40`, background: C.card, color: C.text, fontSize: '0.82rem', outline: 'none', cursor: 'pointer' }} />
            </>
          )}

          {/* Kampanya Dropdown */}
          <KampanyaDropdown
            kampanyalar={aktifPlatKamp}
            seciliIds={aktifSeciliIds}
            onChange={aktifSetSecili}
            yukleniyor={kampYuk}
          />

          {/* Analiz Et */}
          <button onClick={analizEt}
            disabled={yukleniyor || aktifSeciliIds.length === 0}
            style={{
              padding: '8px 20px', borderRadius: '8px', border: 'none',
              background: yukleniyor || aktifSeciliIds.length === 0 ? '#9CA3AF' : C.primary,
              color: '#fff', cursor: yukleniyor || aktifSeciliIds.length === 0 ? 'not-allowed' : 'pointer',
              fontSize: '0.88rem', fontWeight: 700, whiteSpace: 'nowrap',
              display: 'flex', alignItems: 'center', gap: '7px',
              boxShadow: yukleniyor ? 'none' : '0 2px 8px ' + C.primary + '40',
            }}>
            {yukleniyor ? '⏳' : '⚡'} {yukleniyor ? 'Analiz Ediliyor...' : 'Analiz Et'}
          </button>

          {/* Model göstergesi */}
          <div style={{ marginLeft: 'auto', fontSize: '0.72rem', color: C.faint, whiteSpace: 'nowrap' }}>
            🤖 {model.includes('haiku') ? 'Haiku' : model.includes('opus') ? 'Opus' : 'Sonnet'}
          </div>
        </div>

        {/* ── Tab Bar ── */}
        <div style={{ background: C.card, borderBottom: `1px solid ${C.border}`, padding: '0 24px', display: 'flex', gap: '2px' }}>
          {[
            { id: 'analiz', label: '📊 Analiz Sonucu' },
            { id: 'gunluk', label: `📋 Optimizasyon Günlüğü${kayitlar.length > 0 ? ` (${kayitlar.length})` : ''}${hatirlatmaSayisi > 0 ? ` 🔔${hatirlatmaSayisi}` : ''}` },
          ].map(t => (
            <button key={t.id} onClick={() => setAktifTab(t.id as 'analiz' | 'gunluk')} style={{
              padding: '12px 18px', border: 'none', background: 'transparent',
              borderBottom: `2px solid ${aktifTab === t.id ? C.primary : 'transparent'}`,
              color: aktifTab === t.id ? C.primary : C.muted,
              fontWeight: aktifTab === t.id ? 700 : 400, fontSize: '0.85rem', cursor: 'pointer',
              transition: 'all 0.15s',
            }}>{t.label}</button>
          ))}
        </div>

        {/* ── İçerik ── */}
        <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>

          {/* ─── ANALİZ SONUCU TABBI ─── */}
          {aktifTab === 'analiz' && (
            <div>
              {/* Hata */}
              {hata && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', padding: '14px 18px', color: '#DC2626', marginBottom: '20px', fontSize: '0.88rem' }}>
                  ❌ {hata}
                </div>
              )}

              {/* Yükleniyor */}
              {yukleniyor && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', gap: '16px' }}>
                  <div style={{ fontSize: '2.5rem' }}>🤖</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: C.text }}>AI analiz yapıyor...</div>
                  <div style={{ fontSize: '0.83rem', color: C.muted }}>
                    {aktifSeciliIds.length} kampanya · {donemAdi} · {model.includes('haiku') ? 'Haiku' : model.includes('opus') ? 'Opus' : 'Sonnet'}
                  </div>
                  <div style={{ width: '200px', height: '3px', background: C.border, borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ width: '60%', height: '100%', background: C.primary, borderRadius: '2px', animation: 'pulse 1.5s infinite' }} />
                  </div>
                </div>
              )}

              {/* Boş durum */}
              {!yukleniyor && !sonuc && !hata && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', gap: '14px', color: C.faint }}>
                  <div style={{ fontSize: '3rem' }}>⚡</div>
                  <div style={{ fontSize: '1rem', fontWeight: 600, color: C.muted }}>Analiz için kampanya seçin ve başlatın</div>
                  <div style={{ fontSize: '0.83rem' }}>Üstten platform, hesap, dönem ve kampanyaları seçin</div>
                </div>
              )}

              {/* Sonuç */}
              {sonuc && !yukleniyor && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

                  {/* Özet + Kaydet */}
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '18px 22px' }}>
                      <div style={{ fontSize: '0.65rem', color: C.faint, textTransform: 'uppercase', fontWeight: 700, marginBottom: '8px' }}>📋 Genel Değerlendirme</div>
                      <p style={{ margin: 0, fontSize: '0.9rem', color: C.text, lineHeight: 1.7 }}>{sonuc.ozet}</p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                      <button
                        onClick={() => setKaydetAcik(true)}
                        disabled={seciliOneri.size === 0}
                        style={{
                          padding: '10px 18px', borderRadius: '10px', whiteSpace: 'nowrap',
                          border: `1px solid ${seciliOneri.size > 0 ? '#DDD6FE' : C.border}`,
                          background: seciliOneri.size > 0 ? '#EDE9FE' : C.bg,
                          color: seciliOneri.size > 0 ? '#7C3AED' : '#9CA3AF',
                          cursor: seciliOneri.size > 0 ? 'pointer' : 'not-allowed',
                          fontSize: '0.83rem', fontWeight: 700,
                        }}>
                        📥 Günlüğe Kaydet {seciliOneri.size > 0 ? `(${seciliOneri.size})` : ''}
                      </button>
                      {seciliOneri.size === 0 && (
                        <span style={{ fontSize: '0.68rem', color: '#9CA3AF', fontStyle: 'italic' }}>☝️ Aksiyon seç</span>
                      )}
                    </div>
                  </div>

                  {/* Anlık Metrikler */}
                  {analizMeta && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                      {[
                        { l: 'Harcama',  v: para(analizMeta.harcama),              r: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
                        { l: 'Gelir',    v: para(analizMeta.gelir),                r: '#059669', bg: '#F0FDF4', border: '#BBF7D0' },
                        { l: 'ROAS',     v: `${analizMeta.roas.toFixed(2)}x`,      r: '#0284C7', bg: '#EFF6FF', border: '#BAE6FD' },
                        { l: 'Dönüşüm', v: String(analizMeta.donusum),             r: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
                      ].map(m => (
                        <div key={m.l} style={{ background: m.bg, border: `1px solid ${m.border}`, borderRadius: '12px', padding: '14px 18px' }}>
                          <div style={{ fontSize: '0.63rem', color: m.r + 'AA', textTransform: 'uppercase', fontWeight: 700, marginBottom: '6px' }}>{m.l}</div>
                          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: m.r }}>{m.v}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Güçlüler / Zayıflar */}
                  {((sonuc.guclular?.length || 0) + (sonuc.zayiflar?.length || 0)) > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                      {sonuc.guclular?.length > 0 && (
                        <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '12px', padding: '16px 20px' }}>
                          <div style={{ fontSize: '0.72rem', color: '#15803D', fontWeight: 700, textTransform: 'uppercase', marginBottom: '10px' }}>💪 Güçlü Yönler</div>
                          {sonuc.guclular.map((g, i) => (
                            <div key={i} style={{ fontSize: '0.83rem', color: '#166534', marginBottom: '6px', display: 'flex', gap: '8px', lineHeight: 1.5 }}>
                              <span style={{ flexShrink: 0 }}>✓</span>{g}
                            </div>
                          ))}
                        </div>
                      )}
                      {sonuc.zayiflar?.length > 0 && (
                        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '12px', padding: '16px 20px' }}>
                          <div style={{ fontSize: '0.72rem', color: '#DC2626', fontWeight: 700, textTransform: 'uppercase', marginBottom: '10px' }}>⚠️ Zayıf Yönler</div>
                          {sonuc.zayiflar.map((z, i) => (
                            <div key={i} style={{ fontSize: '0.83rem', color: '#991B1B', marginBottom: '6px', display: 'flex', gap: '8px', lineHeight: 1.5 }}>
                              <span style={{ flexShrink: 0 }}>!</span>{z}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Bütçe + Fırsat */}
                  {(sonuc.butceVerimliligi || sonuc.firsat) && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                      {sonuc.butceVerimliligi && (
                        <div style={{ background: '#EFF6FF', border: '1px solid #BAE6FD', borderRadius: '12px', padding: '16px 20px' }}>
                          <div style={{ fontSize: '0.72rem', color: '#0284C7', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>💰 Bütçe Verimliliği</div>
                          <p style={{ margin: 0, fontSize: '0.85rem', color: '#0C4A6E', lineHeight: 1.6 }}>{sonuc.butceVerimliligi}</p>
                        </div>
                      )}
                      {sonuc.firsat && (
                        <div style={{ background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: '12px', padding: '16px 20px' }}>
                          <div style={{ fontSize: '0.72rem', color: '#7C3AED', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>🚀 Büyüme Fırsatı</div>
                          <p style={{ margin: 0, fontSize: '0.85rem', color: '#4C1D95', lineHeight: 1.6 }}>{sonuc.firsat}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Öneriler */}
                  {sonuc.oneriler?.length > 0 && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <div style={{ fontSize: '0.72rem', color: C.faint, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em' }}>
                          💡 Aksiyon Önerileri ({sonuc.oneriler.length}) ·{' '}
                          <span style={{ color: seciliOneri.size > 0 ? C.primary : '#9CA3AF', fontWeight: 600, textTransform: 'none' }}>
                            {seciliOneri.size > 0 ? `${seciliOneri.size} seçili` : 'günlüğe eklemek istediklerini işaretle'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={() => setSeciliOneri(new Set(sonuc.oneriler.map((_, i) => i)))}
                            style={{ fontSize: '0.68rem', color: '#7C3AED', background: '#EDE9FE', border: '1px solid #DDD6FE', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer' }}>Tümünü Seç</button>
                          <button onClick={() => setSeciliOneri(new Set())}
                            style={{ fontSize: '0.68rem', color: C.muted, background: C.bg, border: `1px solid ${C.border}`, borderRadius: '4px', padding: '2px 8px', cursor: 'pointer' }}>Temizle</button>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {sonuc.oneriler.map((o, i) => {
                          const stil = ONERI_RENK[o.tip] || ONERI_RENK.default
                          const onc  = ONCELIK[o.oncelik] || ONCELIK.dusuk
                          const secili = seciliOneri.has(i)
                          return (
                            <label key={i} onClick={() => oneriToggle(i)} style={{
                              background: secili ? stil.bg : C.bg,
                              border: `1.5px solid ${secili ? stil.border : C.border}`,
                              borderRadius: '10px', padding: '14px 18px', display: 'flex', gap: '14px',
                              alignItems: 'flex-start', cursor: 'pointer', transition: 'all 0.1s',
                              opacity: secili ? 1 : 0.6,
                            }}>
                              <input type="checkbox" checked={secili} onChange={() => oneriToggle(i)}
                                style={{ marginTop: '3px', accentColor: C.primary, width: '15px', height: '15px', flexShrink: 0, cursor: 'pointer' }} />
                              <span style={{ fontSize: '1.2rem', flexShrink: 0, marginTop: '1px' }}>{stil.icon}</span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                                  <span style={{ fontWeight: 700, fontSize: '0.88rem', color: stil.text }}>{o.baslik}</span>
                                  <span style={{ fontSize: '0.65rem', color: onc.renk, fontWeight: 700 }}>{onc.label}</span>
                                  {o.kampanya && (
                                    <span style={{ fontSize: '0.7rem', background: C.card, border: `1px solid ${stil.border}`, borderRadius: '4px', padding: '1px 7px', color: C.muted }}>{o.kampanya}</span>
                                  )}
                                </div>
                                <p style={{ margin: 0, fontSize: '0.82rem', color: stil.text + 'CC', lineHeight: 1.6 }}>{o.aciklama}</p>
                              </div>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  )}

                </div>
              )}
            </div>
          )}

          {/* ─── GÜNLÜK TABBI ─── */}
          {aktifTab === 'gunluk' && (
            <div>
              {kayitlar.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', gap: '14px', color: C.faint }}>
                  <div style={{ fontSize: '3rem' }}>📋</div>
                  <div style={{ fontSize: '1rem', fontWeight: 600, color: C.muted }}>Henüz kayıt yok</div>
                  <div style={{ fontSize: '0.83rem' }}>Analiz yaptıktan sonra "Günlüğe Kaydet" ile buraya ekleyin</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {kayitlar.map(k => (
                    <GunlukKart
                      key={k.id}
                      kayit={k}
                      onSil={kayitSilFn}
                      onKarsilastir={karsilastir}
                      karsilastirYuk={karsilastirYuk}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Kaydet Drawer ── */}
      {kaydetAcik && sonuc && analizMeta && (
        <KaydetDrawer
          sonuc={sonuc}
          hesap={hesap}
          donemAdi={donemAdi}
          donemId={donem}
          platform={platform}
          kampanyaAdlari={seciliKampAdi}
          kampanyaIds={aktifSeciliIds}
          metrikler={analizMeta}
          seciliBaslangic={seciliOneri}
          onKapat={() => setKaydetAcik(false)}
          onKaydet={kaydetTamamlandi}
        />
      )}
    </div>
  )
}
