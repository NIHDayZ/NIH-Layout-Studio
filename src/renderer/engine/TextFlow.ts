/**
 * The current NIH Studio SDF preview's line-break policy, extracted so text
 * rendering and diagnostic measurement can share one implementation.
 *
 * IMPORTANT: this reproduces the existing preview; it is NOT claimed to be
 * the native Workbench text wrapping algorithm.
 */
export function WrapPreviewText(
	text: string,
	width: number,
	advance: (text: string) => number,
	enabled: boolean
): string[] {
	if (!enabled || width <= 0)
		return text.split("\n");
	const result: string[] = [];
	for (const paragraph of text.split("\n")) {
		const paragraphStart = result.length;
		let line = "";
		for (const token of paragraph.match(/\s+|\S+/g) ?? []) {
			if (line && advance(line + token) > width) {
				result.push(line.trimEnd());
				line = token.trimStart();
			} else {
				line += token;
			}
			// Break unspaced identifiers by Unicode code point, as before.
			if (line && advance(line) > width) {
				let fragment = "";
				for (const letter of Array.from(line)) {
					if (fragment && advance(fragment + letter) > width) {
						result.push(fragment);
						fragment = "";
					}
					fragment += letter;
				}
				line = fragment;
			}
		}
		if (line || result.length === paragraphStart)
			result.push(line.trimEnd());
	}
	return result;
}

export interface PreviewFlowMetrics {
	lines: readonly string[];
	width: number;
	height: number;
}

/**
 * Width-dependent preview extent for diagnostic comparison.
 * Keep separate from IntrinsicMeasurements: it cannot safely be used
 * as an independent content-size result before native constraint rules.
 */
export function MeasurePreviewFlow(
	text: string,
	availableWidth: number,
	lineHeight: number,
	advance: (text: string) => number,
	wrap: boolean
): PreviewFlowMetrics | null {
	if (!Number.isFinite(availableWidth) || !Number.isFinite(lineHeight) || lineHeight <= 0)
		return null;
	const lines = WrapPreviewText(text, availableWidth, advance, wrap);
	let measuredWidth = 0;
	for (const line of lines) {
		const width = advance(line);
		if (!Number.isFinite(width) || width < 0)
			return null;
		measuredWidth = Math.max(measuredWidth, width);
	}
	return { lines, width: measuredWidth, height: lines.length * lineHeight };
}
