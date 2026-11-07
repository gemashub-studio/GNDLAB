/**
 * Menu GnD Lab (DEC-143): dulu roda pilihan di halaman /lab (DEC-126), kini anak menu "GnD Lab" di navbar & menu ☰.
 * Satu daftar dipakai navbar, halaman lab, dan asisten suara.
 */
export const LAB_MENU = [
  { id: 'bahan', label: 'Pencatatan Data', note: 'Data awal & akhir per nomor, perlakuan, foto, dan kesimpulan.' },
  { id: 'protokol', label: 'Riset Produk', note: 'Resep berversi, laporan harian sampai riset selesai.' },
  { id: 'belanja', label: 'Laporan Belanja', note: 'Nota & foto barang, LPJ siap unduh.' },
  { id: 'gabung', label: 'Gabungkan Data', note: 'Satukan pencatatan, riset, dan laporan belanja dalam satu berkas.' },
  // DEC-144
  { id: 'harian', label: 'Daily Report R&D', note: 'Pencatatan harian by Drive: tautan Drive + tanggal otomatis.' },
] as const;
export type LabTabId = (typeof LAB_MENU)[number]['id'];
export const isLabTab = (s: string | null | undefined): s is LabTabId => LAB_MENU.some((t) => t.id === s);

/** Event: pindah menu GnD Lab tanpa memuat ulang halaman (detail = id menu). */
export const LAB_TAB_EVENT = 'gnd-lab-tab';
/** Event dari halaman lab: menu yang sedang tampil berubah (detail = id menu) → navbar menandai anak menu aktif. */
export const LAB_TAB_SHOWN = 'gnd-lab-tab-shown';

/**
 * Buka menu GnD Lab. Sudah di /lab → ganti menu lewat event (halaman lab membaca ?t= hanya saat dimuat);
 * dari halaman lain → buka /lab?t=<id>.
 */
export function openLabTab(id: LabTabId, push: (href: string) => void): void {
  if (window.location.pathname === '/lab') window.dispatchEvent(new CustomEvent(LAB_TAB_EVENT, { detail: id }));
  else {
    // router Next memperbarui alamat SETELAH halaman lab terpasang → titipkan menu tujuan untuk dibaca saat dimuat
    pending = id;
    push(`/lab?t=${id}`);
  }
}

let pending: LabTabId | undefined;
/** Menu tujuan yang dititipkan openLabTab (sekali baca). */
export function takePendingLabTab(): LabTabId | undefined {
  const t = pending;
  pending = undefined;
  return t;
}

/** Menu GnD Lab di alamat saat ini (default Pencatatan Data). */
export const currentLabTab = (): LabTabId => {
  const t = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('t');
  return isLabTab(t) ? t : 'bahan';
};
