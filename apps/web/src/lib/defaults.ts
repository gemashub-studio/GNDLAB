/** Pilihan awal yang masuk akal, diturunkan dari data (bukan angka ketikan). */
import type { CalcMode } from '@gemas/calc-engine';
import { availableModes, getCommodity, getForm, type DatasetSI } from '@gemas/dataset';

/**
 * Form default untuk container: (1) punya benchmark muat pasar; (2) densitasnya dirujuk kemasan
 * (`density_ref`) — artinya bentuk berkarung yang lazim; (3) form pertama.
 */
export function defaultFormCode(ds: DatasetSI, commodityId: string): string {
  const c = getCommodity(ds, commodityId);
  const withBench = c.forms.find((f) => f.benchmarks.length > 0);
  const packedRef = c.forms.find((f) => f.packaging.some((p) => p.densityRef === f.densityKey));
  return (withBench ?? packedRef ?? c.forms[0]!).code;
}

/** Mode default: barang per butir → PIECE (US-01), selain itu default form dari ERD. */
export function defaultMode(ds: DatasetSI, commodityId: string, formCode: string): CalcMode {
  const form = getForm(ds, commodityId, formCode);
  const modes = availableModes(form);
  if (getCommodity(ds, commodityId).unitType === 'piece' && modes.includes('PIECE')) return 'PIECE';
  return modes.includes(form.calcModeDefault) ? form.calcModeDefault : 'BULK';
}
