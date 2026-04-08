'use client'

import { useEffect, useState } from 'react'

interface Kampanya {
  id: string
  name: string
  status: string
  insights?: {
    data: [{
      spend: string
      impressions: string
      clicks: string
      ctr: string
      cpc: string
      actions?: { action_type: string; value: string }[]
    }]
  }
}

const HESAPLAR = [
  { id: 'karmen', ad: 'Karmen Halı', renk: '#e67e22' },
  { id: 'cotto', ad: 'Cotto Home', renk: '#2980b9' },
]

export default function Panel() {
  const [aktifHesap, setAktifHesap] = useState('karmen')
  const [kampanyalar, setKampanyalar] = useState<Kampanya[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState('')

  useEffect(() => {
    setYukleniyor(true)
    setHata('')
    setKampanyalar([])

    fetch(`/api/meta?hesap=${aktifHesap}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) setHata(data.error)
        else setKampanyalar(data.data || [])
        setYukleniyor(false)
      })
      .catch(() => {
        setHata('Veri çekilemedi')
        setYukleniyor(false)
      })
  }, [aktifHesap])

  const aktifHesapBilgi = HESAPLAR.find(h => h.id === aktifHesap)!

  const toplamHarcama = kampanyalar.reduce((acc, k) => acc + parseFloat(k.insights?.data[0]?.spend || '0'), 0)
  const toplamTiklama = kampanyalar.reduce((acc, k) => acc + parseInt(k.insights?.data[0]?.clicks || '0'), 0)
  const toplamGosterim = kampanyalar.reduce((acc, k) => acc + parseInt(k.insights?.data[0]?.impressions || '0'), 0)
  const aktifSayisi = kampanyalar.filter(k => k.status === 'ACTIVE').length
  const ortCTR = kampanyalar.length > 0
    ? kampanyalar.reduce((acc, k) => acc + parseFloat(k.insights?.data[0]?.ctr || '0'), 0) / kampanyalar.length
    : 0

  const donusumler = kampanyalar.reduce((acc, k) => {
    const actions = k.insights?.data[0]?.actions || []
    const purchase = actions.find(a => a.action_type === 'purchase' || a.action_type === 'offsite_conversion.fb_pixel_purchase')
    return acc + parseInt(purchase?.value || '0')
  }, 0)

  return (
    <div style={{ background: '#0d1117', minHeight: '100vh', color: '#e6edf3', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      {/* HEADER */}
      <header style={{ background: '#161b22', borderBottom: '1px solid #30363d', padding: '0 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '60px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '1.3rem' }}>📊</span>
          <span style={{ fontWeight: 700, fontSize: '1rem' }}>Reklam Paneli</span>
          <span style={{ color: '#30363d' }}>|</span>
          <span style={{ color: aktifHesapBilgi.renk, fontWeight: 600 }}>{aktifHesapBilgi.ad}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '0.8rem', color: '#8b949e' }}>Son 30 gün</span>
          <span style={{ background: '#238636', color: '#fff', padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600 }}>● Canlı</span>
        </div>
      </header>

      <main style={{ maxWidth: '1300px', margin: '0 auto', padding: '28px 32px' }}>

        {/* HESAP SEÇİCİ */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '28px' }}>
          {HESAPLAR.map(h => (
            <button
              key={h.id}
              onClick={() => setAktifHesap(h.id)}
              style={{
                padding: '10px 24px',
                borderRadius: '8px',
                border: `2px solid ${aktifHesap === h.id ? h.renk : '#30363d'}`,
                background: aktifHesap === h.id ? `${h.renk}20` : '#161b22',
                color: aktifHesap === h.id ? h.renk : '#8b949e',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {h.ad}
            </button>
          ))}
        </div>

        {/* YÜKLENIYOR */}
        {yukleniyor && (
          <div style={{ textAlign: 'center', padding: '80px', color: '#8b949e' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>⏳</div>
            <p style={{ fontSize: '1rem' }}>{aktifHesapBilgi.ad} verileri yükleniyor...</p>
          </div>
        )}

        {/* HATA */}
        {hata && (
          <div style={{ background: '#3a1a1a', border: '1px solid #f85149', borderRadius: '12px', padding: '20px 24px', color: '#f85149', marginBottom: '24px' }}>
            <strong>⚠️ Hata:</strong> {hata}
            <p style={{ color: '#8b949e', marginTop: '8px', fontSize: '0.85rem' }}>Token süresi dolmuş olabilir. .env.local dosyasındaki token&apos;ı güncelle.</p>
          </div>
        )}

        {!yukleniyor && !hata && (
          <>
            {/* ÖZET KARTLAR */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '14px', marginBottom: '24px' }}>
              {[
                { baslik: '💸 Harcama', deger: `$${toplamHarcama.toFixed(2)}`, renk: '#f0883e' },
                { baslik: '🛒 Dönüşüm', deger: donusumler.toString(), renk: '#3fb950' },
                { baslik: '📈 ROAS', deger: toplamHarcama > 0 ? `${(donusumler / toplamHarcama * 100).toFixed(1)}x` : '—', renk: '#58a6ff' },
                { baslik: '🖱️ Tıklama', deger: toplamTiklama.toLocaleString(), renk: '#d2a8ff' },
                { baslik: '👁️ Gösterim', deger: toplamGosterim >= 1000 ? `${(toplamGosterim / 1000).toFixed(1)}K` : toplamGosterim.toString(), renk: '#79c0ff' },
                { baslik: '📊 Ort. CTR', deger: `%${ortCTR.toFixed(2)}`, renk: '#56d364' },
              ].map((k, i) => (
                <div key={i} style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '10px', padding: '16px', borderTop: `3px solid ${k.renk}` }}>
                  <div style={{ fontSize: '0.75rem', color: '#8b949e', marginBottom: '8px' }}>{k.baslik}</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, color: k.renk }}>{k.deger}</div>
                </div>
              ))}
            </div>

            {/* KAMPANYA TABLOSU */}
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid #30363d', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Kampanya Detayları</h2>
                <span style={{ fontSize: '0.8rem', color: '#8b949e' }}>{kampanyalar.length} kampanya · {aktifSayisi} aktif</span>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#0d1117' }}>
                    {['Kampanya Adı', 'Durum', 'Harcama', 'Dönüşüm', 'Tıklama', 'Gösterim', 'CTR', 'CPC'].map(h => (
                      <th key={h} style={{ textAlign: 'left', fontSize: '0.72rem', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '10px 16px', borderBottom: '1px solid #30363d' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {kampanyalar.map((k) => {
                    const ins = k.insights?.data[0]
                    const actions = ins?.actions || []
                    const purchase = actions.find(a => a.action_type === 'purchase' || a.action_type === 'offsite_conversion.fb_pixel_purchase')
                    return (
                      <tr key={k.id} style={{ transition: 'background 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#1c2128')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <td style={{ padding: '14px 16px', fontSize: '0.875rem', borderBottom: '1px solid #21262d', maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.name}</td>
                        <td style={{ padding: '14px 16px', borderBottom: '1px solid #21262d' }}>
                          <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 600, background: k.status === 'ACTIVE' ? '#1a3a2a' : '#2a1a1a', color: k.status === 'ACTIVE' ? '#3fb950' : '#f85149' }}>
                            {k.status === 'ACTIVE' ? '● Aktif' : '■ Durduruldu'}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', fontSize: '0.875rem', borderBottom: '1px solid #21262d', color: '#f0883e' }}>${parseFloat(ins?.spend || '0').toFixed(2)}</td>
                        <td style={{ padding: '14px 16px', fontSize: '0.875rem', borderBottom: '1px solid #21262d', color: '#3fb950', fontWeight: 600 }}>{purchase?.value || '0'}</td>
                        <td style={{ padding: '14px 16px', fontSize: '0.875rem', borderBottom: '1px solid #21262d' }}>{parseInt(ins?.clicks || '0').toLocaleString()}</td>
                        <td style={{ padding: '14px 16px', fontSize: '0.875rem', borderBottom: '1px solid #21262d' }}>{parseInt(ins?.impressions || '0').toLocaleString()}</td>
                        <td style={{ padding: '14px 16px', fontSize: '0.875rem', borderBottom: '1px solid #21262d' }}>%{parseFloat(ins?.ctr || '0').toFixed(2)}</td>
                        <td style={{ padding: '14px 16px', fontSize: '0.875rem', borderBottom: '1px solid #21262d' }}>${parseFloat(ins?.cpc || '0').toFixed(2)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {kampanyalar.length === 0 && (
                <div style={{ textAlign: 'center', padding: '48px', color: '#8b949e' }}>
                  Bu hesapta kampanya bulunamadı.
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
