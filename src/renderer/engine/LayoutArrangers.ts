import type { GeometryRect } from "./GeometryCore.js";
import { PlanConstrainedGrid } from "./ConstrainedGrid.js";
import { MeasureFixedWrapContent, PlanFixedWrap, type FixedWrapContentPlan } from "./FixedWrap.js";
import type { MeasuredLayoutNode } from "./LayoutMeasurement.js";

/**
 * Explicitly enabled prototype strategies. Default (omitted) means
 * authored-coordinate diagnostics only; no native layout inference.
 */
export interface ArrangementOptions {
	constrainedGrid?: boolean;
	/** Native-derived fixed-child WrapSpacer only; no content-sized axes. */
	fixedWrap?: boolean;
	/** Prototype: resolve vertical Wrap size from fixed child lines at a known width. Requires fixedWrap. */
	wrapContentHeight?: boolean;
	/**
	 * Prototype only: consume a supplied independent intrinsic dimension for
	 * leaf ImageWidget/TextWidget size-to-content. No native parity asserted.
	 */
	providedIntrinsicContent?: boolean;
	/** Preview only: use measured text height AFTER its authored width is resolved. */
	constrainedTextPreview?: boolean;
	/** Prototype only: derive ordinary Frame/Panel height from acyclic child extents. */
	boundedParentContent?: boolean;
}

export interface AppliedLayoutStrategy {
	id: string;
	kind: "grid" | "wrap";
	evidence: "native-disassembly";
	mode: "constrained-grid-prototype" | "fixed-wrap-prototype";
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

/**
 * Apply only the native-derived line packing case for fixed-size children.
 * Refuse any child with a size-to-content request or a relative axis: that
 * would require intrinsic negotiation not yet recovered from Workbench.
 */
function ReadFixedWrapChildren(
	parent: MeasuredLayoutNode
): readonly Pick<GeometryRect, "width" | "height">[] | null {
	if (!parent.nativeWrap || parent.unresolvedContentWidth
		|| !parent.children.every((child) =>
			child.authored.visible && child.authored.exactSizeX && child.authored.exactSizeY
			&& !child.authored.sizeToContentWidth && !child.authored.sizeToContentHeight
			&& Number.isFinite(child.authored.sizeX) && child.authored.sizeX > 0
			&& Number.isFinite(child.authored.sizeY) && child.authored.sizeY > 0
		))
		return null;
	return parent.children.map((child) => ({
		width: child.authored.sizeX,
		height: child.authored.sizeY
	}));
}

/**
 * Pure width-dependent height candidate. This does not mutate the parent.
 * The content-sized parent must have an independently resolved horizontal
 * dimension and the same fixed-child constraints as the Wrap arranger.
 */
export function ProbeWrapContentHeight(
	parent: MeasuredLayoutNode,
	resolvedWidth: number,
	options: ArrangementOptions = {}
): FixedWrapContentPlan | null {
	if (!options.fixedWrap || !options.wrapContentHeight
		|| parent.strategy.kind !== "wrap"
		|| parent.unresolvedContentWidth || !parent.unresolvedContentHeight)
		return null;
	const sizes = ReadFixedWrapChildren(parent);
	return sizes && parent.nativeWrap
		? MeasureFixedWrapContent(sizes, resolvedWidth, parent.nativeWrap) : null;
}

function ArrangeFixedWrap(
	parent: MeasuredLayoutNode,
	rect: GeometryRect
): ChildArrangement | null {
	const sizes = ReadFixedWrapChildren(parent);
	if (!sizes || !parent.nativeWrap || parent.unresolvedContentHeight)
		return null;
	const plan = PlanFixedWrap(sizes, rect, parent.nativeWrap);
	if (!plan)
		return null;
	return {
		rects: plan.rects,
		applied: {
			id: parent.node.id,
			kind: "wrap",
			evidence: "native-disassembly",
			mode: "fixed-wrap-prototype"
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
	grid: ArrangeConstrainedGrid,
	wrap: ArrangeFixedWrap
};

export function PlanManagedChildren(
	parent: MeasuredLayoutNode,
	containerRect: GeometryRect,
	options: ArrangementOptions = {},
	measuredWrapContent: FixedWrapContentPlan | null = null
): ChildArrangement | null {
	if (!parent.strategy.requiresArrangement || parent.children.length === 0)
		return null;
	if (parent.strategy.kind === "grid" && !options.constrainedGrid)
		return null;
	if (parent.strategy.kind === "wrap" && !options.fixedWrap)
		return null;
	if (parent.strategy.kind === "wrap" && parent.unresolvedContentHeight) {
		if (!options.wrapContentHeight || !measuredWrapContent
			|| Math.abs(measuredWrapContent.requiredHeight - containerRect.height) > 0.000001)
			return null;
		return {
			rects: measuredWrapContent.rects,
			applied: {
				id: parent.node.id, kind: "wrap", evidence: "native-disassembly",
				mode: "fixed-wrap-prototype"
			}
		};
	}
	const handler = IMPLEMENTED_STRATEGIES[parent.strategy.kind];
	return handler?.(parent, containerRect) ?? null;
}
