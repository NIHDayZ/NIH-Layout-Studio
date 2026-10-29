import { IntersectRects, type GeometryRect } from "./GeometryCore.js";

/**
 * Generic, read-only visibility geometry. All widget classes share this
 * calculation; it never substitutes for the native render/scissor pipeline.
 *
 * Hierarchical visibility is supported by the captured DayZ client native
 * IsVisible() and IsVisibleHierarchy() observations. Clip intersections are
 * *authored rectangle candidates*, not independently verified native clips.
 */
export interface AuthoredVisibilityDiagnostic {
	/** This widget's own authored Visible flag (native IsVisible analogue). */
	readonly selfVisible: boolean;
	/** Parent hierarchy and this widget must both be visible. */
	readonly hierarchyVisible: boolean;
	readonly hiddenByAncestor: boolean;
	/** Parent clip rectangle, not this widget's Clipchildren policy. */
	readonly ancestorClip: GeometryRect | null;
	/** Geometric intersection, retained even for hidden widgets. */
	readonly intersectionCandidate: GeometryRect;
	readonly outsideAncestorClip: boolean;
	/** Null when hierarchy-hidden or geometrically outside the parent clip. */
	readonly paintCandidate: GeometryRect | null;
	readonly evidence: "authored-hierarchy-and-ancestor-clip-candidate";
}

function ValidRect(rect: GeometryRect): boolean {
	return [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite)
		&& rect.width >= 0 && rect.height >= 0
		&& Number.isFinite(rect.x + rect.width)
		&& Number.isFinite(rect.y + rect.height);
}

/**
 * Derive a generic UI visibility diagnostic after the common arrangement
 * pass. Not a native clipping mask, paint-opacity test, or a substitute for
 * IsVisibleHierarchy() when native flags outside the authored layout apply.
 */
export function InspectAuthoredVisibility(
	absoluteRect: GeometryRect,
	ancestorClip: GeometryRect | null,
	selfVisible: boolean,
	parentVisible: boolean
): AuthoredVisibilityDiagnostic | null {
	if (!ValidRect(absoluteRect) || (ancestorClip && !ValidRect(ancestorClip)))
		return null;

	const hierarchyVisible = selfVisible && parentVisible;
	const intersection = ancestorClip
		? IntersectRects(absoluteRect, ancestorClip)
		: { ...absoluteRect };
	const outsideAncestorClip = intersection.width === 0 || intersection.height === 0;
	return {
		selfVisible,
		hierarchyVisible,
		hiddenByAncestor: !parentVisible,
		ancestorClip: ancestorClip ? { ...ancestorClip } : null,
		intersectionCandidate: intersection,
		outsideAncestorClip,
		paintCandidate: hierarchyVisible && !outsideAncestorClip ? { ...intersection } : null,
		evidence: "authored-hierarchy-and-ancestor-clip-candidate"
	};
}
