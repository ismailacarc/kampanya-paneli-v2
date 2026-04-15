'use client'

import { C } from '../lib/theme'

interface Props {
  analiz: Record<string, unknown>
  hesapAdi: string
  donemAdi: string
  onKapat?: () => void
  seciliAksiyonlar?: Set<number>
  onAksiyonToggle?: (globalIdx: number) => void
  onSoruOner?: (metin: string) => void  // 💬 butonu callback'i
}

export default function AiRapor({ analiz, hesapAdi, donemAdi, onKapat, seciliAksiyonlar, onAksiyonToggle, onSoruOner }: Props) {
  const kontrollu = seciliAksiyonlar !== undefined && onAksiyonToggle !== undefined

  // Bölümlerin kaçıncı global index'ten başladığını hesapla
  const acil = Array.isArray(analiz.acil) ? (analiz.acil as Record<string, unknown>[]) : []
  const iyilestir = Array.isArray(analiz.iyilestir) ? (analiz.iyilestir as Record<string, unknown>[]) : []
  const stratejik = Array.isArray(analiz.stratejik) ? (analiz.stratejik as string[]) : []

  const acilToplamAksiyon = acil.reduce((t, item) =>
    t + (Array.isArray(item.aksiyonlar) ? (item.aksiyonlar as string[]).length : 0), 0)
  const iyilestirToplamAksiyon = iyilestir.reduce((t, item) =>
    t + (Array.isArray(item.aksiyonlar) ? (item.aksiyonlar as string[]).length : 0), 0)

  // Her bölüm için global index başlangıcı
  const iyilestirOffset = acilToplamAksiyon
  const stratejikOffset = acilToplamAksiyon + iyilestirToplamAksiyon

  return (
    <div style={{ background: C.card, border: '1px solid #DDD6FE', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      {/* Başlık */}
      <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F5F3FF' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#4C1D95' }}>🤖 AI Raporu — {hesapAdi}</span>
          {donemAdi && (
            <span style={{ fontSize: '0.72rem', color: '#7C3AED', background: '#EDE9FE', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
              {donemAdi}
            </span>
          )}
        </div>
        {kontrollu && (
          <span style={{ fontSize: '0.72rem', color: seciliAksiyonlar!.size > 0 ? '#7C3AED' : '#9CA3AF' }}>
            {seciliAksiyonlar!.size > 0 ? `${seciliAksiyonlar!.size} aksiyon seçili` : 'Günlüğe eklemek istediklerini işaretle'}
          </span>
        )}
        {onKapat && (
          <button onClick={onKapat} style={{ background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1 }}>✕</button>
        )}
      </div>

      <div style={{ padding: '20px 24px' }}>
        {(typeof analiz !== 'object' || analiz === null) ? (
          <div style={{ color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '12px 16px' }}>
            ❌ AI yanıtı işlenemedi. Lütfen tekrar deneyin.
          </div>
        ) : 'hata' in analiz ? (
          <div style={{ color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '12px 16px' }}>
            ❌ {String(analiz.hata)}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

            {/* ÖZET */}
            <div style={{ background: C.sectionPurple, border: '1px solid #DDD6FE', borderRadius: '10px', padding: '16px 20px' }}>
              <div style={{ fontSize: '0.72rem', color: '#6D28D9', marginBottom: '8px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em' }}>📊 Genel Değerlendirme</div>
              <p style={{ fontSize: '0.88rem', lineHeight: '1.65', color: C.text, margin: 0 }}>{String(analiz.ozet || '')}</p>
              <div style={{ display: 'flex', gap: '10px', marginTop: '14px', flexWrap: 'wrap' }}>
                {[
                  { b: 'Toplam Harcama', d: String(analiz.toplamHarcama || ''), r: '#C2410C', bg: '#FFF7ED' },
                  { b: 'Toplam Gelir', d: String(analiz.toplamGelir || ''), r: '#059669', bg: '#F0FDF4' },
                  { b: 'Genel ROAS', d: String(analiz.genelRoas || ''), r: '#0284C7', bg: '#EFF6FF' },
                ].map((k, i) => (
                  <div key={i} style={{ background: k.bg, border: `1px solid ${k.r}30`, borderRadius: '8px', padding: '10px 16px', minWidth: '110px' }}>
                    <div style={{ fontSize: '0.68rem', color: C.muted, marginBottom: '4px', fontWeight: 500 }}>{k.b}</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: k.r }}>{k.d}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ACİL */}
            {acil.length > 0 && (
              <div style={{ background: C.sectionRed, border: '1px solid #FECACA', borderRadius: '10px', padding: '16px 20px' }}>
                <div style={{ fontSize: '0.72rem', color: '#B91C1C', marginBottom: '12px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em' }}>🔴 Acil Önlem Gerekenler</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {acil.map((item, i) => {
                    // Bu item'ın aksiyonları kaçıncı global index'ten başlıyor?
                    const itemOffset = acil.slice(0, i).reduce((t, prev) =>
                      t + (Array.isArray(prev.aksiyonlar) ? (prev.aksiyonlar as string[]).length : 0), 0)
                    return (
                      <div key={i} style={{ background: C.card, borderRadius: '8px', padding: '12px 16px', border: '1px solid #FEE2E2' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: '4px', color: '#991B1B' }}>📌 {String(item.kampanya || '')}</div>
                        <div style={{ fontSize: '0.8rem', color: C.muted, marginBottom: '8px' }}>{String(item.sorun || '')}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                          {Array.isArray(item.aksiyonlar) && (item.aksiyonlar as string[]).map((a, j) => {
                            const gIdx = itemOffset + j
                            const secili = kontrollu ? seciliAksiyonlar!.has(gIdx) : undefined
                            const baglamMetin = `[${String(item.kampanya || '')}] Sorun: "${String(item.sorun || '')}" — Öneri: "${a}" — `
                            return (
                              <div key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', padding: kontrollu ? '4px 6px' : '0', borderRadius: '6px', background: kontrollu && secili ? '#FEE2E2' : 'transparent', transition: 'background 0.1s' }}>
                                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', flex: 1 }}>
                                  <input
                                    type="checkbox"
                                    checked={secili}
                                    onChange={kontrollu ? () => onAksiyonToggle!(gIdx) : undefined}
                                    style={{ marginTop: '3px', accentColor: '#DC2626', width: '14px', height: '14px', flexShrink: 0 }}
                                  />
                                  <span style={{ fontSize: '0.83rem', color: C.text, lineHeight: '1.5' }}>{a}</span>
                                </label>
                                {onSoruOner && (
                                  <button onClick={() => onSoruOner(baglamMetin)} title="Bu aksiyon hakkında AI'ye sor" style={{ background: 'transparent', border: '1px solid #FECACA', borderRadius: '5px', color: '#DC2626', cursor: 'pointer', fontSize: '0.7rem', padding: '2px 6px', flexShrink: 0, marginTop: '2px', opacity: 0.7 }}>
                                    💬
                                  </button>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* İYİLEŞTİR */}
            {iyilestir.length > 0 && (
              <div style={{ background: C.sectionYellow, border: '1px solid #FDE68A', borderRadius: '10px', padding: '16px 20px' }}>
                <div style={{ fontSize: '0.72rem', color: '#92400E', marginBottom: '12px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em' }}>🟡 İyileştirilmesi Gerekenler</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {iyilestir.map((item, i) => {
                    const itemOffset = iyilestirOffset + iyilestir.slice(0, i).reduce((t, prev) =>
                      t + (Array.isArray(prev.aksiyonlar) ? (prev.aksiyonlar as string[]).length : 0), 0)
                    return (
                      <div key={i} style={{ background: C.card, borderRadius: '8px', padding: '12px 16px', border: '1px solid #FDE68A' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: '4px', color: '#92400E' }}>📌 {String(item.kampanya || '')}</div>
                        <div style={{ fontSize: '0.8rem', color: C.muted, marginBottom: '8px' }}>{String(item.sorun || '')}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                          {Array.isArray(item.aksiyonlar) && (item.aksiyonlar as string[]).map((a, j) => {
                            const gIdx = itemOffset + j
                            const secili = kontrollu ? seciliAksiyonlar!.has(gIdx) : undefined
                            const baglamMetin = `[${String(item.kampanya || '')}] Sorun: "${String(item.sorun || '')}" — Öneri: "${a}" — `
                            return (
                              <div key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', padding: kontrollu ? '4px 6px' : '0', borderRadius: '6px', background: kontrollu && secili ? '#FFFBEB' : 'transparent', transition: 'background 0.1s' }}>
                                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', flex: 1 }}>
                                  <input
                                    type="checkbox"
                                    checked={secili}
                                    onChange={kontrollu ? () => onAksiyonToggle!(gIdx) : undefined}
                                    style={{ marginTop: '3px', accentColor: '#D97706', width: '14px', height: '14px', flexShrink: 0 }}
                                  />
                                  <span style={{ fontSize: '0.83rem', color: C.text, lineHeight: '1.5' }}>{a}</span>
                                </label>
                                {onSoruOner && (
                                  <button onClick={() => onSoruOner(baglamMetin)} title="Bu aksiyon hakkında AI'ye sor" style={{ background: 'transparent', border: '1px solid #FDE68A', borderRadius: '5px', color: '#D97706', cursor: 'pointer', fontSize: '0.7rem', padding: '2px 6px', flexShrink: 0, marginTop: '2px', opacity: 0.7 }}>
                                    💬
                                  </button>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* İYİ PERFORMANS */}
            {Array.isArray(analiz.iyi) && (analiz.iyi as Record<string, unknown>[]).length > 0 && (
              <div style={{ background: C.sectionGreen, border: '1px solid #A7F3D0', borderRadius: '10px', padding: '16px 20px' }}>
                <div style={{ fontSize: '0.72rem', color: '#065F46', marginBottom: '12px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em' }}>🟢 İyi Performans Gösterenler</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {(analiz.iyi as Record<string, unknown>[]).map((item, i) => (
                    <div key={i} style={{ background: C.card, borderRadius: '8px', padding: '12px 16px', border: '1px solid #A7F3D0' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#065F46', marginBottom: '4px' }}>🏆 {String(item.kampanya || '')}</div>
                      <div style={{ fontSize: '0.8rem', color: C.muted, marginBottom: '4px' }}>{String(item.neden || '')}</div>
                      <div style={{ fontSize: '0.82rem', color: '#059669', fontWeight: 500 }}>💡 {String(item.oneri || '')}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* STRATEJİK ÖNERİLER */}
            {stratejik.length > 0 && (
              <div style={{ background: C.sectionBlue, border: '1px solid #BAE6FD', borderRadius: '10px', padding: '16px 20px' }}>
                <div style={{ fontSize: '0.72rem', color: '#0369A1', marginBottom: '12px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em' }}>💡 Stratejik Öneriler</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {stratejik.map((oneri, i) => {
                    const gIdx = stratejikOffset + i
                    const secili = kontrollu ? seciliAksiyonlar!.has(gIdx) : undefined
                    const baglamMetin = `Stratejik öneri: "${oneri}" — `
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', padding: kontrollu ? '4px 6px' : '0', borderRadius: '6px', background: kontrollu && secili ? '#EFF6FF' : 'transparent', transition: 'background 0.1s' }}>
                        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', flex: 1 }}>
                          <input
                            type="checkbox"
                            checked={secili}
                            onChange={kontrollu ? () => onAksiyonToggle!(gIdx) : undefined}
                            style={{ marginTop: '3px', accentColor: '#0284C7', width: '14px', height: '14px', flexShrink: 0 }}
                          />
                          <span style={{ fontSize: '0.85rem', color: C.text, lineHeight: '1.55' }}>{oneri}</span>
                        </label>
                        {onSoruOner && (
                          <button onClick={() => onSoruOner(baglamMetin)} title="Bu öneri hakkında AI'ye sor" style={{ background: 'transparent', border: '1px solid #BAE6FD', borderRadius: '5px', color: '#0284C7', cursor: 'pointer', fontSize: '0.7rem', padding: '2px 6px', flexShrink: 0, marginTop: '2px', opacity: 0.7 }}>
                            💬
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* BÜTÇE DAĞILIMI */}
            {Array.isArray(analiz.butce) && (analiz.butce as Record<string, unknown>[]).length > 0 && (
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '16px 20px' }}>
                <div style={{ fontSize: '0.72rem', color: C.muted, marginBottom: '12px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em' }}>📈 Önerilen Bütçe Dağılımı</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {(analiz.butce as Record<string, unknown>[]).map((item, i) => (
                    <div key={i}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                        <span style={{ fontSize: '0.83rem', color: C.text, fontWeight: 500 }}>{String(item.kategori || '')}</span>
                        <span style={{ fontSize: '0.83rem', fontWeight: 700, color: '#0284C7' }}>%{String(item.yuzde || '')}</span>
                      </div>
                      <div style={{ background: C.borderLight, borderRadius: '4px', height: '8px' }}>
                        <div style={{ background: 'linear-gradient(90deg, #0F4C81, #0284C7)', borderRadius: '4px', height: '8px', width: `${item.yuzde}%`, transition: 'width 0.6s ease' }} />
                      </div>
                      <div style={{ fontSize: '0.73rem', color: C.faint, marginTop: '3px' }}>{String(item.aciklama || '')}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  )
}
