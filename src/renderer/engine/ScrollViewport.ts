import type { GeometryRect } from "./GeometryCore.js";

/**
 * An authored-coordinate diagnostic, NOT a native ScrollWidget layout.
 * The viewport comes from the already arranged outer ScrollWidget rectangle.
 * Content bounds include direct, exact-sized and exact-positioned children
 * only; they do not include native scrollbar widths, margins, zoom or
 * interaction state.
 */
export interface AuthoredScrollViewport {
	viewport: GeometryRect;
	directChildBounds: GeometryRect;
	overhang: { left: number; right: number; top: number; bottom: number };
	directChildCount: number;
	evidence: "authored-direct-child-bounds";
}

/** Diagnostic math only. Never applies a scroll offset or changes clipping. */
export function MeasureAuthoredScrollViewport(
	container: Pick<GeometryRect, "width" | "height">,
	children: readonly GeometryRect[]
): AuthoredScrollViewport | null {
	if (!Number.isFinite(container.width) || !Number.isFinite(container.height)
		|| container.width <= 0 || container.height <= 0 || children.length === 0)
		return null;
	let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
	for (const child of children) {
		if (![child.x, child.y, child.width, child.height].every(Number.isFinite)
			|| child.width <= 0 || child.height <= 0)
			return null;
		left = Math.min(left, child.x);
		top = Math.min(top, child.y);
		right = Math.max(right, child.x + child.width);
		bottom = Math.max(bottom, child.y + child.height);
	}
	if (![left, top, right, bottom].every(Number.isFinite))
		return null;
	return {
		viewport: { x: 0, y: 0, width: container.width, height: container.height },
		directChildBounds: { x: left, y: top, width: right - left, height: bottom - top },
		overhang: {
			left: Math.max(0, -left),
			right: Math.max(0, right - container.width),
			top: Math.max(0, -top),
			bottom: Math.max(0, bottom - container.height)
		},
		directChildCount: children.length,
		evidence: "authored-direct-child-bounds"
	};
}

/**
 * Native-derived extent CANDIDATE from the same authored direct-child bounds.
 *
 * ScrollWidget virtual slot 14 at 0x1408E0C70 initializes the extents at
 * [widget+0x180/+0x184] to the widget width/height, then maxes them against
 * each arranged child's right/bottom relative to the child context origin.
 *
 * This reproduces that final max only under a ZERO-SCROLL-OFFSET and
 * UNADJUSTED-VIEWPORT hypothesis. Native scrollbar reservations, positioning
 * transforms and visibility policy are not implemented or inferred here.
 */
export interface NativeScrollExtentCandidate {
	width: number;
	height: number;
	evidence: "native-derived-scroll-extent-prototype";
	assumptions: "zero-offset-unadjusted-viewport";
}

export function EstimateNativeScrollExtent(
	inspection: AuthoredScrollViewport
): NativeScrollExtentCandidate | null {
	const { viewport, directChildBounds } = inspection;
	const right = directChildBounds.x + directChildBounds.width;
	const bottom = directChildBounds.y + directChildBounds.height;
	if (![viewport.width, viewport.height, right, bottom].every(Number.isFinite)
		|| viewport.width <= 0 || viewport.height <= 0)
		return null;
	return {
		width: Math.max(viewport.width, right),
		height: Math.max(viewport.height, bottom),
		evidence: "native-derived-scroll-extent-prototype",
		assumptions: "zero-offset-unadjusted-viewport"
	};
}
