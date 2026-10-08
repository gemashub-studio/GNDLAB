import type { Meters } from './units.ts';

export type Binding = 'VOLUME' | 'WEIGHT' | 'NONE';
export type CalcMode = 'BULK' | 'PIECE' | 'PACKAGE';

export interface Dim3 {
  l: Meters;
  w: Meters;
  h: Meters;
}
