import type { MeasuredLayoutNode } from "./LayoutMeasurement.js";
import type { MeasuredRelativeGrid } from "./GridRelativeBridge.js";
import { SelectManagedChildIndices } from "./ManagedVisibility.js";
import { PlanNativeRelativeGrid, type NativeRelativeGridChild } from "./GridRelativeContent.js";

/**
 * Research-only follow-up to Phase 3N. Does NOT participate in Studio rendering.
 *
 * Generalizes the native-derived provisional-cell pass just enough to examine
 * mixed ordinary relative-width siblings and a non-content-sized ScrollWidget
 * with an exact measured height. Never read native fixture coordinates here.
 * This is a candidate for further independent validation, not native parity.
 */
export interface MixedAxisGridCandidate {
	readonly root: MeasuredRelativeGrid;
	readonly plans: ReadonlyMap<MeasuredLayoutNode, MeasuredRelativeGrid>;
	readonly nestedCount: number;
}

export function ProbeMixedAxisGrid(
	parent: MeasuredLayoutNode,
	allocatedParentWidth: number,
	allocatedParentHeight: number
): MixedAxisGridCandidate | null {
	if (!Number.isFinite(allocatedParentWidth) || allocatedParentWidth <= 0
		|| !Number.isFinite(allocatedParentHeight) || allocatedParentHeight <= 0)
		return null;

	const plans = new Map<MeasuredLayoutNode, MeasuredRelativeGrid>();
	let nestedCount = 0;

	function Resolve(
		node: MeasuredLayoutNode,
		provisionalWidth: number,
		provisionalHeight: number,
		forceWidth: boolean,
		forceHeight: boolean,
		depth: number
	): MeasuredRelativeGrid | null {
		if (depth > 8 || node.strategy.kind !== "grid" || !node.nativeGrid
			|| (!node.unresolvedContentWidth && !node.unresolvedContentHeight)
			|| !Number.isFinite(provisionalWidth) || provisionalWidth <= 0
			|| !Number.isFinite(provisionalHeight) || provisionalHeight <= 0)
			return null;
		const indices = SelectManagedChildIndices(node.children, node.nativeIgnoreInvisible);
		if (!indices || indices.length === 0)
			return null;

		const sourceChildren: NativeRelativeGridChild[] = [];
		const nestedIndices: number[] = [];
		for (let i = 0; i < indices.length; ++i) {
			const child = node.children[indices[i]];
			const a = child.authored;
			const isNested = child.strategy.kind === "grid"
				&& (child.unresolvedContentWidth || child.unresolvedContentHeight);
			const isScrollLeaf = child.strategy.kind === "scroll"
				&& !child.unresolvedContentWidth && !child.unresolvedContentHeight;
			if (![a.sizeX, a.sizeY].every(Number.isFinite)
				|| a.sizeX < 0 || a.sizeY < 0)
				return null;

			if (isNested) {
				nestedIndices.push(i);
			} else {
				if (a.sizeToContentWidth || a.sizeToContentHeight
					|| (child.strategy.requiresArrangement && !isScrollLeaf)
					|| (isScrollLeaf && ((!a.exactSizeX && node.unresolvedContentWidth)
						&& (!a.exactSizeY && node.unresolvedContentHeight))))
					return null;
				// A ScrollWidget may be used only as a fixed-height leaf on
				// the measured content axis; its child scrolling is separate.
				if (isScrollLeaf && node.unresolvedContentHeight && !a.exactSizeY)
					return null;
			}
			// Relative ordinary siblings next to managers are currently
			// supported by independent native evidence only in 1-column grids.
			if (!isNested && node.nativeGrid.columns !== 1
				&& nestedIndices.length > 0
				&& (!a.exactSizeX || !a.exactSizeY))
				return null;

			sourceChildren.push({
				width: a.sizeX, height: a.sizeY,
				exactWidth: a.exactSizeX, exactHeight: a.exactSizeY
			});
		}
		if (node.nativeGrid.columns !== 1 && nestedIndices.length > 0
			&& indices.some(index => {
				const child = node.children[index];
				return child.strategy.kind !== "grid"
					&& (!child.authored.exactSizeX || !child.authored.exactSizeY);
			}))
			return null;

		const grid = node.nativeGrid;
		const settings = {
			columns: grid.columns, rows: grid.rows,
			padding: grid.padding, margin: grid.margin,
			authoredWidth: provisionalWidth, authoredHeight: provisionalHeight,
			contentWidth: node.unresolvedContentWidth,
			contentHeight: node.unresolvedContentHeight
		};
		const provisional = PlanNativeRelativeGrid({ ...settings, children: sourceChildren });
		if (!provisional)
			return null;

		let finalPlan = provisional;
		if (nestedIndices.length > 0) {
			const finalChildren = sourceChildren.slice();
			for (const i of nestedIndices) {
				const child = node.children[indices[i]];
				const slot = provisional.rects[i];
				const measured = Resolve(child, slot.width, slot.height,
					!node.unresolvedContentWidth, !node.unresolvedContentHeight, depth + 1);
				if (!measured)
					return null;
				++nestedCount;
				finalChildren[i] = {
					width: measured.plan.width, height: measured.plan.height,
					exactWidth: true, exactHeight: true
				};
			}
			const reconciled = PlanNativeRelativeGrid({ ...settings, children: finalChildren });
			if (!reconciled)
				return null;
			finalPlan = reconciled;
		}
		const width = forceWidth ? provisionalWidth : finalPlan.width;
		const height = forceHeight ? provisionalHeight : finalPlan.height;
		const result: MeasuredRelativeGrid = {
			plan: { ...finalPlan, width, height },
			participatingIndices: indices,
			nestedAllocatedGrid: true
		};
		plans.set(node, result);
		return result;
	}

	const authored = parent.authored;
	const width = authored.exactSizeX ? authored.sizeX
		: allocatedParentWidth * authored.sizeX;
	const height = authored.exactSizeY ? authored.sizeY
		: allocatedParentHeight * authored.sizeY;
	const root = Resolve(parent, width, height, false, false, 0);
	if (!root || nestedCount === 0)
		return null;
	return { root, plans, nestedCount };
}
