import type { CalcWarning, WarningCode } from '@gemas/calc-engine';

/** Saran tindakan per kode — melengkapi pesan engine dengan langkah praktis. */
const ACTION: Partial<Record<WarningCode, string>> = {
  LOW_CONFIDENCE_PARAM: 'Ukur sendiri (timbang/uji kotak volume) lalu masukkan lewat "Ubah angka".',
  SELF_HEATING_RISK: 'Keringkan dulu atau simpan di zona berventilasi; hindari tumpukan tinggi.',
  FLAMMABLE: 'Pisahkan dari sumber api, tandai zona "NO FIRE", jaga tetap kering.',
  ODOR_CONTAMINATION: 'Simpan kopra edible di zona/ruang terpisah.',
  SHELF_LIFE: 'Jadwalkan muat sebelum batas umur simpan; terapkan FIFO.',
  WEIGHT_LIMITED: 'Ruang masih tersisa — bisa dicampur barang ringan atau pakai container lebih kecil.',
  ITEM_EXCEEDS_CONTAINER: 'Periksa dimensi kemasan atau pilih container/zona lebih besar.',
  FLOOR_OVERLOAD: 'Turunkan tinggi tumpuk atau sebar ke area lebih luas.',
  CONSERVATIVE_BENCHMARK_GAP: 'Ada laporan pasar yang jauh lebih rendah — cek ukuran butir & jenis container (reefer/palet).',
};

const SAFETY: WarningCode[] = ['SELF_HEATING_RISK', 'FLAMMABLE', 'FLOOR_OVERLOAD', 'ODOR_CONTAMINATION', 'ITEM_EXCEEDS_CONTAINER'];

export function WarningList({ warnings }: { warnings: CalcWarning[] }) {
  if (!warnings.length) return null;
  return (
    <section aria-label="Peringatan" className="card-ink flex flex-col gap-3 p-4" data-testid="warnings">
      <h2 className="text-xl text-acid">Peringatan</h2>
      {warnings.map((w) => {
        const danger = SAFETY.includes(w.code);
        return (
          <div key={w.code} className="flex gap-3 border-2 border-line-ink p-3" data-code={w.code}>
            <span
              aria-hidden
              className={`inline-flex h-[34px] w-[34px] flex-none items-center justify-center text-ink ${danger ? 'bg-safety' : 'bg-acid'}`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8">
                <path d="M12 3l10 18H2z" />
                <path d="M12 10v5M12 18v.5" />
              </svg>
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-sm font-extrabold">{w.message}</span>
              {ACTION[w.code] && <span className="text-[13px] text-muted-ink">{ACTION[w.code]}</span>}
              {w.code === 'LOW_CONFIDENCE_PARAM' && w.detail && (
                <span className="font-mono text-[11px] text-muted-ink">Parameter estimasi: {w.detail.replaceAll(',', ', ')}</span>
              )}
              <span className={`font-mono text-[11px] font-bold ${danger ? 'text-safety' : 'text-acid'}`}>{w.code}</span>
            </div>
          </div>
        );
      })}
    </section>
  );
}
