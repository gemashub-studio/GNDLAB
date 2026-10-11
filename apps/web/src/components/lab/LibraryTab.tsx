'use client';

import { useState } from 'react';
import { GEMA_SOURCES, GEMA_SOURCES_CHECKED, GEMA_SOURCES_DOC, SOURCE_CATEGORIES, SOURCE_STATUS, type SourceCategory, type SourceStatus } from '@/lib/gemaSources';
import { LAB_PRODUCTS, type LabProductId } from '@/lib/labStore';
import { SourcePill } from './ui';

export function LibraryTab() {
  const [status, setStatus] = useState<SourceStatus | 'all'>('all');
  const [product, setProduct] = useState<LabProductId | 'all'>('all');
  const [category, setCategory] = useState<SourceCategory | 'all'>('all');
  const shown = GEMA_SOURCES.filter(
    (s) => (status === 'all' || s.status === status) && (product === 'all' || s.products.includes(product)) && (category === 'all' || s.category === category),
  );

  return (
    <div className="flex flex-col gap-5" data-testid="lab-library">
      <div className="card flex flex-col gap-3">
        <p className="text-sm">
          Daftar sumber dengan status pemeriksaan. Dicek {GEMA_SOURCES_CHECKED}. Catatan lengkap: <code className="font-mono text-xs">{GEMA_SOURCES_DOC}</code>.
        </p>
        <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
          {SOURCE_STATUS.map((s) => <li key={s.id} className="flex items-center gap-2"><SourcePill status={s.id} /> {s.hint}</li>)}
        </ul>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1.5">
            <span className="label-mono">Jenis</span>
            <select className="field" value={category} onChange={(e) => setCategory(e.target.value as SourceCategory | 'all')} data-testid="lib-filter-category">
              <option value="all">Semua jenis</option>
              {(Object.keys(SOURCE_CATEGORIES) as SourceCategory[]).map((k) => <option key={k} value={k}>{SOURCE_CATEGORIES[k]}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label-mono">Status</span>
            <select className="field" value={status} onChange={(e) => setStatus(e.target.value as SourceStatus | 'all')} data-testid="lib-filter-status">
              <option value="all">Semua status</option>
              {SOURCE_STATUS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label-mono">Jalur</span>
            <select className="field" value={product} onChange={(e) => setProduct(e.target.value as LabProductId | 'all')} data-testid="lib-filter-product">
              <option value="all">Semua jalur</option>
              {LAB_PRODUCTS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
        </div>
      </div>

      <ul className="grid gap-3 lg:grid-cols-2" data-testid="lib-list">
        {shown.map((s) => (
          <li key={s.id} className="card flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-semibold">{s.id}</span>
              <SourcePill status={s.status} />
              <span className="rounded-full bg-paper px-2 py-0.5 font-mono text-[10px] uppercase">{SOURCE_CATEGORIES[s.category]}</span>
              <span className="font-mono text-[11px] text-muted">{s.org}{s.year !== '-' ? ` · ${s.year}` : ''}</span>
            </div>
            <a href={s.url} target="_blank" rel="noopener noreferrer" className="font-display text-lg font-semibold underline-offset-4 hover:underline">{s.title}</a>
            <dl className="grid gap-1 text-sm">
              <div><dt className="label-mono inline">Ruang lingkup: </dt><dd className="inline">{s.scope}</dd></div>
              <div><dt className="label-mono inline">Parameter diatur: </dt><dd className="inline">{s.regulates}</dd></div>
              <div><dt className="label-mono inline">Didukung: </dt><dd className="inline">{s.supports}</dd></div>
              <div><dt className="label-mono inline">Batasan: </dt><dd className="inline">{s.limits}</dd></div>
            </dl>
            <span className="mt-auto font-mono text-[11px] text-muted">
              {s.products.length === LAB_PRODUCTS.length ? 'Semua jalur' : s.products.join(' · ')} · {s.accessed ? `akses ${s.accessed}` : 'belum diakses'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
