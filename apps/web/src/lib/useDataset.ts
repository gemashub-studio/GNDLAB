'use client';

import { bundledDataset } from '@gemas/dataset';

/** Dataset ter-bundle di client (offline, NFR-03). Dimuat & divalidasi sekali. */
export const useDataset = () => bundledDataset();
