import type { GeometryRect } from "./GeometryCore.js";

/**
 * Caller-supplied copies of the native ScrollWidget fields:
 * horizontal [widget+0x178], vertical [widget+0x17C].
 *
 * The engine does not read live Workbench state, infer these from authored
 * widget properties, or invent scrollbar positions.
 */
export interface NativeScrollOffsets {
	horizontal: number;
	vertical: number;
}

export interface NativeScrollChildContext {
	/** Child constraint rectangle relative to the ScrollWidget origin. */
	childContext: GeometryRect;
	/** Untranslated viewport in the ScrollWidget's own coordinate space. */
	viewport: GeometryRect;
	offsets: NativeScrollOffsets;
	evidence: "native-derived-scroll-child-origin";
	assumptions: "explicit-native-offsets-no-clipping";
}

/**
 * Reproduces only the scroll-origin subtraction observed in native measurement
 * at 0x1408E04A8..0x1408E04BE and arrangement at 0x1408E0CA5..0x1408E0CC1.
 * The caller supplies a separate validated scrollbar-adjusted viewport.
 *
 * No children are repositioned, clipped, or rendered by this function.
 */
export function ProjectNativeScrollChildContext(
	viewport: GeometryRect,
	offsets: NativeScrollOffsets
): NativeScrollChildContext | null {
	if (![viewport.x, viewport.y, viewport.width, viewport.height,
		offsets.horizontal, offsets.vertical].every(Number.isFinite)
		|| viewport.width <= 0 || viewport.height <= 0)
		return null;
	const x = viewport.x - offsets.horizontal;
	const y = viewport.y - offsets.vertical;
	if (!Number.isFinite(x) || !Number.isFinite(y))
		return null;
	return {
		childContext: { x, y, width: viewport.width, height: viewport.height },
		viewport: { ...viewport },
		offsets: { ...offsets },
		evidence: "native-derived-scroll-child-origin",
		assumptions: "explicit-native-offsets-no-clipping"
	};
}

export interface NativeScrollPositionInputs {
	/** Native extent fields at widget +0x180 and +0x184. */
	contentWidth: number;
	contentHeight: number;
	/** Current widget dimensions at +0x90 and +0x94. */
	widgetWidth: number;
	widgetHeight: number;
	/** Already verified scrollbar flags and thickness for this context. */
	verticalScrollbar: boolean;
	horizontalScrollbar: boolean;
	scrollbarThickness: number;
	offsets: NativeScrollOffsets;
}

export interface NativeScrollNormalizedPosition {
	horizontal: number;
	vertical: number;
	horizontalRange: number;
	verticalRange: number;
	evidence: "native-derived-scroll-position-ratios";
	assumptions: "explicit-native-extents-offsets-and-thickness";
}

/**
 * Native H/V getters (0x1408DE6B0 / 0x1408DE8E0):
 * H = offsetX / (contentWidth + verticalScrollbarThickness - widgetWidth)
 * V = offsetY / (contentHeight + horizontalScrollbarThickness - widgetHeight)
 *
 * A zero denominator returns zero in the native getters. Negative ranges
 * are rejected here because they cannot describe a valid scroll range.
 * This is a read-only diagnostic, NOT native scroll setter/clamping behavior.
 */
export function MeasureNativeScrollNormalizedPosition(
	input: NativeScrollPositionInputs
): NativeScrollNormalizedPosition | null {
	const { contentWidth, contentHeight, widgetWidth, widgetHeight,
		scrollbarThickness, offsets, verticalScrollbar, horizontalScrollbar } = input;
	if (![contentWidth, contentHeight, widgetWidth, widgetHeight,
		scrollbarThickness, offsets.horizontal, offsets.vertical].every(Number.isFinite)
		|| contentWidth <= 0 || contentHeight <= 0
		|| widgetWidth <= 0 || widgetHeight <= 0 || scrollbarThickness < 0)
		return null;
	const horizontalRange = contentWidth + (verticalScrollbar ? scrollbarThickness : 0) - widgetWidth;
	const verticalRange = contentHeight + (horizontalScrollbar ? scrollbarThickness : 0) - widgetHeight;
	if (!Number.isFinite(horizontalRange) || !Number.isFinite(verticalRange)
		|| horizontalRange < 0 || verticalRange < 0)
		return null;
	const horizontal = horizontalRange === 0 ? 0 : offsets.horizontal / horizontalRange;
	const vertical = verticalRange === 0 ? 0 : offsets.vertical / verticalRange;
	if (!Number.isFinite(horizontal) || !Number.isFinite(vertical))
		return null;
	return {
		horizontal, vertical, horizontalRange, verticalRange,
		evidence: "native-derived-scroll-position-ratios",
		assumptions: "explicit-native-extents-offsets-and-thickness"
	};
}
