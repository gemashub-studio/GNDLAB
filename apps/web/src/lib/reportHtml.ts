/**
 * Laporan HTML (DEC-073): isi sama dengan PDF/Word/PowerPoint (model ResearchReport + grafik chartSvg), tetapi
 * VIDEO bisa diputar langsung dan foto memakai berkas asli. Satu file .html mandiri (semua media ditanam sebagai
 * data URL) — dibuka di browser HP/laptop tanpa internet, bisa dikirim lewat WhatsApp/email.
 */
import { chartSvg } from './reportCharts';
import type { MediaItem } from './labStore';
import type { ReportImage, ResearchReport } from './researchReport';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Isi media → data URL. Bisa diganti di uji (Node tidak punya FileReader). */
export type MediaToDataUrl = (m: MediaItem) => Promise<string>;

export const blobDataUrl: MediaToDataUrl = (m) =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(r.error);
    r.readAsDataURL(m.blob);
  });

const CSS = `
:root{--ink:#0E1A1F;--paper:#F3F6F7;--grid:#E2E8EA;--mint:#1FA88F;--mint2:#63E6CF;--amber:#F5A524;--muted:#5B6B72;--line:#2A3A41}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif}
.wrap{max-width:960px;margin:0 auto;padding:16px}
.mono{font-family:ui-monospace,SFMono-Regular,Consolas,monospace}
.cover{background:var(--ink);color:#fff;border-radius:18px;padding:28px 22px;margin-bottom:18px}
.brand{font:700 11px/1 ui-monospace,Consolas,monospace;letter-spacing:.18em;color:var(--mint2)}
.bar{width:64px;height:4px;background:var(--mint2);border-radius:2px;margin:14px 0 16px}
.cover h1{margin:0;font-size:clamp(24px,5vw,36px);line-height:1.2}
.pill{display:inline-block;margin-top:12px;padding:4px 12px;border-radius:999px;font:700 12px/1.4 system-ui;color:var(--ink)}
.meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));margin-top:20px;border-top:1px solid var(--line)}
.meta div{padding:9px 10px 9px 0;border-bottom:1px solid var(--line)}
.meta dt{font:10px/1.3 ui-monospace,Consolas,monospace;letter-spacing:.12em;text-transform:uppercase;color:#A9B8BE}
.meta dd{margin:2px 0 0;font-size:15px}
.cover-media{margin-top:20px;width:100%;max-height:420px;object-fit:cover;border-radius:12px;background:#000}
.foot{font:11px/1.4 ui-monospace,Consolas,monospace;color:var(--muted);margin:18px 0 40px}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
.kpi{background:#fff;border-left:3px solid var(--mint);border-radius:8px;padding:12px}
.kpi b{display:block;font-size:24px}.kpi span{font:10px/1.3 ui-monospace,Consolas,monospace;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
section{background:#fff;border-radius:16px;padding:18px;margin:14px 0}
section.day{border-left:4px solid var(--mint2)}
h2{display:flex;align-items:center;gap:10px;margin:0 0 12px;padding-bottom:8px;border-bottom:2px solid var(--mint2);font-size:18px}
h2 .n{background:var(--ink);color:var(--mint2);font:700 12px/1 ui-monospace,Consolas,monospace;padding:5px 7px;border-radius:5px}
section.day h2{color:var(--mint);border-bottom-color:var(--grid)}
.kv{display:grid;grid-template-columns:minmax(110px,170px) 1fr;gap:2px 12px;margin:0 0 4px}
.kv dt{font:10px/1.9 ui-monospace,Consolas,monospace;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.kv dd{margin:0}.empty{font-style:italic;color:var(--muted)}
p.line{margin:0 0 4px}
.tbl{overflow-x:auto;margin:10px 0;border:1px solid var(--grid);border-radius:8px}
table{border-collapse:collapse;width:100%;font-size:13px}
th{background:var(--ink);color:var(--mint2);font:600 11px/1.3 ui-monospace,Consolas,monospace;text-align:left;padding:7px 9px;white-space:nowrap}
td{padding:7px 9px;border-top:1px solid var(--grid)}tr:nth-child(even) td{background:var(--paper)}
.chart{border:1px solid var(--grid);border-radius:10px;padding:10px;margin:12px 0}
.chart h3{margin:0 0 6px;font-size:14px}.chart svg{width:100%;height:auto;display:block}
.note{font-size:12px;color:var(--muted);margin-top:4px}
.gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;margin-top:10px}
figure{margin:0;background:var(--paper);border-radius:10px;overflow:hidden}
figure img,figure video{display:block;width:100%;max-height:360px;object-fit:contain;background:#000}
figcaption{padding:8px 10px;font-size:13px}figcaption small{display:block;color:var(--muted);font:11px/1.4 ui-monospace,Consolas,monospace}
.tag{display:inline-block;background:var(--amber);color:var(--ink);font:700 10px/1 system-ui;padding:3px 6px;border-radius:4px;margin-right:6px}
@media print{body{background:#fff}section,.cover{break-inside:avoid}video{display:none}}
`;

/** "Label: isi" → baris label-nilai (sama dengan PDF). */
function line(t: string): string {
  const m = /^([A-Za-z][^:·]{1,34}): (.+)$/.exec(t);
  if (!m) return `<p class="line">${esc(t)}</p>`;
  return `<dl class="kv"><dt>${esc(m[1]!)}</dt><dd${m[2] === 'belum dicatat' ? ' class="empty"' : ''}>${esc(m[2]!)}</dd></dl>`;
}

export async function buildReportHtml(r: ResearchReport, media: readonly MediaItem[], toDataUrl: MediaToDataUrl = blobDataUrl): Promise<{ html: string; videos: number; bytes: number }> {
  const byId = new Map(media.map((m) => [m.id, m]));
  const cache = new Map<string, string>();
  let videos = 0;
  const src = async (im: ReportImage) => {
    const m = im.mediaId ? byId.get(im.mediaId) : undefined;
    if (!m) return im.dataUrl;
    if (!cache.has(m.id)) cache.set(m.id, await toDataUrl(m).catch(() => im.dataUrl));
    return cache.get(m.id)!;
  };
  const fig = async (im: ReportImage) => {
    const url = await src(im);
    const cap = `<figcaption>${im.video ? '<span class="tag">VIDEO</span>' : ''}${esc(im.caption || im.name)}<small>${esc(im.name)}</small></figcaption>`;
    if (im.video) {
      if (url.startsWith('data:video') || url.startsWith('data:application')) {
        videos++;
        return `<figure><video controls playsinline preload="metadata"${im.dataUrl ? ` poster="${im.dataUrl}"` : ''} src="${url}"></video>${cap}</figure>`;
      }
      return `<figure>${im.dataUrl ? `<img src="${im.dataUrl}" alt="">` : ''}${cap}</figure>`;
    }
    return `<figure>${url ? `<img src="${url}" alt="${esc(im.caption || im.name)}" loading="lazy">` : ''}${cap}</figure>`;
  };

  const out: string[] = [];
  const c = r.cover;
  let coverMedia = '';
  if (c.image) {
    const url = await src(c.image);
    coverMedia = c.image.video && url.startsWith('data:video') ? `<video class="cover-media" controls playsinline src="${url}"></video>` : url ? `<img class="cover-media" src="${url}" alt="">` : '';
  }
  out.push(`<header class="cover"><div class="brand">GEMA RND LAB · RISET PRODUK</div><div class="bar"></div><h1>${esc(r.title)}</h1>
<span class="pill" style="background:${c.done ? 'var(--mint2)' : 'var(--amber)'}">${esc(c.status)}</span>
<dl class="meta">${c.meta.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>${coverMedia}</header>`);
  let n = 0;
  out.push(`<section><h2><span class="n">${String(++n).padStart(2, '0')}</span>Ringkasan</h2><div class="kpis">${r.kpis.map((k) => `<div class="kpi"><b>${esc(k.value)}</b><span>${esc(k.label)}</span></div>`).join('')}</div></section>`);
  for (const b of r.blocks) {
    const parts: string[] = [];
    parts.push(b.level === 1 ? `<h2><span class="n">${String(++n).padStart(2, '0')}</span>${esc(b.heading)}</h2>` : `<h2>${esc(b.heading)}</h2>`);
    parts.push(...b.lines.map(line));
    if (b.table) parts.push(`<div class="tbl"><table><thead><tr>${b.table.head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${b.table.rows.map((row) => `<tr>${row.map((x) => `<td>${esc(x || '–')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
    for (const ch of b.charts ?? []) parts.push(`<div class="chart"><h3>${esc(ch.title)}</h3>${chartSvg(ch)}<div class="note">${esc(ch.note)}</div></div>`);
    if (b.images.length) {
      const figs: string[] = [];
      for (const im of b.images) figs.push(await fig(im));
      parts.push(`<div class="gallery">${figs.join('')}</div>`);
    }
    out.push(`<section${b.level === 2 ? ' class="day"' : ''}>${parts.join('')}</section>`);
  }
  out.push(`<p class="foot">${esc(r.footer)} · laporan HTML: video bisa diputar langsung; isi = catatan pengguna, bukan klaim produk aman/memenuhi standar.</p>`);
  const html = `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(r.title)}</title><style>${CSS}</style></head><body><main class="wrap">${out.join('\n')}</main></body></html>`;
  return { html, videos, bytes: html.length };
}
