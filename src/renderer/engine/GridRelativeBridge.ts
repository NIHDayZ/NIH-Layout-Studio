import type { MeasuredLayoutNode } from "./LayoutMeasurement.js";
import { SelectManagedChildIndices } from "./ManagedVisibility.js";
import {
	PlanNativeRelativeGrid,
	type NativeRelativeGridChild,
	type NativeRelativeGridPlan
} from "./GridRelativeContent.js";

/**
 * Phase 2M: strictly opt-in bridge from already decoded widget measurements
 * to the independent Phase 2L native-derived GridSpacer planner.
 * No global state, source IDs, property rescans or production Canvas hooks.
 */
export interface MeasuredRelativeGrid {
	readonly plan: NativeRelativeGridPlan;
	readonly participatingIndices: readonly number[];
	/** Only set by the Phase 3I resolved-parent experiment; never by legacy exact-size probe. */
	readonly allocatedParentRelative?: true;
	/** Phase 3K single-axis candidate, separately gated from Phase 3I. */
	readonly allocatedParentSingleAxis?: true;
	/** Phase 3M opt-in: provisional nested cells and reconciled content axes. */
	readonly nestedAllocatedGrid?: true;
	/** Phase 3N research: mixed ordinary relatives / fixed-height Scroll alongside nested Grid. */
	readonly mixedAllocatedGrid?: true;
}

/**
 * Cache belongs to one snapshot arrangement pass, never to a document or
 * component lifetime. Nested content-sized GridSpacers measure bottom-up.
 */
export function ProbeMeasuredRelativeGrid(
	parent: MeasuredLayoutNode,
	cache: WeakMap<MeasuredLayoutNode, MeasuredRelativeGrid | null>
): MeasuredRelativeGrid | null {
	if (cache.has(parent))
		return cache.get(parent) ?? null;
	const grid = parent.nativeGrid;
	if (parent.strategy.kind !== "grid" || !grid
		|| (!parent.unresolvedContentWidth && !parent.unresolvedContentHeight)
		|| !parent.authored.exactSizeX || !parent.authored.exactSizeY) {
		cache.set(parent, null);
		return null;
	}
	const indices = SelectManagedChildIndices(parent.children, parent.nativeIgnoreInvisible);
	if (!indices || indices.length === 0) {
		cache.set(parent, null);
		return null;
	}
	const children: NativeRelativeGridChild[] = [];
	for (const index of indices) {
		const child = parent.children[index];
		const a = child.authored;
		if (a.sizeToContentWidth || a.sizeToContentHeight) {
			// Only nested content-sized GridSpacers have been captured.
			// Both dimensions must be concrete and the nested arrangement
			// must be independently supported.
			if (child.strategy.kind !== "grid" || !a.sizeToContentWidth
				|| !a.sizeToContentHeight || !a.exactSizeX || !a.exactSizeY) {
				cache.set(parent, null);
				return null;
			}
			const nested = ProbeMeasuredRelativeGrid(child, cache);
			if (!nested) {
				cache.set(parent, null);
				return null;
			}
			children.push({
				width: nested.plan.width,
				height: nested.plan.height,
				exactWidth: true,
				exactHeight: true
			});
			continue;
		}
		// Unsupported managed children cannot be treated as plain rectangles.
		if (child.strategy.requiresArrangement || !Number.isFinite(a.sizeX)
			|| !Number.isFinite(a.sizeY) || a.sizeX < 0 || a.sizeY < 0) {
			cache.set(parent, null);
			return null;
		}
		children.push({
			width: a.sizeX,
			height: a.sizeY,
			exactWidth: a.exactSizeX,
			exactHeight: a.exactSizeY
		});
	}
	const plan = PlanNativeRelativeGrid({
		columns: grid.columns,
		rows: grid.rows,
		padding: grid.padding,
		margin: grid.margin,
		authoredWidth: parent.authored.sizeX,
		authoredHeight: parent.authored.sizeY,
		contentWidth: parent.unresolvedContentWidth,
		contentHeight: parent.unresolvedContentHeight,
		children
	});
	const result = plan ? { plan, participatingIndices: indices } : null;
	cache.set(parent, result);
	return result;
}

/**
 * Phase 3I: strictly scoped, opt-in experiment for content-sized GridSpacers
 * whose authored size is relative to a KNOWN, already allocated parent rect.
 *
 * Unlike ProbeMeasuredRelativeGrid, these parent dimensions are resolved
 * before invoking the native-derived cell planner. Reject nested content-
 * sized / other managed children: their allocation must be solved separately.
 * This is not used by the existing exact-size bridge or default renderer.
 */
export function ProbeAllocatedParentRelativeGrid(
	parent: MeasuredLayoutNode,
	allocatedParentWidth: number,
	allocatedParentHeight: number,
	mode: "both" | "single" = "both"
): MeasuredRelativeGrid | null {
	const grid = parent.nativeGrid;
	const authored = parent.authored;
	const contentWidth = parent.unresolvedContentWidth;
	const contentHeight = parent.unresolvedContentHeight;
	const validContentAxes = mode === "single"
		? contentWidth !== contentHeight : contentWidth && contentHeight;
	if (parent.strategy.kind !== "grid" || !grid
		|| !validContentAxes
		|| (authored.exactSizeX && authored.exactSizeY)
		|| !Number.isFinite(allocatedParentWidth) || allocatedParentWidth <= 0
		|| !Number.isFinite(allocatedParentHeight) || allocatedParentHeight <= 0)
		return null;
	const resolvedWidth = authored.exactSizeX
		? authored.sizeX : allocatedParentWidth * authored.sizeX;
	const resolvedHeight = authored.exactSizeY
		? authored.sizeY : allocatedParentHeight * authored.sizeY;
	if (![resolvedWidth, resolvedHeight].every(Number.isFinite)
		|| resolvedWidth <= 0 || resolvedHeight <= 0)
		return null;
	const indices = SelectManagedChildIndices(parent.children, parent.nativeIgnoreInvisible);
	if (!indices || indices.length === 0)
		return null;
	const children: NativeRelativeGridChild[] = [];
	for (const index of indices) {
		const child = parent.children[index];
		const a = child.authored;
		// No guessed nested content allocation, hidden-child reinterpretation,
		// or unsupported manager invocation in this phase.
		if (a.sizeToContentWidth || a.sizeToContentHeight
			|| child.strategy.requiresArrangement
			|| !Number.isFinite(a.sizeX) || !Number.isFinite(a.sizeY)
			|| a.sizeX < 0 || a.sizeY < 0)
			return null;
		children.push({
			width: a.sizeX,
			height: a.sizeY,
			exactWidth: a.exactSizeX,
			exactHeight: a.exactSizeY
		});
	}
	const plan = PlanNativeRelativeGrid({
		columns: grid.columns,
		rows: grid.rows,
		padding: grid.padding,
		margin: grid.margin,
		authoredWidth: resolvedWidth,
		authoredHeight: resolvedHeight,
		contentWidth,
		contentHeight,
		children
	});
	if (!plan)
		return null;
	if (mode === "single")
		return { plan, participatingIndices: indices, allocatedParentRelative: true,
			allocatedParentSingleAxis: true };
	return { plan, participatingIndices: indices, allocatedParentRelative: true };
}

/**
 * Phase 3K: single-axis Size To Content against known allocated parent size.
 * Requires a separate snapshot/Canvas flag: existing Phase 3I remains both-axis.
 */
export function ProbeAllocatedParentSingleAxisGrid(
	parent: MeasuredLayoutNode,
	allocatedParentWidth: number,
	allocatedParentHeight: number
): MeasuredRelativeGrid | null {
	return ProbeAllocatedParentRelativeGrid(parent, allocatedParentWidth,
		allocatedParentHeight, "single");
}
