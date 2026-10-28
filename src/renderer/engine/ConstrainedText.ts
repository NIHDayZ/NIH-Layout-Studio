import type { GeometryWidget } from "./WidgetGeometry.js";
import { MeasureSdfSingleLineWidth, type SdfMetricFont } from "./TextLineMetrics.js";
import { MeasurePreviewFlow } from "./TextFlow.js";

/**
 * An already-resolved width-dependent text source, prepared once per
 * document revision. Unlike intrinsic metrics, this must be evaluated with
 * the final arranged width, and must NEVER be used to determine that width.
 */
export interface PreparedTextFlow {
	readonly evidence: "sdf-preview-flow";
	measure(availableWidth: number): ConstrainedTextResult | null;
}

export interface ConstrainedTextResult {
	readonly height: number;
	readonly lineCount: number;
	readonly widthUsed: number;
	readonly evidence: "sdf-preview-flow";
}

export interface SdfPreviewTextSource {
	readonly font: SdfMetricFont;
	readonly displaySize: number;
	/** The current preview line height, supplied explicitly by the caller. */
	readonly lineHeight: number;
	readonly wrap: boolean;
}

export type SdfPreviewTextSourceResolver = (node: GeometryWidget) => SdfPreviewTextSource | null;
export type ConstrainedTextPreparer = (node: GeometryWidget) => PreparedTextFlow | null;

/**
 * Bridge NIH Studio's CURRENT SDF preview wrapping into constrained
 * diagnostic measurement. It is not a Workbench native text algorithm.
 * Unsupported glyphs and invalid sizes are rejected, never approximated.
 *
 * The resolver executes only in the prepare pass; each width-dependent
 * measure executes later with the actual arranged width.
 */
export function CreateSdfPreviewTextPreparer(
	resolve: SdfPreviewTextSourceResolver
): ConstrainedTextPreparer {
	return (node) => {
		if (node.type.trim().toLowerCase() !== "textwidgetclass")
			return null;
		const source = resolve(node);
		if (!source || !Number.isFinite(source.displaySize) || source.displaySize <= 0
			|| !Number.isFinite(source.lineHeight) || source.lineHeight <= 0)
			return null;
		const text = node.properties.find((property) => property.name.toLowerCase() === "text")?.value ?? "";
		if (!text)
			return null;
		// Validate the whole source once so an unknown glyph cannot enter
		// the line-wrapping algorithm and appear to have a known width.
		for (const ch of text) {
			if (ch === "\n")
				continue;
			if (!source.font.glyphs.has(ch.codePointAt(0)!))
				return null;
		}
		const advance = (value: string): number => {
			if (!value)
				return 0;
			return MeasureSdfSingleLineWidth(source.font, value, source.displaySize) ?? NaN;
		};
		return {
			evidence: "sdf-preview-flow",
			measure(availableWidth: number): ConstrainedTextResult | null {
				if (!Number.isFinite(availableWidth) || availableWidth <= 0)
					return null;
				const flow = MeasurePreviewFlow(text, availableWidth, source.lineHeight, advance, source.wrap);
				if (!flow || !Number.isFinite(flow.height) || flow.height <= 0)
					return null;
				return {
					height: flow.height,
					lineCount: flow.lines.length,
					widthUsed: availableWidth,
					evidence: "sdf-preview-flow"
				};
			}
		};
	};
}
