import type { LayoutConstraints, MeasuredWidget } from "./GeometryCore.js";
import { DecodeAuthoredGeometry, MeasureAuthoredSize, type AuthoredGeometry, type GeometryWidget } from "./WidgetGeometry.js";
import { ResolveChildLayoutStrategy, type ChildLayoutStrategy } from "./WidgetStrategies.js";
import { DecodeNativeGridSettings, type NativeGridSettings } from "./ConstrainedGrid.js";
import { DecodeNativeWrapSettings, type NativeWrapSettings } from "./FixedWrap.js";
import { DecodeNativeScrollSettings, type NativeScrollSettings } from "./ScrollSettings.js";
import { ResolveIntrinsicMeasurement, type IntrinsicMeasurementProviders, type ResolvedIntrinsicMeasurement } from "./IntrinsicMeasurements.js";
import type { ConstrainedTextPreparer, PreparedTextFlow } from "./ConstrainedText.js";

/**
 * A prepared layout node with geometry properties decoded exactly once.
 * Children are measured before their parent; the tree retains document order.
 *
 * `measurement` is an authored-size hint, NOT a native content measurement.
 * Unsupported native sizing is marked explicitly instead of inventing a
 * preferred size for text, images, or managed containers.
 */
export interface MeasuredLayoutNode {
	readonly node: GeometryWidget;
	readonly authored: AuthoredGeometry;
	readonly strategy: ChildLayoutStrategy;
	/** Grid-only native settings decoded once; absent for other widget classes. */
	readonly nativeGrid: NativeGridSettings | null;
	/** Wrap-only spacing and alignment, decoded once. */
	readonly nativeWrap: NativeWrapSettings | null;
	/** Native scroll bar toggles decoded only for ScrollWidget. */
	readonly nativeScroll: NativeScrollSettings | null;
	readonly measurement: MeasuredWidget;
	/** Optional external resource measurements, never calculated from the widget rectangle. */
	readonly intrinsic: ResolvedIntrinsicMeasurement | null;
	/** Deferred width-constrained text preview; must run after width arrangement. */
	readonly textFlow: PreparedTextFlow | null;
	readonly unresolvedContentWidth: boolean;
	readonly unresolvedContentHeight: boolean;
	readonly children: readonly MeasuredLayoutNode[];
}

export interface MeasuredLayoutTree {
	readonly roots: readonly MeasuredLayoutNode[];
	readonly nodeCount: number;
	readonly unresolvedContentSizeCount: number;
	readonly managedContainerCount: number;
}

/**
 * Phase 1: bottom-up property decoding and conservative intrinsic measurement.
 *
 * Do not expand a parent to include children here. When native Size To
 * Content is requested, its extent depends on widget-specific measurement,
 * child alignment, visibility and possibly parent constraints.
 */
export interface MeasurementOptions {
	intrinsics?: IntrinsicMeasurementProviders;
	/** Optional preview-only text measurement; not native Workbench. */
	constrainedText?: ConstrainedTextPreparer;
}

export function MeasureLayoutTree(
	roots: readonly GeometryWidget[],
	options: MeasurementOptions = {}
): MeasuredLayoutTree {
	let nodeCount = 0;
	let unresolvedContentSizeCount = 0;
	let managedContainerCount = 0;

	function Measure(node: GeometryWidget): MeasuredLayoutNode | null {
		if (!node.type.toLowerCase().includes("widgetclass"))
			return null;
		const children: MeasuredLayoutNode[] = [];
		for (const child of node.children) {
			const measured = Measure(child);
			if (measured)
				children.push(measured);
		}
		const authored = DecodeAuthoredGeometry(node);
		const strategy = ResolveChildLayoutStrategy(node.type);
		const nativeGrid = strategy.kind === "grid" ? DecodeNativeGridSettings(node.properties) : null;
		const nativeWrap = strategy.kind === "wrap" ? DecodeNativeWrapSettings(node.properties) : null;
		const nativeScroll = strategy.kind === "scroll" ? DecodeNativeScrollSettings(node.properties) : null;
		const intrinsic = options.intrinsics && (authored.sizeToContentWidth || authored.sizeToContentHeight)
			? ResolveIntrinsicMeasurement(node, options.intrinsics) : null;
		const textFlow = options.constrainedText && node.type.trim().toLowerCase() === "textwidgetclass"
			&& authored.sizeToContentHeight && !authored.sizeToContentWidth && children.length === 0
			? options.constrainedText(node) : null;
		const unresolvedContentWidth = authored.sizeToContentWidth;
		const unresolvedContentHeight = authored.sizeToContentHeight;
		++nodeCount;
		if (unresolvedContentWidth || unresolvedContentHeight)
			++unresolvedContentSizeCount;
		if (strategy.requiresArrangement && children.length > 0)
			++managedContainerCount;
		return {
			node,
			authored,
			strategy,
			nativeGrid,
			nativeWrap,
			nativeScroll,
			measurement: MeasureAuthoredSize(authored),
			intrinsic,
			textFlow,
			unresolvedContentWidth,
			unresolvedContentHeight,
			children
		};
	}

	const measuredRoots: MeasuredLayoutNode[] = [];
	for (const root of roots) {
		const measured = Measure(root);
		if (measured)
			measuredRoots.push(measured);
	}

	return {
		roots: measuredRoots,
		nodeCount,
		unresolvedContentSizeCount,
		managedContainerCount
	};
}

/** Pass finite caller constraints to descendants without guessing DPI rules. */
export function ChildConstraints(
	container: Pick<LayoutConstraints, "availableWidth" | "availableHeight">,
	dpiScale: number
): LayoutConstraints {
	return {
		availableWidth: container.availableWidth,
		availableHeight: container.availableHeight,
		dpiScale
	};
}
