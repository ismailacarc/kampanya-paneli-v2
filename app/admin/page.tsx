'use client'

import { useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import { C } from '../lib/theme'
import type { Yetkiler } from '@/lib/userStore'

// ── Dashboard Ayarları bölümü ─────────────────────────────────────────────────
function DashboardAyarlari() {
  const [ciro,    setCiro]    = useState('')
  const [harcama, setHarcama] = useState('')
  const [mevcut,  setMevcut]  = useState<{ ciro_duzeltme: number; harcama_duzeltme: number; guncellendi: string | null } | null>(null)
  const [kayit,   setKayit]   = useState(false)

  useEffect(() => {
    fetch('/api/admin/ayarlar').then(r => r.json()).then(d => {
      setMevcut(d)
      setCiro(d.ciro_duzeltme === 0 ? '' : String(d.ciro_duzeltme))
      setHarcama(d.harcama_duzeltme === 0 ? '' : String(d.harcama_duzeltme))
    })
  }, [])

  async function kaydet() {
    setKayit(true)
    await fetch('/api/admin/ayarlar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ciro_duzeltme: parseFloat(ciro) || 0, harcama_duzeltme: parseFloat(harcama) || 0 }),
    })
    const d = await fetch('/api/admin/ayarlar').then(r => r.json())
    setMevcut(d)
    setTimeout(() => setKayit(false), 2000)
  }

  async function sifirla() {
    setCiro(''); setHarcama('')
    await fetch('/api/admin/ayarlar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ciro_duzeltme: 0, harcama_duzeltme: 0 }),
    })
    setMevcut(prev => prev ? { ...prev, ciro_duzeltme: 0, harcama_duzeltme: 0 } : prev)
  }

  const aktif = mevcut && (mevcut.ciro_duzeltme !== 0 || mevcut.harcama_duzeltme !== 0)

  return (
    <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: '14px', padding: '22px 26px', marginBottom: '28px', boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
        <div>
          <div style={{ fontSize: '0.92rem', fontWeight: 800, color: C.text }}>📊 Dashboard Rakam Düzeltmesi</div>
          <div style={{ fontSize: '0.72rem', color: C.faint, marginTop: '3px' }}>
            Tüm kullanıcılar düzeltilmiş rakamı görür — hiçbir uyarı gösterilmez
          </div>
        </div>
        {aktif && (
          <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: '8px', padding: '4px 12px', fontSize: '0.72rem', fontWeight: 700, color: '#92400E' }}>
            ⚡ Aktif
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        {/* Ciro */}
        <div>
          <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: C.text, marginBottom: '7px' }}>
            💰 Ciro Değişimi (GA4 Toplam Gelir)
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="number"
              value={ciro}
              onChange={e => setCiro(e.target.value)}
              placeholder="Örn: 20 veya -15"
              style={{ flex: 1, padding: '9px 13px', border: `1.5px solid ${ciro && ciro !== '0' ? '#22C55E' : C.border}`, borderRadius: '9px', fontSize: '0.88rem', color: C.text, background: ciro && ciro !== '0' ? '#F0FDF4' : '#fff', outline: 'none' }}
            />
            <span style={{ fontWeight: 800, color: C.muted }}>%</span>
          </div>
          {mevcut && mevcut.ciro_duzeltme !== 0 && (
            <div style={{ marginTop: '5px', fontSize: '0.7rem', color: '#15803d', fontWeight: 600 }}>
              Şu an aktif: {mevcut.ciro_duzeltme > 0 ? '+' : ''}{mevcut.ciro_duzeltme}%
            </div>
          )}
        </div>

        {/* Harcama */}
        <div>
          <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: C.text, marginBottom: '7px' }}>
            📉 Harcama Değişimi (Meta + Google)
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="number"
              value={harcama}
              onChange={e => setHarcama(e.target.value)}
              placeholder="Örn: -20 veya 10"
              style={{ flex: 1, padding: '9px 13px', border: `1.5px solid ${harcama && harcama !== '0' ? '#22C55E' : C.border}`, borderRadius: '9px', fontSize: '0.88rem', color: C.text, background: harcama && harcama !== '0' ? '#F0FDF4' : '#fff', outline: 'none' }}
            />
            <span style={{ fontWeight: 800, color: C.muted }}>%</span>
          </div>
          {mevcut && mevcut.harcama_duzeltme !== 0 && (
            <div style={{ marginTop: '5px', fontSize: '0.7rem', color: '#15803d', fontWeight: 600 }}>
              Şu an aktif: {mevcut.harcama_duzeltme > 0 ? '+' : ''}{mevcut.harcama_duzeltme}%
            </div>
          )}
        </div>
      </div>

      {/* Bilgi kutusu */}
      <div style={{ background: '#F8FAFC', border: `1px solid ${C.borderLight}`, borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '0.72rem', color: C.muted, lineHeight: 1.6 }}>
        <strong style={{ color: C.text }}>Nasıl çalışır:</strong> Girilen yüzde değeri ana dashboard ve marka kartlarındaki rakamlara uygulanır.
        Gerçek API verisi değişmez, sadece görüntülenen rakam çarpılır. Kullanıcılar fark görmez.
        {mevcut?.guncellendi && <span> · Son güncelleme: {mevcut.guncellendi}</span>}
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        <button onClick={kaydet} style={{ flex: 1, padding: '10px', borderRadius: '9px', border: 'none', background: kayit ? '#22C55E' : C.text, color: '#fff', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', transition: 'background 0.2s' }}>
          {kayit ? '✓ Kaydedildi' : '💾 Uygula'}
        </button>
        {aktif && (
          <button onClick={sifirla} style={{ padding: '10px 20px', borderRadius: '9px', border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#DC2626', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>
            🗑 Sıfırla
          </button>
        )}
      </div>
    </div>
  )
}

interface Kullanici {
  id: string
  ad: string
  email: string
  rol: 'admin' | 'kullanici'
  aktif: boolean
  olusturuldu: string
  yetkiler: Yetkiler
}

const BOŞ_YETKILER: Yetkiler = {
  sayfalar: { meta: true, google_ads: true, analytics: true, search_console: false, ticimax_seo: false, ai_merkezi: false },
  markalar: { karmen: true, cotto: true },
  ciro_goster: false, harcama_goster: false, roas_goster: true,
  ai_uret: false, blog_yaz: false, admin_panel: false,
}

// ── Yetki toggle satırı ───────────────────────────────────────────────────────
function Toggle({ label, aciklama, aktif, onChange }: { label: string; aciklama?: string; aktif: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${C.borderLight}` }}>
      <div>
        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: C.text }}>{label}</div>
        {aciklama && <div style={{ fontSize: '0.7rem', color: C.faint, marginTop: '2px' }}>{aciklama}</div>}
      </div>
      <button
        onClick={() => onChange(!aktif)}
        style={{
          width: '44px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer',
          background: aktif ? '#22C55E' : '#D1D5DB', position: 'relative', transition: 'background 0.2s', flexShrink: 0,
        }}
      >
        <span style={{
          position: 'absolute', top: '3px', left: aktif ? '23px' : '3px',
          width: '18px', height: '18px', borderRadius: '50%', background: '#fff',
          transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }} />
      </button>
    </div>
  )
}

// ── Bölüm başlığı ─────────────────────────────────────────────────────────────
function BolumBaslik({ label }: { label: string }) {
  return (
    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '14px 0 4px' }}>
      {label}
    </div>
  )
}

export default function AdminPanel() {
  const [kullanicilar, setKullanicilar] = useState<Kullanici[]>([])
  const [secili,       setSecili]       = useState<Kullanici | null>(null)
  const [eklemeModu,   setEklemeModu]   = useState(false)
  const [yukleniyor,   setYukleniyor]   = useState(true)
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const [mesaj,        setMesaj]        = useState('')

  // Yeni kullanıcı formu
  const [yeniAd,    setYeniAd]    = useState('')
  const [yeniEmail, setYeniEmail] = useState('')
  const [yeniSifre, setYeniSifre] = useState('')
  const [yeniYetki, setYeniYetki] = useState<Yetkiler>(BOŞ_YETKILER)

  useEffect(() => { listele() }, [])

  async function listele() {
    setYukleniyor(true)
    const res = await fetch('/api/admin/users')
    if (res.ok) {
      const data = await res.json()
      setKullanicilar(data.users)
    }
    setYukleniyor(false)
  }

  async function kaydet() {
    if (!secili) return
    setKaydediliyor(true)
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: secili.id, yetkiler: secili.yetkiler, aktif: secili.aktif }),
    })
    await listele()
    setMesaj('✓ Kaydedildi')
    setTimeout(() => setMesaj(''), 2500)
    setKaydediliyor(false)
  }

  async function sifreGuncelle(yeniS: string) {
    if (!secili || !yeniS) return
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: secili.id, sifre: yeniS }),
    })
    setMesaj('✓ Şifre güncellendi')
    setTimeout(() => setMesaj(''), 2500)
  }

  async function kullaniciEkle() {
    if (!yeniAd || !yeniEmail || !yeniSifre) return
    setKaydediliyor(true)
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ad: yeniAd, email: yeniEmail, sifre: yeniSifre, yetkiler: yeniYetki }),
    })
    if (res.ok) {
      await listele()
      setEklemeModu(false)
      setYeniAd(''); setYeniEmail(''); setYeniSifre(''); setYeniYetki(BOŞ_YETKILER)
      setMesaj('✓ Kullanıcı eklendi')
      setTimeout(() => setMesaj(''), 2500)
    }
    setKaydediliyor(false)
  }

  async function sil(id: string, ad: string) {
    if (!confirm(`"${ad}" silinsin mi?`)) return
    await fetch('/api/admin/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (secili?.id === id) setSecili(null)
    await listele()
  }

  // Seçili kullanıcının yetki setterı
  function yetkileriGuncelle(guncelleme: Partial<Yetkiler>) {
    if (!secili) return
    setSecili({ ...secili, yetkiler: { ...secili.yetkiler, ...guncelleme } })
  }
  function sayfaYetki(alan: keyof Yetkiler['sayfalar'], deger: boolean) {
    if (!secili) return
    setSecili({ ...secili, yetkiler: { ...secili.yetkiler, sayfalar: { ...secili.yetkiler.sayfalar, [alan]: deger } } })
  }
  function markaYetki(alan: keyof Yetkiler['markalar'], deger: boolean) {
    if (!secili) return
    setSecili({ ...secili, yetkiler: { ...secili.yetkiler, markalar: { ...secili.yetkiler.markalar, [alan]: deger } } })
  }

  // Yeni kullanıcı yetki setterı
  function yeniSayfaYetki(alan: keyof Yetkiler['sayfalar'], deger: boolean) {
    setYeniYetki(p => ({ ...p, sayfalar: { ...p.sayfalar, [alan]: deger } }))
  }
  function yeniMarkaYetki(alan: keyof Yetkiler['markalar'], deger: boolean) {
    setYeniYetki(p => ({ ...p, markalar: { ...p.markalar, [alan]: deger } }))
  }

  // Yetki paneli (hem düzenleme hem ekleme için)
  function YetkiPaneli({ y, onSayfa, onMarka, onGuncelle }: {
    y: Yetkiler
    onSayfa: (k: keyof Yetkiler['sayfalar'], v: boolean) => void
    onMarka: (k: keyof Yetkiler['markalar'], v: boolean) => void
    onGuncelle: (p: Partial<Yetkiler>) => void
  }) {
    return (
      <div>
        <BolumBaslik label="Sayfalar" />
        <Toggle label="Ana Dashboard" aktif={true} onChange={() => {}} />
        <Toggle label="Meta Ads"        aktif={y.sayfalar.meta}           onChange={v => onSayfa('meta', v)} />
        <Toggle label="Google Ads"      aktif={y.sayfalar.google_ads}     onChange={v => onSayfa('google_ads', v)} />
        <Toggle label="Google Analytics" aktif={y.sayfalar.analytics}    onChange={v => onSayfa('analytics', v)} />
        <Toggle label="Search Console"  aktif={y.sayfalar.search_console} onChange={v => onSayfa('search_console', v)} />
        <Toggle label="Ticimax SEO"     aktif={y.sayfalar.ticimax_seo}   onChange={v => onSayfa('ticimax_seo', v)} />
        <Toggle label="AI Merkezi"      aktif={y.sayfalar.ai_merkezi}    onChange={v => onSayfa('ai_merkezi', v)} />

        <BolumBaslik label="Marka Erişimi" />
        <Toggle label="Karmen Halı verisi" aktif={y.markalar.karmen} onChange={v => onMarka('karmen', v)} />
        <Toggle label="Cotto Home verisi"  aktif={y.markalar.cotto}  onChange={v => onMarka('cotto', v)} />

        <BolumBaslik label="Veri Görünürlüğü" />
        <Toggle label="Ciro rakamlarını gör"    aciklama="GA4 gelir rakamları"     aktif={y.ciro_goster}    onChange={v => onGuncelle({ ciro_goster: v })} />
        <Toggle label="Harcama rakamlarını gör" aciklama="Meta + Google Ads harcama" aktif={y.harcama_goster} onChange={v => onGuncelle({ harcama_goster: v })} />
        <Toggle label="ROAS göster"             aciklama="Reklam getirisi oranı"   aktif={y.roas_goster}    onChange={v => onGuncelle({ roas_goster: v })} />

        <BolumBaslik label="Aksiyonlar" />
        <Toggle label="AI içerik üret"  aciklama="Ürün/kategori AI analizi" aktif={y.ai_uret}      onChange={v => onGuncelle({ ai_uret: v })} />
        <Toggle label="Blog yaz"        aciklama="Blog içeriği oluştur"     aktif={y.blog_yaz}     onChange={v => onGuncelle({ blog_yaz: v })} />
        <Toggle label="Admin paneline gir" aciklama="Kullanıcı yönetimi"   aktif={y.admin_panel}  onChange={v => onGuncelle({ admin_panel: v })} />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F8F9FB', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <Sidebar />
      <div style={{ flex: 1, marginLeft: '220px' }}>

        {/* Header */}
        <header style={{ background: '#fff', borderBottom: `1px solid ${C.border}`, padding: '0 28px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: C.text }}>⚙️ Admin Paneli</div>
            <div style={{ fontSize: '0.7rem', color: C.faint }}>Kullanıcı ve yetki yönetimi</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {mesaj && <span style={{ fontSize: '0.8rem', color: '#15803d', fontWeight: 600 }}>{mesaj}</span>}
            <button onClick={() => { setEklemeModu(true); setSecili(null) }} style={{ padding: '7px 16px', borderRadius: '8px', border: 'none', background: C.text, color: '#fff', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>
              + Kullanıcı Ekle
            </button>
          </div>
        </header>

        <main style={{ display: 'flex', height: 'calc(100vh - 56px)' }}>

          {/* ─── Sol: Kullanıcı listesi ─── */}
          <div style={{ width: '300px', borderRight: `1px solid ${C.border}`, background: '#fff', overflowY: 'auto', flexShrink: 0 }}>
            {yukleniyor ? (
              <div style={{ padding: '40px', textAlign: 'center', color: C.faint, fontSize: '0.82rem' }}>Yükleniyor...</div>
            ) : kullanicilar.map(k => (
              <div
                key={k.id}
                onClick={() => { setSecili(k); setEklemeModu(false) }}
                style={{
                  padding: '14px 18px', borderBottom: `1px solid ${C.borderLight}`, cursor: 'pointer',
                  background: secili?.id === k.id ? '#F0F9FF' : 'transparent',
                  borderLeft: secili?.id === k.id ? '3px solid #0284C7' : '3px solid transparent',
                  transition: 'all 0.1s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: k.aktif ? C.text : C.faint }}>{k.ad}</div>
                    <div style={{ fontSize: '0.7rem', color: C.faint, marginTop: '2px' }}>{k.email}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: '8px', background: k.rol === 'admin' ? '#FEF3C7' : '#F3F4F6', color: k.rol === 'admin' ? '#92400E' : C.muted }}>
                      {k.rol === 'admin' ? '👑 Admin' : '👤 Kullanıcı'}
                    </span>
                    {!k.aktif && <span style={{ fontSize: '0.6rem', color: '#DC2626', fontWeight: 600 }}>Pasif</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ─── Sağ: Düzenleme / Ekleme paneli ─── */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '28px 36px' }}>

            {/* ── Kullanıcı düzenleme ── */}
            {secili && !eklemeModu && (() => {
              const [sifreDegis, setSifreDegis] = useState(false)
              const [yeniSifreVal, setYeniSifreVal] = useState('')

              return (
                <div style={{ maxWidth: '540px' }}>
                  {/* Başlık */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                    <div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: C.text }}>{secili.ad}</div>
                      <div style={{ fontSize: '0.75rem', color: C.faint }}>{secili.email} · {secili.olusturuldu}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {secili.rol !== 'admin' && (
                        <button onClick={() => sil(secili.id, secili.ad)} style={{ padding: '7px 14px', borderRadius: '8px', border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#DC2626', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}>
                          🗑 Sil
                        </button>
                      )}
                      <button onClick={kaydet} disabled={kaydediliyor} style={{ padding: '7px 18px', borderRadius: '8px', border: 'none', background: C.text, color: '#fff', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>
                        {kaydediliyor ? '...' : '💾 Kaydet'}
                      </button>
                    </div>
                  </div>

                  {/* Aktif/Pasif */}
                  {secili.rol !== 'admin' && (
                    <div style={{ background: secili.aktif ? '#F0FDF4' : '#FEF2F2', border: `1px solid ${secili.aktif ? '#86EFAC' : '#FCA5A5'}`, borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: secili.aktif ? '#15803d' : '#DC2626' }}>
                        {secili.aktif ? '✓ Hesap aktif' : '✗ Hesap pasif (giriş yapamaz)'}
                      </span>
                      <button onClick={() => setSecili({ ...secili, aktif: !secili.aktif })} style={{ fontSize: '0.75rem', fontWeight: 700, padding: '4px 12px', borderRadius: '6px', border: `1px solid ${C.border}`, background: '#fff', cursor: 'pointer', color: C.text }}>
                        {secili.aktif ? 'Pasif Yap' : 'Aktif Yap'}
                      </button>
                    </div>
                  )}

                  {/* Şifre değiştir */}
                  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '14px 16px', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: C.text }}>🔑 Şifre</span>
                      <button onClick={() => setSifreDegis(v => !v)} style={{ fontSize: '0.72rem', color: '#0284C7', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                        {sifreDegis ? 'İptal' : 'Değiştir'}
                      </button>
                    </div>
                    {sifreDegis && (
                      <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
                        <input type="password" placeholder="Yeni şifre" value={yeniSifreVal} onChange={e => setYeniSifreVal(e.target.value)}
                          style={{ flex: 1, padding: '8px 12px', borderRadius: '7px', border: `1px solid ${C.border}`, fontSize: '0.85rem', color: C.text }} />
                        <button onClick={() => { sifreGuncelle(yeniSifreVal); setSifreDegis(false); setYeniSifreVal('') }}
                          style={{ padding: '8px 14px', borderRadius: '7px', border: 'none', background: C.text, color: '#fff', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>
                          Güncelle
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Yetkiler */}
                  {secili.rol !== 'admin' ? (
                    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '16px 20px' }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 800, color: C.text, marginBottom: '4px' }}>Yetkiler</div>
                      <YetkiPaneli y={secili.yetkiler} onSayfa={sayfaYetki} onMarka={markaYetki} onGuncelle={yetkileriGuncelle} />
                    </div>
                  ) : (
                    <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '10px', padding: '14px 16px', fontSize: '0.8rem', color: '#92400E' }}>
                      👑 Admin hesabı — tüm yetkiler kalıcı olarak açık.
                    </div>
                  )}
                </div>
              )
            })()}

            {/* ── Kullanıcı ekleme formu ── */}
            {eklemeModu && (
              <div style={{ maxWidth: '540px' }}>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: C.text, marginBottom: '20px' }}>Yeni Kullanıcı</div>

                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
                  {[
                    { label: 'Ad Soyad', value: yeniAd,    set: setYeniAd,    type: 'text',     ph: 'Ahmet Yılmaz' },
                    { label: 'E-posta',  value: yeniEmail,  set: setYeniEmail,  type: 'email',    ph: 'ahmet@ornek.com' },
                    { label: 'Şifre',    value: yeniSifre,  set: setYeniSifre,  type: 'password', ph: 'En az 8 karakter' },
                  ].map(f => (
                    <div key={f.label} style={{ marginBottom: '14px' }}>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: C.text, marginBottom: '6px' }}>{f.label}</label>
                      <input type={f.type} value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.ph}
                        style={{ width: '100%', padding: '9px 13px', borderRadius: '8px', border: `1px solid ${C.border}`, fontSize: '0.88rem', color: C.text, boxSizing: 'border-box' }} />
                    </div>
                  ))}
                </div>

                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '16px 20px', marginBottom: '20px' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 800, color: C.text, marginBottom: '4px' }}>Yetkiler</div>
                  <YetkiPaneli
                    y={yeniYetki}
                    onSayfa={yeniSayfaYetki}
                    onMarka={yeniMarkaYetki}
                    onGuncelle={p => setYeniYetki(prev => ({ ...prev, ...p }))}
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => setEklemeModu(false)} style={{ padding: '10px 20px', borderRadius: '9px', border: `1px solid ${C.border}`, background: '#fff', color: C.muted, fontWeight: 600, cursor: 'pointer' }}>
                    İptal
                  </button>
                  <button onClick={kullaniciEkle} disabled={!yeniAd || !yeniEmail || !yeniSifre || kaydediliyor}
                    style={{ flex: 1, padding: '10px', borderRadius: '9px', border: 'none', background: (yeniAd && yeniEmail && yeniSifre) ? C.text : C.borderLight, color: (yeniAd && yeniEmail && yeniSifre) ? '#fff' : C.faint, fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer' }}>
                    {kaydediliyor ? '...' : '✓ Kullanıcı Ekle'}
                  </button>
                </div>
              </div>
            )}

            {/* Boş durum — Dashboard ayarları burada */}
            {!secili && !eklemeModu && (
              <div style={{ maxWidth: '560px' }}>
                <DashboardAyarlari />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px', color: C.faint }}>
                  <div style={{ fontSize: '2rem', marginBottom: '8px' }}>👥</div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>Sol taraftan bir kullanıcı seç</div>
                  <div style={{ fontSize: '0.72rem', marginTop: '4px' }}>veya sağ üstten yeni kullanıcı ekle</div>
                </div>
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  )
}
