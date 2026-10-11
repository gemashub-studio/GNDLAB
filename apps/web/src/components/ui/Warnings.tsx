import type { CalcWarning, WarningCode } from '@gemas/calc-engine';

/**
 * Judul santai + saran per kode peringatan (DEC-027). Pesan resmi engine (calc_spec §6) tetap
 * ditampilkan kecil di bawahnya — itu kontrak API, sengaja tidak diubah.
 */
const FRIENDLY: Record<WarningCode, { title: string; action?: string }> = {
  LOW_CONFIDENCE_PARAM: { title: 'Sebagian angkanya masih kira-kira', action: 'Timbang/ukur sendiri beberapa sampel, lalu pakai angkamu sendiri (kalkulator: "Ubah angka"; formula: isi kotaknya).' },
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
  MUST_BRIX_OUT_OF_RANGE: { title: 'Kadar gula must di luar resep', action: 'Biasanya 14–17 °Brix (target 15). Kurang dari itu alkoholnya tipis, cukanya asam lemah.' },
  ACETIC_POTENTIAL_LOW: { title: 'Cukanya bisa kurang asam', action: 'Naikkan °Brix must (gula) atau pakai starter lebih banyak; target minimal 4% asam asetat.' },
  BINDER_ABOVE_RANGE: { title: 'Perekatnya kebanyakan', action: 'Di atas 8% kalor turun dan abu naik. Coba 4–8% dulu (FAO).' },
  DOUGH_MOISTURE_OUT_OF_RANGE: { title: 'Adonan terlalu kering/basah', action: 'Jaga kadar air adonan 22–28% biar gampang dicetak dan nggak retak.' },
  DOUGH_TOO_WET: { title: 'Bahan sudah kebasahan', action: 'Jangan tambah air. Keringkan serbuk arang dulu atau kurangi air di pasta perekat.' },
  FINAL_MOISTURE_ABOVE_SPEC: { title: 'Kadar air akhir masih tinggi', action: 'Tambah waktu oven/angin-anginkan sampai masuk spesifikasi pembeli.' },
  NAOH_TOO_STRONG: { title: 'NaOH-nya terlalu pekat', action: 'Maksimal 0,1 M (4 g per liter). Lebih pekat bikin lembar rapuh permanen.' },
  COOLING_TOO_SHORT: { title: 'Arang belum cukup dingin', action: 'Mati hampa minimal 8 jam / semalam, tanpa disiram air.' },
  OVEN_TEMP_HIGH: { title: 'Ovennya kepanasan', action: 'Kopra maks 70°C, briket 60–90°C bertahap. Kepanasan = gosong & FFA naik.' },
  SPLIT_DELAY_EXCEEDED: { title: 'Lewat aturan 4 jam', action: 'Batch ini nggak boleh diklaim Edible — maksimal Reguler. Jadwalkan belah sesuai kapasitas pengering.' },
  DRYING_BEHIND_SCHEDULE: { title: 'Pengeringan ketinggalan jadwal', action: 'Target ≤35% di 24 jam dan ≤20% di 48 jam. Pindahkan sebagian ke oven.' },
  YIELD_BELOW_REFERENCE: { title: 'Rendemen di bawah acuan', action: 'Cek kadar air batok, kebanyakan udara saat bakar, atau granul ikut terbuang saat ayak.' },
  PAYLOAD_LEGAL_CHECK: { title: 'Cek batas muat legal truk', action: 'Angka payload dari vendor/platform. Pastikan ke JBI di buku KIR — muatan lebih (ODOL) bisa ditilang & membahayakan.' },
  DERIVED_SCALING: { title: 'Jumlah kipas hasil skala', action: 'Diskalakan dari contoh greenhouse KORA 105 m³. Ukur suhu & RH tiap tingkat saat uji pertama.' },
  BLEND_OUT_OF_SPEC: { title: 'Campuran belum masuk spek', action: 'Geser rasio DT:DR (lihat batas rasio di bawah) atau pakai lot batok lain.' },
};

const SAFETY: WarningCode[] = ['SELF_HEATING_RISK', 'FLAMMABLE', 'FLOOR_OVERLOAD', 'ODOR_CONTAMINATION', 'ITEM_EXCEEDS_CONTAINER', 'NAOH_TOO_STRONG', 'COOLING_TOO_SHORT', 'SPLIT_DELAY_EXCEEDED'];

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
