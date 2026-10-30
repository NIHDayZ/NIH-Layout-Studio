import type { GeometryRect } from "./GeometryCore.js";
import { DecodeNativeGridSettings, PlanConstrainedGrid } from "./ConstrainedGrid.js";
import { DecodeNativeWrapSettings, MeasureFixedWrapContent, PlanFixedWrap, PlanFixedWrapPreview, type FixedWrapContentPlan } from "./FixedWrap.js";
import { MeasureAuthoredScrollViewport, type AuthoredScrollViewport } from "./ScrollViewport.js";
import { ResolveAuthoredRect } from "./WidgetGeometry.js";
import { EstimateUnscaledScrollViewport, type UnscaledScrollViewportCandidate } from "./ScrollSettings.js";
import type { MeasuredLayoutNode } from "./LayoutMeasurement.js";
import { ScatterManagedRects, SelectManagedChildIndices } from "./ManagedVisibility.js";
import type { NativeScrollOffsets } from "./ScrollOffset.js";

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
	/** Authored-only viewport diagnostics; does not simulate native scrolling. */
	scrollViewportDiagnostics?: boolean;
	/** Native-derived MAX extent candidate only, assumes zero offset and unadjusted viewport. */
	scrollNativeExtentDiagnostics?: boolean;
	/** Prototype unscaled scrollbar reservation and child viewport, never live Scroll clipping. */
	scrollScrollbarViewportDiagnostics?: boolean;
	/** Caller-supplied native Scroll state for read-only geometry comparisons. */
	scrollOffsetSamples?: ReadonlyMap<string, NativeScrollOffsets>;
	/**
	 * Prototype only: consume a supplied independent intrinsic dimension for
	 * leaf ImageWidget/TextWidget size-to-content. No native parity asserted.
	 */
	providedIntrinsicContent?: boolean;
	/** Preview only: use measured text height AFTER its authored width is resolved. */
	constrainedTextPreview?: boolean;
	/** Prototype only: derive ordinary Frame/Panel height from acyclic child extents. */
	boundedParentContent?: boolean;
	/**
	 * O(n), read-only envelopes of each parent's arranged direct children.
	 * All children count, including hidden and authored manager fallbacks.
	 * These bounds do NOT resize parents or simulate native sizing policy.
	 */
	directChildBoundsDiagnostics?: boolean;
	/**
	 * Common authored visibility and ancestor-clip intersection diagnostics.
	 * Read-only, class-agnostic, and NOT a native scissor/painting strategy.
	 */
	authoredVisibilityDiagnostics?: boolean;
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
 * invalid native visibility flags and invalid parent geometry.
 */
function ArrangeConstrainedGrid(
	parent: MeasuredLayoutNode,
	rect: GeometryRect
): ChildArrangement | null {
	const grid = parent.nativeGrid;
	const indices = SelectManagedChildIndices(parent.children, parent.nativeIgnoreInvisible);
	if (!grid || !indices || indices.length === 0
		|| parent.unresolvedContentWidth || parent.unresolvedContentHeight
		|| indices.length > grid.columns * grid.rows)
		return null;
	if (!Number.isFinite(rect.width) || rect.width < 0
		|| !Number.isFinite(rect.height) || rect.height < 0)
		return null;

	const plan = PlanConstrainedGrid(
		indices.length, grid.columns, grid.rows,
		{ width: rect.width, height: rect.height }, grid.margin, grid.padding
	);
	const rects = ScatterManagedRects(indices, plan.rects, parent.children.length);
	if (!rects)
		return null;
	return {
		rects,
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
interface EligibleWrapChildren {
	readonly indices: readonly number[];
	readonly sizes: readonly Pick<GeometryRect, "width" | "height">[];
}

function ReadFixedWrapChildren(
	parent: MeasuredLayoutNode
): EligibleWrapChildren | null {
	const indices = SelectManagedChildIndices(parent.children, parent.nativeIgnoreInvisible);
	if (!parent.nativeWrap || parent.unresolvedContentWidth || !indices || indices.length === 0)
		return null;
	if (!indices.every((index) => {
		const child = parent.children[index].authored;
		return child.exactSizeX && child.exactSizeY
			&& !child.sizeToContentWidth && !child.sizeToContentHeight
			&& Number.isFinite(child.sizeX) && child.sizeX > 0
			&& Number.isFinite(child.sizeY) && child.sizeY > 0;
	}))
		return null;
	return {
		indices,
		sizes: indices.map((index) => ({
			width: parent.children[index].authored.sizeX,
			height: parent.children[index].authored.sizeY
		}))
	};
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
	const eligible = ReadFixedWrapChildren(parent);
	if (!eligible || !parent.nativeWrap)
		return null;
	const plan = MeasureFixedWrapContent(eligible.sizes, resolvedWidth, parent.nativeWrap);
	if (!plan)
		return null;
	const rects = ScatterManagedRects(eligible.indices, plan.rects, parent.children.length);
	return rects ? { ...plan, rects } : null;
}

function ArrangeFixedWrap(
	parent: MeasuredLayoutNode,
	rect: GeometryRect
): ChildArrangement | null {
	const eligible = ReadFixedWrapChildren(parent);
	if (!eligible || !parent.nativeWrap || parent.unresolvedContentHeight)
		return null;
	const plan = PlanFixedWrap(eligible.sizes, rect, parent.nativeWrap);
	if (!plan)
		return null;
	const rects = ScatterManagedRects(eligible.indices, plan.rects, parent.children.length);
	if (!rects)
		return null;
	return {
		rects,
		applied: {
			id: parent.node.id,
			kind: "wrap",
			evidence: "native-disassembly",
			mode: "fixed-wrap-prototype"
		}
	};
}

/**
 * Read-only ScrollWidget viewport diagnostic. Only eligible exact, direct
 * child bounds are measured; we never infer native scrollbars/offsets.
 * This does NOT fulfill the ScrollWidget arrangement strategy.
 */
export function ProbeScrollViewport(
	parent: MeasuredLayoutNode,
	rect: GeometryRect,
	options: ArrangementOptions = {}
): AuthoredScrollViewport | null {
	if (!options.scrollViewportDiagnostics || parent.strategy.kind !== "scroll"
		|| parent.unresolvedContentWidth || parent.unresolvedContentHeight)
		return null;
	const indices = SelectManagedChildIndices(parent.children, parent.nativeIgnoreInvisible);
	if (!indices || indices.length === 0
		|| !indices.every((index) => {
			const child = parent.children[index];
			return !child.strategy.requiresArrangement
				&& child.authored.exactPositionX && child.authored.exactPositionY
				&& child.authored.exactSizeX && child.authored.exactSizeY
				&& !child.authored.sizeToContentWidth && !child.authored.sizeToContentHeight;
		}))
		return null;
	const rects = indices.map((index) =>
		ResolveAuthoredRect(parent.children[index].authored, {
			width: rect.width, height: rect.height
		}));
	return MeasureAuthoredScrollViewport(rect, rects);
}

/**
 * Independent from authored child-overhang and content-extent inspection:
 * the compiled native branch reserves space for scrollbars in the child
 * viewport before it measures descendants.
 */
export function ProbeUnscaledScrollViewport(
	parent: MeasuredLayoutNode,
	rect: GeometryRect,
	unitScale: number,
	options: ArrangementOptions = {}
): UnscaledScrollViewportCandidate | null {
	if (!options.scrollScrollbarViewportDiagnostics || parent.strategy.kind !== "scroll"
		|| parent.unresolvedContentWidth || parent.unresolvedContentHeight
		|| !parent.nativeScroll)
		return null;
	return EstimateUnscaledScrollViewport(rect, parent.nativeScroll, unitScale);
}


/**
 * One managed-container native planning boundary, shared by live preview and
 * the measured snapshot strategy. Unverified modes are opt-in, not defaults.
 * Preview returns child-index-preserving rectangles without changing source.
 */
export function PlanNativeManagedPreview(
	type: string,
	properties: readonly { name: string; value: string }[],
	children: readonly GeometryRect[],
	container: GeometryRect,
	mode: "constrained-grid" | "fixed-wrap"
): readonly GeometryRect[] | null {
	const widgetType = type.trim().toLowerCase();
	if (mode === "constrained-grid") {
		if (widgetType !== "gridspacerwidgetclass")
			return null;
		const grid = DecodeNativeGridSettings(properties);
		if (children.length > grid.columns * grid.rows)
			return null;
		return PlanConstrainedGrid(children.length, grid.columns, grid.rows,
			container, grid.margin, grid.padding).rects;
	}
	if (widgetType !== "wrapspacerwidgetclass")
		return null;
	const settings = DecodeNativeWrapSettings(properties);
	return PlanFixedWrapPreview(children, container, settings)?.rects ?? null;
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
