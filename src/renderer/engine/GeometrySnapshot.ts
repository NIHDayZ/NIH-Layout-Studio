import { ResolveChildClip, TranslateRect, type ArrangedWidget, type GeometryRect, type LayoutConstraints, type MeasuredWidget } from "./GeometryCore.js";
import { ResolveAuthoredRect, type GeometryWidget } from "./WidgetGeometry.js";
import { ChildConstraints, MeasureLayoutTree, type MeasuredLayoutNode, type MeasuredLayoutTree } from "./LayoutMeasurement.js";
import { PlanManagedChildren, type ArrangementOptions, type AppliedLayoutStrategy } from "./LayoutArrangers.js";
export type { ArrangementOptions, AppliedLayoutStrategy } from "./LayoutArrangers.js";

export type GeometryIssueCode = "unresolved-layout-strategy" | "unresolved-size-to-content" | "duplicate-widget-id";

export interface GeometryIssue {
	code: GeometryIssueCode;
	id: string;
	type: string;
	detail: string;
}

export interface AuthoredGeometrySnapshot {
	/**
	 * Pre-order geometry in document order. These are authored-coordinate
	 * rectangles, NOT the final Grid/Wrap/Scroll layout arrangement.
	 */
	entries: readonly ArrangedWidget[];
	byId: ReadonlyMap<string, ArrangedWidget>;
	/** Conservative authored-size hints; native content extents are unresolved. */
	measuredById: ReadonlyMap<string, MeasuredWidget>;
	issues: readonly GeometryIssue[];
	/** Only actually applied native-derived strategy prototypes, not unimplemented types. */
	appliedStrategies: readonly AppliedLayoutStrategy[];
	rootRect: GeometryRect;
}

/**
 * Phase 2: top-down arrangement of authored coordinates from prepared
 * measurements. Native container layout is deliberately NOT applied.
 *
 * The measurement tree already contains decoded geometry properties; no
 * per-widget property rescans or new intrinsic measurements occur here.
 */
export function ArrangeMeasuredGeometry(
	measured: MeasuredLayoutTree,
	rootRect: GeometryRect,
	dpiScale = 1,
	options: ArrangementOptions = {}
): AuthoredGeometrySnapshot {
	const entries: ArrangedWidget[] = [];
	const byId = new Map<string, ArrangedWidget>();
	const measuredById = new Map<string, MeasuredWidget>();
	const issues: GeometryIssue[] = [];
	const appliedStrategies: AppliedLayoutStrategy[] = [];

	function Visit(
		nodes: readonly MeasuredLayoutNode[],
		parentRect: GeometryRect,
		constraints: LayoutConstraints,
		parentId: string | null,
		inheritedClip: GeometryRect | null,
		parentVisible: boolean,
		allocatedRects: readonly GeometryRect[] | null
	): void {
		for (let index = 0; index < nodes.length; ++index) {
			const prepared = nodes[index];
			const { node, authored, strategy } = prepared;
			const localRect = allocatedRects?.[index] ?? ResolveAuthoredRect(authored, {
				width: constraints.availableWidth,
				height: constraints.availableHeight
			});
			const absoluteRect = TranslateRect(localRect, parentRect);
			const arranged: ArrangedWidget = {
				id: node.id,
				parentId,
				localRect,
				absoluteRect,
				clipRect: inheritedClip ? { ...inheritedClip } : null,
				visible: parentVisible && authored.visible,
				sortOrder: authored.sortOrder
			};

			entries.push(arranged);
			if (byId.has(node.id)) {
				issues.push({
					code: "duplicate-widget-id",
					id: node.id,
					type: node.type,
					detail: "Duplicate ID: byId retains the first widget; inspect entries to find each occurrence."
				});
			} else {
				byId.set(node.id, arranged);
				measuredById.set(node.id, prepared.measurement);
			}

			if (prepared.unresolvedContentWidth || prepared.unresolvedContentHeight) {
				const axes = [
					prepared.unresolvedContentWidth ? "horizontal" : "",
					prepared.unresolvedContentHeight ? "vertical" : ""
				].filter(Boolean).join(" and ");
				issues.push({
					code: "unresolved-size-to-content",
					id: node.id,
					type: node.type,
					detail: `Native ${axes} size-to-content has not been measured; this rectangle uses authored size only.`
				});
			}
			const layoutPlan = PlanManagedChildren(prepared, absoluteRect, options);
			const childSlots = layoutPlan?.rects ?? null;
			if (layoutPlan)
				appliedStrategies.push(layoutPlan.applied);
			if (prepared.children.length > 0 && strategy.requiresArrangement && !childSlots) {
				issues.push({
					code: "unresolved-layout-strategy",
					id: node.id,
					type: node.type,
					detail: `Unresolved ${strategy.kind} arrangement (${strategy.evidence} evidence); children use authored positions only.`
				});
			}

			const clip = ResolveChildClip(inheritedClip, absoluteRect, authored.clipChildren);
			const childConstraints = ChildConstraints({
				availableWidth: absoluteRect.width,
				availableHeight: absoluteRect.height
			}, constraints.dpiScale);
			Visit(prepared.children, absoluteRect, childConstraints, node.id, clip, arranged.visible, childSlots);
		}
	}

	const rootConstraints: LayoutConstraints = {
		availableWidth: rootRect.width,
		availableHeight: rootRect.height,
		dpiScale
	};
	Visit(measured.roots, rootRect, rootConstraints, null, { ...rootRect }, true, null);
	return { entries, byId, measuredById, issues, appliedStrategies, rootRect: { ...rootRect } };
}

/**
 * Diagnostic convenience entry point. Builds one bottom-up measurement tree,
 * then arranges the authored geometry top-down. For a future renderer,
 * reuse a prepared measurement tree instead of reparsing it for every view.
 */
export function BuildAuthoredGeometrySnapshot(
	roots: readonly GeometryWidget[],
	rootRect: GeometryRect
): AuthoredGeometrySnapshot {
	return ArrangeMeasuredGeometry(MeasureLayoutTree(roots), rootRect);
}
