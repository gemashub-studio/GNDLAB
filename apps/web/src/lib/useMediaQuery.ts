'use client';

import { useEffect, useState } from 'react';

/** true bila media query cocok (false saat render server / sebelum terbaca). */
export function useMediaQuery(query: string): boolean {
  const [hit, setHit] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setHit(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return hit;
}
