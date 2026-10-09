'use client';

import { useEffect, useRef } from 'react';
import { decodeState, encodeState, type ScenarioState } from './scenario';

/**
 * Sinkron state kalkulator ↔ `?s=` di URL.
 * - Saat halaman disajikan dari cache offline, server tidak sempat membaca `?s=`; maka di sini
 *   state dibaca ulang dari URL sekali saat mount (bila server tidak memberi `initial`).
 * - Setiap perubahan state ditulis ke URL → "Salin tautan" & muat ulang selalu konsisten.
 */
export function useUrlState<S extends ScenarioState>(
  kind: S['kind'],
  state: S,
  set: (s: S) => void,
  hadInitial: boolean,
) {
  const restored = useRef(hadInitial);
  useEffect(() => {
    if (!restored.current) {
      restored.current = true;
      const fromUrl = decodeState(new URLSearchParams(window.location.search).get('s'));
      if (fromUrl?.kind === kind) {
        set(fromUrl as S);
        return; // efek berikutnya menulis URL setelah state baru terpasang
      }
    }
    const url = new URL(window.location.href);
    url.searchParams.set('s', encodeState(state));
    url.searchParams.delete('wizard');
    window.history.replaceState(null, '', url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
}
