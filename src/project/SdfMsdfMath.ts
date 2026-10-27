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
