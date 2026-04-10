'use client'

import { useEffect, useState, useCallback } from 'react'
import AiRapor from '../components/AiRapor'
import Sidebar, { globalModelOku } from '../components/Sidebar'
import { C } from '../lib/theme'
import { HESAPLAR, PRESETLER, Satir, AnalizGecmis } from '../lib/types'
import { getGelir, getRoas, getDonusum, kampanyaSkoru, para } from '../lib/helpers'
import {
  OptimizasyonKaydi, kayitlariGetir, kayitEkle, kayitGuncelle, kayitSil,
  vadesiGelenler, aksiyonlariCikar
} from '../lib/gecmis'

type StatusFiltre = 'hepsi' | 'aktif' | 'pasif'
type SagTab = 'analiz' | 'aiGecmis' | 'optGecmis'

function SkorBadge({ ins }: { ins?: import('../lib/types').Insights }) {
  const { harf, renk, skor } = kampanyaSkoru(ins)
  if (harf === '—') return <span style={{ color: C.faint, fontSize: '0.78rem' }}>—</span>
  return (
    <span title={`Skor: ${skor}/100`} style={{
      display: 'inline-block', width: '22px', height: '22px', borderRadius: '50%',
      background: renk + '22', border: `1.5px solid ${renk}`, color: renk,
      fontSize: '0.72rem', fontWeight: 700, textAlign: 'center', lineHeight: '20px', cursor: 'help'
    }}>{harf}</span>
  )
}

// ─── Kaydet Paneli ────────────────────────────────────────────────
interface KaydetPanelProps {
  analiz: Record<string, unknown>
  hesap: string
  donemAdi: string
  kampanyalar: Satir[]
  seciliIds: Set<string>
  initialSecimler: Set<number>
  onKapat: () => void
  onKaydet: () => void
  // Google Ads için opsiyonel: hazır metrikler ve kampanya isimleri
  preMetriks?: { harcama: number; gelir: number; roas: number; donusum: number }
  gKampanyaAdlari?: string[]
  gKampanyaIds?: string[]
}

function KaydetPanel({ analiz, hesap, donemAdi, kampanyalar, seciliIds, initialSecimler, onKapat, onKaydet, preMetriks, gKampanyaAdlari, gKampanyaIds }: KaydetPanelProps) {
  const tumAksiyonlar = aksiyonlariCikar(analiz)
  const [seciliAksiyonlar, setSeciliAksiyonlar] = useState<Set<number>>(
    new Set(initialSecimler)
  )
  const [notlar, setNotlar] = useState('')
  const [hatirlatmaGun, setHatirlatmaGun] = useState(7)
  const [hatirlatmaAktif, setHatirlatmaAktif] = useState(false)

  function aksiyonToggle(i: number) {
    setSeciliAksiyonlar(prev => {
      const yeni = new Set(prev)
      yeni.has(i) ? yeni.delete(i) : yeni.add(i)
      return yeni
    })
  }

  function kaydet() {
    let toplamHarcama: number, toplamGelir: number, toplamDonusum: number
    let kampanyaIds: string[], kampanyaAdlari: string[]

    if (preMetriks) {
      // Google Ads modu: hazır metrikler
      toplamHarcama = preMetriks.harcama
      toplamGelir = preMetriks.gelir
      toplamDonusum = preMetriks.donusum
      kampanyaIds = gKampanyaIds || []
      kampanyaAdlari = gKampanyaAdlari || []
    } else {
      // Meta modu: kampanya verisinden hesapla
      const seciliKampanyalar = kampanyalar.filter(k => seciliIds.has(k.id))
      toplamHarcama = seciliKampanyalar.reduce((a, k) => a + parseFloat(k.insights?.data[0]?.spend || '0'), 0)
      toplamGelir = seciliKampanyalar.reduce((a, k) => a + getGelir(k.insights?.data[0]), 0)
      toplamDonusum = seciliKampanyalar.reduce((a, k) => a + getDonusum(k.insights?.data[0]), 0)
      kampanyaIds = seciliKampanyalar.map(k => k.id)
      kampanyaAdlari = seciliKampanyalar.map(k => k.name)
    }

    const hatirlatmaTarihi = hatirlatmaAktif && hatirlatmaGun > 0
      ? (() => {
          const t = new Date()
          t.setDate(t.getDate() + hatirlatmaGun)
          return t.toISOString().split('T')[0]
        })()
      : null

    const kayit: OptimizasyonKaydi = {
      id: Date.now().toString(),
      tarih: new Date().toISOString(),
      hesap,
      donemAdi,
      kaynak: 'ai-merkezi',
      kampanyaIds,
      kampanyaAdlari,
      metriks: {
        harcama: toplamHarcama,
        gelir: toplamGelir,
        roas: toplamHarcama > 0 ? toplamGelir / toplamHarcama : 0,
        donusum: toplamDonusum,
      },
      yapilanlar: tumAksiyonlar.filter((_, i) => seciliAksiyonlar.has(i)),
      notlar,
      hatirlatmaGun: hatirlatmaAktif ? hatirlatmaGun : 0,
      hatirlatmaTarihi,
      hatirlatmaGoruldu: false,
    }

    kayitEkle(kayit)
    onKaydet()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end'
    }} onClick={e => { if (e.target === e.currentTarget) onKapat() }}>
      <div style={{
        width: '480px', height: '100vh', background: C.card, borderLeft: `1px solid ${C.border}`,
        display: 'flex', flexDirection: 'column', overflow: 'hidden'
      }}>
        {/* Başlık */}
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F5F3FF' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#4C1D95' }}>📥 Optimizasyon Günlüğüne Kaydet</div>
            <div style={{ fontSize: '0.75rem', color: '#7C3AED', marginTop: '2px' }}>{donemAdi} · {HESAPLAR.find(h => h.id === hesap)?.ad}</div>
          </div>
          <button onClick={onKapat} style={{ background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', fontSize: '1.3rem', lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Aksiyonlar */}
          <div>
            <div style={{ fontSize: '0.72rem', color: C.muted, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em', marginBottom: '10px' }}>
              Yapılan Aksiyonlar <span style={{ color: C.faint, fontWeight: 400, textTransform: 'none' }}>— hangilerini yaptın?</span>
            </div>
            {tumAksiyonlar.length === 0 ? (
              <div style={{ fontSize: '0.82rem', color: C.faint, fontStyle: 'italic' }}>Bu analizde aksiyon maddesi bulunamadı.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {tumAksiyonlar.map((a, i) => (
                  <label key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', padding: '8px 10px', borderRadius: '8px', background: seciliAksiyonlar.has(i) ? '#EDE9FE' : C.bg, border: `1px solid ${seciliAksiyonlar.has(i) ? '#DDD6FE' : C.border}`, transition: 'all 0.1s' }}>
                    <input
                      type="checkbox"
                      checked={seciliAksiyonlar.has(i)}
                      onChange={() => aksiyonToggle(i)}
                      style={{ marginTop: '2px', accentColor: '#7C3AED', width: '15px', height: '15px', flexShrink: 0 }}
                    />
                    <span style={{ fontSize: '0.82rem', color: C.text, lineHeight: '1.5' }}>{a}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Notlar */}
          <div>
            <div style={{ fontSize: '0.72rem', color: C.muted, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em', marginBottom: '8px' }}>
              Ek Notlar <span style={{ color: C.faint, fontWeight: 400, textTransform: 'none' }}>— isteğe bağlı</span>
            </div>
            <textarea
              value={notlar}
              onChange={e => setNotlar(e.target.value)}
              placeholder="Neden bu değişiklikleri yaptın? Gözlemlerini not al..."
              rows={3}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: '8px',
                border: `1px solid ${C.border}`, background: C.bg, color: C.text,
                fontSize: '0.83rem', resize: 'vertical', fontFamily: 'inherit',
                boxSizing: 'border-box', outline: 'none'
              }}
            />
          </div>

          {/* Hatırlatma */}
          <div style={{ background: hatirlatmaAktif ? '#EFF6FF' : C.bg, border: `1px solid ${hatirlatmaAktif ? '#BAE6FD' : C.border}`, borderRadius: '10px', padding: '14px 16px', transition: 'all 0.2s' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginBottom: hatirlatmaAktif ? '12px' : '0' }}>
              <input
                type="checkbox"
                checked={hatirlatmaAktif}
                onChange={e => setHatirlatmaAktif(e.target.checked)}
                style={{ accentColor: '#0284C7', width: '16px', height: '16px' }}
              />
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: C.text }}>⏰ Takip hatırlatması kur</div>
                <div style={{ fontSize: '0.73rem', color: C.muted, marginTop: '1px' }}>X gün sonra sana "sonucu kontrol et" diye hatırlatayım</div>
              </div>
            </label>
            {hatirlatmaAktif && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: '26px' }}>
                <input
                  type="number"
                  min={1} max={90}
                  value={hatirlatmaGun}
                  onChange={e => setHatirlatmaGun(parseInt(e.target.value) || 1)}
                  style={{
                    width: '70px', padding: '6px 10px', borderRadius: '7px',
                    border: `1.5px solid #0284C7`, background: '#fff', color: C.text,
                    fontSize: '1rem', fontWeight: 700, textAlign: 'center'
                  }}
                />
                <span style={{ fontSize: '0.85rem', color: '#0369A1', fontWeight: 500 }}>gün sonra hatırlat</span>
                <span style={{ fontSize: '0.73rem', color: C.muted }}>
                  ({(() => {
                    const t = new Date()
                    t.setDate(t.getDate() + hatirlatmaGun)
                    return t.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })
                  })()})
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Kaydet Butonu */}
        <div style={{ padding: '16px 24px', borderTop: `1px solid ${C.border}`, background: C.card }}>
          <div style={{ fontSize: '0.75rem', color: C.faint, marginBottom: '10px', textAlign: 'center' }}>
            {seciliAksiyonlar.size} aksiyon seçili · {kampanyalar.filter(k => seciliIds.has(k.id)).length} kampanya
          </div>
          <button onClick={kaydet} style={{
            width: '100%', padding: '12px', borderRadius: '10px', border: 'none',
            background: '#7C3AED', color: '#fff', cursor: 'pointer',
            fontSize: '0.92rem', fontWeight: 700
          }}>
            ✅ Günlüğe Kaydet
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Opt. Günlüğü Kartı ──────────────────────────────────────────
interface GunlukKartProps {
  kayit: OptimizasyonKaydi
  onSil: (id: string) => void
  onDuzenle: (id: string) => void
  onTakipAl: (kayit: OptimizasyonKaydi) => void
  onAiYorum: (kayit: OptimizasyonKaydi) => void
  takipYukleniyor: string | null
  aiYorumYukleniyor: string | null
}

function GunlukKart({ kayit, onSil, onTakipAl, onAiYorum, takipYukleniyor, aiYorumYukleniyor }: GunlukKartProps) {
  const [acik, setAcik] = useState(false)
  const tarihStr = new Date(kayit.tarih).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  const deltaRoas = kayit.takipMetriks
    ? kayit.metriks.roas > 0
      ? ((kayit.takipMetriks.roas - kayit.metriks.roas) / kayit.metriks.roas * 100)
      : null
    : null

  const roasRenkFn = (r: number) => r >= 4 ? '#059669' : r >= 2 ? '#D97706' : r > 0 ? '#DC2626' : C.faint
  const sonucRenk = kayit.takipAiYorumu
    ? kayit.takipAiYorumu.includes('"iyi"') ? '#059669'
    : kayit.takipAiYorumu.includes('"kötü"') ? '#DC2626'
    : '#D97706'
    : null

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', overflow: 'hidden', borderLeft: `4px solid ${sonucRenk || '#7C3AED'}` }}>
      {/* Özet satırı */}
      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: '0.85rem', color: C.text }}>
              {HESAPLAR.find(h => h.id === kayit.hesap)?.emoji} {HESAPLAR.find(h => h.id === kayit.hesap)?.ad}
            </span>
            <span style={{ fontSize: '0.7rem', color: '#7C3AED', background: '#EDE9FE', padding: '2px 7px', borderRadius: '4px', fontWeight: 600 }}>
              {kayit.donemAdi}
            </span>
            {kayit.kaynak === 'kampanya-detay' && (
              <span style={{ fontSize: '0.7rem', color: C.muted, background: C.bg, padding: '2px 7px', borderRadius: '4px', border: `1px solid ${C.border}` }}>
                Kampanya Detay
              </span>
            )}
            {kayit.hatirlatmaTarihi && !kayit.hatirlatmaGoruldu && (
              <span style={{ fontSize: '0.68rem', color: '#0369A1', background: '#EFF6FF', padding: '2px 7px', borderRadius: '4px', border: '1px solid #BAE6FD' }}>
                ⏰ {new Date(kayit.hatirlatmaTarihi).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.72rem', color: C.muted, marginBottom: '8px' }}>{tarihStr}</div>

          {/* Kampanyalar */}
          {kayit.kampanyaAdlari.length > 0 && (
            <div style={{ fontSize: '0.73rem', color: C.faint, marginBottom: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              📌 {kayit.kampanyaAdlari.slice(0, 2).join(', ')}{kayit.kampanyaAdlari.length > 2 ? ` +${kayit.kampanyaAdlari.length - 2} daha` : ''}
            </div>
          )}

          {/* Metrik karşılaştırma */}
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            {[
              { b: 'Harcama', v: para(kayit.metriks.harcama), s: kayit.takipMetriks ? para(kayit.takipMetriks.harcama) : null, r: '#C2410C' },
              { b: 'Gelir', v: para(kayit.metriks.gelir), s: kayit.takipMetriks ? para(kayit.takipMetriks.gelir) : null, r: '#059669' },
              { b: 'ROAS', v: `${kayit.metriks.roas.toFixed(2)}x`, s: kayit.takipMetriks ? `${kayit.takipMetriks.roas.toFixed(2)}x` : null, r: roasRenkFn(kayit.metriks.roas) },
              { b: 'Dönüşüm', v: String(kayit.metriks.donusum), s: kayit.takipMetriks ? String(kayit.takipMetriks.donusum) : null, r: '#0284C7' },
            ].map((m, i) => (
              <div key={i}>
                <div style={{ fontSize: '0.63rem', color: C.faint, marginBottom: '2px' }}>{m.b}</div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: m.r }}>{m.v}</div>
                {m.s && (
                  <div style={{ fontSize: '0.73rem', color: m.r, opacity: 0.8 }}>→ {m.s}</div>
                )}
              </div>
            ))}
            {deltaRoas !== null && (
              <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '2px' }}>
                <span style={{
                  fontSize: '0.8rem', fontWeight: 700, padding: '2px 8px', borderRadius: '6px',
                  background: deltaRoas >= 0 ? '#DCFCE7' : '#FEE2E2',
                  color: deltaRoas >= 0 ? '#166534' : '#991B1B'
                }}>
                  {deltaRoas >= 0 ? '↑' : '↓'} ROAS %{Math.abs(deltaRoas).toFixed(1)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Sağ butonlar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flexShrink: 0 }}>
          <button onClick={() => setAcik(p => !p)} style={{
            background: C.bg, border: `1px solid ${C.border}`, color: C.muted,
            borderRadius: '7px', padding: '5px 10px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 500
          }}>
            {acik ? '▲ Kapat' : '▼ Detay'}
          </button>
          <button
            onClick={() => onTakipAl(kayit)}
            disabled={takipYukleniyor === kayit.id}
            style={{
              background: kayit.takipMetriks ? '#F0FDF4' : '#EFF6FF',
              border: `1px solid ${kayit.takipMetriks ? '#A7F3D0' : '#BAE6FD'}`,
              color: kayit.takipMetriks ? '#059669' : '#0369A1',
              borderRadius: '7px', padding: '5px 10px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600
          }}>
            {takipYukleniyor === kayit.id ? '⏳' : kayit.takipMetriks ? '🔄 Güncelle' : '📊 Takip Al'}
          </button>
          {kayit.takipMetriks && (
            <button
              onClick={() => onAiYorum(kayit)}
              disabled={aiYorumYukleniyor === kayit.id}
              style={{
                background: '#F5F3FF', border: '1px solid #DDD6FE', color: '#7C3AED',
                borderRadius: '7px', padding: '5px 10px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600
              }}>
              {aiYorumYukleniyor === kayit.id ? '⏳' : '🤖 AI Yorumu'}
            </button>
          )}
          <button onClick={() => onSil(kayit.id)} style={{
            background: 'transparent', border: `1px solid ${C.border}`,
            color: C.faint, borderRadius: '7px', padding: '5px 10px', cursor: 'pointer', fontSize: '0.75rem'
          }}>🗑️</button>
        </div>
      </div>

      {/* Detay açılır alan */}
      {acik && (
        <div style={{ padding: '0 16px 16px', borderTop: `1px solid ${C.borderLight}` }}>
          {/* Yapılanlar */}
          {kayit.yapilanlar.length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <div style={{ fontSize: '0.68rem', color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>✅ Yapılan Aksiyonlar</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {kayit.yapilanlar.map((y, i) => (
                  <div key={i} style={{ fontSize: '0.8rem', color: C.text, display: 'flex', gap: '7px', padding: '5px 8px', background: '#F0FDF4', borderRadius: '6px', border: '1px solid #A7F3D0' }}>
                    <span style={{ color: '#059669', flexShrink: 0 }}>✓</span>
                    <span>{y}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notlar */}
          {kayit.notlar && (
            <div style={{ marginTop: '12px' }}>
              <div style={{ fontSize: '0.68rem', color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>📝 Notlar</div>
              <div style={{ fontSize: '0.82rem', color: C.text, background: C.bg, borderRadius: '7px', padding: '10px 12px', border: `1px solid ${C.border}`, lineHeight: '1.55' }}>
                {kayit.notlar}
              </div>
            </div>
          )}

          {/* AI Yorumu */}
          {kayit.takipAiYorumu && (() => {
            try {
              const yorum = JSON.parse(kayit.takipAiYorumu)
              const sonucRenkMap: Record<string, string> = { iyi: '#059669', 'karışık': '#D97706', kötü: '#DC2626' }
              const sr = sonucRenkMap[yorum.sonuc] || C.muted
              return (
                <div style={{ marginTop: '14px', background: sr + '10', border: `1px solid ${sr}40`, borderRadius: '10px', padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: sr, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      🤖 AI Yorumu — {yorum.sonuc === 'iyi' ? '✅ İyi Sonuç' : yorum.sonuc === 'kötü' ? '❌ Kötü Sonuç' : '⚠️ Karışık Sonuç'}
                    </span>
                    {kayit.takipTarihi && (
                      <span style={{ fontSize: '0.68rem', color: C.muted }}>
                        {new Date(kayit.takipTarihi).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: '0.83rem', color: C.text, margin: '0 0 10px', lineHeight: '1.6' }}>{yorum.ozet}</p>
                  {yorum.olumlu?.length > 0 && (
                    <div style={{ marginBottom: '8px' }}>
                      {yorum.olumlu.map((o: string, i: number) => (
                        <div key={i} style={{ fontSize: '0.78rem', color: '#059669', display: 'flex', gap: '6px', marginBottom: '3px' }}>
                          <span>✅</span><span>{o}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {yorum.olumsuz?.length > 0 && (
                    <div style={{ marginBottom: '8px' }}>
                      {yorum.olumsuz.map((o: string, i: number) => (
                        <div key={i} style={{ fontSize: '0.78rem', color: '#D97706', display: 'flex', gap: '6px', marginBottom: '3px' }}>
                          <span>⚠️</span><span>{o}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {yorum.oneri && (
                    <div style={{ fontSize: '0.8rem', color: '#0369A1', background: '#EFF6FF', borderRadius: '6px', padding: '8px 12px', marginTop: '6px' }}>
                      💡 {yorum.oneri}
                    </div>
                  )}
                </div>
              )
            } catch {
              return <div style={{ marginTop: '12px', fontSize: '0.82rem', color: C.text }}>{kayit.takipAiYorumu}</div>
            }
          })()}
        </div>
      )}
    </div>
  )
}

// ─── Ana Bileşen ─────────────────────────────────────────────────
export default function AiMerkezi() {
  const [hesap, setHesap] = useState('karmen')
  const [donem, setDonem] = useState('30')
  const [baslangic, setBaslangic] = useState('')
  const [bitis, setBitis] = useState('')
  const [statusFiltre, setStatusFiltre] = useState<StatusFiltre>('aktif')
  const [kampanyalar, setKampanyalar] = useState<Satir[]>([])
  const [seciliIds, setSeciliIds] = useState<Set<string>>(new Set())
  const [kampanyaYukleniyor, setKampanyaYukleniyor] = useState(false)
  const [analiz, setAnaliz] = useState<Record<string, unknown> | null>(null)
  const [analizYukleniyor, setAnalizYukleniyor] = useState(false)
  const [analizDonemAdi, setAnalizDonemAdi] = useState('')
  const [analizHesapAdi, setAnalizHesapAdi] = useState('')
  const [analizHesap, setAnalizHesap] = useState('karmen')
  const [aiGecmis, setAiGecmis] = useState<AnalizGecmis[]>([])
  const [aktifTab, setAktifTab] = useState<SagTab>('analiz')
  const [kaydetAcik, setKaydetAcik] = useState(false)
  const [analizSecimler, setAnalizSecimler] = useState<Set<number>>(new Set()) // AiRapor checkbox state
  const [optGecmis, setOptGecmis] = useState<OptimizasyonKaydi[]>([])
  const [hatirlatmalar, setHatirlatmalar] = useState<OptimizasyonKaydi[]>([])
  const [takipYukleniyor, setTakipYukleniyor] = useState<string | null>(null)
  const [aiYorumYukleniyor, setAiYorumYukleniyor] = useState<string | null>(null)
  // Sohbet state
  const [sohbetSoru, setSohbetSoru] = useState('')
  const [sohbetGecmis, setSohbetGecmis] = useState<{ soru: string; yanit: string }[]>([])
  const [sohbetYukleniyor, setSohbetYukleniyor] = useState(false)
  // Platform & Google Ads state
  const [platform, setPlatform] = useState<'meta' | 'google'>('meta')
  const [gKampanyalar, setGKampanyalar] = useState<{ id: string; ad: string; durum: number; harcama: string; donusum: number; gelir: string; roas: string; tip: string }[]>([])
  const [gSeciliIds, setGSeciliIds] = useState<Set<string>>(new Set())
  const [gKampanyaYukleniyor, setGKampanyaYukleniyor] = useState(false)
  const [gAnaliz, setGAnaliz] = useState<Record<string, unknown> | null>(null)
  const [gAnalizSecimler, setGAnalizSecimler] = useState<Set<number>>(new Set())
  const [gStatusFiltre, setGStatusFiltre] = useState<StatusFiltre>('aktif')
  const [gKaydetAcik, setGKaydetAcik] = useState(false)

  // LocalStorage yükle
  useEffect(() => {
    try {
      const stored = localStorage.getItem('reklam_analiz_gecmisi')
      if (stored) setAiGecmis(JSON.parse(stored))
    } catch { /* ignore */ }
    setOptGecmis(kayitlariGetir())
    setHatirlatmalar(vadesiGelenler())
  }, [])

  const yukleKampanyalar = useCallback(() => {
    setKampanyaYukleniyor(true)
    setKampanyalar([])
    setSeciliIds(new Set())

    let url = `/api/meta?hesap=${hesap}&tur=kampanyalar&donem=${donem}`
    if (donem === 'ozel' && baslangic && bitis) url += `&baslangic=${baslangic}&bitis=${bitis}`

    fetch(url).then(r => r.json()).then(d => {
      const liste: Satir[] = d.data || []
      setKampanyalar(liste)
      autoSec(liste, statusFiltre)
      setKampanyaYukleniyor(false)
    }).catch(() => setKampanyaYukleniyor(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hesap, donem, baslangic, bitis])

  useEffect(() => { if (platform === 'meta') yukleKampanyalar() }, [yukleKampanyalar, platform])

  const yukleGKampanyalar = useCallback(() => {
    setGKampanyaYukleniyor(true)
    setGKampanyalar([])
    setGSeciliIds(new Set())
    let url = `/api/google-ads?hesap=${hesap}&tur=kampanyalar&donem=${donem}`
    if (donem === 'ozel' && baslangic && bitis) url += `&baslangic=${baslangic}&bitis=${bitis}`
    fetch(url).then(r => r.json()).then(d => {
      const liste: { id: string; ad: string; durum: number; harcama: string; donusum: number; gelir: string; roas: string; tip: string }[] = d.data || []
      setGKampanyalar(liste)
      setGSeciliIds(new Set(liste.filter(k => k.durum === 2).map(k => String(k.id))))
      // gStatusFiltre'yi burada kullanamayız (closure sorunu), 'aktif' varsayılan yeterli
      setGKampanyaYukleniyor(false)
    }).catch(() => setGKampanyaYukleniyor(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hesap, donem, baslangic, bitis])

  useEffect(() => { if (platform === 'google') yukleGKampanyalar() }, [yukleGKampanyalar, platform])

  async function gAnalizBaslat() {
    const gFiltreliSecili = gKampanyalar.filter(k => gSeciliIds.has(String(k.id)))
    if (gFiltreliSecili.length === 0) return

    const hesapBilgi = HESAPLAR.find(h => h.id === hesap)!
    const donemAdi = donem === 'ozel' && baslangic && bitis
      ? `${baslangic} — ${bitis}`
      : PRESETLER.find(p => p.id === donem)?.ad || `Son ${donem} Gün`

    setAnalizYukleniyor(true)
    setGAnaliz(null)
    setGAnalizSecimler(new Set())
    setAktifTab('analiz')
    setAnalizDonemAdi(donemAdi)
    setAnalizHesapAdi(hesapBilgi.ad + ' · Google Ads')
    setAnalizHesap(hesap)

    try {
      const model = globalModelOku()
      const res = await fetch('/api/google-ads-analiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kampanyalar: gFiltreliSecili, hesapAdi: hesapBilgi.ad, donem: donemAdi, model })
      })
      const data = await res.json()
      if (data.error) {
        setGAnaliz({ hata: data.error })
      } else {
        setGAnaliz(data.analiz)
        // AI geçmişine ekle (platform: 'google')
        const yeniItem: AnalizGecmis = {
          id: Date.now().toString(),
          tarih: new Date().toLocaleString('tr-TR'),
          hesapAdi: hesapBilgi.ad,
          donemAdi,
          analiz: data.analiz,
          platform: 'google',
        }
        setAiGecmis(prev => {
          const yeni = [yeniItem, ...prev].slice(0, 10)
          try { localStorage.setItem('reklam_analiz_gecmisi', JSON.stringify(yeni)) } catch {}
          return yeni
        })
      }
    } catch {
      setGAnaliz({ hata: 'Bağlantı hatası' })
    }
    setAnalizYukleniyor(false)
  }

  function gAnalizAksiyonToggle(idx: number) {
    setGAnalizSecimler(prev => {
      const yeni = new Set(prev)
      yeni.has(idx) ? yeni.delete(idx) : yeni.add(idx)
      return yeni
    })
  }

  function gOptKaydetTamamlandi() {
    setGKaydetAcik(false)
    setOptGecmis(kayitlariGetir())
    setAktifTab('optGecmis')
  }

  function gKampanyaToggle(id: string) {
    setGSeciliIds(prev => { const y = new Set(prev); y.has(id) ? y.delete(id) : y.add(id); return y })
  }

  function gAutoSec(liste: typeof gKampanyalar, filtre: StatusFiltre) {
    setGSeciliIds(new Set(
      liste.filter(k => filtre === 'hepsi' || (filtre === 'aktif' ? k.durum === 2 : k.durum !== 2))
        .map(k => String(k.id))
    ))
  }

  function gStatusDegistir(f: StatusFiltre) {
    setGStatusFiltre(f)
    gAutoSec(gKampanyalar, f)
  }

  function gTumunuToggle() {
    const gFiltreliKampanyalar = gKampanyalar.filter(k =>
      gStatusFiltre === 'hepsi' || (gStatusFiltre === 'aktif' ? k.durum === 2 : k.durum !== 2)
    )
    const hepsi = gFiltreliKampanyalar.every(k => gSeciliIds.has(String(k.id)))
    setGSeciliIds(hepsi ? new Set() : new Set(gFiltreliKampanyalar.map(k => String(k.id))))
  }

  function autoSec(liste: Satir[], filtre: StatusFiltre) {
    setSeciliIds(new Set(
      liste.filter(k => filtre === 'hepsi' || (filtre === 'aktif' ? k.status === 'ACTIVE' : k.status !== 'ACTIVE'))
        .map(k => k.id)
    ))
  }

  function statusDegistir(f: StatusFiltre) {
    setStatusFiltre(f)
    autoSec(kampanyalar, f)
  }

  const filtreliKampanyalar = kampanyalar.filter(k =>
    statusFiltre === 'hepsi' ||
    (statusFiltre === 'aktif' ? k.status === 'ACTIVE' : k.status !== 'ACTIVE')
  )

  function kampanyaToggle(id: string) {
    setSeciliIds(prev => { const y = new Set(prev); y.has(id) ? y.delete(id) : y.add(id); return y })
  }

  function tumunuToggle() {
    const hepsiSecili = filtreliKampanyalar.every(k => seciliIds.has(k.id))
    setSeciliIds(hepsiSecili ? new Set() : new Set(filtreliKampanyalar.map(k => k.id)))
  }

  async function analizBaslat() {
    const seciliKampanyalar = kampanyalar.filter(k => seciliIds.has(k.id))
    if (seciliKampanyalar.length === 0) return

    const hesapBilgi = HESAPLAR.find(h => h.id === hesap)!
    const donemAdi = donem === 'ozel' && baslangic && bitis
      ? `${baslangic} — ${bitis}`
      : PRESETLER.find(p => p.id === donem)?.ad || `Son ${donem} Gün`

    setAnalizYukleniyor(true)
    setAnaliz(null)
    setAnalizSecimler(new Set()) // yeni analiz = seçimler sıfırlanır
    setSohbetGecmis([])         // yeni analiz = sohbet temizlenir
    setAktifTab('analiz')
    setAnalizDonemAdi(donemAdi)
    setAnalizHesapAdi(hesapBilgi.ad)
    setAnalizHesap(hesap)

    try {
      const res = await fetch('/api/ai-analiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kampanyalar: seciliKampanyalar, hesapAdi: hesapBilgi.ad, skipStatusFilter: true })
      })
      const data = await res.json()

      if (data.error) {
        setAnaliz({ hata: data.error })
      } else {
        setAnaliz(data.analiz)
        const yeniItem: AnalizGecmis = {
          id: Date.now().toString(),
          tarih: new Date().toLocaleString('tr-TR'),
          hesapAdi: hesapBilgi.ad,
          donemAdi,
          analiz: data.analiz,
          platform: 'meta',
        }
        setAiGecmis(prev => {
          const yeni = [yeniItem, ...prev].slice(0, 10)
          try { localStorage.setItem('reklam_analiz_gecmisi', JSON.stringify(yeni)) } catch {}
          return yeni
        })
      }
    } catch {
      setAnaliz({ hata: 'Bağlantı hatası' })
    }
    setAnalizYukleniyor(false)
  }

  function aiGecmisSil(id: string) {
    setAiGecmis(prev => {
      const yeni = prev.filter(g => g.id !== id)
      try { localStorage.setItem('reklam_analiz_gecmisi', JSON.stringify(yeni)) } catch {}
      return yeni
    })
  }

  function aiGecmisGoster(item: AnalizGecmis) {
    if (item.platform === 'google') {
      setPlatform('google')
      setGAnaliz(item.analiz)
      setGAnalizSecimler(new Set())
    } else {
      setPlatform('meta')
      setAnaliz(item.analiz)
      setAnalizSecimler(new Set())
    }
    setAnalizDonemAdi(item.donemAdi)
    setAnalizHesapAdi(`${item.hesapAdi} · ${item.tarih}`)
    setAktifTab('analiz')
  }

  function analizAksiyonToggle(idx: number) {
    setAnalizSecimler(prev => {
      const yeni = new Set(prev)
      yeni.has(idx) ? yeni.delete(idx) : yeni.add(idx)
      return yeni
    })
  }

  async function sohbetGonder() {
    if (!sohbetSoru.trim() || sohbetYukleniyor) return
    const soru = sohbetSoru.trim()
    setSohbetSoru('')
    setSohbetYukleniyor(true)
    try {
      const res = await fetch('/api/ai-sohbet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analiz, soru, hesapAdi: analizHesapAdi })
      })
      const data = await res.json()
      setSohbetGecmis(prev => [...prev, { soru, yanit: data.yanit || data.error || 'Yanıt alınamadı' }])
    } catch {
      setSohbetGecmis(prev => [...prev, { soru, yanit: 'Bağlantı hatası, tekrar dene.' }])
    }
    setSohbetYukleniyor(false)
  }

  function optKaydetTamamlandi() {
    setKaydetAcik(false)
    setOptGecmis(kayitlariGetir())
    setAktifTab('optGecmis')
  }

  function optSil(id: string) {
    kayitSil(id)
    setOptGecmis(kayitlariGetir())
  }

  async function takipAl(kayit: OptimizasyonKaydi) {
    setTakipYukleniyor(kayit.id)
    try {
      const res = await fetch(`/api/meta?hesap=${kayit.hesap}&tur=kampanyalar&donem=30`)
      const data = await res.json()
      const kampanyaListesi: Satir[] = data.data || []
      const ilgili = kampanyaListesi.filter(k => kayit.kampanyaIds.includes(k.id))

      if (ilgili.length === 0) {
        alert('Bu kampanyalar artık bulunamadı. Hesap veya kampanya değişmiş olabilir.')
        setTakipYukleniyor(null)
        return
      }

      const harcama = ilgili.reduce((a, k) => a + parseFloat(k.insights?.data[0]?.spend || '0'), 0)
      const gelir = ilgili.reduce((a, k) => a + getGelir(k.insights?.data[0]), 0)
      const donusum = ilgili.reduce((a, k) => a + getDonusum(k.insights?.data[0]), 0)

      const guncellemeler: Partial<OptimizasyonKaydi> = {
        takipTarihi: new Date().toISOString(),
        takipMetriks: { harcama, gelir, roas: harcama > 0 ? gelir / harcama : 0, donusum },
        hatirlatmaGoruldu: true,
      }

      kayitGuncelle(kayit.id, guncellemeler)
      setOptGecmis(kayitlariGetir())
      setHatirlatmalar(vadesiGelenler())
    } catch { alert('Veri çekilemedi, lütfen tekrar dene.') }
    setTakipYukleniyor(null)
  }

  async function aiYorumAl(kayit: OptimizasyonKaydi) {
    if (!kayit.takipMetriks) return
    setAiYorumYukleniyor(kayit.id)
    try {
      const takipTarihi = kayit.takipTarihi ? new Date(kayit.takipTarihi) : new Date()
      const kayitTarihi = new Date(kayit.tarih)
      const gun = Math.round((takipTarihi.getTime() - kayitTarihi.getTime()) / (1000 * 60 * 60 * 24))

      const res = await fetch('/api/ai-karsilastir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          onceki: kayit.metriks,
          sonraki: { ...kayit.takipMetriks, gun },
          yapilanlar: kayit.yapilanlar,
          kampanyaAdlari: kayit.kampanyaAdlari,
          hesap: HESAPLAR.find(h => h.id === kayit.hesap)?.ad || kayit.hesap,
        })
      })
      const data = await res.json()
      if (!data.error) {
        kayitGuncelle(kayit.id, { takipAiYorumu: JSON.stringify(data) })
        setOptGecmis(kayitlariGetir())
      }
    } catch {}
    setAiYorumYukleniyor(null)
  }

  const gFiltreliKampanyalar = gKampanyalar.filter(k =>
    gStatusFiltre === 'hepsi' || (gStatusFiltre === 'aktif' ? k.durum === 2 : k.durum !== 2)
  )
  const metaSeciliSayi = kampanyalar.filter(k => seciliIds.has(k.id)).length
  const gSeciliSayi = gFiltreliKampanyalar.filter(k => gSeciliIds.has(String(k.id))).length
  const seciliSayi = platform === 'meta' ? metaSeciliSayi : gSeciliSayi
  const hepsiSecili = platform === 'meta'
    ? filtreliKampanyalar.length > 0 && filtreliKampanyalar.every(k => seciliIds.has(k.id))
    : gFiltreliKampanyalar.length > 0 && gFiltreliKampanyalar.every(k => gSeciliIds.has(String(k.id)))

  return (
    <div style={{ display: 'flex', background: C.bg, height: '100vh', color: C.text, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <Sidebar />

      <div style={{ flex: 1, marginLeft: '220px', display: 'flex', flexDirection: 'column', height: '100vh' }}>

        {/* HATIRLATMA BANNER */}
        {hatirlatmalar.length > 0 && (
          <div style={{ background: '#FFFBEB', borderBottom: '1px solid #FDE68A', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
            <span style={{ fontSize: '1.1rem' }}>⏰</span>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: '0.83rem', fontWeight: 600, color: '#92400E' }}>
                {hatirlatmalar.length} optimizasyon için takip zamanı!
              </span>
              <span style={{ fontSize: '0.78rem', color: '#A16207', marginLeft: '8px' }}>
                {hatirlatmalar.map(h => HESAPLAR.find(a => a.id === h.hesap)?.ad || h.hesap).join(', ')}
              </span>
            </div>
            <button onClick={() => setAktifTab('optGecmis')} style={{
              background: '#F59E0B', color: '#fff', border: 'none', borderRadius: '7px',
              padding: '6px 14px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600
            }}>
              Günlüğü Aç →
            </button>
            <button onClick={() => {
              hatirlatmalar.forEach(h => kayitGuncelle(h.id, { hatirlatmaGoruldu: true }))
              setHatirlatmalar([])
            }} style={{ background: 'transparent', border: 'none', color: '#A16207', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
          </div>
        )}

        {/* HEADER */}
        <header style={{ background: C.card, borderBottom: `1px solid ${C.border}`, padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '54px', flexShrink: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>🤖 AI Analiz Merkezi</span>
          <div style={{ fontSize: '0.75rem', color: C.muted }}>
            {seciliSayi > 0 && `${seciliSayi} kampanya seçili`}
          </div>
        </header>

        {/* ANA İÇERİK */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* SOL PANEL */}
          <div style={{ width: '320px', flexShrink: 0, borderRight: `1px solid ${C.border}`, overflowY: 'auto', background: C.card, display: 'flex', flexDirection: 'column' }}>

            {/* PLATFORM TOGGLE */}
            <div style={{ padding: '12px 16px 0' }}>
              <div style={{ display: 'flex', gap: '6px', background: C.bg, borderRadius: '10px', padding: '4px' }}>
                <button onClick={() => setPlatform('meta')} style={{
                  flex: 1, padding: '8px', borderRadius: '7px', border: 'none',
                  background: platform === 'meta' ? '#1877F2' : 'transparent',
                  color: platform === 'meta' ? '#fff' : C.muted,
                  cursor: 'pointer', fontSize: '0.82rem', fontWeight: platform === 'meta' ? 700 : 400, transition: 'all 0.15s'
                }}>📘 Meta Ads</button>
                <button onClick={() => setPlatform('google')} style={{
                  flex: 1, padding: '8px', borderRadius: '7px', border: 'none',
                  background: platform === 'google' ? '#4285F4' : 'transparent',
                  color: platform === 'google' ? '#fff' : C.muted,
                  cursor: 'pointer', fontSize: '0.82rem', fontWeight: platform === 'google' ? 700 : 400, transition: 'all 0.15s'
                }}>🔵 Google Ads</button>
              </div>
            </div>

            {/* HESAP */}
            <div style={{ padding: '16px 16px 0' }}>
              <div style={{ fontSize: '0.68rem', color: C.muted, textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.06em', marginBottom: '8px' }}>Hesap</div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {HESAPLAR.map(h => (
                  <button key={h.id} onClick={() => setHesap(h.id)} style={{
                    flex: 1, padding: '8px', borderRadius: '8px', border: `2px solid ${hesap === h.id ? h.renk : C.border}`,
                    background: hesap === h.id ? h.renk + '22' : 'transparent',
                    color: hesap === h.id ? C.text : C.muted,
                    cursor: 'pointer', fontSize: '0.8rem', fontWeight: hesap === h.id ? 600 : 400, transition: 'all 0.15s'
                  }}>{h.emoji} {h.ad}</button>
                ))}
              </div>
            </div>

            {/* DÖNEM */}
            <div style={{ padding: '14px 16px 0' }}>
              <div style={{ fontSize: '0.68rem', color: C.muted, textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.06em', marginBottom: '8px' }}>Dönem</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                {PRESETLER.map(p => (
                  <button key={p.id} onClick={() => setDonem(p.id)} style={{
                    padding: '8px', borderRadius: '7px', border: `1.5px solid ${donem === p.id ? '#7C3AED' : C.border}`,
                    background: donem === p.id ? '#EDE9FE' : 'transparent',
                    color: donem === p.id ? '#7C3AED' : C.muted,
                    cursor: 'pointer', fontSize: '0.8rem', fontWeight: donem === p.id ? 600 : 400, transition: 'all 0.15s'
                  }}>{p.ad}</button>
                ))}
                <button onClick={() => setDonem('ozel')} style={{
                  padding: '8px', borderRadius: '7px', border: `1.5px solid ${donem === 'ozel' ? '#2563EB' : C.border}`,
                  background: donem === 'ozel' ? '#DBEAFE' : 'transparent',
                  color: donem === 'ozel' ? '#1D4ED8' : C.muted,
                  cursor: 'pointer', fontSize: '0.8rem', gridColumn: '1 / -1', transition: 'all 0.15s'
                }}>📅 Özel Tarih Aralığı</button>
              </div>
              {donem === 'ozel' && (
                <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <input type="date" value={baslangic} onChange={e => setBaslangic(e.target.value)}
                    style={{ background: C.input, border: `1px solid ${C.border}`, borderRadius: '6px', color: C.text, padding: '6px 10px', fontSize: '0.8rem' }} />
                  <input type="date" value={bitis} onChange={e => setBitis(e.target.value)}
                    style={{ background: C.input, border: `1px solid ${C.border}`, borderRadius: '6px', color: C.text, padding: '6px 10px', fontSize: '0.8rem' }} />
                  {baslangic && bitis && (
                    <button onClick={yukleKampanyalar} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', padding: '7px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>Uygula</button>
                  )}
                </div>
              )}
            </div>

            {/* DURUM FİLTRE */}
            <div style={{ padding: '14px 16px 0' }}>
              <div style={{ fontSize: '0.68rem', color: C.muted, textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.06em', marginBottom: '8px' }}>Kampanya Durumu</div>
              <div style={{ display: 'flex', gap: '5px' }}>
                {([
                  { id: 'aktif' as StatusFiltre, ad: '● Aktif', renk: '#059669' },
                  { id: 'pasif' as StatusFiltre, ad: '■ Pasif', renk: '#DC2626' },
                  { id: 'hepsi' as StatusFiltre, ad: 'Tümü', renk: C.muted },
                ]).map(s => {
                  const aktif = platform === 'meta' ? statusFiltre === s.id : gStatusFiltre === s.id
                  const onTikla = platform === 'meta' ? () => statusDegistir(s.id) : () => gStatusDegistir(s.id)
                  return (
                    <button key={s.id} onClick={onTikla} style={{
                      flex: 1, padding: '7px 4px', borderRadius: '7px',
                      border: `1.5px solid ${aktif ? s.renk : C.border}`,
                      background: aktif ? s.renk + '15' : 'transparent',
                      color: aktif ? s.renk : C.muted,
                      cursor: 'pointer', fontSize: '0.75rem', fontWeight: aktif ? 600 : 400,
                    }}>{s.ad}</button>
                  )
                })}
              </div>
            </div>

            {/* KAMPANYA LİSTESİ */}
            <div style={{ padding: '14px 16px 0', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ fontSize: '0.68rem', color: C.muted, textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.06em' }}>
                  Kampanyalar
                  {platform === 'meta' && !kampanyaYukleniyor && filtreliKampanyalar.length > 0 && (
                    <span style={{ marginLeft: '6px', color: '#7c3aed', fontWeight: 700 }}>{metaSeciliSayi}/{filtreliKampanyalar.length}</span>
                  )}
                  {platform === 'google' && !gKampanyaYukleniyor && gFiltreliKampanyalar.length > 0 && (
                    <span style={{ marginLeft: '6px', color: '#4285F4', fontWeight: 700 }}>{gSeciliSayi}/{gFiltreliKampanyalar.length}</span>
                  )}
                </div>
                {platform === 'meta' && filtreliKampanyalar.length > 0 && (
                  <button onClick={tumunuToggle} style={{ background: 'transparent', border: 'none', color: '#7c3aed', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}>
                    {hepsiSecili ? 'Kaldır' : 'Tümü'}
                  </button>
                )}
                {platform === 'google' && gFiltreliKampanyalar.length > 0 && (
                  <button onClick={gTumunuToggle} style={{ background: 'transparent', border: 'none', color: '#4285F4', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}>
                    {hepsiSecili ? 'Kaldır' : 'Tümü'}
                  </button>
                )}
              </div>
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', paddingBottom: '8px' }}>
                {/* META LİSTESİ */}
                {platform === 'meta' && (kampanyaYukleniyor ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: C.muted, fontSize: '0.8rem' }}>⏳ Yükleniyor...</div>
                ) : filtreliKampanyalar.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: C.faint, fontSize: '0.8rem' }}>Kampanya bulunamadı</div>
                ) : (
                  filtreliKampanyalar.map(k => {
                    const ins = k.insights?.data[0]
                    const harcama = parseFloat(ins?.spend || '0')
                    const roas = getRoas(ins)
                    const secili = seciliIds.has(k.id)
                    const { harf, renk } = kampanyaSkoru(ins)
                    return (
                      <div key={k.id} onClick={() => kampanyaToggle(k.id)} style={{
                        display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '8px 10px',
                        borderRadius: '8px', cursor: 'pointer', transition: 'background 0.1s',
                        background: secili ? '#7c3aed15' : 'transparent',
                        border: `1px solid ${secili ? '#7c3aed40' : 'transparent'}`,
                      }}>
                        <div style={{ width: '16px', height: '16px', borderRadius: '4px', flexShrink: 0, marginTop: '1px', border: `2px solid ${secili ? '#7c3aed' : C.border}`, background: secili ? '#7c3aed' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {secili && <span style={{ color: '#fff', fontSize: '10px', lineHeight: 1 }}>✓</span>}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.78rem', fontWeight: 500, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '3px' }}>{k.name}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '0.7rem', color: k.status === 'ACTIVE' ? '#059669' : '#DC2626' }}>
                              {k.status === 'ACTIVE' ? '● Aktif' : '■ Pasif'}
                            </span>
                            {harcama > 0 && <span style={{ fontSize: '0.7rem', color: C.muted }}>{para(harcama)}</span>}
                            {roas > 0 && <span style={{ fontSize: '0.7rem', color: roas >= 3 ? '#059669' : roas >= 1.5 ? '#D97706' : '#DC2626', fontWeight: 600 }}>{roas.toFixed(1)}x</span>}
                            {harf !== '—' && <span style={{ fontSize: '0.68rem', fontWeight: 700, color: renk, background: renk + '20', padding: '0 4px', borderRadius: '3px' }}>{harf}</span>}
                          </div>
                        </div>
                      </div>
                    )
                  })
                ))}
                {/* GOOGLE LİSTESİ */}
                {platform === 'google' && (gKampanyaYukleniyor ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: C.muted, fontSize: '0.8rem' }}>⏳ Yükleniyor...</div>
                ) : gFiltreliKampanyalar.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: C.faint, fontSize: '0.8rem' }}>Kampanya bulunamadı</div>
                ) : (
                  gFiltreliKampanyalar.map(k => {
                    const secili = gSeciliIds.has(String(k.id))
                    const roas = parseFloat(k.roas || '0')
                    return (
                      <div key={k.id} onClick={() => gKampanyaToggle(String(k.id))} style={{
                        display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '8px 10px',
                        borderRadius: '8px', cursor: 'pointer', transition: 'background 0.1s',
                        background: secili ? '#4285F415' : 'transparent',
                        border: `1px solid ${secili ? '#4285F440' : 'transparent'}`,
                      }}>
                        <div style={{ width: '16px', height: '16px', borderRadius: '4px', flexShrink: 0, marginTop: '1px', border: `2px solid ${secili ? '#4285F4' : C.border}`, background: secili ? '#4285F4' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {secili && <span style={{ color: '#fff', fontSize: '10px', lineHeight: 1 }}>✓</span>}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.78rem', fontWeight: 500, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '3px' }}>{k.ad}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '0.7rem', color: k.durum === 2 ? '#059669' : '#DC2626' }}>
                              {k.durum === 2 ? '● Aktif' : '■ Pasif'}
                            </span>
                            <span style={{ fontSize: '0.68rem', color: C.faint, background: C.cardHover, padding: '0 5px', borderRadius: '3px' }}>{k.tip}</span>
                            {parseFloat(k.harcama) > 0 && <span style={{ fontSize: '0.7rem', color: C.muted }}>₺{parseFloat(k.harcama).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}</span>}
                            {roas > 0 && <span style={{ fontSize: '0.7rem', color: roas >= 3 ? '#059669' : roas >= 1.5 ? '#D97706' : '#DC2626', fontWeight: 600 }}>{roas.toFixed(1)}x</span>}
                          </div>
                        </div>
                      </div>
                    )
                  })
                ))}
              </div>
            </div>

            {/* ANALİZ BUTONU */}
            <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.border}`, background: C.card, flexShrink: 0 }}>
              <button
                onClick={platform === 'meta' ? analizBaslat : gAnalizBaslat}
                disabled={seciliSayi === 0 || analizYukleniyor}
                style={{
                  width: '100%', padding: '12px', borderRadius: '10px', border: 'none',
                  background: seciliSayi === 0 || analizYukleniyor ? C.cardHover : platform === 'meta' ? '#7c3aed' : '#4285F4',
                  color: seciliSayi === 0 ? C.faint : '#fff',
                  cursor: seciliSayi === 0 || analizYukleniyor ? 'not-allowed' : 'pointer',
                  fontSize: '0.9rem', fontWeight: 700, transition: 'all 0.2s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                }}>
                {analizYukleniyor ? '⏳ Analiz yapılıyor...' : seciliSayi === 0 ? 'Kampanya seç' : `🤖 ${seciliSayi} Kampanyayı Analiz Et`}
              </button>
              {seciliSayi > 0 && !analizYukleniyor && (
                <div style={{ fontSize: '0.7rem', color: C.faint, textAlign: 'center', marginTop: '6px' }}>~10-20 saniye sürebilir</div>
              )}
            </div>
          </div>

          {/* SAĞ İÇERİK */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

            {/* SEKMELER */}
            <div style={{ background: C.card, borderBottom: `1px solid ${C.border}`, padding: '0 24px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              {([
                { id: 'analiz' as SagTab, ad: '📊 Analiz Sonucu' },
                { id: 'aiGecmis' as SagTab, ad: `📋 AI Geçmişi${aiGecmis.length > 0 ? ` (${aiGecmis.length})` : ''}` },
                { id: 'optGecmis' as SagTab, ad: `📓 Opt. Günlüğü${optGecmis.length > 0 ? ` (${optGecmis.length})` : ''}${hatirlatmalar.length > 0 ? ` 🔔` : ''}` },
              ]).map(t => (
                <button key={t.id} onClick={() => setAktifTab(t.id)} style={{
                  padding: '14px 20px', background: 'transparent', border: 'none',
                  borderBottom: `2px solid ${aktifTab === t.id ? '#7C3AED' : 'transparent'}`,
                  color: aktifTab === t.id ? '#7C3AED' : C.muted,
                  cursor: 'pointer', fontSize: '0.85rem', fontWeight: aktifTab === t.id ? 600 : 400,
                  transition: 'all 0.15s', marginBottom: '-1px'
                }}>{t.ad}</button>
              ))}
            </div>

            {/* SEKME İÇERİĞİ */}
            <div style={{ flex: 1, padding: '20px 24px' }}>

              {/* ANALİZ SEKMESİ */}
              {aktifTab === 'analiz' && (
                <>
                  {analizYukleniyor && (
                    <div style={{ textAlign: 'center', padding: '80px 20px' }}>
                      <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🤖</div>
                      <p style={{ fontSize: '1rem', color: C.text, fontWeight: 500 }}>Kampanyalar analiz ediliyor...</p>
                      <p style={{ fontSize: '0.82rem', color: C.faint, marginTop: '8px' }}>{seciliSayi} kampanya · {analizDonemAdi} · 10-20 saniye</p>
                    </div>
                  )}

                  {/* GOOGLE ADS ANALİZ SONUCU */}
                  {!analizYukleniyor && platform === 'google' && gAnaliz && (
                    <>
                      <AiRapor
                        analiz={gAnaliz}
                        hesapAdi={analizHesapAdi}
                        donemAdi={analizDonemAdi}
                        seciliAksiyonlar={gAnalizSecimler}
                        onAksiyonToggle={gAnalizAksiyonToggle}
                        onSoruOner={metin => {
                          setSohbetSoru(metin)
                          setTimeout(() => {
                            document.getElementById('sohbet-input')?.focus()
                            document.getElementById('sohbet-input')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                          }, 50)
                        }}
                      />
                      {/* KAYDET BUTONU */}
                      {!('hata' in gAnaliz) && (
                        <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px' }}>
                          {gAnalizSecimler.size === 0 && (
                            <span style={{ fontSize: '0.75rem', color: C.muted }}>☝️ Yukarıdaki listeden yaptıklarını seç</span>
                          )}
                          <button onClick={() => setGKaydetAcik(true)} style={{
                            background: gAnalizSecimler.size > 0 ? '#4285F4' : C.cardHover,
                            color: gAnalizSecimler.size > 0 ? '#fff' : C.faint,
                            border: 'none', borderRadius: '9px',
                            padding: '10px 22px', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 700,
                            display: 'flex', alignItems: 'center', gap: '7px',
                            boxShadow: gAnalizSecimler.size > 0 ? '0 2px 8px rgba(66,133,244,0.3)' : 'none'
                          }}>
                            📥 {gAnalizSecimler.size > 0 ? `${gAnalizSecimler.size} Aksiyonu Kaydet` : 'Günlüğe Kaydet'}
                          </button>
                        </div>
                      )}
                    </>
                  )}

                  {/* GOOGLE ADS — henüz analiz yok */}
                  {!analizYukleniyor && platform === 'google' && !gAnaliz && (
                    <div style={{ textAlign: 'center', padding: '80px 20px' }}>
                      <div style={{ fontSize: '3rem', marginBottom: '16px', opacity: 0.5 }}>🔵</div>
                      <p style={{ fontSize: '1rem', color: C.muted, fontWeight: 500 }}>Google Ads analizi bekleniyor</p>
                      <p style={{ fontSize: '0.82rem', color: C.faint, marginTop: '8px', maxWidth: '360px', margin: '8px auto 0', lineHeight: '1.6' }}>
                        Soldan Google Ads hesabı, dönem ve kampanyaları seç, ardından &ldquo;Analiz Et&rdquo; butonuna bas
                      </p>
                    </div>
                  )}

                  {/* META — henüz analiz yok */}
                  {!analizYukleniyor && platform === 'meta' && !analiz && (
                    <div style={{ textAlign: 'center', padding: '80px 20px' }}>
                      <div style={{ fontSize: '3rem', marginBottom: '16px', opacity: 0.5 }}>🤖</div>
                      <p style={{ fontSize: '1rem', color: C.muted, fontWeight: 500 }}>Henüz analiz yapılmadı</p>
                      <p style={{ fontSize: '0.82rem', color: C.faint, marginTop: '8px', maxWidth: '360px', margin: '8px auto 0', lineHeight: '1.6' }}>
                        Soldan hesap, dönem ve kampanyaları seç, ardından &ldquo;Analiz Et&rdquo; butonuna bas
                      </p>
                    </div>
                  )}

                  {/* META ANALİZ SONUCU */}
                  {!analizYukleniyor && platform === 'meta' && analiz && (
                    <>
                      <AiRapor
                        analiz={analiz}
                        hesapAdi={analizHesapAdi}
                        donemAdi={analizDonemAdi}
                        seciliAksiyonlar={analizSecimler}
                        onAksiyonToggle={analizAksiyonToggle}
                        onSoruOner={metin => {
                          setSohbetSoru(metin)
                          setTimeout(() => {
                            document.getElementById('sohbet-input')?.focus()
                            document.getElementById('sohbet-input')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                          }, 50)
                        }}
                      />

                      {/* KAYDET BUTONU */}
                      {!('hata' in analiz) && (
                        <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px' }}>
                          {analizSecimler.size === 0 && (
                            <span style={{ fontSize: '0.75rem', color: C.muted }}>
                              ☝️ Yukarıdaki listeden yaptıklarını seç
                            </span>
                          )}
                          <button onClick={() => setKaydetAcik(true)} style={{
                            background: analizSecimler.size > 0 ? '#7C3AED' : C.cardHover,
                            color: analizSecimler.size > 0 ? '#fff' : C.faint,
                            border: 'none', borderRadius: '9px',
                            padding: '10px 22px', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 700,
                            display: 'flex', alignItems: 'center', gap: '7px',
                            boxShadow: analizSecimler.size > 0 ? '0 2px 8px rgba(124,58,237,0.3)' : 'none'
                          }}>
                            📥 {analizSecimler.size > 0 ? `${analizSecimler.size} Aksiyonu Kaydet` : 'Günlüğe Kaydet'}
                          </button>
                        </div>
                      )}

                      {/* SOHBET BÖLÜMÜ */}
                      {!('hata' in analiz) && (
                        <div style={{ marginTop: '20px', background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', overflow: 'hidden' }}>
                          <div style={{ padding: '12px 16px', background: '#F5F3FF', borderBottom: `1px solid #DDD6FE`, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#4C1D95' }}>💬 Bu Analiz Hakkında AI&rsquo;ye Sor</span>
                            <span style={{ fontSize: '0.72rem', color: '#7C3AED' }}>— Aklına takılan bir şey mi var?</span>
                          </div>

                          {/* Geçmiş sorular */}
                          {sohbetGecmis.length > 0 && (
                            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '280px', overflowY: 'auto' }}>
                              {sohbetGecmis.map((item, i) => (
                                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  <div style={{ alignSelf: 'flex-end', background: '#7C3AED', color: '#fff', borderRadius: '10px 10px 2px 10px', padding: '8px 12px', maxWidth: '80%', fontSize: '0.83rem', lineHeight: '1.5' }}>
                                    {item.soru}
                                  </div>
                                  <div style={{ alignSelf: 'flex-start', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '2px 10px 10px 10px', padding: '8px 12px', maxWidth: '85%', fontSize: '0.83rem', lineHeight: '1.6', color: C.text }}>
                                    🤖 {item.yanit}
                                  </div>
                                </div>
                              ))}
                              {sohbetYukleniyor && (
                                <div style={{ alignSelf: 'flex-start', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '2px 10px 10px 10px', padding: '8px 14px', fontSize: '0.83rem', color: C.muted }}>
                                  🤖 Düşünüyor...
                                </div>
                              )}
                            </div>
                          )}

                          {/* Soru girişi */}
                          <div style={{ padding: '12px 16px', borderTop: sohbetGecmis.length > 0 ? `1px solid ${C.border}` : 'none', display: 'flex', gap: '8px' }}>
                            <input
                              type="text"
                              id="sohbet-input"
                              value={sohbetSoru}
                              onChange={e => setSohbetSoru(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sohbetGonder() } }}
                              placeholder="Örn: Bu ROAS neden düşük? Bütçeyi artırsam ne olur?"
                              style={{
                                flex: 1, padding: '8px 12px', borderRadius: '8px',
                                border: `1px solid ${C.border}`, background: C.bg, color: C.text,
                                fontSize: '0.83rem', outline: 'none', fontFamily: 'inherit'
                              }}
                            />
                            <button
                              onClick={sohbetGonder}
                              disabled={!sohbetSoru.trim() || sohbetYukleniyor}
                              style={{
                                background: sohbetSoru.trim() && !sohbetYukleniyor ? '#7C3AED' : C.cardHover,
                                color: sohbetSoru.trim() && !sohbetYukleniyor ? '#fff' : C.faint,
                                border: 'none', borderRadius: '8px', padding: '8px 16px',
                                cursor: sohbetSoru.trim() && !sohbetYukleniyor ? 'pointer' : 'not-allowed',
                                fontSize: '0.83rem', fontWeight: 600, whiteSpace: 'nowrap'
                              }}>
                              {sohbetYukleniyor ? '⏳' : 'Gönder ↵'}
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {/* AI GEÇMİŞİ */}
              {aktifTab === 'aiGecmis' && (
                <>
                  {aiGecmis.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '80px 20px' }}>
                      <div style={{ fontSize: '3rem', marginBottom: '16px', opacity: 0.5 }}>📋</div>
                      <p style={{ fontSize: '1rem', color: C.muted }}>Henüz geçmiş analiz yok</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ fontSize: '0.78rem', color: C.muted, marginBottom: '4px' }}>Son 10 analiz saklanır</div>
                      {aiGecmis.map(item => {
                        const roas = item.analiz.genelRoas ? String(item.analiz.genelRoas) : null
                        const acilSayi = Array.isArray(item.analiz.acil) ? (item.analiz.acil as unknown[]).length : 0
                        const iyiSayi = Array.isArray(item.analiz.iyi) ? (item.analiz.iyi as unknown[]).length : 0
                        return (
                          <div key={item.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', overflow: 'hidden' }}>
                            <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                                  <span style={{ fontWeight: 600, fontSize: '0.88rem', color: C.text }}>{item.hesapAdi}</span>
                                  {item.platform === 'google'
                                    ? <span style={{ fontSize: '0.7rem', color: '#4285F4', background: '#EBF3FE', padding: '2px 7px', borderRadius: '4px', fontWeight: 700 }}>🔵 Google Ads</span>
                                    : <span style={{ fontSize: '0.7rem', color: '#1877F2', background: '#EBF2FF', padding: '2px 7px', borderRadius: '4px', fontWeight: 700 }}>📘 Meta Ads</span>
                                  }
                                  <span style={{ fontSize: '0.72rem', color: '#7C3AED', background: '#EDE9FE', padding: '2px 7px', borderRadius: '4px', fontWeight: 600 }}>{item.donemAdi}</span>
                                </div>
                                <div style={{ fontSize: '0.73rem', color: C.muted, marginBottom: '6px' }}>{item.tarih}</div>
                                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                  {roas && <span style={{ fontSize: '0.75rem', color: C.muted }}>ROAS: <strong style={{ color: '#0284C7' }}>{roas}</strong></span>}
                                  {acilSayi > 0 && <span style={{ fontSize: '0.75rem', color: '#DC2626' }}>🔴 {acilSayi} acil</span>}
                                  {iyiSayi > 0 && <span style={{ fontSize: '0.75rem', color: '#059669' }}>🟢 {iyiSayi} iyi</span>}
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                                <button onClick={() => aiGecmisGoster(item)} style={{ background: item.platform === 'google' ? '#4285F4' : '#7c3aed', color: '#fff', border: 'none', borderRadius: '7px', padding: '7px 14px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>Görüntüle</button>
                                <button onClick={() => aiGecmisSil(item.id)} style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.muted, borderRadius: '7px', padding: '7px 10px', cursor: 'pointer', fontSize: '0.8rem' }}>✕</button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              )}

              {/* OPT. GÜNLÜĞÜ */}
              {aktifTab === 'optGecmis' && (
                <>
                  {optGecmis.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '80px 20px' }}>
                      <div style={{ fontSize: '3rem', marginBottom: '16px', opacity: 0.5 }}>📓</div>
                      <p style={{ fontSize: '1rem', color: C.muted, fontWeight: 500 }}>Henüz kayıt yok</p>
                      <p style={{ fontSize: '0.82rem', color: C.faint, marginTop: '8px', maxWidth: '360px', margin: '8px auto 0', lineHeight: '1.6' }}>
                        Analiz yaptıktan sonra &ldquo;📥 Günlüğe Kaydet&rdquo; butonuyla optimizasyonları kaydet.
                        Sonra &ldquo;Takip Al&rdquo; ile sonuçları ölç.
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <div style={{ fontSize: '0.78rem', color: C.muted }}>{optGecmis.length} kayıt</div>
                        {hatirlatmalar.length > 0 && (
                          <div style={{ fontSize: '0.78rem', color: '#92400E', background: '#FFFBEB', padding: '3px 10px', borderRadius: '6px', border: '1px solid #FDE68A' }}>
                            ⏰ {hatirlatmalar.length} takip bekliyor
                          </div>
                        )}
                      </div>
                      {optGecmis.map(kayit => (
                        <GunlukKart
                          key={kayit.id}
                          kayit={kayit}
                          onSil={id => { optSil(id); }}
                          onDuzenle={() => {}}
                          onTakipAl={takipAl}
                          onAiYorum={aiYorumAl}
                          takipYukleniyor={takipYukleniyor}
                          aiYorumYukleniyor={aiYorumYukleniyor}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}

            </div>
          </div>
        </div>
      </div>

      {/* META KAYDET PANEL */}
      {kaydetAcik && analiz && (
        <KaydetPanel
          analiz={analiz}
          hesap={analizHesap}
          donemAdi={analizDonemAdi}
          kampanyalar={kampanyalar}
          seciliIds={seciliIds}
          initialSecimler={analizSecimler}
          onKapat={() => setKaydetAcik(false)}
          onKaydet={optKaydetTamamlandi}
        />
      )}

      {/* GOOGLE KAYDET PANEL */}
      {gKaydetAcik && gAnaliz && (
        <KaydetPanel
          analiz={gAnaliz}
          hesap={analizHesap}
          donemAdi={analizDonemAdi}
          kampanyalar={[]}
          seciliIds={new Set()}
          initialSecimler={gAnalizSecimler}
          onKapat={() => setGKaydetAcik(false)}
          onKaydet={gOptKaydetTamamlandi}
          preMetriks={{
            harcama: gKampanyalar.filter(k => gSeciliIds.has(String(k.id))).reduce((a, k) => a + parseFloat(k.harcama || '0'), 0),
            gelir: gKampanyalar.filter(k => gSeciliIds.has(String(k.id))).reduce((a, k) => a + parseFloat(k.gelir || '0'), 0),
            roas: (() => {
              const h = gKampanyalar.filter(k => gSeciliIds.has(String(k.id))).reduce((a, k) => a + parseFloat(k.harcama || '0'), 0)
              const g = gKampanyalar.filter(k => gSeciliIds.has(String(k.id))).reduce((a, k) => a + parseFloat(k.gelir || '0'), 0)
              return h > 0 ? g / h : 0
            })(),
            donusum: gKampanyalar.filter(k => gSeciliIds.has(String(k.id))).reduce((a, k) => a + (k.donusum || 0), 0),
          }}
          gKampanyaIds={gKampanyalar.filter(k => gSeciliIds.has(String(k.id))).map(k => String(k.id))}
          gKampanyaAdlari={gKampanyalar.filter(k => gSeciliIds.has(String(k.id))).map(k => k.ad)}
        />
      )}

      <style>{`
        @keyframes progress {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(0%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  )
}
