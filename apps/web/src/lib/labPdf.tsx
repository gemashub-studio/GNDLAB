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

// ------------------------------------------------------------------ laporan riset produk (DEC-052)

function ResearchDoc({ r }: { r: ResearchReport }) {
  return (
    <Document title={r.title} author="GEMA RnD">
      <Page size="A4" style={s.page}>
        <View style={s.head}>
          <Text style={s.brand}>GEMA RnD Lab · Riset Produk</Text>
          <Text style={s.title}>{r.title}</Text>
          <Text style={s.meta}>{r.subtitle}</Text>
        </View>
        {r.blocks.map((b, i) => (
          <View key={i} style={{ marginBottom: 8 }}>
            <Text style={b.level === 1 ? s.h2 : { fontFamily: 'Helvetica-Bold', fontSize: 10.5, color: C.mint, marginTop: 6, marginBottom: 3 }} minPresenceAhead={50}>
              {b.heading}
            </Text>
            {b.lines.map((l, k) => <Text key={k} style={{ marginBottom: 2 }}>{l}</Text>)}
            {b.table && <Table head={b.table.head} rows={b.table.rows} widths={b.table.head.map(() => 100 / b.table!.head.length)} />}
            {b.images.length > 0 && (
              <View style={s.thumbs}>
                {b.images.map((im, k) => (
                  <View key={k} style={s.thumb} wrap={false}>
                    {im.dataUrl ? <Image src={im.dataUrl} style={{ width: 150, borderRadius: 4 }} /> : null}
                    <Text style={{ fontSize: 7.5, fontFamily: 'Courier' }}>{im.video ? 'VIDEO · ' : ''}{im.name}</Text>
                    {im.caption ? <Text style={{ fontSize: 7.5 }}>{im.caption}</Text> : null}
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}
        <Text style={s.foot} fixed render={({ pageNumber, totalPages }) => `${r.footer}. Hal. ${pageNumber}/${totalPages}`} />
      </Page>
    </Document>
  );
}

export function researchPdfBlob(r: ResearchReport): Promise<Blob> {
  return pdf(<ResearchDoc r={r} />).toBlob();
}
