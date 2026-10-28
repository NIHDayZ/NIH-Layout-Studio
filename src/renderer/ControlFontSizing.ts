/**
 * Diagnostic approximation of DayZ's font-size selection for control widgets.
 *
 * Vanilla MetronBook.xml advertises sizes 12, 14, 16, 22, 28, 48 and 58.
 * Unlike TextWidgets, default ButtonWidgets do not generally declare a text
 * size. The existing CSS fallback caps them at 32 px, leaving 60 px controls
 * noticeably undersized against Workbench. Do not use this for SDF/FNT fonts,
 * explicit text sizes, or unknown third-party font families.
 */
export const METRON_CONTROL_SIZES = [12, 14, 16, 22, 28, 48, 58] as const;

export function SelectWorkbenchControlFontSize(fontPath: string | undefined, widgetHeight: number): number | null {
	if (!fontPath || !Number.isFinite(widgetHeight) || widgetHeight <= 0)
		return null;
	const normalized = fontPath.replace(/^["']|["']$/g, "").replace(/\\/g, "/").toLowerCase();
	if (!/(?:^|\/)metron(?:book|light)?(?:-bold|-italic|-bolditalic)?$/.test(normalized))
		return null;
	let size: number = METRON_CONTROL_SIZES[0];
	for (const candidate of METRON_CONTROL_SIZES) {
		if (candidate > widgetHeight)
			break;
		size = candidate;
	}
	return size;
}
