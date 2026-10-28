/** Scale reference-atlas coordinates for an ImageSetTextureClass mpix variant. */
export function ScaleImageSetCoordinates(mpix: number, values: readonly number[]) {
	if (!Number.isInteger(mpix) || mpix < 0 || mpix > 8)
		return null;
	const scale = Math.pow(2, mpix);
	return values.map((value) => value * scale);
}


/**
 * Prioritize a requested ImageSet texture resolution without changing the
 * fallback order. A preferred variant is tried first only when present.
 * Default preview behavior continues to use the lowest mpix available.
 */
export function OrderImageSetVariants<T extends { mpix: number }>(variants: readonly T[], preferredMpix: number | null = null): T[] {
	const ordered = [...variants].sort((a, b) => a.mpix - b.mpix);
	if (preferredMpix === null || !Number.isInteger(preferredMpix) || preferredMpix < 0)
		return ordered;
	return ordered.sort((a, b) => {
		const aPreferred = a.mpix === preferredMpix;
		const bPreferred = b.mpix === preferredMpix;
		if (aPreferred && !bPreferred)
			return -1;
		if (bPreferred && !aPreferred)
			return 1;
		return a.mpix - b.mpix;
	});
}
