'use client'

import { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import { globalModelOku, MODELLER } from '../components/Sidebar'
import { C } from '../lib/theme'
import { HESAPLAR } from '../lib/types'

// ─── Tipler ──────────────────────────────────────────────────────
interface KreatifKart {
  id: string
  ad: string
  metin: string
  baslik: string
  cta: string
  thumbnail: string   // en yüksek kaliteli URL
  format: string
  harcama: number
  gosteriminSayisi: number
  tiklama: number
  ctr: number
  cpc: number
  cpm: number
  frequency: number
  satis: number
  gelir: number
  roas: number
  video: boolean
}

interface SiralamaSecenegi {
  id: string
  ad: string
  icon: string
  aciklama: string
  yuksekIyi: boolean
}

const SIRALAMAR: SiralamaSecenegi[] = [
  { id: 'ctr',   ad: 'CTR',   icon: '👆', aciklama: 'Tıklama Oranı',          yuksekIyi: true  },
  { id: 'satis', ad: 'Satış', icon: '🛒', aciklama: 'Satın Alma Sayısı',       yuksekIyi: true  },
  { id: 'roas',  ad: 'ROAS',  icon: '💰', aciklama: 'Harcama Verimliliği',     yuksekIyi: true  },
  { id: 'cpc',   ad: 'CPC',   icon: '🖱️', aciklama: 'Tıklama Başı Maliyet',   yuksekIyi: false },
]

// ─── Yardımcılar ─────────────────────────────────────────────────
function metrikDeger(k: KreatifKart, id: string): number {
  switch (id) {
    case 'ctr':   return k.ctr
    case 'satis': return k.satis
    case 'roas':  return k.roas
    case 'cpc':   return k.cpc === 0 ? 9999 : k.cpc
    default: return 0
  }
}

function metrikGoster(k: KreatifKart, id: string): string {
  switch (id) {
    case 'ctr':   return `%${k.ctr.toFixed(2)}`
    case 'satis': return `${k.satis} satış`
    case 'roas':  return `${k.roas.toFixed(2)}x`
    case 'cpc':   return `${k.cpc.toFixed(2)} ₺`
    default: return '—'
  }
}

function formatBelirle(ad: string): string {
  const lower = ad.toLowerCase()
  if (lower.includes('story') || lower.includes('hikaye')) return 'Story'
  if (lower.includes('reel') || lower.includes('video')) return 'Reels'
  if (lower.includes('katalog') || lower.includes('catalog') || lower.includes('dpa')) return 'Katalog'
  return 'Feed'
}

// En iyi kaliteli görsel URL'yi seç
function enIyiGorsel(creative?: {
  image_url?: string
  thumbnail_url?: string
  picture?: string
  object_story_spec?: {
    link_data?: { picture?: string }
    video_data?: { image_url?: string; thumbnail_url?: string }
  }
}): string {
  if (!creative) return ''
  // Tercih sırası: yüksek res → düşük res
  return (
    creative.picture ||                                              // en yüksek res (doğrudan picture)
    creative.object_story_spec?.link_data?.picture ||              // statik reklam görseli
    creative.object_story_spec?.video_data?.image_url ||           // video kapak görseli
    creative.object_story_spec?.video_data?.thumbnail_url ||       // video thumbnail
    creative.image_url ||
    creative.thumbnail_url ||
    ''
  )
}

// ─── Markdown Renderer ────────────────────────────────────────────
function bold(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((p, i) =>
    p.startsWith('**') && p.endsWith('**')
      ? <strong key={i}>{p.slice(2, -2)}</strong>
      : p
  )
}

function AIMetin({ text }: { text: string }) {
  const lines = text.split('\n')
  const els: React.ReactNode[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) { els.push(<div key={i} style={{ height: '8px' }} />); i++; continue }
    if (line.startsWith('## ')) { els.push(<div key={i} style={{ fontWeight: 800, fontSize: '0.88rem', color: C.primary, marginTop: '16px', marginBottom: '6px', borderBottom: `1px solid ${C.border}`, paddingBottom: '4px' }}>{bold(line.slice(3))}</div>); i++; continue }
    if (line.startsWith('### ')) { els.push(<div key={i} style={{ fontWeight: 700, fontSize: '0.84rem', color: C.text, marginTop: '12px', marginBottom: '4px' }}>{bold(line.slice(4))}</div>); i++; continue }
    if (line.match(/^(\d+)\.\s/)) {
      const items: string[] = []
      while (i < lines.length && lines[i].match(/^(\d+)\.\s/)) {
        items.push(lines[i].replace(/^\d+\.\s/, '')); i++
      }
      els.push(<ol key={`ol${i}`} style={{ margin: '6px 0', paddingLeft: '20px' }}>{items.map((item, ii) => <li key={ii} style={{ fontSize: '0.82rem', lineHeight: 1.65, marginBottom: '4px', color: C.text }}>{bold(item)}</li>)}</ol>)
      continue
    }
    if (line.match(/^[-•]\s/)) {
      const items: string[] = []
      while (i < lines.length && lines[i].match(/^[-•]\s/)) {
        items.push(lines[i].replace(/^[-•]\s/, '')); i++
      }
      els.push(<ul key={`ul${i}`} style={{ margin: '6px 0', paddingLeft: '18px', listStyle: 'disc' }}>{items.map((item, ii) => <li key={ii} style={{ fontSize: '0.82rem', lineHeight: 1.65, marginBottom: '3px', color: C.text }}>{bold(item)}</li>)}</ul>)
      continue
    }
    if (/^---+$/.test(line.trim())) { els.push(<hr key={i} style={{ border: 'none', borderTop: `1px solid ${C.border}`, margin: '10px 0' }} />); i++; continue }
    els.push(<p key={i} style={{ fontSize: '0.82rem', lineHeight: 1.7, color: C.muted, margin: '2px 0' }}>{bold(line)}</p>)
    i++
  }
  return <div>{els}</div>
}

// ─── Detay + AI Analiz Modal ──────────────────────────────────────
function DetayModal({
  kart, hesap, donem, model, onKapat
}: {
  kart: KreatifKart
  hesap: string
  donem: number
  model: string
  onKapat: () => void
}) {
  const [analiz, setAnaliz] = useState('')
  const [yukleniyor, setYukleniyor] = useState(false)
  const secilenModel = MODELLER.find(m => m.id === model) || MODELLER[1]

  async function aiAnalizYap() {
    setYukleniyor(true)
    setAnaliz('')
    try {
      const res = await fetch('/api/kreatif-performans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mod: 'tekli',
          kart: {
            ad: kart.ad, metin: kart.metin, baslik: kart.baslik, cta: kart.cta,
            ctr: kart.ctr.toFixed(2), satis: String(kart.satis),
            roas: kart.roas.toFixed(2), harcama: kart.harcama.toFixed(0),
            cpc: kart.cpc.toFixed(2), cpm: kart.cpm.toFixed(2),
            frequency: kart.frequency.toFixed(1), format: kart.format,
            video: kart.video
          },
          hesap, donem, model
        })
      })
      const data = await res.json()
      setAnaliz(data.analiz || 'Analiz alınamadı.')
    } catch {
      setAnaliz('Bağlantı hatası.')
    }
    setYukleniyor(false)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: '20px'
    }} onClick={onKapat}>
      <div style={{
        background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '620px',
        maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 24px 64px rgba(0,0,0,0.25)'
      }} onClick={e => e.stopPropagation()}>

        {/* Görsel — tam boyut */}
        {kart.thumbnail && (
          <div style={{ position: 'relative', width: '100%', maxHeight: '320px', overflow: 'hidden', borderRadius: '16px 16px 0 0', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src={kart.thumbnail} alt={kart.ad} style={{ width: '100%', maxHeight: '320px', objectFit: 'contain' }} />
            {kart.video && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <div style={{ background: 'rgba(0,0,0,0.5)', borderRadius: '50%', width: '56px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem' }}>▶️</div>
              </div>
            )}
            {kart.video && (
              <div style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.7)', color: '#fff', borderRadius: '6px', padding: '3px 8px', fontSize: '0.7rem', fontWeight: 700 }}>
                🎬 Video Reklam
              </div>
            )}
          </div>
        )}

        <div style={{ padding: '20px' }}>
          {/* Başlık + Kapat */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
            <div style={{ flex: 1, paddingRight: '12px' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: C.text, marginBottom: '2px' }}>{kart.ad}</div>
              <div style={{ fontSize: '0.68rem', color: C.faint }}>{kart.format} · {kart.video ? 'Video' : 'Statik'}</div>
            </div>
            <button onClick={onKapat} style={{ background: '#f3f4f6', border: 'none', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', fontSize: '0.78rem', color: C.muted, flexShrink: 0 }}>✕ Kapat</button>
          </div>

          {/* Reklam metni */}
          {kart.baslik && <div style={{ fontWeight: 700, fontSize: '0.82rem', color: C.text, marginBottom: '4px' }}>🔤 {kart.baslik}</div>}
          {kart.metin && (
            <div style={{ fontSize: '0.78rem', color: C.muted, lineHeight: 1.6, background: '#f9fafb', borderRadius: '8px', padding: '10px 12px', marginBottom: '6px' }}>
              {kart.metin}
            </div>
          )}
          {kart.cta && <div style={{ fontSize: '0.7rem', color: C.faint, marginBottom: '14px' }}>CTA: <strong style={{ color: C.text }}>{kart.cta}</strong></div>}

          {/* Metrikler */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '18px' }}>
            {[
              { label: 'Harcama', val: `${kart.harcama.toLocaleString('tr-TR')} ₺` },
              { label: 'CTR',     val: `%${kart.ctr.toFixed(2)}` },
              { label: 'Satış',   val: `${kart.satis}` },
              { label: 'ROAS',    val: `${kart.roas.toFixed(2)}x` },
              { label: 'CPC',     val: `${kart.cpc.toFixed(2)} ₺` },
              { label: 'CPM',     val: `${kart.cpm.toFixed(2)} ₺` },
              { label: 'Gösterim',val: kart.gosteriminSayisi.toLocaleString('tr-TR') },
              { label: 'Frequency',val: `${kart.frequency.toFixed(1)}x` },
            ].map(m => (
              <div key={m.label} style={{ background: '#f9fafb', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.58rem', color: C.faint, fontWeight: 700, marginBottom: '2px', textTransform: 'uppercase' }}>{m.label}</div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: C.text }}>{m.val}</div>
              </div>
            ))}
          </div>

          {/* AI Analiz */}
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: analiz ? '12px' : '0' }}>
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: C.text }}>🤖 Bu Reklamı Analiz Et</div>
                <div style={{ fontSize: '0.65rem', color: C.faint, marginTop: '2px' }}>
                  Bu görselin neden iyi/kötü çalıştığını grafiker dilinde açıkla
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 600, color: C.primary, background: C.primary + '12', padding: '3px 8px', borderRadius: '6px' }}>
                  {secilenModel.icon} {secilenModel.ad}
                </span>
                <button onClick={aiAnalizYap} disabled={yukleniyor} style={{
                  padding: '7px 14px', borderRadius: '8px',
                  background: yukleniyor ? C.border : '#7C3AED',
                  color: '#fff', border: 'none', cursor: yukleniyor ? 'not-allowed' : 'pointer',
                  fontSize: '0.78rem', fontWeight: 700
                }}>
                  {yukleniyor ? '⏳ Analiz...' : '✨ Analiz Et'}
                </button>
              </div>
            </div>

            {analiz && (
              <div style={{ background: '#FAFAFF', border: `1px solid #E9D5FF`, borderRadius: '10px', padding: '14px' }}>
                <AIMetin text={analiz} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Kreatif Kart ─────────────────────────────────────────────────
function KreatifKartBileseni({
  kart, sira, tip, siralamaId, onClick
}: {
  kart: KreatifKart
  sira: number
  tip: 'iyi' | 'zayif'
  siralamaId: string
  onClick: (k: KreatifKart) => void
}) {
  const iyi = tip === 'iyi'
  const renk = iyi ? '#15803D' : '#DC2626'
  const bg = iyi ? '#F0FDF4' : '#FEF2F2'
  const siralama = SIRALAMAR.find(s => s.id === siralamaId)!

  return (
    <div style={{
      background: '#fff', borderRadius: '12px', overflow: 'hidden',
      border: `1px solid ${iyi ? '#BBF7D0' : '#FECACA'}`,
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      transition: 'all 0.15s'
    }}>
      {/* Görsel — objectFit: contain + siyah bg → blur olmaz */}
      <div
        onClick={() => onClick(kart)}
        style={{ position: 'relative', width: '100%', aspectRatio: '4/3', background: '#111', overflow: 'hidden', cursor: 'pointer' }}
        onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.opacity = '0.9'}
        onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.opacity = '1'}
      >
        {kart.thumbnail ? (
          <>
            <img
              src={kart.thumbnail}
              alt={kart.ad}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              onError={e => {
                (e.target as HTMLImageElement).style.display = 'none';
                const parent = (e.target as HTMLImageElement).parentElement;
                if (parent) {
                  const el = document.createElement('div');
                  el.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:2.5rem;';
                  el.textContent = kart.video ? '🎬' : '🖼️';
                  parent.appendChild(el);
                }
              }}
            />
            {/* Video overlay */}
            {kart.video && (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                pointerEvents: 'none'
              }}>
                <div style={{
                  width: '44px', height: '44px', borderRadius: '50%',
                  background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.3rem'
                }}>▶️</div>
              </div>
            )}
          </>
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem' }}>
            {kart.video ? '🎬' : '🖼️'}
          </div>
        )}

        {/* Rank badge */}
        <div style={{ position: 'absolute', top: '8px', left: '8px', background: renk, color: '#fff', borderRadius: '20px', padding: '3px 10px', fontSize: '0.68rem', fontWeight: 800 }}>
          {iyi ? `#${sira} En İyi` : `#${sira} En Zayıf`}
        </div>
        {/* Format badge */}
        <div style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.7)', color: '#fff', borderRadius: '6px', padding: '2px 7px', fontSize: '0.63rem', fontWeight: 600 }}>
          {kart.format}
        </div>
        {/* Metrik overlay */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: `linear-gradient(to top, ${renk}f0, ${renk}40, transparent)`,
          padding: '28px 10px 8px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end'
        }}>
          <div>
            <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.85)' }}>{siralama.icon} {siralama.ad}</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff' }}>{metrikGoster(kart, siralamaId)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.85)' }}>Harcama</div>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff' }}>{kart.harcama.toLocaleString('tr-TR')} ₺</div>
          </div>
        </div>
      </div>

      {/* Alt bilgi */}
      <div style={{ padding: '10px 12px 12px' }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 600, color: C.text, marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{kart.ad}</div>
        {kart.metin && (
          <div style={{ fontSize: '0.65rem', color: C.muted, marginBottom: '8px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.4 }}>
            {kart.metin}
          </div>
        )}

        {/* Metrik grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px', marginBottom: '8px' }}>
          {[
            { label: 'CTR',   val: `%${kart.ctr.toFixed(2)}` },
            { label: 'Satış', val: `${kart.satis}` },
            { label: 'ROAS',  val: `${kart.roas.toFixed(1)}x` },
          ].map(m => (
            <div key={m.label} style={{ background: bg, borderRadius: '6px', padding: '4px 6px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.56rem', color: renk, fontWeight: 700 }}>{m.label}</div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: C.text }}>{m.val}</div>
            </div>
          ))}
        </div>

        {/* Detay + Analiz butonları */}
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={() => onClick(kart)} style={{
            flex: 1, padding: '5px', borderRadius: '6px', cursor: 'pointer',
            border: `1px solid ${C.border}`, background: 'transparent',
            color: C.muted, fontSize: '0.68rem', fontWeight: 600
          }}>
            🔍 Detay
          </button>
          <button onClick={() => onClick(kart)} style={{
            flex: 1, padding: '5px', borderRadius: '6px', cursor: 'pointer',
            border: `1px solid #7C3AED30`, background: '#7C3AED08',
            color: '#7C3AED', fontSize: '0.68rem', fontWeight: 700
          }}>
            ✨ AI Analiz
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Genel AI Analiz ─────────────────────────────────────────────
function GenelAnaliz({ iyiler, zayiflar, hesap, donem, model, siralama }: {
  iyiler: KreatifKart[]
  zayiflar: KreatifKart[]
  hesap: string
  donem: number
  model: string
  siralama: SiralamaSecenegi
}) {
  const [analiz, setAnaliz] = useState('')
  const [yukleniyor, setYukleniyor] = useState(false)
  const secilenModel = MODELLER.find(m => m.id === model) || MODELLER[1]

  async function aiAnalizYap() {
    setYukleniyor(true); setAnaliz('')
    const fmt = (k: KreatifKart) => ({
      ad: k.ad, metin: k.metin.slice(0, 120), ctr: k.ctr.toFixed(2),
      satis: String(k.satis), roas: k.roas.toFixed(2), harcama: k.harcama.toFixed(0),
      cpc: k.cpc.toFixed(2), format: k.format
    })
    try {
      const res = await fetch('/api/kreatif-performans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mod: 'genel', iyiler: iyiler.map(fmt), zayiflar: zayiflar.map(fmt), hesap, donem, siralamaMetrigi: siralama.ad, model })
      })
      const data = await res.json()
      setAnaliz(data.analiz || 'Analiz alınamadı.')
    } catch { setAnaliz('Bağlantı hatası.') }
    setYukleniyor(false)
  }

  return (
    <div style={{ background: C.card, borderRadius: '14px', border: `1px solid ${C.border}`, padding: '18px 20px', marginBottom: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: C.text }}>🤖 Genel Grafiker Analizi</div>
          <div style={{ fontSize: '0.67rem', color: C.faint, marginTop: '2px' }}>En iyi & en zayıf kreatiflerin karşılaştırmalı analizi + grafiker önerileri</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: C.primary, background: C.primary + '12', padding: '3px 8px', borderRadius: '6px' }}>
            {secilenModel.icon} {secilenModel.ad}
          </span>
          <button onClick={aiAnalizYap} disabled={yukleniyor} style={{
            padding: '8px 18px', borderRadius: '8px',
            background: yukleniyor ? C.border : '#7C3AED',
            color: '#fff', border: 'none', cursor: yukleniyor ? 'not-allowed' : 'pointer',
            fontSize: '0.8rem', fontWeight: 700
          }}>
            {yukleniyor ? '⏳ Analiz...' : '✨ Genel Analiz Yap'}
          </button>
        </div>
      </div>
      {analiz && (
        <div style={{ background: '#FAFAFF', border: `1px solid #E9D5FF`, borderRadius: '10px', padding: '16px', marginTop: '14px' }}>
          <AIMetin text={analiz} />
        </div>
      )}
    </div>
  )
}

// ─── Ana Sayfa ────────────────────────────────────────────────────
export default function KreatifPerformansPage() {
  const [hesap, setHesap] = useState('karmen')
  const [donem, setDonem] = useState(30)
  const [siralamaId, setSiralamaId] = useState('ctr')
  const [minHarcama, setMinHarcama] = useState(500)
  const [model, setModel] = useState(globalModelOku())

  const [kreatifler, setKreatifler] = useState<KreatifKart[]>([])
  const [yukleniyor, setYukleniyor] = useState(false)
  const [hata, setHata] = useState('')
  const [secilenKart, setSecilenKart] = useState<KreatifKart | null>(null)
  const [gosterimSayisi, setGosterimSayisi] = useState(5)

  useEffect(() => {
    function onModel() { setModel(globalModelOku()) }
    window.addEventListener('modelDegisti', onModel)
    return () => window.removeEventListener('modelDegisti', onModel)
  }, [])

  async function verileriCek() {
    setYukleniyor(true); setHata(''); setKreatifler([])
    try {
      const res = await fetch(`/api/meta?hesap=${hesap}&tur=kreatif-analiz&donem=${donem}`)
      const data = await res.json()
      if (data.error) { setHata(data.error); setYukleniyor(false); return }

      const reklamlar: KreatifKart[] = (data.data || [])
        .filter((r: { insights?: { data: unknown[] } }) => r.insights?.data?.length)
        .map((r: {
          id: string; name: string
          creative?: {
            image_url?: string; thumbnail_url?: string; picture?: string
            body?: string; title?: string; call_to_action_type?: string
            video_id?: string; object_type?: string
            object_story_spec?: { link_data?: { picture?: string }; video_data?: { image_url?: string; thumbnail_url?: string } }
          }
          insights?: { data: { spend?: string; impressions?: string; clicks?: string; ctr?: string; cpc?: string; cpm?: string; frequency?: string; actions?: { action_type: string; value: string }[]; action_values?: { action_type: string; value: string }[] }[] }
        }) => {
          const ins = r.insights!.data[0]
          const satin = ins.actions?.find(a => ['purchase', 'omni_purchase', 'offsite_conversion.fb_pixel_purchase'].includes(a.action_type))
          const gelirA = ins.action_values?.find(a => ['purchase', 'omni_purchase', 'offsite_conversion.fb_pixel_purchase'].includes(a.action_type))
          const harcama = parseFloat(ins.spend || '0')
          const gelir = parseFloat(gelirA?.value || '0')
          return {
            id: r.id, ad: r.name,
            metin: r.creative?.body || '',
            baslik: r.creative?.title || '',
            cta: r.creative?.call_to_action_type || '',
            thumbnail: enIyiGorsel(r.creative),
            format: formatBelirle(r.name),
            harcama,
            gosteriminSayisi: parseInt(ins.impressions || '0'),
            tiklama: parseInt(ins.clicks || '0'),
            ctr: parseFloat(ins.ctr || '0'),
            cpc: parseFloat(ins.cpc || '0'),
            cpm: parseFloat(ins.cpm || '0'),
            frequency: parseFloat(ins.frequency || '0'),
            satis: parseInt(satin?.value || '0'),
            gelir,
            roas: harcama > 0 ? gelir / harcama : 0,
            video: !!(r.creative?.video_id || r.creative?.object_type === 'VIDEO'),
          } as KreatifKart
        })
        .filter((k: KreatifKart) => k.harcama >= minHarcama)

      setKreatifler(reklamlar)
    } catch { setHata('Veri çekilemedi. Bağlantıyı kontrol et.') }
    setYukleniyor(false)
  }

  const siralama = SIRALAMAR.find(s => s.id === siralamaId)!
  const sirali = [...kreatifler].sort((a, b) => {
    const av = metrikDeger(a, siralamaId), bv = metrikDeger(b, siralamaId)
    return siralama.yuksekIyi ? bv - av : av - bv
  })
  const iyiler = sirali.slice(0, gosterimSayisi)
  const zayiflar = [...sirali].reverse().slice(0, gosterimSayisi)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg }}>
      <Sidebar />
      <div style={{ marginLeft: '220px', flex: 1, padding: '24px', maxWidth: 'calc(100vw - 220px)' }}>

        {/* Başlık */}
        <div style={{ marginBottom: '20px' }}>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 800, color: C.text, margin: 0 }}>🎨 Kreatif Performans</h1>
          <p style={{ fontSize: '0.78rem', color: C.faint, margin: '4px 0 0' }}>
            Hangi görsel daha fazla sattırıyor? Grafikerlerin referans alabileceği en iyi & en zayıf kreatifleri bul.
          </p>
        </div>

        {/* Filtreler */}
        <div style={{ background: C.card, borderRadius: '12px', border: `1px solid ${C.border}`, padding: '16px 20px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-end' }}>

            <div>
              <div style={{ fontSize: '0.6rem', fontWeight: 700, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Hesap</div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {HESAPLAR.map(h => (
                  <button key={h.id} onClick={() => setHesap(h.id)} style={{
                    padding: '6px 12px', borderRadius: '8px', cursor: 'pointer',
                    border: `2px solid ${hesap === h.id ? h.renk : C.border}`,
                    background: hesap === h.id ? h.renk + '15' : 'transparent',
                    color: hesap === h.id ? h.renk : C.muted,
                    fontSize: '0.78rem', fontWeight: 600
                  }}>{h.emoji} {h.ad}</button>
                ))}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.6rem', fontWeight: 700, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Dönem</div>
              <div style={{ display: 'flex', gap: '4px' }}>
                {[7, 14, 30, 60, 90].map(g => (
                  <button key={g} onClick={() => setDonem(g)} style={{
                    padding: '5px 10px', borderRadius: '6px', cursor: 'pointer',
                    border: `1.5px solid ${donem === g ? C.primary : C.border}`,
                    background: donem === g ? C.primary + '12' : 'transparent',
                    color: donem === g ? C.primary : C.muted,
                    fontSize: '0.75rem', fontWeight: donem === g ? 700 : 400
                  }}>Son {g}g</button>
                ))}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.6rem', fontWeight: 700, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Sıralama Metriği</div>
              <div style={{ display: 'flex', gap: '4px' }}>
                {SIRALAMAR.map(s => (
                  <button key={s.id} onClick={() => setSiralamaId(s.id)} style={{
                    padding: '5px 10px', borderRadius: '6px', cursor: 'pointer',
                    border: `1.5px solid ${siralamaId === s.id ? '#7C3AED' : C.border}`,
                    background: siralamaId === s.id ? '#7C3AED12' : 'transparent',
                    color: siralamaId === s.id ? '#7C3AED' : C.muted,
                    fontSize: '0.75rem', fontWeight: siralamaId === s.id ? 700 : 400
                  }} title={s.aciklama}>{s.icon} {s.ad}</button>
                ))}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.6rem', fontWeight: 700, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Min. Harcama (₺)</div>
              <input type="number" value={minHarcama} onChange={e => setMinHarcama(Number(e.target.value))} style={{ width: '90px', padding: '6px 10px', borderRadius: '6px', border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: '0.78rem', outline: 'none' }} />
            </div>

            <button onClick={verileriCek} disabled={yukleniyor} style={{
              padding: '8px 20px', borderRadius: '8px',
              background: yukleniyor ? C.border : C.primary,
              color: '#fff', border: 'none', cursor: yukleniyor ? 'not-allowed' : 'pointer',
              fontSize: '0.82rem', fontWeight: 700
            }}>
              {yukleniyor ? '⏳ Yükleniyor...' : '🔍 Verileri Çek'}
            </button>
          </div>
        </div>

        {/* Hata */}
        {hata && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', color: '#DC2626', fontSize: '0.82rem' }}>
            ⚠️ {hata}
          </div>
        )}

        {/* Boş durum */}
        {!yukleniyor && kreatifler.length === 0 && !hata && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: C.faint }}>
            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🎨</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: C.muted, marginBottom: '6px' }}>Kreatif verisi bekleniyor</div>
            <div style={{ fontSize: '0.78rem' }}>Hesap ve dönem seç, ardından "Verileri Çek"e tıkla</div>
          </div>
        )}

        {kreatifler.length > 0 && (
          <>
            {/* Özet bar */}
            <div style={{ background: C.card, borderRadius: '10px', border: `1px solid ${C.border}`, padding: '12px 16px', marginBottom: '20px', display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '0.8rem', color: C.muted }}><strong style={{ color: C.text }}>{kreatifler.length}</strong> reklam</div>
              <div style={{ fontSize: '0.8rem', color: C.muted }}>Toplam harcama: <strong style={{ color: C.text }}>{kreatifler.reduce((s, k) => s + k.harcama, 0).toLocaleString('tr-TR')} ₺</strong></div>
              <div style={{ fontSize: '0.8rem', color: C.muted }}>Sıralama: <strong style={{ color: '#7C3AED' }}>{siralama.icon} {siralama.ad}</strong></div>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.7rem', color: C.faint }}>Gösterim:</span>
                {[3, 5, 10].map(n => (
                  <button key={n} onClick={() => setGosterimSayisi(n)} style={{
                    padding: '3px 8px', borderRadius: '5px', cursor: 'pointer',
                    border: `1px solid ${gosterimSayisi === n ? C.primary : C.border}`,
                    background: gosterimSayisi === n ? C.primary + '12' : 'transparent',
                    color: gosterimSayisi === n ? C.primary : C.muted,
                    fontSize: '0.72rem', fontWeight: gosterimSayisi === n ? 700 : 400
                  }}>Top {n}</button>
                ))}
              </div>
            </div>

            {/* İki kolon */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px', marginBottom: '28px' }}>
              {/* En İyi */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <span style={{ fontSize: '1.2rem' }}>🏆</span>
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#15803D' }}>En İyi Kreatiflер</div>
                    <div style={{ fontSize: '0.63rem', color: C.faint }}>En yüksek {siralama.ad} değerine sahip</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                  {iyiler.map((k, i) => (
                    <KreatifKartBileseni key={k.id} kart={k} sira={i + 1} tip="iyi" siralamaId={siralamaId} onClick={setSecilenKart} />
                  ))}
                </div>
              </div>

              {/* En Zayıf */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <span style={{ fontSize: '1.2rem' }}>💀</span>
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#DC2626' }}>En Zayıf Kreatiflер</div>
                    <div style={{ fontSize: '0.63rem', color: C.faint }}>En düşük {siralama.ad} değerine sahip</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                  {zayiflar.map((k, i) => (
                    <KreatifKartBileseni key={k.id} kart={k} sira={i + 1} tip="zayif" siralamaId={siralamaId} onClick={setSecilenKart} />
                  ))}
                </div>
              </div>
            </div>

            {/* Genel AI Analiz */}
            <GenelAnaliz iyiler={iyiler} zayiflar={zayiflar} hesap={hesap} donem={donem} model={model} siralama={siralama} />
          </>
        )}
      </div>

      {/* Modal */}
      {secilenKart && (
        <DetayModal kart={secilenKart} hesap={hesap} donem={donem} model={model} onKapat={() => setSecilenKart(null)} />
      )}
    </div>
  )
}
