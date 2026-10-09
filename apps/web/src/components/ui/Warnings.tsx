import type { CalcWarning, WarningCode } from '@gemas/calc-engine';

/**
 * Judul santai + saran per kode peringatan (DEC-027). Pesan resmi engine (calc_spec §6) tetap
 * ditampilkan kecil di bawahnya — itu kontrak API, sengaja tidak diubah.
 */
const FRIENDLY: Record<WarningCode, { title: string; action?: string }> = {
  LOW_CONFIDENCE_PARAM: { title: 'Sebagian angkanya masih kira-kira', action: 'Timbang/ukur sendiri beberapa sampel, lalu masukkan lewat "Ubah angka".' },
  SELF_HEATING_RISK: { title: 'Awas, kopra basah bisa panas sendiri', action: 'Keringkan dulu atau simpan di tempat berangin; jangan ditumpuk tinggi.' },
  FLAMMABLE: { title: 'Arang gampang terbakar', action: 'Jauhkan dari api, kasih tanda "DILARANG MEROKOK", jaga tetap kering.' },
  ODOR_CONTAMINATION: { title: 'Bau kopra asap bisa nempel', action: 'Simpan kopra edible di ruang/zona terpisah.' },
  SHELF_LIFE: { title: 'Kelapa nggak tahan lama', action: 'Muat sebelum lewat batas umur simpan; yang datang duluan, keluar duluan.' },
  WEIGHT_LIMITED: { title: 'Berat sudah mentok duluan', action: 'Ruang masih sisa — bisa diisi barang ringan atau pakai container lebih kecil.' },
  ITEM_EXCEEDS_CONTAINER: { title: 'Kemasannya kegedean', action: 'Cek lagi ukuran karung, atau pilih container/zona yang lebih besar.' },
  FLOOR_OVERLOAD: { title: 'Lantai bisa nggak kuat', action: 'Turunkan tumpukan atau sebar ke area yang lebih luas.' },
  OVERRIDE_OUT_OF_RANGE: { title: 'Angkanya kayaknya salah ketik' },
  CONSERVATIVE_BENCHMARK_GAP: { title: 'Ada laporan pasar yang jauh lebih rendah', action: 'Cek ukuran butir & jenis container (reefer/palet) sebelum janji ke pembeli.' },
  WATER_REMAINDER_CLAMPED: { title: 'Komposisi buah lebih dari 100%', action: 'Cek lagi angka sabut, batok, dan daging hasil ukurmu.' },
  WEATHER_DEPENDENT: { title: 'Lama jemur tergantung cuaca', action: 'Siapkan terpal/penutup. Musim hujan? Pertimbangkan greenhouse atau oven.' },
};

const SAFETY: WarningCode[] = ['SELF_HEATING_RISK', 'FLAMMABLE', 'FLOOR_OVERLOAD', 'ODOR_CONTAMINATION', 'ITEM_EXCEEDS_CONTAINER'];

export function WarningList({ warnings }: { warnings: CalcWarning[] }) {
  if (!warnings.length) return null;
  return (
    <section aria-label="Peringatan" className="card-ink flex flex-col gap-3 p-4" data-testid="warnings">
      <h2 className="text-xl text-acid">Perlu diperhatikan</h2>
      {warnings.map((w) => {
        const danger = SAFETY.includes(w.code);
        const f = FRIENDLY[w.code];
        return (
          <div key={w.code} className="flex gap-3 border-2 border-line-ink p-3" data-code={w.code}>
            <span aria-hidden className={`inline-flex h-[34px] w-[34px] flex-none items-center justify-center text-ink ${danger ? 'bg-safety' : 'bg-acid'}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8">
                <path d="M12 3l10 18H2z" />
                <path d="M12 10v5M12 18v.5" />
              </svg>
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-sm font-extrabold">{f.title}</span>
              {f.action && <span className="text-[13px] text-muted-ink">{f.action}</span>}
              {w.code === 'LOW_CONFIDENCE_PARAM' && w.detail && (
                <span className="font-mono text-[11px] text-muted-ink">Angka kira-kira: {w.detail.replaceAll(',', ', ')}</span>
              )}
              <span className="text-[12px] text-muted-ink">{w.message}</span>
              <span className={`font-mono text-[11px] font-bold ${danger ? 'text-safety' : 'text-acid'}`}>{w.code}</span>
            </div>
          </div>
        );
      })}
    </section>
  );
}
