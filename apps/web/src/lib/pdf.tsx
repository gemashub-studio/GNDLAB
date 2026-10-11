/**
 * Ekspor PDF di browser (ARD §4: @react-pdf/renderer, tanpa server headless).
 * Dimuat dinamis saat tombol ditekan agar tidak membebani bundle awal.
 * Font PDF memakai Helvetica/Courier bawaan (font web tidak di-embed) — warna & garis tetap token.
 */
import { Document, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer';
import type { ReportRow } from './report';

const s = StyleSheet.create({
  page: { padding: 32, fontFamily: 'Helvetica', fontSize: 10, color: '#0E1A1F', backgroundColor: '#F3F6F7' },
  head: { backgroundColor: '#0E1A1F', color: '#F3F6F7', padding: 12, marginBottom: 14 },
  brand: { fontFamily: 'Helvetica-Bold', fontSize: 18 },
  acid: { color: '#63E6CF' },
  title: { fontFamily: 'Helvetica-Bold', fontSize: 14, marginTop: 4, textTransform: 'uppercase' },
  section: { borderWidth: 3, borderColor: '#0E1A1F', backgroundColor: '#FFFFFF', marginBottom: 12 },
  sectionHead: { backgroundColor: '#0E1A1F', color: '#63E6CF', fontFamily: 'Courier-Bold', fontSize: 9, padding: 5 },
  row: { flexDirection: 'row', borderTopWidth: 1, borderColor: '#E2E8EA' },
  label: { width: '38%', padding: 5, fontFamily: 'Helvetica-Bold' },
  value: { width: '62%', padding: 5, fontFamily: 'Courier' },
  foot: { marginTop: 8, fontFamily: 'Courier', fontSize: 8, color: '#5B6B72' },
});

function Report({ title, rows, generatedAt }: { title: string; rows: ReportRow[]; generatedAt: string }) {
  const sections = ['Input', 'Hasil', 'Peringatan', 'Jejak'] as const;
  return (
    <Document title={`gemasSTUDIO — ${title}`} author="gemasSTUDIO">
      <Page size="A4" style={s.page}>
        <View style={s.head}>
          <Text style={s.brand}>
            gemas<Text style={s.acid}>STUDIO</Text>
          </Text>
          <Text style={s.title}>{title}</Text>
        </View>
        {sections.map((sec) => {
          const list = rows.filter((r) => r.section === sec);
          if (!list.length) return null;
          return (
            <View key={sec} style={s.section} wrap={false}>
              <Text style={s.sectionHead}>{sec.toUpperCase()}</Text>
              {list.map((r, i) => (
                <View key={i} style={s.row}>
                  <Text style={s.label}>{r.label}</Text>
                  <Text style={s.value}>{r.value}</Text>
                </View>
              ))}
            </View>
          );
        })}
        <Text style={s.foot}>
          Dibuat {generatedAt}. Angka dari engine gemasSTUDIO; rentang = evaluasi sudut parameter. Simulasi adalah
          representasi grid, bukan posisi fisik eksak.
        </Text>
      </Page>
    </Document>
  );
}

export async function reportPdfBlob(title: string, rows: ReportRow[]): Promise<Blob> {
  const generatedAt = new Date().toLocaleString('id-ID');
  return pdf(<Report title={title} rows={rows} generatedAt={generatedAt} />).toBlob();
}
