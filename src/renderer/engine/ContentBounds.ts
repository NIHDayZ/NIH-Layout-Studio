import type { ArrangedWidget, GeometryRect } from "./GeometryCore.js";

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

/**
 * Diagnostic-only envelope computed from the already arranged direct
 * children of a parent. Every child participates, including hidden children
 * and authored fallback positions inside unresolved managed containers.
 * This is intentionally NOT native size-to-content behavior.
 */
export interface ArrangedDirectChildBounds {
	readonly bounds: ContentBounds;
	readonly evidence: "arranged-direct-child-bounds";
	readonly assumptions: "all-direct-children-including-hidden-no-native-filter";
}

/**
 * O(total widgets): group each arranged child once by parent ID, then
 * calculate each parent's direct rectangle envelope. No tree re-traversal,
 * per-widget resource lookup, mutation or native eligibility assumptions.
 *
 * Duplicate IDs make the parent association ambiguous. Fail closed for the
 * entire diagnostic pass; the snapshot separately reports duplicate IDs.
 */
export function MeasureArrangedDirectChildBounds(
	entries: readonly Pick<ArrangedWidget, "id" | "parentId" | "localRect">[]
): ReadonlyMap<string, ArrangedDirectChildBounds> {
	const seen = new Set<string>();
	for (const entry of entries) {
		if (seen.has(entry.id))
			return new Map();
		seen.add(entry.id);
	}

	const byParent = new Map<string, GeometryRect[]>();
	for (const entry of entries) {
		if (entry.parentId === null || !seen.has(entry.parentId))
			continue;
		let rects = byParent.get(entry.parentId);
		if (!rects) {
			rects = [];
			byParent.set(entry.parentId, rects);
		}
		rects.push(entry.localRect);
	}

	const output = new Map<string, ArrangedDirectChildBounds>();
	for (const [parentId, children] of byParent) {
		const bounds = MeasureContentBounds(children, { allowZeroHeight: true });
		if (!bounds)
			continue;
		output.set(parentId, {
			bounds,
			evidence: "arranged-direct-child-bounds",
			assumptions: "all-direct-children-including-hidden-no-native-filter"
		});
	}
	return output;
}
