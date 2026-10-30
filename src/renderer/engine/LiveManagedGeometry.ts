import type { LayoutNode } from "../../model/LayoutTypes";
import { GetFlag, GetNumber, GetNodeProperty, ResolveRect, type Rect } from "../LayoutMath";
import { PlanConstrainedGrid, PlanGrid, ResolveNativeGridCounts } from "../GridLayout";
import { DecodeNativeWrapSettings, PlanFixedWrapPreview } from "./FixedWrap";

/**
 * Transitional live-preview managed layout adapter.
 *
 * Owns the legacy and opt-in Grid/Wrap decisions previously duplicated inside
 * Canvas.tsx. This is NOT the completed single snapshot pipeline: the next
 * integration step must route sizing and all final rectangles through
 * MeasureLayoutTree + ArrangeMeasuredGeometry. Keeping the existing policies
 * here preserves the currently accepted editor rendering while doing so.
 */
export interface LiveManagedOptions {
	gridLayout: boolean;
	nativeConstrainedGrid: boolean;
	nativeWrapLayout: boolean;
}

function GetSpacerDirection(node: LayoutNode): "row" | "column" {
	const orientation = (GetNodeProperty(node, "orientation") ?? GetNodeProperty(node, "Orientation") ?? "").toLowerCase();
	if (orientation.includes("horizontal") || orientation === "h" || orientation === "0")
		return "row";
	return "column";
}

function GetSpacerGap(node: LayoutNode): number {
	const raw = Number(GetNodeProperty(node, "Spacing") ?? GetNodeProperty(node, "spacing") ?? GetNodeProperty(node, "Gap") ?? GetNodeProperty(node, "Margin") ?? GetNodeProperty(node, "margin") ?? 0);
	return Number.isFinite(raw) ? Math.max(0, raw) : 0;
}

function GetGridPlan(node: LayoutNode, childParent: Rect, nativeConstrainedGrid: boolean) {
	const children = node.children.map((child) => ResolveRect(child, childParent));
	// Parent-relative children are rendered at their resolved sizes, but must
	// not contribute that same parent-dependent size to intrinsic measurement.
	const measured = children.map((childRect, index) => ({
		...childRect,
		width: GetFlag(node.children[index], "hexactsize") ? childRect.width : 0,
		height: GetFlag(node.children[index], "vexactsize") ? childRect.height : 0
	}));
	const configuredColumns = GetNumber(node, "Columns", 0);
	const configuredRows = GetNumber(node, "Rows", 0);
	if (nativeConstrainedGrid && !GetFlag(node, "Size To Content H") && !GetFlag(node, "Size To Content V")) {
		// Verified GridSpacerWidget property-load routine at image VA
		// 0x1408DED50 defaults both Rows and Columns independently to 3.
		const { columns, rows } = ResolveNativeGridCounts(configuredColumns, configuredRows);
		return PlanConstrainedGrid(children.length, columns, rows,
			{ width: childParent.width, height: childParent.height }, GetNumber(node, "Margin", 0), GetNumber(node, "Padding", 0));
	}
	return PlanGrid(children, configuredColumns, configuredRows, GetSpacerGap(node), measured, { width: childParent.width, height: childParent.height });
}


export function PlanLiveManagedChildren(node: LayoutNode, childParent: Rect, options: LiveManagedOptions) {
	const isGridSpacer = node.type.toLowerCase().includes("gridspacerwidget");
	const isWrapSpacer = node.type.toLowerCase().includes("wrapspacerwidget");
	const direction = GetSpacerDirection(node);
	const gap = GetSpacerGap(node);
	const gridPlan = isGridSpacer && options.gridLayout
		? GetGridPlan(node, childParent, options.nativeConstrainedGrid) : null;
	const eligibleWrap = options.nativeWrapLayout && isWrapSpacer &&
		!GetFlag(node, "Size To Content H") && !GetFlag(node, "Size To Content V") &&
		GetFlag(node, "hexactsize") && GetFlag(node, "vexactsize") &&
		node.children.length > 0 && node.children.every((child) =>
			GetNodeProperty(child, "visible") !== "0" &&
			GetFlag(child, "hexactsize") && GetFlag(child, "vexactsize") &&
			!GetFlag(child, "Size To Content H") && !GetFlag(child, "Size To Content V"));
	const wrapNaturalRects = eligibleWrap ? node.children.map((child) => ResolveRect(child, childParent)) : null;
	const wrapPlan = wrapNaturalRects && wrapNaturalRects.every((r) =>
		Number.isFinite(r.width) && Number.isFinite(r.height) && r.width > 0 && r.height > 0)
		? PlanFixedWrapPreview(wrapNaturalRects, childParent, DecodeNativeWrapSettings(node.properties))
		: null;
	const rects: Rect[] = [];
	let cursor = 0;
	for (let index = 0; index < node.children.length; ++index) {
		const natural = wrapNaturalRects?.[index] ?? ResolveRect(node.children[index], childParent);
		let rect = natural;
		if (gridPlan)
			rect = gridPlan.rects[index];
		else if (wrapPlan)
			rect = wrapPlan.rects[index];
		else if (isGridSpacer) {
			if (direction === "column") {
				const height = natural.height > 0 ? natural.height : childParent.height;
				rect = { x: natural.x, y: cursor, width: natural.width, height };
				cursor += height + gap;
			} else {
				const width = natural.width > 0 ? natural.width : childParent.width;
				rect = { x: cursor, y: natural.y, width, height: natural.height };
				cursor += width + gap;
			}
		}
		rects.push(rect);
	}
	return { rects, gridPlan, wrapApplied: !!wrapPlan, direction, gap };
}

export function PlanLiveGridContent(node: LayoutNode, bounds: Rect, nativeConstrainedGrid: boolean) {
	return GetGridPlan(node, bounds, nativeConstrainedGrid);
}
