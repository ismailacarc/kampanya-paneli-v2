import { Satir } from './types'
import { para, sayi, getDonusum, getGelir, getRoas, kampanyaSkoru } from './helpers'

export async function excelExport(satirlar: Satir[], dosyaAdi: string, tur: 'kampanya' | 'set' | 'reklam' = 'kampanya') {
  const XLSX = await import('xlsx')

  const baslik = tur === 'kampanya' ? 'Kampanya' : tur === 'set' ? 'Reklam Seti' : 'Reklam'

  const veri = satirlar.map(s => {
    const ins = s.insights?.data[0]
    const h = parseFloat(ins?.spend || '0')
    const g = getGelir(ins)
    const r = getRoas(ins)
    const d = getDonusum(ins)
    const t = parseInt(ins?.clicks || '0')
    const gos = parseInt(ins?.impressions || '0')
    const { harf, skor } = kampanyaSkoru(ins)

    return {
      [baslik]: s.name,
      'Durum': s.status === 'ACTIVE' ? 'Aktif' : 'Durduruldu',
      'Skor': harf !== '—' ? `${harf} (${skor}/100)` : '—',
      'Harcama (₺)': h > 0 ? parseFloat(h.toFixed(2)) : 0,
      'Gelir (₺)': g > 0 ? parseFloat(g.toFixed(2)) : 0,
      'ROAS': r > 0 ? parseFloat(r.toFixed(2)) : 0,
      'Dönüşüm': d,
      'Gösterim': gos,
      'Tıklama': t,
      'CTR (%)': ins?.ctr ? parseFloat(parseFloat(ins.ctr).toFixed(2)) : 0,
      'CPC (₺)': ins?.cpc ? parseFloat(parseFloat(ins.cpc).toFixed(2)) : 0,
      'Frekans': ins?.frequency ? parseFloat(parseFloat(ins.frequency).toFixed(1)) : 0,
      'CPM (₺)': ins?.cpm ? parseFloat(parseFloat(ins.cpm).toFixed(2)) : 0,
    }
  })

  const ws = XLSX.utils.json_to_sheet(veri)

  // Kolon genişlikleri
  ws['!cols'] = [
    { wch: 45 }, // Kampanya adı
    { wch: 12 }, // Durum
    { wch: 10 }, // Skor
    { wch: 14 }, // Harcama
    { wch: 14 }, // Gelir
    { wch: 8  }, // ROAS
    { wch: 10 }, // Dönüşüm
    { wch: 12 }, // Gösterim
    { wch: 10 }, // Tıklama
    { wch: 8  }, // CTR
    { wch: 10 }, // CPC
    { wch: 10 }, // Frekans
    { wch: 10 }, // CPM
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, baslik + 'lar')

  const tarih = new Date().toLocaleDateString('tr-TR').replace(/\./g, '-')
  XLSX.writeFile(wb, `${dosyaAdi}_${tarih}.xlsx`)
}
