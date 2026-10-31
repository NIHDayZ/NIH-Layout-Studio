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
