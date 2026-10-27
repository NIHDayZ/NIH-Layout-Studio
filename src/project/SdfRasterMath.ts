/** Shared, bounded SDF preview calculations. Not a substitute for Enfusion's font shader. */
export function SdfCellSize(fontSize: number, charScale: number): number {
 if (!Number.isFinite(fontSize) || !Number.isFinite(charScale) || fontSize <= 0 || charScale <= 0)
  return 0;
 return Math.ceil(fontSize * charScale);
}
export function SdfGlyphAdvance(units: number, size: number): number {
 if (!Number.isFinite(units) || !Number.isFinite(size) || units < 0 || size <= 0)
  return 0;
 return units * size / 1000;
}
export function SdfSampleAlpha(sample: number, inverted: boolean): number {
 if (!Number.isFinite(sample))
  return 0;
 const distance = inverted ? 255 - sample : sample;
 return Math.max(0, Math.min(255, Math.round(Math.max(0, Math.min(1, (distance - 112) / 32)) * 255)));
}
