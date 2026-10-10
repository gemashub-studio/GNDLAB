'use client';

import { formatLotCode, originClass, warehouseSpace, type Meters } from '@gemas/calc-engine';
import { useEffect, useMemo, useState } from 'react';
import { NumberField } from '@/components/ui/fields';
import { Stat } from '@/components/ui/Stat';
import { WarningList } from '@/components/ui/Warnings';
import { fmt } from '@/lib/format';
import { deleteLot, listLots, lotsCsv, saveLot, type RawLot } from '@/lib/lotStore';
import { CalcError, ChainSources, getForm, Note, safe, SopList, Table, useChain, useDataset } from './shared';

const today = () => new Date().toISOString().slice(0, 10);

export function TerimaTab() {
  const c = useChain();
  const ds = useDataset();
  const bagged = getForm(ds, 'kelapa_jambul', 'bagged');
  const pack = bagged.packaging[0]!;
  const dr = c.raw.origin.classes.find((o) => o.id === 'DR')!;
  const threshold = dr.altitude_max_m!;

  const [lots, setLots] = useState<RawLot[]>([]);
  const [form, setForm] = useState({ date: today(), region: '', supplier: '', altitude: undefined as number | undefined, nuts: undefined as number | undefined, note: '' });
  const [msg, setMsg] = useState('');

  const refresh = () => listLots().then(setLots).catch(() => setLots([]));
  useEffect(() => {
    void refresh();
  }, []);

  const origin = form.altitude === undefined ? undefined : originClass(form.altitude, threshold);
  const seq = useMemo(() => {
    if (!origin) return 1;
    const prefix = formatLotCode(c.raw.origin.lot_code_pattern, origin, form.date, 1).slice(0, -3);
    return lots.filter((l) => l.code.startsWith(prefix)).length + 1;
  }, [origin, form.date, lots, c]);
  const code = origin && /^\d{4}-\d{2}-\d{2}$/.test(form.date) && seq <= 999 ? formatLotCode(c.raw.origin.lot_code_pattern, origin, form.date, seq) : undefined;

  const save = async () => {
    if (!code || !origin || !form.nuts || !form.region.trim()) {
      setMsg('Isi daerah asal, ketinggian kebun, dan jumlah butir dulu.');
      return;
    }
    await saveLot({ code, origin, date: form.date, region: form.region.trim(), supplier: form.supplier.trim(), altitudeM: form.altitude!, nuts: form.nuts, note: form.note.trim() });
    setMsg(`Tersimpan: ${code}`);
    setForm((f) => ({ ...f, nuts: undefined, note: '' }));
    void refresh();
  };

  const csv = () => {
    const url = URL.createObjectURL(new Blob([lotsCsv(lots)], { type: 'text/csv' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `register-lot-${today()}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  };

  // Gudang penerimaan: stok per kelas asal dihitung TERPISAH (zona DR & DT tidak dicampur).
  const stackSop = c.receiving.max_stack_height_m.typ;
  const [stackH, setStackH] = useState<number | undefined>(stackSop);
  const zones = useMemo(() => {
    const total = { DR: 0, DT: 0 };
    for (const l of lots) total[l.origin] += l.nuts;
    if (form.nuts && origin) total[origin] += form.nuts;
    return (['DR', 'DT'] as const).map((o) => {
      if (!total[o] || !stackH) return { o, nuts: total[o], r: undefined };
      const r = safe(() => {
        return warehouseSpace({
          stock: { pieces: total[o], unitMass: bagged.params.mass_per_unit! },
          pack: { l: pack.dims!.l, w: pack.dims!.w, h: pack.dims!.h, netKg: pack.netKg, ...(pack.pcsPerPack && { pcs: pack.pcsPerPack }) },
          stackHeightM: stackH as Meters,
          context: { commodityCode: 'kelapa_jambul' },
        });
      });
      return { o, nuts: total[o], r };
    });
  }, [lots, form.nuts, origin, stackH, bagged, pack]);

  return (
    <div className="flex flex-col gap-5" data-testid="chain-terima">
      <Note title="Kenapa asal dicatat?">
        Batok kelapa {c.raw.origin.classes.map((o) => `${o.id} (${o.rule})`).join(' dan ')} diproses terpisah sampai jadi arang & briket, supaya mutu tiap asal bisa
        dibandingkan. {c.raw.origin.note}
      </Note>

      <section className="card flex flex-col gap-3" aria-label="Catat lot masuk">
        <h3 className="text-xl">Catat lot masuk</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className="label-mono">Tanggal masuk</span>
            <input type="date" className="field" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} data-testid="lot-date" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="label-mono">Daerah / kebun asal</span>
            <input className="field" value={form.region} onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))} placeholder="mis. Pesisir Indragiri Hilir" data-testid="lot-region" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="label-mono">Pemasok / pengepul</span>
            <input className="field" value={form.supplier} onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))} data-testid="lot-supplier" />
          </label>
          <NumberField label="Ketinggian kebun" unit="mdpl" min={0} max={5000} value={form.altitude} onValue={(v) => setForm((f) => ({ ...f, altitude: v }))}
            hint="Dari GPS/peta kebun; tanya pengepul bila perlu" testId="lot-alt" />
          <NumberField label="Jumlah kelapa" unit="butir" integer min={1} max={10_000_000} value={form.nuts} onValue={(v) => setForm((f) => ({ ...f, nuts: v }))} testId="lot-nuts" />
          <label className="flex flex-col gap-1">
            <span className="label-mono">Catatan</span>
            <input className="field" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="kondisi, % retak, dll." />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="tag-mono" data-testid="lot-code">{code ?? 'KODE LOT: isi ketinggian'}</span>
          {origin && <span className={`border-3 border-ink px-2 py-1 font-bold ${origin === 'DT' ? 'bg-ink text-acid' : 'bg-acid'}`} data-testid="lot-origin">{origin === 'DT' ? 'DATARAN TINGGI' : 'DATARAN RENDAH / PESISIR'}</span>}
          <button type="button" className="btn-primary" onClick={() => void save()} data-testid="lot-save">Simpan lot</button>
          {msg && <span className="font-mono text-xs" role="status" data-testid="lot-msg">{msg}</span>}
        </div>
        <ChainSources ids={c.raw.origin.source_ids} confidence="C" />
      </section>

      <section className="flex flex-col gap-2" aria-label="Register lot">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xl">Register lot ({lots.length})</h3>
          {lots.length > 0 && <button type="button" className="btn-ghost" onClick={csv}>Unduh CSV</button>}
        </div>
        {lots.length ? (
          <Table
            testId="lot-list"
            head={['Kode', 'Asal', 'Daerah', 'mdpl', 'Butir', '']}
            rows={lots.map((l) => [
              <strong key="c">{l.code}</strong>,
              l.origin,
              `${l.region}${l.supplier ? ` · ${l.supplier}` : ''}`,
              fmt(l.altitudeM, 0),
              fmt(l.nuts, 0),
              <button key="d" type="button" className="font-mono text-xs underline" onClick={() => void deleteLot(l.code).then(refresh)}>hapus</button>,
            ])}
          />
        ) : (
          <p className="text-sm text-muted">Belum ada lot. Data tersimpan di perangkat ini (offline).</p>
        )}
      </section>

      <section className="card flex flex-col gap-3" aria-label="Gudang penerimaan">
        <h3 className="text-xl">Ruang gudang penerimaan per asal</h3>
        <NumberField label="Tinggi tumpuk karung" unit="m" min={0.3} max={stackSop} value={stackH} onValue={setStackH}
          hint={`SOP KORA maksimal ${fmt(stackSop, 1)} m (beban lapis bawah)`} testId="terima-stack" />
        <div className="grid gap-3 sm:grid-cols-2">
          {zones.map(({ o, nuts, r }) => (
            <div key={o} className="flex flex-col gap-2 border-3 border-ink p-3" data-testid={`zone-${o}`}>
              <p className="font-extrabold">Zona {o}</p>
              {!nuts ? (
                <p className="text-sm text-muted">Belum ada stok.</p>
              ) : r && !r.ok ? (
                <CalcError message={r.message} />
              ) : r ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <Stat label="Butir" value={fmt(nuts, 0)} />
                    <Stat label="Karung" value={fmt(r.v.result.typ.packs ?? 0, 0)} />
                    <Stat label="Luas lantai" value={`${fmt(r.v.result.typ.floorAreaM2, 1)} m²`} accent />
                    <Stat label="Tumpukan" value={fmt(r.v.result.typ.stacks ?? 0, 0)} />
                  </div>
                  <WarningList warnings={r.v.warnings} />
                </>
              ) : null}
            </div>
          ))}
        </div>
        <ChainSources ids={c.receiving.max_stack_height_m.sourceIds} confidence={c.receiving.max_stack_height_m.confidence} />
      </section>

      <SopList
        title="Penerimaan & simpan awal"
        testId="sop-terima"
        steps={[
          'Cek surat jalan & asal kebun; ukur/isi ketinggian kebun → sistem memberi kode lot DR/DT.',
          'Sortir cepat saat bongkar: pisahkan butir retak/bocor & berbau (proses duluan atau tolak).',
          'Timbang & hitung butir; catat di register lot. Tempel label kode lot + tanggal di tiap tumpukan.',
          `Simpan di atas palet, ventilasi silang, tumpukan karung maksimal ${fmt(stackSop, 1)} m, zona DR & DT dipisah jelas (garis lantai/papan nama).`,
          'FIFO ketat: lot paling lama dibelah duluan; umur simpan kelapa ambien terbatas (lihat peringatan).',
        ]}
        tools={['Palet', 'Timbangan', 'GPS/peta kebun', 'Label lot', 'Papan zona DR/DT', 'Form penerimaan']}
      />
    </div>
  );
}
