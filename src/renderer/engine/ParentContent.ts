import type { MeasuredLayoutNode } from "./LayoutMeasurement.js";
import type { GeometryRect } from "./GeometryCore.js";
import { MeasureContentBounds } from "./ContentBounds.js";
import { ResolveAuthoredRect } from "./WidgetGeometry.js";

/**
 * Diagnostic-only parent height negotiation for ordinary Frame/Panel nodes.
 * Workbench's native child bounding-box and cyclic dependency rules are NOT
 * recovered. Accept only a strictly acyclic, top-referenced vertical graph.
 */
export type ParentContentFailure =
	| "unsupported-parent"
	| "parent-width-unresolved"
	| "managed-child-layout"
	| "hidden-child"
	| "parent-height-dependency"
	| "unsupported-child-content"
	| "invalid-child-geometry"
	| "empty-content";

export interface ParentContentResult {
	height: number;
	contributingChildren: number;
	evidence: "bounded-child-extent-prototype";
}

export interface ParentContentAttempt {
	result: ParentContentResult | null;
	failure: ParentContentFailure | null;
	causeId: string | null;
}

export interface ParentContentResolvers {
	/** Width must already be final. Return only a validated height. */
	textHeight: (node: MeasuredLayoutNode, width: number) => number | null;
	intrinsicHeight: (node: MeasuredLayoutNode) => number | null;
}

function Failed(failure: ParentContentFailure, causeId: string): ParentContentAttempt {
	return { result: null, failure, causeId };
}

function IsOrdinaryContainer(node: MeasuredLayoutNode): boolean {
	const type = node.node.type.trim().toLowerCase();
	return type === "framewidgetclass" || type === "panelwidgetclass";
}

/**
 * Estimate a vertical-only Size To Content parent without a feedback loop.
 * Each child must be top-anchored with a fixed vertical offset, and must
 * either have an exact height or an independently resolvable content height.
 * Nested ordinary content-sized parents are permitted with the same rules.
 *
 * This is not a native Workbench container sizing implementation. In
 * particular, it does not infer padding, invisible-child behavior,
 * scroll extents, or layout manager allocations. A managed child with
 * fixed authored height contributes only its outer box, not its contents.
 */
export function ResolveBoundedParentHeight(
	parent: MeasuredLayoutNode,
	finalWidth: number,
	resolvers: ParentContentResolvers,
	depth = 0
): ParentContentAttempt {
	if (!IsOrdinaryContainer(parent) || !parent.authored.sizeToContentHeight)
		return Failed("unsupported-parent", parent.node.id);
	if (!Number.isFinite(finalWidth) || finalWidth <= 0 || parent.authored.sizeToContentWidth)
		return Failed("parent-width-unresolved", parent.node.id);
	if (parent.strategy.requiresArrangement)
		return Failed("managed-child-layout", parent.node.id);
	if (parent.children.length === 0)
		return Failed("empty-content", parent.node.id);
	// A finite traversal bound protects diagnostic evaluation from an
	// unexpected cyclic object graph or pathologically nested user layouts.
	if (depth >= 64)
		return Failed("parent-height-dependency", parent.node.id);

	// Parent-specific dependency/eligibility checks stay here. Only the
	// finite rectangle envelope is shared with other layout families.
	const boxes: GeometryRect[] = [];
	for (const child of parent.children) {
		const authored = child.authored;
		if (!authored.visible)
			return Failed("hidden-child", child.node.id);
		// A managed child with a completely fixed authored height is an
		// opaque box to its parent. Its internal Grid/Wrap/Scroll placement
		// need not be recovered to establish that outer vertical extent.
		// The manager must still report its own unresolved layout separately.
		if (child.strategy.requiresArrangement
			&& (authored.sizeToContentHeight || authored.sizeToContentWidth || !authored.exactSizeY))
			return Failed("managed-child-layout", child.node.id);
		const align = authored.vAlign.trim().toLowerCase();
		if (!authored.exactPositionY || (align !== "top_ref" && align !== "top")
			|| (!authored.exactSizeY && !authored.sizeToContentHeight))
			return Failed("parent-height-dependency", child.node.id);
		if (authored.sizeToContentWidth)
			return Failed("parent-width-unresolved", child.node.id);

		// Width may be relative to the known final parent width, but its
		// vertical dimensions must never read the unknown parent height.
		const authoredRect = ResolveAuthoredRect(authored, { width: finalWidth, height: 0 });
		if (!Number.isFinite(authoredRect.width) || authoredRect.width <= 0
			|| !Number.isFinite(authoredRect.y) || authoredRect.y < 0)
			return Failed("invalid-child-geometry", child.node.id);

		let height = authoredRect.height;
		if (authored.sizeToContentHeight) {
			if (child.children.length > 0 && IsOrdinaryContainer(child)) {
				const nested = ResolveBoundedParentHeight(child, authoredRect.width, resolvers, depth + 1);
				if (!nested.result)
					return Failed(nested.failure ?? "unsupported-child-content", nested.causeId ?? child.node.id);
				height = nested.result.height;
			} else if (child.children.length === 0 && child.node.type.trim().toLowerCase() === "textwidgetclass") {
				height = resolvers.textHeight(child, authoredRect.width)
					?? resolvers.intrinsicHeight(child) ?? NaN;
			} else if (child.children.length === 0) {
				height = resolvers.intrinsicHeight(child) ?? NaN;
			} else {
				return Failed("unsupported-child-content", child.node.id);
			}
		} else if (!authored.exactSizeY) {
			return Failed("parent-height-dependency", child.node.id);
		}
		if (!Number.isFinite(height) || height < 0)
			return Failed("unsupported-child-content", child.node.id);
		const extent = authoredRect.y + height;
		if (!Number.isFinite(extent))
			return Failed("invalid-child-geometry", child.node.id);
		boxes.push({ x: authoredRect.x, y: authoredRect.y,
			width: authoredRect.width, height });
	}
	// This prototype anchors parent height at y=0. A negative left edge
	// does not enlarge vertical content, and a zero-height child is permitted
	// only here (Scroll viewport diagnostics still reject zero-area children).
	const bounds = MeasureContentBounds(boxes, { allowZeroHeight: true });
	if (!bounds)
		return Failed("invalid-child-geometry", parent.node.id);
	const bottom = Math.max(0, bounds.bottom);
	if (bottom <= 0)
		return Failed("empty-content", parent.node.id);
	return {
		result: {
			height: bottom,
			contributingChildren: bounds.childCount,
			evidence: "bounded-child-extent-prototype"
		},
		failure: null,
		causeId: null
	};
}
