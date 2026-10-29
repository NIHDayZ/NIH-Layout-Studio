/**
 * Experimental FNT5 sizing only. Do not mistake screenshot-fit modes for recovered
 * Enfusion auto text sizing or alter non-FNT5/default widget behavior.
 */
export function ResolveExperimentalFnt5FontSize(
	mode: string | null,
	nominalSize: number,
	widgetHeight: number,
	hasFnt5PixelMetrics: boolean,
	explicitTextSize: boolean
): number {
	if (!hasFnt5PixelMetrics || explicitTextSize || !Number.isFinite(nominalSize) ||
		nominalSize <= 0 || !Number.isFinite(widgetHeight))
		return nominalSize;

	if (mode === "height")
		return Math.max(1, widgetHeight);

	if (mode === null || mode === "0")
		return nominalSize;

	const ratio = mode === "1" ? 0.9 : Number(mode);
	if (!Number.isFinite(ratio) || ratio < 0.5 || ratio > 1.2)
		return nominalSize;

	return Math.min(nominalSize, Math.max(1, widgetHeight * ratio));
}
