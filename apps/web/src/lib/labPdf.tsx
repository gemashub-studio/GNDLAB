/**
 * PDF harian & PDF kompilasi eksperimen GEMA RnD (@react-pdf/renderer, di browser, offline).
 * Isi HANYA dari data tercatat: tabel hasil ukur mentah, grafik bila ≥ 2 titik angka, media (thumbnail +
 * nama berkas; video asli ada di file cadangan, tidak ditanam di PDF). Hasil gagal tidak disembunyikan.
 * Dimuat dinamis saat tombol ditekan.
 */
import { Circle, Document, G, Image, Line, Page, Polyline, Rect, StyleSheet, Svg, Text, View, pdf } from '@react-pdf/renderer';
import {
  chartable,
  LAB_PRODUCTS,
  LAB_STATUS,
  measurementSeries,
  NOT_RECORDED,
  type DailyEntry,
  type Experiment,
  type MediaItem,
  type ProtocolVersion,
  type Series,
} from './labStore';
import { summarize, type ResponseSummary } from './labDesign';
import type { ResearchReport } from './researchReport';
import { CHART_H, CHART_W, chartLayout, type ChartSpec } from './reportCharts';

const C = { ink: '#0E1A1F', paper: '#F3F6F7', grid: '#E2E8EA', mint: '#1FA88F', mintLight: '#63E6CF', amber: '#F5A524', muted: '#5B6B72' };
const SERIES_COLORS = [C.mint, C.amber, C.ink, '#7C5CBF', '#D9534F', '#3B82F6'];

const s = StyleSheet.create({
  page: { padding: 32, paddingBottom: 48, fontFamily: 'Helvetica', fontSize: 9.5, color: C.ink, backgroundColor: '#FFFFFF' },
  head: { backgroundColor: C.ink, color: C.paper, padding: 14, marginBottom: 14, borderRadius: 8 },
  brand: { fontFamily: 'Helvetica-Bold', fontSize: 11, color: C.mintLight },
  title: { fontFamily: 'Helvetica-Bold', fontSize: 16, marginTop: 4 },
  meta: { fontFamily: 'Courier', fontSize: 8, color: '#A9B8BE', marginTop: 4 },
  h2: { fontFamily: 'Helvetica-Bold', fontSize: 12, marginTop: 10, marginBottom: 6 },
  box: { borderWidth: 1, borderColor: C.grid, borderRadius: 6, padding: 8, marginBottom: 8 },
  label: { fontFamily: 'Courier-Bold', fontSize: 7.5, color: C.muted, marginBottom: 2, textTransform: 'uppercase' },
  empty: { color: C.muted, fontFamily: 'Helvetica-Oblique' },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderColor: C.grid },
  th: { fontFamily: 'Courier-Bold', fontSize: 7.5, padding: 4, backgroundColor: C.paper },
  td: { fontSize: 8.5, padding: 4 },
  foot: { position: 'absolute', bottom: 18, left: 32, right: 32, fontFamily: 'Courier', fontSize: 7, color: C.muted },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumb: { width: 150, marginBottom: 6 },
});

const productName = (id: string) => LAB_PRODUCTS.find((p) => p.id === id)?.name ?? id;
const statusName = (id: string) => LAB_STATUS.find((x) => x.id === id)?.label ?? id;
const orEmpty = (v: string) => (v.trim() ? <Text>{v}</Text> : <Text style={s.empty}>{NOT_RECORDED}</Text>);

function Block({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.box} wrap={false}>
      <Text style={s.label}>{label}</Text>
      {orEmpty(value)}
    </View>
  );
}

function Table({ head, rows, widths }: { head: string[]; rows: string[][]; widths: number[] }) {
  return (
    <View style={{ borderWidth: 1, borderColor: C.grid, borderRadius: 4, marginBottom: 8 }}>
      <View style={s.row} fixed>
        {head.map((h, i) => <Text key={h} style={[s.th, { width: `${widths[i]}%` }]}>{h}</Text>)}
      </View>
      {rows.map((r, j) => (
        <View key={j} style={s.row} wrap={false}>
          {r.map((c, i) => <Text key={i} style={[s.td, { width: `${widths[i]}%` }]}>{c || '–'}</Text>)}
        </View>
      ))}
    </View>
  );
}

/** Grafik garis per kelompok; sumbu X = urutan waktu ukur tercatat, sumbu Y = nilai (satuan asli). */
function Chart({ series }: { series: Series }) {
  const W = 500;
  const H = 170;
  const pad = { l: 44, r: 10, t: 10, b: 30 };
  const times = [...new Set(series.points.map((p) => p.at))].sort();
  const vals = series.points.map((p) => p.value);
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  if (lo === hi) {
    lo -= Math.abs(lo) * 0.1 || 1;
    hi += Math.abs(hi) * 0.1 || 1;
  }
  const x = (t: string) => pad.l + (times.length === 1 ? 0.5 : times.indexOf(t) / (times.length - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);
  const groups = [...new Set(series.points.map((p) => p.group || 'semua'))];
  const fmt = (v: number) => String(Number(v.toPrecision(4))).replace('.', ',');

  return (
    <View wrap={false} style={{ marginBottom: 8 }}>
      <Svg width={W} height={H}>
        {[0, 0.5, 1].map((f) => {
          const v = lo + f * (hi - lo);
          return (
            <G key={f}>
              <Line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke={C.grid} strokeWidth={1} />
              <Text x={4} y={y(v) + 3} style={{ fontSize: 7, fontFamily: 'Courier' }}>{fmt(v)}</Text>
            </G>
          );
        })}
        {groups.map((g, gi) => {
          const pts = series.points.filter((p) => (p.group || 'semua') === g);
          const color = SERIES_COLORS[gi % SERIES_COLORS.length]!;
          return (
            <G key={g}>
              {pts.length > 1 && <Polyline points={pts.map((p) => `${x(p.at)},${y(p.value)}`).join(' ')} fill="none" stroke={color} strokeWidth={1.5} />}
              {pts.map((p, i) => <Circle key={i} cx={x(p.at)} cy={y(p.value)} r={2.5} fill={color} />)}
            </G>
          );
        })}
        <Text x={pad.l} y={H - 8} style={{ fontSize: 7, fontFamily: 'Courier' }}>{times[0]!.replace('T', ' ')}</Text>
        <Text x={W - pad.r - 80} y={H - 8} style={{ fontSize: 7, fontFamily: 'Courier' }}>{times[times.length - 1]!.replace('T', ' ')}</Text>
      </Svg>
      <Text style={{ fontSize: 7.5, color: C.muted }}>
        {groups.map((g, gi) => `${gi ? ' · ' : ''}${g} (warna ${['hijau', 'amber', 'gelap', 'ungu', 'merah', 'biru'][gi % 6]})`).join('')} · n = {series.points.length} titik dari {times.length} waktu ukur
        {series.nonNumeric ? ` · ${series.nonNumeric} nilai non-angka tidak digambar` : ''}
      </Text>
    </View>
  );
}

/** Batang rata-rata ± SD per perlakuan — hanya bila ≥ 2 perlakuan punya data. */
function SummaryBars({ sum }: { sum: ResponseSummary }) {
  const rows = sum.rows.filter((r) => r.mean !== undefined);
  if (rows.length < 2) return <Text style={[s.empty, { marginBottom: 6 }]}>Grafik muncul bila minimal 2 perlakuan punya data.</Text>;
  const W = 500;
  const H = 150;
  const hi = Math.max(...rows.map((r) => r.mean! + (r.sd ?? 0)), 0);
  const lo = Math.min(0, ...rows.map((r) => r.mean! - (r.sd ?? 0)));
  const bw = (W - 40) / rows.length;
  const y = (v: number) => 8 + (1 - (v - lo) / (hi - lo || 1)) * (H - 30);
  const f = (v: number) => String(Number(v.toPrecision(4))).replace('.', ',');
  return (
    <View wrap={false} style={{ marginBottom: 8 }}>
      <Svg width={W} height={H}>
        <Line x1={40} x2={W} y1={y(0)} y2={y(0)} stroke={C.grid} strokeWidth={1} />
        <Text x={2} y={y(hi) + 3} style={{ fontSize: 7, fontFamily: 'Courier' }}>{f(hi)}</Text>
        <Text x={2} y={y(0) + 3} style={{ fontSize: 7, fontFamily: 'Courier' }}>{f(0)}</Text>
        {rows.map((r, i) => {
          const x0 = 40 + i * bw;
          return (
            <G key={r.treatment}>
              <Rect x={x0 + bw * 0.2} y={Math.min(y(r.mean!), y(0))} width={bw * 0.6} height={Math.abs(y(0) - y(r.mean!))} fill={C.mintLight} stroke={C.ink} strokeWidth={0.8} />
              {r.sd !== undefined && <Line x1={x0 + bw / 2} x2={x0 + bw / 2} y1={y(r.mean! - r.sd)} y2={y(r.mean! + r.sd)} stroke={C.ink} strokeWidth={1.2} />}
              <Text x={x0 + bw / 2 - 6} y={H - 8} style={{ fontSize: 8, fontFamily: 'Courier' }}>{r.treatment}</Text>
            </G>
          );
        })}
      </Svg>
      <Text style={{ fontSize: 7.5, color: C.muted }}>Batang = rata-rata nilai terakhir tiap unit; garis = +/- SD (n-1). Deskriptif, tanpa uji beda nyata.</Text>
    </View>
  );
}

function SeriesSection({ entries }: { entries: DailyEntry[] }) {
  const series = measurementSeries(entries);
  if (!series.length) return <Text style={s.empty}>Belum ada hasil ukur tercatat — tidak ada grafik.</Text>;
  return (
    <>
      {series.map((se) => (
        <View key={`${se.name}|${se.unit}`} style={{ marginBottom: 6 }}>
          <Text style={{ fontFamily: 'Helvetica-Bold', marginBottom: 3 }}>{se.name}{se.unit ? ` (${se.unit})` : ''}</Text>
          {chartable(se) ? <Chart series={se} /> : <Text style={[s.empty, { marginBottom: 6 }]}>Data belum cukup untuk grafik (titik angka: {se.points.length}).</Text>}
        </View>
      ))}
    </>
  );
}

function EntryBody({ e, protocols, media }: { e: DailyEntry; protocols: ProtocolVersion[]; media: MediaItem[] }) {
  const p = protocols.find((x) => x.id === e.protocolId);
  const files = media.filter((m) => m.entryId === e.id);
  return (
    <View>
      {e.correctsEntryId && <Text style={{ color: C.amber, marginBottom: 4 }}>Koreksi atas entri {e.correctsEntryId} (entri lama tetap tersimpan).</Text>}
      <Block label="Riset produk yang dipakai" value={p ? `${p.id} — ${p.name} (versi ${p.version})` : e.protocolId} />
      <Block label="Rencana (pengguna)" value={e.plan} />
      <Block label="Realisasi — yang benar-benar dilakukan" value={e.actual} />
      <Text style={s.label}>Bahan & batch</Text>
      {e.materials.length ? (
        <Table head={['Bahan', 'Batch/lot', 'Jumlah', 'Satuan']} widths={[40, 25, 20, 15]} rows={e.materials.map((m) => [m.name, m.batch, m.amount, m.unit])} />
      ) : (
        <Text style={[s.empty, { marginBottom: 8 }]}>{NOT_RECORDED}</Text>
      )}
      <Block label="Alat" value={e.tools} />
      <Block label="Kondisi yang dicatat" value={e.conditions} />
      <Text style={s.label}>Hasil ukur (data mentah)</Text>
      {e.measurements.length ? (
        <Table
          head={['Waktu', 'Variabel', 'Nilai', 'Satuan', 'Kelompok', 'Catatan']}
          widths={[18, 22, 12, 10, 13, 25]}
          rows={e.measurements.map((m) => [m.at.replace('T', ' '), m.name, m.value, m.unit, m.group, m.note])}
        />
      ) : (
        <Text style={[s.empty, { marginBottom: 8 }]}>{NOT_RECORDED}</Text>
      )}
      <Block label="Penyimpangan / kegagalan" value={e.deviations} />
      <Block label="Interpretasi sementara (pengguna)" value={e.interpretation} />
      <Block label="Langkah berikutnya" value={e.nextStep} />
      {files.length > 0 && (
        <View>
          <Text style={s.label}>Lampiran</Text>
          <View style={s.thumbs}>
            {files.map((m) => (
              <View key={m.id} style={s.thumb} wrap={false}>
                {m.thumb ? <Image src={m.thumb} style={{ width: 150, borderRadius: 4 }} /> : null}
                <Text style={{ fontSize: 7.5, fontFamily: 'Courier' }}>{m.type.startsWith('video/') ? 'VIDEO · ' : ''}{m.name}</Text>
                <Text style={{ fontSize: 7.5 }}>{m.caption || 'tanpa keterangan'} · {m.createdAt.slice(0, 10)}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

function Header({ title, e, sub }: { title: string; e: Experiment; sub: string }) {
  return (
    <View style={s.head}>
      <Text style={s.brand}>GEMA RnD Lab · gemasSTUDIO</Text>
      <Text style={s.title}>{title}</Text>
      <Text style={s.meta}>{e.id} · {productName(e.product)} · {statusName(e.status)} · mulai {e.startedAt} · {sub}</Text>
    </View>
  );
}

const Footer = ({ at }: { at: string }) => (
  <Text style={s.foot} fixed render={({ pageNumber, totalPages }) => `Dibuat ${at} dari catatan tersimpan di perangkat. Isi = catatan pengguna; laporan ini tidak memuat saran AI dan bukan klaim produk aman/memenuhi standar. Hal. ${pageNumber}/${totalPages}`} />
);

function DailyDoc({ e, entry, protocols, media, at }: { e: Experiment; entry: DailyEntry; protocols: ProtocolVersion[]; media: MediaItem[]; at: string }) {
  return (
    <Document title={`${entry.id} — laporan harian`} author="GEMA RnD">
      <Page size="A4" style={s.page}>
        <Header title={`Laporan harian ${entry.entryDate}`} e={e} sub={`entri ${entry.id}`} />
        <Text style={s.h2} minPresenceAhead={60}>{e.title}</Text>
        <EntryBody e={entry} protocols={protocols} media={media} />
        <Text style={s.h2} minPresenceAhead={60}>Grafik hari ini</Text>
        <SeriesSection entries={[entry]} />
        <Footer at={at} />
      </Page>
    </Document>
  );
}

function CompileDoc({ e, entries, protocols, media, at }: { e: Experiment; entries: DailyEntry[]; protocols: ProtocolVersion[]; media: MediaItem[]; at: string }) {
  const usedProtocols = protocols.filter((p) => entries.some((x) => x.protocolId === p.id));
  return (
    <Document title={`${e.id} — kompilasi`} author="GEMA RnD">
      <Page size="A4" style={s.page}>
        <Header title="Laporan eksperimen — lengkap" e={e} sub={`${entries.length} catatan harian`} />
        <Text style={s.h2} minPresenceAhead={60}>{e.title}</Text>
        <Block label="Pertanyaan" value={e.question} />
        <Block label="Tujuan" value={e.objective} />
        <Block label="Dugaan (hipotesis)" value={e.hypothesis ?? ''} />
        <Block label="Versi metode / protokol" value={e.methodVersion} />
        <Block label="Kondisi proses (ringkas)" value={e.processConditions} />

        {e.design && (
          <>
            <Text style={s.h2} minPresenceAhead={60}>Desain eksperimen</Text>
            <Table
              head={['Faktor', 'Level', 'Satuan']}
              widths={[35, 50, 15]}
              rows={e.design.factors.map((f) => [f.name, f.levels.join(' / '), f.unit])}
            />
            <Text style={{ marginBottom: 4 }}>Pembanding: {e.design.control} · Ulangan: {e.design.replicates} per perlakuan · {e.design.runs.length} unit percobaan</Text>
            <Text style={{ marginBottom: 6 }}>Diukur: {e.design.responses.map((r) => `${r.name}${r.unit ? ` (${r.unit})` : ''}`).join(', ')}</Text>
            <Table
              head={['Urutan', 'Kode unit', 'Perlakuan']}
              widths={[14, 18, 68]}
              rows={[...e.design.runs].sort((a, b) => a.order - b.order).map((r) => [String(r.order), r.code, r.label])}
            />
            <Text style={s.h2} minPresenceAhead={60}>Ringkasan hasil per perlakuan</Text>
            {summarize(e.design, entries).map((sum) => (
              <View key={`${sum.response.name}|${sum.response.unit}`} style={{ marginBottom: 6 }} wrap={false}>
                <Text style={{ fontFamily: 'Helvetica-Bold', marginBottom: 3 }}>{sum.response.name}{sum.response.unit ? ` (${sum.response.unit})` : ''}</Text>
                <Table
                  head={['Perlakuan', 'n', 'Rata-rata', 'SD', 'Min', 'Maks', 'Tanpa data']}
                  widths={[34, 8, 13, 11, 11, 11, 12]}
                  rows={sum.rows.map((r) => {
                    const f = (v?: number) => (v === undefined ? '–' : String(Number(v.toPrecision(4))).replace('.', ','));
                    return [`${r.treatment} ${r.label}`, String(r.n), f(r.mean), f(r.sd), f(r.min), f(r.max), String(r.missing)];
                  })}
                />
                <SummaryBars sum={sum} />
              </View>
            ))}
          </>
        )}

        <Text style={s.h2} minPresenceAhead={60}>Riset produk yang dipakai</Text>
        {usedProtocols.length ? (
          usedProtocols.map((p) => (
            <View key={p.id} style={s.box} wrap={false}>
              <Text style={{ fontFamily: 'Helvetica-Bold' }}>{p.id} — {p.name} (versi {p.version}, {p.createdAt.slice(0, 10)})</Text>
              {p.ingredients.length > 0 && <Table head={['Bahan', 'Jumlah', 'Satuan']} widths={[60, 25, 15]} rows={p.ingredients.map((i) => [i.name, i.amount, i.unit])} />}
              {p.steps.map((st, i) => <Text key={i}>{i + 1}. {st.text}{st.duration ? ` · ${st.duration}` : ''}{st.conditions ? ` · ${st.conditions}` : ''}</Text>)}
            </View>
          ))
        ) : (
          <Text style={s.empty}>Tidak ada catatan harian yang merujuk riset produk.</Text>
        )}

        <Text style={s.h2} minPresenceAhead={60}>Grafik hasil ukur (semua catatan)</Text>
        <SeriesSection entries={entries} />

        <Text style={s.h2} minPresenceAhead={60}>Ringkasan catatan harian</Text>
        {entries.length ? (
          <Table
            head={['Entri', 'Tanggal', 'Riset produk', 'Hasil ukur', 'Penyimpangan']}
            widths={[20, 13, 17, 12, 38]}
            rows={entries.map((x) => [x.id, x.entryDate, x.protocolId, String(x.measurements.length), x.deviations])}
          />
        ) : (
          <Text style={s.empty}>Belum ada catatan harian.</Text>
        )}

        <Text style={s.h2} minPresenceAhead={60}>Hasil & kesimpulan</Text>
        <Block label="Hasil (ringkasan pengguna)" value={e.resultSummary} />
        <Block label="Kesimpulan sementara (pengguna)" value={e.conclusion} />
        <Text style={s.label}>Langkah berikutnya</Text>
        {e.nextSteps.length ? (
          e.nextSteps.map((st) => <Text key={st.id}>{st.done ? '[selesai] ' : '[ ] '}{st.action}</Text>)
        ) : (
          <Text style={s.empty}>{NOT_RECORDED}</Text>
        )}
        <Footer at={at} />
      </Page>
      {entries.map((x) => (
        <Page key={x.id} size="A4" style={s.page}>
          <Header title={`Catatan ${x.entryDate}`} e={e} sub={`entri ${x.id}`} />
          <EntryBody e={x} protocols={protocols} media={media} />
          <Footer at={at} />
        </Page>
      ))}
    </Document>
  );
}

const now = () => new Date().toLocaleString('id-ID');

export function dailyPdfBlob(e: Experiment, entry: DailyEntry, protocols: ProtocolVersion[], media: MediaItem[]): Promise<Blob> {
  return pdf(<DailyDoc e={e} entry={entry} protocols={protocols} media={media} at={now()} />).toBlob();
}

export function compilePdfBlob(e: Experiment, entries: DailyEntry[], protocols: ProtocolVersion[], media: MediaItem[]): Promise<Blob> {
  return pdf(<CompileDoc e={e} entries={entries} protocols={protocols} media={media} at={now()} />).toBlob();
}

// ------------------------------------------------------------------ laporan riset produk (DEC-052, desain DEC-058)

const r = StyleSheet.create({
  cover: { padding: 44, fontFamily: 'Helvetica', color: '#FFFFFF', backgroundColor: C.ink },
  brand: { fontFamily: 'Courier-Bold', fontSize: 9, color: C.mintLight, letterSpacing: 2 },
  bar: { width: 64, height: 4, backgroundColor: C.mintLight, marginTop: 14, marginBottom: 18, borderRadius: 2 },
  coverTitle: { fontFamily: 'Helvetica-Bold', fontSize: 28, lineHeight: 1.2 },
  pill: { alignSelf: 'flex-start', marginTop: 14, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 10, fontFamily: 'Helvetica-Bold', fontSize: 9, color: C.ink },
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 26, borderTopWidth: 1, borderColor: '#2A3A41' },
  metaCell: { width: '50%', paddingVertical: 8, paddingRight: 10, borderBottomWidth: 1, borderColor: '#2A3A41' },
  metaLabel: { fontFamily: 'Courier', fontSize: 7.5, color: '#A9B8BE', textTransform: 'uppercase', marginBottom: 2 },
  page: { paddingTop: 54, paddingHorizontal: 36, paddingBottom: 50, fontFamily: 'Helvetica', fontSize: 9.5, color: C.ink, backgroundColor: '#FFFFFF' },
  runHead: { position: 'absolute', top: 20, left: 36, right: 36, flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: C.grid, paddingBottom: 6, fontFamily: 'Courier', fontSize: 7.5, color: C.muted },
  secHead: { flexDirection: 'row', alignItems: 'center', marginTop: 14, marginBottom: 8, paddingBottom: 5, borderBottomWidth: 1.5, borderColor: C.mintLight },
  secNum: { backgroundColor: C.ink, color: C.mintLight, fontFamily: 'Courier-Bold', fontSize: 9, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 3, marginRight: 8 },
  secTitle: { fontFamily: 'Helvetica-Bold', fontSize: 13 },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  kpi: { width: '31.8%', backgroundColor: C.paper, borderLeftWidth: 3, borderColor: C.mint, borderRadius: 4, padding: 8 },
  kpiVal: { fontFamily: 'Helvetica-Bold', fontSize: 18 },
  kpiLabel: { fontFamily: 'Courier', fontSize: 7.5, color: C.muted, textTransform: 'uppercase', marginTop: 2 },
  chartCard: { borderWidth: 1, borderColor: C.grid, borderRadius: 6, padding: 8, marginBottom: 10 },
  chartTitle: { fontFamily: 'Helvetica-Bold', fontSize: 10, marginBottom: 4 },
  note: { fontSize: 7.5, color: C.muted, marginTop: 3 },
  kv: { flexDirection: 'row', marginBottom: 3 },
  kvLabel: { width: 118, fontFamily: 'Courier-Bold', fontSize: 7.5, color: C.muted, textTransform: 'uppercase', paddingTop: 1.5 },
  day: { borderLeftWidth: 3, borderColor: C.mintLight, backgroundColor: '#FAFCFC', borderRadius: 4, padding: 8, marginBottom: 10 },
  dayHead: { fontFamily: 'Helvetica-Bold', fontSize: 10.5, color: C.mint, marginBottom: 5 },
  gallery: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  photo: { width: 166, marginBottom: 4 },
  foot: { position: 'absolute', bottom: 20, left: 36, right: 36, flexDirection: 'row', justifyContent: 'space-between', fontFamily: 'Courier', fontSize: 7, color: C.muted },
});

/** Grafik PDF = bentuk yang sama dengan SVG/PNG di Word & PowerPoint (chartLayout). */
function SpecChart({ spec, width = 523 }: { spec: ChartSpec; width?: number }) {
  const k = width / CHART_W;
  return (
    <Svg width={width} height={CHART_H * k} viewBox={`0 0 ${CHART_W} ${CHART_H}`}>
      {chartLayout(spec).map((p, i) => {
        switch (p.t) {
          case 'rect':
            return <Rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} fill={p.fill} {...(p.rx && { rx: p.rx })} />;
          case 'line':
            return <Line key={i} x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} stroke={p.stroke} strokeWidth={p.w} {...(p.dash && { strokeDasharray: '4 4' })} />;
          case 'poly':
            return <Polyline key={i} points={p.pts.map(([a, b]) => `${a},${b}`).join(' ')} fill="none" stroke={p.stroke} strokeWidth={p.w} strokeLinejoin="round" />;
          case 'circle':
            return <Circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill={p.fill} {...(p.stroke && { stroke: p.stroke, strokeWidth: 2 })} />;
          case 'text':
            return (
              <Text key={i} x={p.x} y={p.y} fill={p.fill} textAnchor={p.anchor} style={{ fontSize: p.size, fontFamily: p.bold ? 'Helvetica-Bold' : 'Helvetica' }}>
                {p.s}
              </Text>
            );
        }
      })}
    </Svg>
  );
}

function ZebraTable({ head, rows }: { head: string[]; rows: string[][] }) {
  const w = `${100 / head.length}%`;
  return (
    <View style={{ borderRadius: 4, overflow: 'hidden', marginBottom: 8, borderWidth: 1, borderColor: C.grid }}>
      <View style={{ flexDirection: 'row', backgroundColor: C.ink }} fixed>
        {head.map((h) => <Text key={h} style={{ width: w, padding: 5, fontFamily: 'Courier-Bold', fontSize: 7.5, color: C.mintLight }}>{h}</Text>)}
      </View>
      {rows.map((row, j) => (
        <View key={j} style={{ flexDirection: 'row', backgroundColor: j % 2 ? C.paper : '#FFFFFF' }} wrap={false}>
          {row.map((c, i) => <Text key={i} style={{ width: w, padding: 5, fontSize: 8.5 }}>{c || '–'}</Text>)}
        </View>
      ))}
    </View>
  );
}

/** "Label: isi" → baris label-nilai; selain itu paragraf biasa. */
function Line_({ text }: { text: string }) {
  const m = /^([A-Za-z][^:·]{1,34}): (.+)$/.exec(text);
  if (!m) return <Text style={{ marginBottom: 3 }}>{text}</Text>;
  const empty = m[2] === NOT_RECORDED;
  return (
    <View style={r.kv} wrap={false}>
      <Text style={r.kvLabel}>{m[1]}</Text>
      <Text style={[{ flex: 1 }, empty ? s.empty : {}]}>{m[2]}</Text>
    </View>
  );
}

function Gallery({ images }: { images: ResearchReport['blocks'][number]['images'] }) {
  return (
    <View style={r.gallery}>
      {images.map((im, k) => (
        <View key={k} style={r.photo} wrap={false}>
          {im.dataUrl ? <Image src={im.dataUrl} style={{ width: 166, height: 124, objectFit: 'cover', borderRadius: 4 }} /> : <View style={{ width: 166, height: 40, backgroundColor: C.paper, borderRadius: 4 }} />}
          <Text style={{ fontSize: 7.5, marginTop: 2 }}>{im.caption || im.name}</Text>
          <Text style={{ fontSize: 6.5, fontFamily: 'Courier', color: C.muted }}>{im.video ? 'VIDEO · ' : ''}{im.name}</Text>
        </View>
      ))}
    </View>
  );
}

function ResearchDoc({ r: rep }: { r: ResearchReport }) {
  let sec = 0;
  return (
    <Document title={rep.title} author="GEMA RnD">
      <Page size="A4" style={r.cover}>
        <Text style={r.brand}>GEMA RND LAB · RISET PRODUK</Text>
        <View style={r.bar} />
        <Text style={r.coverTitle}>{rep.title}</Text>
        <Text style={[r.pill, { backgroundColor: rep.cover.done ? C.mintLight : C.amber }]}>{rep.cover.status}</Text>
        <View style={r.metaGrid}>
          {rep.cover.meta.map(([k, v]) => (
            <View key={k} style={r.metaCell}>
              <Text style={r.metaLabel}>{k}</Text>
              <Text style={{ fontSize: 11 }}>{v}</Text>
            </View>
          ))}
        </View>
        {rep.cover.image?.dataUrl ? <Image src={rep.cover.image.dataUrl} style={{ marginTop: 24, width: 523, height: 250, objectFit: 'cover', borderRadius: 8 }} /> : null}
        <Text style={{ position: 'absolute', bottom: 36, left: 44, right: 44, fontFamily: 'Courier', fontSize: 7.5, color: '#A9B8BE' }}>
          Dibuat {rep.generatedAt} dari catatan tersimpan di perangkat. Isi = catatan pengguna; bukan klaim produk aman/memenuhi standar.
        </Text>
      </Page>
      <Page size="A4" style={r.page}>
        <View style={r.runHead} fixed>
          <Text>{rep.cover.code} · {rep.cover.product}</Text>
          <Text>GEMA RnD Lab</Text>
        </View>
        <View style={r.secHead}>
          <Text style={r.secNum}>{String(++sec).padStart(2, '0')}</Text>
          <Text style={r.secTitle}>Ringkasan</Text>
        </View>
        <View style={r.kpis}>
          {rep.kpis.map((k) => (
            <View key={k.label} style={r.kpi}>
              <Text style={r.kpiVal}>{k.value}</Text>
              <Text style={r.kpiLabel}>{k.label}</Text>
            </View>
          ))}
        </View>
        {rep.blocks.map((b, i) =>
          b.level === 1 ? (
            <View key={i}>
              <View style={r.secHead} minPresenceAhead={80}>
                <Text style={r.secNum}>{String(++sec).padStart(2, '0')}</Text>
                <Text style={r.secTitle}>{b.heading}</Text>
              </View>
              {b.lines.map((l, k) => <Line_ key={k} text={l} />)}
              {b.table && <ZebraTable head={b.table.head} rows={b.table.rows} />}
              {b.charts?.map((c) => (
                <View key={c.id} style={r.chartCard} wrap={false}>
                  <Text style={r.chartTitle}>{c.title}</Text>
                  <SpecChart spec={c} width={505} />
                  <Text style={r.note}>{c.note}</Text>
                </View>
              ))}
              {b.images.length > 0 && <Gallery images={b.images} />}
            </View>
          ) : (
            <View key={i} style={r.day}>
              <Text style={r.dayHead} minPresenceAhead={150}>{b.heading}</Text>
              {b.lines.map((l, k) => <Line_ key={k} text={l} />)}
              {b.table && <ZebraTable head={b.table.head} rows={b.table.rows} />}
              {b.images.length > 0 && <Gallery images={b.images} />}
            </View>
          ),
        )}
        <View style={r.foot} fixed>
          <Text>{rep.footer}</Text>
          <Text render={({ pageNumber, totalPages }) => `Hal. ${pageNumber}/${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export function researchPdfBlob(rep: ResearchReport): Promise<Blob> {
  return pdf(<ResearchDoc r={rep} />).toBlob();
}
