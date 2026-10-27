/** Scale reference-atlas coordinates for an ImageSetTextureClass mpix variant. */
export function ScaleImageSetCoordinates(mpix: number, values: readonly number[]) {
	if (!Number.isInteger(mpix) || mpix < 0 || mpix > 8)
		return null;
	const scale = Math.pow(2, mpix);
	return values.map((value) => value * scale);
}
