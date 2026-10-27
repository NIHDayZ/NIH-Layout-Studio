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

/** Convert FSDF reference glyph cells into cooked atlas source pixels. */
export function SdfAtlasCell(x: number, y: number, cellSize: number, referenceWidth: number, textureWidth: number, textureHeight: number) {
	if (![x, y, cellSize, referenceWidth, textureWidth, textureHeight].every(Number.isFinite) || referenceWidth <= 0 || textureWidth <= 0 || textureHeight <= 0 || cellSize <= 0)
		return null;
	const scale = textureWidth / referenceWidth;
	const left = Math.round(x * scale);
	const top = Math.round(y * scale);
	const size = Math.round(cellSize * scale);
	if (left < 0 || top < 0 || size <= 0 || left + size > textureWidth || top + size > textureHeight)
		return null;
	return { left, top, size, scale };
}
