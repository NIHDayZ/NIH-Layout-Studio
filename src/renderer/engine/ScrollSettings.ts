import type { GeometryRect } from "./GeometryCore.js";

/**
 * Scrollbar property names are present in the pinned WorkbenchApp.exe
 * reflection table. The native scroll measurement branch tests bytes at
 * +0x188 (horizontal), +0x189 (vertical) and +0x18C (vertical-left).
 *
 * This decoder is deliberately class-specific. Unknown authored values
 * cannot be interpreted as disabled scrollbars.
 */
export interface NativeScrollSettings {
	horizontal: boolean;
	vertical: boolean;
	verticalLeft: boolean;
}

export function DecodeNativeScrollSettings(
	properties: readonly { name: string; value: string }[]
): NativeScrollSettings | null {
	const values = new Map<string, string>();
	for (const property of properties) {
		const key = property.name.trim().toLowerCase();
		if (!values.has(key))
			values.set(key, property.value.trim());
	}
	function ReadBoolean(name: string): boolean | null {
		const raw = values.get(name);
		if (raw === undefined || raw === "0")
			return false;
		if (raw === "1")
			return true;
		return null;
	}
	const horizontal = ReadBoolean("scrollbar h");
	const vertical = ReadBoolean("scrollbar v");
	const verticalLeft = ReadBoolean("scrollbar v left");
	if (horizontal === null || vertical === null || verticalLeft === null)
		return null;
	return { horizontal, vertical, verticalLeft };
}

/**
 * Prototype of the *unscaled* ScrollWidget measurement branch.
 *
 * Native 0x1408E04F3 loads float constant 10.0 when the scale-dependent
 * flag is absent. +0x189 reserves width for a vertical scrollbar;
 * +0x188 reserves height for a horizontal scrollbar; +0x18C shifts
 * the child origin when a vertical bar is on the left.
 *
 * We do not know the correspondence between the native scale-mode flag and
 * the editor's DPI input. Restrict this result to an explicitly requested
 * unit-scale hypothesis, without claiming it is the actual Workbench DPI
 * branch. No scroll offset, child arrangement or clip is applied.
 */
export interface UnscaledScrollViewportCandidate {
	childViewport: GeometryRect;
	scrollbarThickness: 10;
	horizontalScrollbar: boolean;
	verticalScrollbar: boolean;
	verticalScrollbarLeft: boolean;
	evidence: "native-derived-unscaled-scroll-viewport";
	assumptions: "zero-offset-no-dpi-scaling";
}

interface ScrollViewportDimensions {
	childViewport: GeometryRect;
	horizontalScrollbar: boolean;
	verticalScrollbar: boolean;
	verticalScrollbarLeft: boolean;
}

/** One geometry calculation shared by native-derived scale and unscaled modes. */
function ReserveNativeScrollbarSpace(
	container: Pick<GeometryRect, "width" | "height">,
	settings: NativeScrollSettings,
	thickness: number
): ScrollViewportDimensions | null {
	if (!Number.isFinite(container.width) || !Number.isFinite(container.height)
		|| container.width <= 0 || container.height <= 0
		|| !Number.isFinite(thickness) || thickness <= 0)
		return null;
	const width = container.width - (settings.vertical ? thickness : 0);
	const height = container.height - (settings.horizontal ? thickness : 0);
	if (width <= 0 || height <= 0)
		return null;
	return {
		childViewport: {
			x: settings.vertical && settings.verticalLeft ? thickness : 0,
			y: 0, width, height
		},
		horizontalScrollbar: settings.horizontal,
		verticalScrollbar: settings.vertical,
		verticalScrollbarLeft: settings.vertical && settings.verticalLeft
	};
}

export function EstimateUnscaledScrollViewport(
	container: Pick<GeometryRect, "width" | "height">,
	settings: NativeScrollSettings,
	unitScale: number
): UnscaledScrollViewportCandidate | null {
	if (unitScale !== 1)
		return null;
	const dimensions = ReserveNativeScrollbarSpace(container, settings, 10);
	if (!dimensions)
		return null;
	return {
		...dimensions,
		scrollbarThickness: 10,
		evidence: "native-derived-unscaled-scroll-viewport",
		assumptions: "zero-offset-no-dpi-scaling"
	};
}

/**
 * The compiled scale branch reads a SIGNED int32 context value at +0xC4
 * and a positive unsigned integer denominator at +0xCC, then computes:
 *
 *  thickness = 10 * float32(numerator) / float32(denominator)
 *
 * The exact relationship of these fields to canvas DPI and Workbench
 * display resolution is not recovered; the caller must provide the native
 * context fields, never simply pass an inferred UI zoom level.
 */
export interface NativeScrollbarScaleContext {
	numerator: number;
	denominator: number;
}

export interface ContextScaledScrollViewportCandidate extends ScrollViewportDimensions {
	scrollbarThickness: number;
	evidence: "native-derived-context-scaled-scroll-viewport";
	assumptions: "explicit-native-context-zero-offset";
}

export function EstimateContextScaledScrollViewport(
	container: Pick<GeometryRect, "width" | "height">,
	settings: NativeScrollSettings,
	context: NativeScrollbarScaleContext
): ContextScaledScrollViewportCandidate | null {
	if (!Number.isInteger(context.numerator) || context.numerator <= 0
		|| context.numerator > 0x7fffffff
		|| !Number.isInteger(context.denominator) || context.denominator <= 0
		|| context.denominator > 0xffffffff)
		return null;

	// Match SSE single-precision conversions, division, and multiplication.
	const ratio = Math.fround(Math.fround(context.numerator) / Math.fround(context.denominator));
	const thickness = Math.fround(ratio * Math.fround(10));
	const dimensions = ReserveNativeScrollbarSpace(container, settings, thickness);
	if (!dimensions)
		return null;
	return {
		...dimensions,
		scrollbarThickness: thickness,
		evidence: "native-derived-context-scaled-scroll-viewport",
		assumptions: "explicit-native-context-zero-offset"
	};
}
