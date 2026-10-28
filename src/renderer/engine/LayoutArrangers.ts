import type { GeometryRect } from "./GeometryCore.js";
import { PlanConstrainedGrid } from "./ConstrainedGrid.js";
import type { MeasuredLayoutNode } from "./LayoutMeasurement.js";

/**
 * Explicitly enabled prototype strategies. Default (omitted) means
 * authored-coordinate diagnostics only; no native layout inference.
 */
export interface ArrangementOptions {
	constrainedGrid?: boolean;
	/**
	 * Prototype only: consume a supplied independent intrinsic dimension for
	 * leaf ImageWidget/TextWidget size-to-content. No native parity asserted.
	 */
	providedIntrinsicContent?: boolean;
}

export interface AppliedLayoutStrategy {
	id: string;
	kind: "grid";
	evidence: "native-disassembly";
	mode: "constrained-grid-prototype";
}

export interface ChildArrangement {
	rects: readonly GeometryRect[];
	applied: AppliedLayoutStrategy;
}

/**
 * Verified native fixed-cell arithmetic, guarded wherever Workbench behavior
 * has not yet been traced: content-sized axes, overflowing slot count,
 * filtered/hidden children, and invalid parent geometry.
 */
function ArrangeConstrainedGrid(
	parent: MeasuredLayoutNode,
	rect: GeometryRect
): ChildArrangement | null {
	const grid = parent.nativeGrid;
	if (!grid || parent.unresolvedContentWidth || parent.unresolvedContentHeight)
		return null;
	if (parent.children.length > grid.columns * grid.rows)
		return null;
	if (!parent.children.every((child) => child.authored.visible))
		return null;
	if (!Number.isFinite(rect.width) || rect.width < 0 || !Number.isFinite(rect.height) || rect.height < 0)
		return null;

	return {
		rects: PlanConstrainedGrid(
			parent.children.length, grid.columns, grid.rows,
			{ width: rect.width, height: rect.height }, grid.margin, grid.padding
		).rects,
		applied: {
			id: parent.node.id,
			kind: "grid",
			evidence: "native-disassembly",
			mode: "constrained-grid-prototype"
		}
	};
}

type StrategyPlanner = (node: MeasuredLayoutNode, rect: GeometryRect) => ChildArrangement | null;

/**
 * Single dispatch boundary for native widget-specific child arrangement.
 * Add a new strategy here only with independent evidence and regression tests.
 * Ordinary Frame/Panel/Text/Image/Button placement is handled by the shared
 * authored geometry resolver, not this registry.
 */
const IMPLEMENTED_STRATEGIES: Partial<Record<MeasuredLayoutNode["strategy"]["kind"], StrategyPlanner>> = {
	grid: ArrangeConstrainedGrid
};

export function PlanManagedChildren(
	parent: MeasuredLayoutNode,
	containerRect: GeometryRect,
	options: ArrangementOptions = {}
): ChildArrangement | null {
	if (!parent.strategy.requiresArrangement || parent.children.length === 0)
		return null;
	if (parent.strategy.kind === "grid" && !options.constrainedGrid)
		return null;
	const handler = IMPLEMENTED_STRATEGIES[parent.strategy.kind];
	return handler?.(parent, containerRect) ?? null;
}
