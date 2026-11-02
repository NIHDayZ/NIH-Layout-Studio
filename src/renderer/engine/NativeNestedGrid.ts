import type { MeasuredLayoutNode } from "./LayoutMeasurement.js";
import type { MeasuredRelativeGrid } from "./GridRelativeBridge.js";
import { SelectManagedChildIndices } from "./ManagedVisibility.js";
import { PlanNativeRelativeGrid, type NativeRelativeGridChild } from "./GridRelativeContent.js";

/**
 * Phase 3M: native-observed two-stage GridSpacer sizing. This experimental
 * probe is used only after a parent has a known allocated rectangle.
 * A parent distributes PROVISIONAL cells using the authored dimensions and
 * relative child fractions; the nested child measures using that cell;
 * finally the parent reconciles its content axes with the child's result.
 * Never re-measure a nested child against its newly shrunken final cell.
 */
export interface NestedAllocatedGridProbe {
	readonly root: MeasuredRelativeGrid;
	readonly plans: ReadonlyMap<MeasuredLayoutNode, MeasuredRelativeGrid>;
}

export function ProbeNestedAllocatedGrid(
	parent: MeasuredLayoutNode,
	allocatedParentWidth: number,
	allocatedParentHeight: number
): NestedAllocatedGridProbe | null {
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
		let hasNested = false;
		for (const index of indices) {
			const child = node.children[index];
			const authored = child.authored;
			const isNested = child.strategy.kind === "grid"
				&& (child.unresolvedContentWidth || child.unresolvedContentHeight);
			if (![authored.sizeX, authored.sizeY].every(Number.isFinite)
				|| authored.sizeX < 0 || authored.sizeY < 0
				|| (!isNested && (child.strategy.requiresArrangement
					|| authored.sizeToContentWidth || authored.sizeToContentHeight)))
				return null;
			if (isNested)
				hasNested = true;
			sourceChildren.push({
				width: authored.sizeX, height: authored.sizeY,
				exactWidth: authored.exactSizeX, exactHeight: authored.exactSizeY
			});
		}
		// The native reference has only exact ordinary siblings beside a
		// nested manager. Reject unmeasured mixed sibling dependencies.
		if (hasNested && indices.some(index => {
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
		if (hasNested) {
			const finalChildren = sourceChildren.slice();
			for (let i = 0; i < indices.length; ++i) {
				const child = node.children[indices[i]];
				if (child.strategy.kind !== "grid")
					continue;
				const provisionalSlot = provisional.rects[i];
				const measured = Resolve(child, provisionalSlot.width, provisionalSlot.height,
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
		// Outer equal-cell allocation overrides a nested content-size request
		// on that axis, but never invalidates the nested provisional children.
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
	return { root, plans };
}
