import type { GeometryWidget } from "./WidgetGeometry.js";
import type { IntrinsicMeasurement } from "./IntrinsicMeasurements.js";

/**
 * Font-metric contracts mirror the parsed FNT3 and FSDF resources.
 * No canvas, DOM fonts, or CSS-based measurements occur in this module.
 */
export interface BitmapMetricFont {
	nominalSize: number;
	lineHeight: number;
	glyphs: ReadonlyMap<number, { advance: number }>;
	kerning: ReadonlyMap<string, number>;
}

export interface SdfMetricFont {
	fontSize: number;
	/** Packed FNT5 records use pixel advances, FSDF uses 1/1000 em. */
	pixelAdvances: boolean;
	glyphs: ReadonlyMap<number, { advance: number }>;
}

/**
 * Renderer mode deliberately preserves the legacy half-nominal fallback for
 * missing FNT3 glyphs. Intrinsic mode refuses unknown glyphs instead.
 */
export function MeasureBitmapAdvance(
	font: BitmapMetricFont,
	text: string,
	scale: number,
	missing: "reject" | "renderer-fallback" = "reject"
): number | null {
	if (!Number.isFinite(scale) || scale <= 0 || !Number.isFinite(font.nominalSize) || font.nominalSize <= 0)
		return null;
	let width = 0;
	let previous = -1;
	for (const character of text) {
		const codePoint = character.codePointAt(0)!;
		if (previous >= 0)
			width += (font.kerning.get(`${previous}:${codePoint}`) ?? 0) * scale;
		const glyph = font.glyphs.get(codePoint);
		if (!glyph && missing === "reject")
			return null;
		const advance = glyph?.advance ?? font.nominalSize * 0.5;
		if (!Number.isFinite(advance) || advance < 0)
			return null;
		width += advance * scale;
		previous = codePoint;
	}
	return Number.isFinite(width) && width >= 0 ? width : null;
}

/** FNT3 single-line metrics, not native Workbench Size To Content rules. */
export function MeasureBitmapSingleLine(
	font: BitmapMetricFont,
	text: string,
	displaySize: number
): { width: number; height: number } | null {
	if (!text || /[\r\n]/.test(text) || !Number.isFinite(displaySize) || displaySize <= 0
		|| !Number.isFinite(font.lineHeight) || font.lineHeight <= 0)
		return null;
	const scale = Math.max(0.05, displaySize / Math.max(1, font.nominalSize));
	const width = MeasureBitmapAdvance(font, text, scale);
	if (width === null)
		return null;
	const height = Math.max(1, font.lineHeight * scale);
	return { width, height };
}

/**
 * FSDF/FNT5 single-line horizontal advances in their declared units.
 * The font's glyph cell height is NOT a proven native line height, so only
 * width is returned, and missing glyphs cause a conservative refusal.
 */
export function MeasureSdfSingleLineWidth(
	font: SdfMetricFont,
	text: string,
	displaySize: number
): number | null {
	if (!text || /[\r\n]/.test(text) || !Number.isFinite(displaySize) || displaySize <= 0
		|| !Number.isFinite(font.fontSize) || font.fontSize <= 0)
		return null;
	let width = 0;
	for (const character of text) {
		const glyph = font.glyphs.get(character.codePointAt(0)!);
		if (!glyph || !Number.isFinite(glyph.advance) || glyph.advance < 0)
			return null;
		width += glyph.advance * (font.pixelAdvances ? displaySize / font.fontSize : displaySize / 1000);
	}
	return Number.isFinite(width) && width >= 0 ? width : null;
}

export type TextMetricSource =
	| { kind: "fnt3"; font: BitmapMetricFont; displaySize: number }
	| { kind: "fsdf"; font: SdfMetricFont; displaySize: number };

export type TextMetricSourceResolver = (node: GeometryWidget) => TextMetricSource | null;

/**
 * Caller must supply the *actual* resolved font and explicit display size
 * from project/style resources. Guessing browser font fallback is forbidden.
 * Note: source metrics provide a diagnostic hypothesis, not native parity.
 */
export function CreateSingleLineTextIntrinsicProvider(
	resolve: TextMetricSourceResolver
): (node: GeometryWidget) => IntrinsicMeasurement | null {
	return (node) => {
		const property = node.properties.find((p) => p.name.toLowerCase() === "text");
		const text = property?.value ?? "";
		const source = resolve(node);
		if (!source)
			return null;
		if (source.kind === "fnt3") {
			const size = MeasureBitmapSingleLine(source.font, text, source.displaySize);
			if (!size)
				return null;
			return {
				...size, evidence: "font-metrics",
				widthIndependent: true, heightIndependent: true
			};
		}
		const width = MeasureSdfSingleLineWidth(source.font, text, source.displaySize);
		if (width === null)
			return null;
		return {
			width, evidence: "font-metrics",
			widthIndependent: true, heightIndependent: false
		};
	};
}
