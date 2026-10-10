'use client';

import { greenhouseServices, rackRoomDesign, sunDryingArea, type RackRoomResult } from '@gemas/calc-engine';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ChoiceGroup, NumberField } from '@/components/ui/fields';
import { Stat } from '@/components/ui/Stat';
import { WarningList } from '@/components/ui/Warnings';
import { fmt } from '@/lib/format';
import { BigResult, CalcError, ChainSources, Note, paramText, safe, SopList, useChain, useFormula, useProcess } from './shared';

type Method = 'greenhouse' | 'sun' | 'oven';

/** Tampak depan skematis (lebar × tinggi): rak, tingkat, lorong. Bukan gambar kerja. */
function FrontView({ W, H, r, depth, pitch }: { W: number; H: number; r: RackRoomResult; depth: number; pitch: number }) {
  const px = 300 / W;
  const h = H * px;
  const racks = Array.from({ length: r.racks }, (_, i) => (r.racks > 1 ? i * (depth + r.aisleM) : 0));
  return (
    <figure className="flex flex-col gap-1" data-testid="gh-svg">
      <svg viewBox={`-4 -4 ${300 + 8} ${h + 24}`} className="w-full max-w-[420px] border-3 border-ink bg-paper" role="img" aria-label={`Tampak depan: ${r.racks} rak, ${r.tiers} tingkat`}>
        <rect x={0} y={0} width={300} height={h} fill="none" stroke="currentColor" strokeWidth={2} />
        {racks.map((x0, i) => (
          <g key={i}>
            <rect x={x0 * px} y={h - r.rackHeightM * px} width={depth * px} height={r.rackHeightM * px} fill="#C6F135" stroke="currentColor" strokeWidth={1.5} />
            {Array.from({ length: r.tiers }, (_, t) => (
              <line key={t} x1={x0 * px} x2={(x0 + depth) * px} y1={h - (t + 1) * pitch * px} y2={h - (t + 1) * pitch * px} stroke="currentColor" strokeWidth={1} />
            ))}
          </g>
        ))}
        {r.racks > 1 &&
          racks.slice(0, -1).map((x0, i) => (
            <text key={i} x={(x0 + depth + r.aisleM / 2) * px} y={h - 6} fontSize={10} textAnchor="middle" fontFamily="monospace">
              {fmt(r.aisleM, 2)} m
            </text>
          ))}
        <text x={150} y={h + 16} fontSize={11} textAnchor="middle" fontFamily="monospace">
          lebar {fmt(W, 2)} m · tinggi {fmt(H, 2)} m
        </text>
      </svg>
      <figcaption className="font-mono text-[11px] text-muted">Representasi skematis tampak depan — rak hijau, garis = tingkat tray, angka = lebar lorong.</figcaption>
    </figure>
  );
}

function RackInputs({ dims, setDims, tray, setTray, prefix }: {
  dims: { L?: number; W?: number; H?: number };
  setDims: (f: (d: { L?: number; W?: number; H?: number }) => { L?: number; W?: number; H?: number }) => void;
  tray: { L?: number; W?: number; end?: number };
  setTray: (f: (d: { L?: number; W?: number; end?: number }) => { L?: number; W?: number; end?: number }) => void;
  prefix: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <NumberField label="Panjang ruang" unit="m" min={1} max={200} value={dims.L} onValue={(v) => setDims((d) => ({ ...d, L: v }))} testId={`${prefix}-L`} />
      <NumberField label="Lebar ruang" unit="m" min={0.5} max={100} value={dims.W} onValue={(v) => setDims((d) => ({ ...d, W: v }))} testId={`${prefix}-W`} />
      <NumberField label="Tinggi ruang" unit="m" min={1} max={20} value={dims.H} onValue={(v) => setDims((d) => ({ ...d, H: v }))} testId={`${prefix}-H`} />
      <NumberField label="Panjang tray" unit="m" min={0.2} max={10} value={tray.L} onValue={(v) => setTray((t) => ({ ...t, L: v }))} hint="Kosong = hitung luasan (cara KORA)" testId={`${prefix}-trayL`} />
      <NumberField label="Lebar tray" unit="m" min={0.2} max={2} value={tray.W} onValue={(v) => setTray((t) => ({ ...t, W: v }))} hint="Kosong = selebar rak" testId={`${prefix}-trayW`} />
      <NumberField label="Jarak bebas tiap ujung" unit="m" min={0} max={20} value={tray.end} onValue={(v) => setTray((t) => ({ ...t, end: v }))} hint="Ruang pintu/kipas; 0 = rak sepanjang ruang" />
    </div>
  );
}

function useRack(dims: { L?: number; W?: number; H?: number }, tray: { L?: number; W?: number; end?: number }) {
  const c = useChain();
  const f = useFormula();
  const g = c.greenhouse;
  return useMemo(
    () =>
      dims.L && dims.W && dims.H
        ? safe(() =>
            rackRoomDesign({
              roomL: dims.L!,
              roomW: dims.W!,
              roomH: dims.H!,
              rackDepth: g.rack_depth_m,
              tierPitch: g.tier_pitch_m,
              aisleMin: g.aisle_min_m,
              roofClearance: g.roof_clearance_m,
              halvesPerM2: f.kopra.greenhouseHalves,
              ...(tray.L && { trayL: tray.L }),
              ...(tray.W && { trayW: tray.W }),
              ...(tray.end !== undefined && { endClearanceM: tray.end }),
              datasetVersion: `rantai.${c.version}`,
            }),
          )
        : undefined,
    [dims, tray, g, f, c.version],
  );
}

function RackResult({ r, prefix, trays }: { r: RackRoomResult; prefix: string; trays: boolean }) {
  const c = useChain();
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid={`${prefix}-rack`}>
      <Stat label="Ukuran 1 rak" value={`${fmt(c.greenhouse.rack_depth_m.typ, 2)} × ${fmt(r.rackLenM, 1)} × ${fmt(r.rackHeightM, 1)} m`} sub="dalam × panjang × tinggi" />
      <Stat label="Baris rak" value={fmt(r.racks, 0)} testId={`${prefix}-racks`} accent />
      <Stat label="Tingkat per rak" value={fmt(r.tiers, 0)} sub={`jarak ${fmt(c.greenhouse.tier_pitch_m.typ, 2)} m`} testId={`${prefix}-tiers`} />
      <Stat label="Jarak antar rak (lorong)" value={`${fmt(r.aisleM, 2)} m`} sub={`${fmt(r.aisles, 0)} lorong`} testId={`${prefix}-aisle`} />
      {trays ? (
        <>
          <Stat label="Tray per tingkat" value={fmt(r.traysPerTier, 0)} sub={`total ${fmt(r.trays, 0)} tray`} testId={`${prefix}-trays`} />
          <Stat label="Kelapa per tray" value={`${fmt(r.nutsPerTray, 1)} butir`} sub={`${fmt(r.halvesPerTray, 0)} belahan`} testId={`${prefix}-pertray`} />
        </>
      ) : (
        <Stat label="Tray" value="isi ukuran tray" sub="untuk jumlah tray & kelapa per tray" />
      )}
      <Stat label="Luas rak total" value={`${fmt(r.totalAreaM2, 1)} m²`} />
      <Stat label="Volume ruang" value={`${fmt(r.roomM3, 1)} m³`} />
    </div>
  );
}

function Greenhouse() {
  const c = useChain();
  const f = useFormula();
  const g = c.greenhouse;
  const ref = c.raw.greenhouse.ref_room_m;
  const [dims, setDims] = useState<{ L?: number; W?: number; H?: number }>({ L: ref.L, W: ref.W, H: ref.H });
  const [tray, setTray] = useState<{ L?: number; W?: number; end?: number }>({ end: 0 });
  const [load, setLoad] = useState<number | undefined>();
  const rack = useRack(dims, tray);
  const r = rack?.ok ? rack.v.result : undefined;
  const byTray = tray.L !== undefined;
  const cap = r ? (byTray ? r.typ.nutsByTrays : r.typ.nutsByArea) : 0;
  const nuts = load ?? cap;
  const svc = useMemo(
    () =>
      r
        ? safe(() =>
            greenhouseServices({
              roomM3: r.typ.roomM3,
              nuts,
              aisles: r.typ.aisles,
              refRoomM3: ref.L * ref.W * ref.H,
              fansPerRefRoom: g.fans_per_ref_room,
              sulfurGPerNut: f.kopra.sulfurGPerNut,
              sulfurGPerM3: f.kopra.sulfurGPerM3,
              roomPerPointM3: g.sulfur_room_per_point_m3,
              datasetVersion: `rantai.${c.version}`,
            }),
          )
        : undefined,
    [r, nuts, ref, g, f, c.version],
  );
  const s = svc?.ok ? svc.v.result : undefined;

  return (
    <div className="flex flex-col gap-4" data-testid="gh">
      <Note>
        Isi ukuran greenhouse kamu — rak, tingkat, lorong, tray, kipas, dan belerang dihitung otomatis. Angka bawaan = contoh greenhouse KORA {fmt(ref.W, 0)}×{fmt(ref.L, 0)}×{fmt(ref.H, 1)} m.
      </Note>
      <RackInputs dims={dims} setDims={setDims} tray={tray} setTray={setTray} prefix="gh" />
      {rack && !rack.ok && <CalcError message={rack.message} />}
      {r && (
        <>
          <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
            <BigResult
              label={byTray ? 'KAPASITAS PER ANGKATAN (HITUNG TRAY)' : 'KAPASITAS PER ANGKATAN (LUASAN)'}
              value={fmt(cap, 0)}
              unit="BUTIR"
              sub={
                byTray
                  ? `${fmt(r.typ.nutsByTrays * 2, 0)} belahan · cara luasan ${fmt(r.min.nutsByArea, 0)}–${fmt(r.max.nutsByArea, 0)} butir (selisih = sisa tepi tray)`
                  : `rentang ${fmt(r.min.nutsByArea, 0)}–${fmt(r.max.nutsByArea, 0)} butir · ${paramText(f.kopra.greenhouseHalves, 0)} belahan/m² × ${fmt(r.typ.totalAreaM2, 0)} m²`
              }
              confidence={rack!.ok ? rack!.v.confidence : undefined}
              testId="gh-cap"
            />
            <FrontView W={dims.W!} H={dims.H!} r={r.typ} depth={g.rack_depth_m.typ} pitch={g.tier_pitch_m.typ} />
          </div>
          <RackResult r={r.typ} prefix="gh" trays={byTray} />
          <ChainSources ids={[...g.rack_depth_m.sourceIds, ...f.kopra.greenhouseHalves.sourceIds]} confidence="C" />

          <section className="card flex flex-col gap-3" aria-label="Kemiringan">
            <h3 className="text-xl">Penataan & kemiringan</h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" data-testid="gh-tilt">
              <Stat label={`Hari 1–${fmt(g.face_down_days.max, 0)}`} value="Telungkup" sub="daging menghadap bawah — sisa air menetes" />
              <Stat label={`Hari ${fmt(g.face_down_days.max + 1, 0)} dst`} value={`Terlentang ${fmt(g.face_up_tilt_deg.min, 0)}–${fmt(g.face_up_tilt_deg.max, 0)}°`} sub="menghadap sinar / aliran udara" accent />
              <Stat label="Tray rak berkipas" value={`Miring ${fmt(g.fan_tray_tilt_deg.min, 0)}–${fmt(g.fan_tray_tilt_deg.max, 0)}°`} sub="condong ke exhaust — kondensasi mengalir keluar" />
            </div>
            <p className="text-sm">Tray berlubang/berongga (bukan papan rata) supaya uap dari bawah daging ikut keluar. Belahan dirapatkan tanpa saling menindih.</p>
            <ChainSources ids={g.face_up_tilt_deg.sourceIds} confidence={g.face_up_tilt_deg.confidence} />
          </section>

          <section className="card flex flex-col gap-3" aria-label="Kipas & belerang">
            <h3 className="text-xl">Kipas sirkulasi & belerang</h3>
            <NumberField label="Isi kelapa angkatan ini" unit="butir" integer min={1} max={1_000_000} value={load} onValue={setLoad}
              hint={`Kosong = kapasitas penuh ${fmt(cap, 0)} butir`} testId="gh-load" />
            {svc && !svc.ok && <CalcError message={svc.message} />}
            {s && (
              <>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Stat label="Kipas Ø16–20″" value={`${fmt(s.min.fans, 0)}–${fmt(s.max.fans, 0)} unit`} sub={`posisi: ${fmt(s.typ.fanPositions, 0)} titik (ujung tiap lorong)`} testId="gh-fans" accent />
                  <Stat label="Jam kipas" value={`${fmt(g.fan_run_h.typ, 0)} jam/hari`} sub="10.00–15.00 · MATI saat fumigasi" />
                  <Stat label="Belerang (per butir)" value={`${fmt(s.min.sulfurByNutsG / 1000, 2)}–${fmt(s.max.sulfurByNutsG / 1000, 2)} kg`} sub={`${paramText(f.kopra.sulfurGPerNut, 1)} g/butir`} testId="gh-sulfur" accent />
                  <Stat label="Belerang (per ruang)" value={`${fmt(s.min.sulfurByRoomG / 1000, 2)}–${fmt(s.max.sulfurByRoomG / 1000, 2)} kg`} sub={`${paramText(f.kopra.sulfurGPerM3, 0)} g/m³ — bila tataan renggang`} />
                  <Stat label="Titik bakar" value={fmt(s.typ.burnPoints, 0)} sub={`±${fmt(s.typ.sulfurPerPointG, 0)} g/titik · lantai lorong tengah`} testId="gh-points" />
                  <Stat label="Waktu paparan" value={`${fmt(g.sulfur_exposure_h.min, 0)}–${fmt(g.sulfur_exposure_h.max, 0)} jam`} sub="malam, ruang tertutup rapat" />
                  <Stat label="Ventilasi sebelum masuk" value={`${fmt(g.sulfur_ventilate_h.min * 60, 0)}–${fmt(g.sulfur_ventilate_h.max * 60, 0)} menit`} sub="buka pintu + exhaust" />
                  <Stat label="Suhu target siang" value={`${fmt(g.day_temp_c.min, 0)}–${fmt(g.day_temp_c.max, 0)} °C`} sub={`ventilasi dibuka ${fmt(g.vent_open_pct.min, 0)}–${fmt(g.vent_open_pct.max, 0)}%`} />
                </div>
                <WarningList warnings={svc!.ok ? svc!.v.warnings : []} />
                <ChainSources ids={[...g.fans_per_ref_room.sourceIds, ...f.kopra.sulfurGPerNut.sourceIds]} confidence="C" />
                <p className="text-sm">
                  Jadwal bertahap malam berikutnya (bila darurat lembap), batas malam & uji residu SO₂: lihat{' '}
                  <Link href="/formula?p=kopra">Formula R&amp;D → Kopra</Link>.
                </p>
              </>
            )}
          </section>

          <SopList
            title="Greenhouse kopra putih"
            testId="sop-gh"
            steps={[
              'Belahan yang sudah ditiriskan masuk rak maksimal 4 jam sejak dibelah; isi tray dari tingkat atas ke bawah, satu lot asal per rak (label kode lot).',
              `Hari 1–${fmt(g.face_down_days.max, 0)}: telungkup. Hari berikutnya: balik terlentang, miring ${fmt(g.face_up_tilt_deg.min, 0)}–${fmt(g.face_up_tilt_deg.max, 0)}° ke arah sinar/aliran udara.`,
              `Siang: greenhouse tertutup (efek rumah kaca), kipas nyala 10.00–15.00, kisi berkasa dibuka ${fmt(g.vent_open_pct.min, 0)}–${fmt(g.vent_open_pct.max, 0)}% untuk buang uap. Catat suhu & RH tiap tingkat 2× sehari.`,
              'Malam pertama (setelah air tiris): matikan SEMUA kipas, tutup rapat semua ventilasi dengan terpal/plastik.',
              'Letakkan wadah tahan api berkaki di lantai lorong tengah (bukan di bawah rak kayu/bambu), nyalakan bara kecil (sabut/arang), taburkan belerang sesuai dosis hingga asap putih kekuningan.',
              `Biarkan tertutup ${fmt(g.sulfur_exposure_h.min, 0)}–${fmt(g.sulfur_exposure_h.max, 0)} jam. Pagi: buka semua pintu + exhaust ${fmt(g.sulfur_ventilate_h.min * 60, 0)}–${fmt(g.sulfur_ventilate_h.max * 60, 0)} menit sebelum orang masuk.`,
              'Ukur kadar air harian (alarm 24/48 jam di Formula Kopra); bila tertinggal jadwal, pindahkan sebagian ke oven.',
            ]}
            tools={['Rak + tray berlubang (bambu serut/plastik food-grade)', 'Plastik UV atap', `Kipas sirkulasi Ø16–20″`, 'Exhaust fan', 'Termometer & higrometer', 'Wadah bakar tahan api berkaki', 'Belerang bubuk + timbangan', 'Terpal penutup ventilasi', 'Timer', 'APAR']}
            safety="SO₂ iritan: hanya petugas terlatih dengan respirator gas asam; tidak ada orang di dalam saat fumigasi; rambu di pintu; alat ukur SO₂ portabel bila ada. Gas belerang korosif — cek baut/rangka & plastik UV berkala."
          />
        </>
      )}
    </div>
  );
}

function Sun() {
  const c = useChain();
  const f = useFormula();
  const p = useProcess();
  const sun = p.dryingMethods.find((m) => m.id === 'sun')!;
  const [nuts, setNuts] = useState<number | undefined>(1000);
  const calc = useMemo(() => (nuts ? safe(() => sunDryingArea(nuts, f.kopra.greenhouseHalves, `rantai.${c.version}`)) : undefined), [nuts, f, c.version]);
  return (
    <div className="flex flex-col gap-4" data-testid="sun">
      <NumberField label="Kelapa dijemur" unit="butir" integer min={1} max={1_000_000} value={nuts} onValue={setNuts} testId="sun-nuts" />
      {calc && !calc.ok && <CalcError message={calc.message} />}
      {calc?.ok && (
        <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
          <BigResult label="LUAS PARA-PARA (SATU LAPIS)" value={fmt(calc.v.result.typ.areaM2, 0)} unit="M²" sub={`${fmt(calc.v.result.min.areaM2, 0)}–${fmt(calc.v.result.max.areaM2, 0)} m² · ${paramText(f.kopra.greenhouseHalves, 0)} belahan/m²`} confidence={calc.v.confidence} testId="sun-area" />
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Tinggi para-para" value={`${fmt(c.sun.rack_height_m.min * 100, 0)}–${fmt(c.sun.rack_height_m.max * 100, 0)} cm`} sub="dari tanah" />
            <Stat label="Lama jemur" value={`${fmt(sun.duration.min / 24, 0)}–${fmt(sun.duration.max / 24, 0)} hari`} sub="hanya siang · tergantung cuaca" accent />
          </div>
        </div>
      )}
      <ChainSources ids={[...c.sun.rack_height_m.sourceIds, ...sun.duration.sourceIds]} confidence="C" />
      <SopList
        title="Jemur matahari"
        testId="sop-sun"
        steps={[
          'Pasang para-para/widig bambu setinggi 50–70 cm — jangan jemur di tanah (kotor & lembap balik).',
          'Hari 1–2 belahan telungkup, lalu terlentang; satu lot asal per blok para-para.',
          'Tutup terpal saat hujan & malam (embun); buka lagi saat matahari terik.',
          'Ukur kadar air harian; kopra yang lambat kering pindah ke oven agar tidak berjamur.',
        ]}
        tools={['Para-para/widig bambu', 'Terpal', 'Moisture meter', 'Label lot']}
      />
    </div>
  );
}

function Oven() {
  const c = useChain();
  const f = useFormula();
  const p = useProcess();
  const ov = p.dryingMethods.find((m) => m.id === 'oven')!;
  const ref = c.raw.oven.ref_room_m;
  const [dims, setDims] = useState<{ L?: number; W?: number; H?: number }>({ L: ref.L, W: ref.W, H: ref.H });
  const [tray, setTray] = useState<{ L?: number; W?: number; end?: number }>({ end: 0 });
  const rack = useRack(dims, tray);
  const r = rack?.ok ? rack.v.result : undefined;
  return (
    <div className="flex flex-col gap-4" data-testid="oven">
      <Note>Ruang oven contoh KORA {fmt(ref.W, 0)}×{fmt(ref.L, 0)}×{fmt(ref.H, 0)} m dengan tungku terpisah — rak dihitung dengan prinsip yang sama dengan greenhouse. {c.raw.oven.note}</Note>
      <RackInputs dims={dims} setDims={setDims} tray={tray} setTray={setTray} prefix="oven" />
      {rack && !rack.ok && <CalcError message={rack.message} />}
      {r && (
        <>
          <BigResult label="KAPASITAS OVEN PER ANGKATAN" value={fmt(tray.L !== undefined ? r.typ.nutsByTrays : r.typ.nutsByArea, 0)} unit="BUTIR" sub={`luasan ${fmt(r.min.nutsByArea, 0)}–${fmt(r.max.nutsByArea, 0)} butir`} confidence={rack!.ok ? rack!.v.confidence : undefined} testId="oven-cap" />
          <RackResult r={r.typ} prefix="oven" trays={tray.L !== undefined} />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Stat label="Suhu" value={`${fmt(ov.temperatureC!.min, 0)}–${fmt(ov.temperatureC!.max, 0)} °C`} sub={`maks ${paramText(f.kopra.oven_max_temp_c, 0)} °C`} accent />
            <Stat label="Lama" value={`${fmt(ov.duration.min, 0)}–${fmt(ov.duration.max, 0)} jam`} />
            <Stat label="Kemiringan tray" value={`±${fmt(c.oven.tray_tilt_deg.typ, 0)}°`} sub="daging ke atas, condong ke jalur uap keluar" />
          </div>
          <ChainSources ids={[...c.oven.tray_tilt_deg.sourceIds, ...ov.duration.sourceIds]} confidence="C" />
          <p className="text-sm">Profil suhu–jam teruji (IPB) & jadwal per angkatan: <Link href="/formula?p=kopra">Formula R&amp;D → Kopra</Link>.</p>
        </>
      )}
      <SopList
        title="Oven kopra (pemanas tidak langsung)"
        testId="sop-oven"
        steps={[
          'Tungku/ruang bakar terpisah dari ruang rak; panas lewat saluran/pipa — asap tidak boleh menyentuh kopra.',
          'Isi rak: daging menghadap atas/arah aliran panas, tempurung di bawah, tray miring ±10° ke jalur keluar uap.',
          `Mulai di suhu bawah ±${fmt(ov.temperatureC!.min, 0)} °C, naikkan bertahap ke ±${fmt(ov.temperatureC!.max, 0)} °C; JANGAN lewat ${paramText(f.kopra.oven_max_temp_c, 0)} °C (gosong, FFA naik, case hardening).`,
          'Tambah bahan bakar (batok/sabut) terjadwal; catat suhu tiap jam.',
          'Ukur kadar air akhir sebelum bongkar; dinginkan sebelum dikemas.',
        ]}
        tools={['Ruang rak berinsulasi', 'Tungku + saluran panas + cerobong', 'Termometer/termokopel', 'Moisture meter', 'Sarung tangan tahan panas', 'APAR']}
        safety="Jarak aman kayu bakar dari tungku, inspeksi cerobong berkala, APAR wajib di area tungku."
      />
    </div>
  );
}

export function KeringTab() {
  const [m, setM] = useState<Method>('greenhouse');
  return (
    <div className="flex flex-col gap-5" data-testid="chain-kering">
      <ChoiceGroup<Method>
        legend="Metode pengeringan"
        columns={3}
        value={m}
        onChange={setM}
        options={[
          { value: 'greenhouse', label: 'Greenhouse', testId: 'kering-gh' },
          { value: 'sun', label: 'Jemur matahari', testId: 'kering-sun' },
          { value: 'oven', label: 'Oven', testId: 'kering-oven' },
        ]}
      />
      {m === 'greenhouse' && <Greenhouse />}
      {m === 'sun' && <Sun />}
      {m === 'oven' && <Oven />}
    </div>
  );
}
