import type { GeometryRect } from "./GeometryCore.js";

/**
 * Shared, class-independent envelope of already positioned *direct* children.
 *
 * This is pure rectangle arithmetic, not a native size-to-content policy.
 * Callers separately decide which children are eligible, whether invisible
 * children participate, whether a zero-height child is meaningful, and how
 * the resulting bounds affect layout. No clipping or scrollbar reservation
 * is applied here.
 */
export interface ContentBounds {
	readonly left: number;
	readonly top: number;
	readonly right: number;
	readonly bottom: number;
	readonly width: number;
	readonly height: number;
	readonly childCount: number;
}

export interface ContentBoundsOptions {
	/** Some parent-height measurements permit a zero-height child box. */
	readonly allowZeroHeight?: boolean;
}

/**
 * One traversal, O(children.length), with no mutation of the source rects.
 * The envelope is not clamped to the parent origin: negative offsets remain
 * observable and a caller can select its own origin/clamping policy.
 *
 * Returns null for empty, invalid, nonfinite, overflowing, or negative-size
 * inputs. Refusing unsafe inputs prevents a partial/guessed content extent.
 */
export function MeasureContentBounds(
	children: readonly GeometryRect[],
	options: ContentBoundsOptions = {}
): ContentBounds | null {
	if (children.length === 0)
		return null;

	let left = Infinity;
	let top = Infinity;
	let right = -Infinity;
	let bottom = -Infinity;
	for (const child of children) {
		if (![child.x, child.y, child.width, child.height].every(Number.isFinite)
			|| child.width <= 0
			|| (options.allowZeroHeight ? child.height < 0 : child.height <= 0))
			return null;

		const childRight = child.x + child.width;
		const childBottom = child.y + child.height;
		if (!Number.isFinite(childRight) || !Number.isFinite(childBottom))
			return null;

		left = Math.min(left, child.x);
		top = Math.min(top, child.y);
		right = Math.max(right, childRight);
		bottom = Math.max(bottom, childBottom);
	}
	const width = right - left;
	const height = bottom - top;
	if (![left, top, right, bottom, width, height].every(Number.isFinite)
		|| width <= 0 || height < 0)
		return null;

	return { left, top, right, bottom, width, height, childCount: children.length };
}
