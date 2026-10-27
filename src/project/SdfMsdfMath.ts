/** Experimental median-distance reconstruction. Kept separate from legacy SDF math. */
export function MsdfMedian(r: number, g: number, b: number): number {
 return Math.max(Math.min(r, g), Math.min(Math.max(r, g), b));
}
/** Distance-field antialiasing in normalized pixel space; experimental, not Enfusion-verified. */
export function MsdfAlpha(r: number, g: number, b: number, inverted: boolean, smoothing = 12): number {
 const median = MsdfMedian(r, g, b);
 const distance = inverted ? 128 - median : median - 128;
 const width = Number.isFinite(smoothing) && smoothing > 0 ? smoothing : 12;
 const normalized = Math.max(0, Math.min(1, 0.5 + distance / width));
 const smooth = normalized * normalized * (3 - 2 * normalized);
 return Math.round(smooth * 255);
}

/**
 * Estimate an atlas-space transition width for an MSDF glyph displayed at a
 * different scale. Kept opt-in until visually validated against Workbench.
 * Clamps extreme minification to avoid invisible or fully blurred characters.
 */
export function MsdfScaledSmoothing(displaySize: number, nominalSize: number, baseline = 12): number {
 if (!Number.isFinite(displaySize) || !Number.isFinite(nominalSize) || nominalSize <= 0 || displaySize <= 0)
  return baseline;
 const scale = displaySize / nominalSize;
 return Math.max(2, Math.min(48, baseline / scale));
}

/**
 * Optional atlas-distance threshold adjustment for small glyphs.
 * Positive bias expands foreground strokes in either inversion mode.
 * Applied before smoothing, so legacy sampling remains unchanged.
 */
export function MsdfAlphaWithBias(r: number, g: number, b: number, inverted: boolean, smoothing: number, bias: number): number {
 const median = MsdfMedian(r, g, b);
 const distance = (inverted ? 128 - median : median - 128) + (Number.isFinite(bias) ? Math.max(-8, Math.min(8, bias)) : 0);
 const width = Number.isFinite(smoothing) && smoothing > 0 ? smoothing : 12;
 const t = Math.max(0, Math.min(1, 0.5 + distance / width));
 return Math.round((t * t * (3 - 2 * t)) * 255);
}
