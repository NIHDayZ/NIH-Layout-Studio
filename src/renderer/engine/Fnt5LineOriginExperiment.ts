/** Research-only shared one-line baseline; not a recovered Enfusion constant. */
export function ResolveExperimentalFnt5LineOrigin(
	mode: string | null,
	widgetHeight: number,
	currentBaseY: number,
	isStandaloneFnt5: boolean,
	lineCount: number
): number {
	if (mode === null || mode.trim() === "" || !isStandaloneFnt5 ||
		lineCount !== 1 || !Number.isFinite(widgetHeight) || widgetHeight <= 0 ||
		!Number.isFinite(currentBaseY))
		return currentBaseY;
	const ratio = Number(mode);
	if (!Number.isFinite(ratio) || ratio < 0 || ratio > 0.25)
		return currentBaseY;
	return -widgetHeight * ratio;
}
