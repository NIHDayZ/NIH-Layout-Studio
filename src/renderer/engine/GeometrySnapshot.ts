import { ResolveChildClip, TranslateRect, type ArrangedWidget, type GeometryRect } from "./GeometryCore.js";
import { DecodeAuthoredGeometry, ResolveAuthoredRect, type GeometryWidget } from "./WidgetGeometry.js";

export type GeometryIssueCode = "unresolved-layout-strategy" | "duplicate-widget-id";

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
	issues: readonly GeometryIssue[];
	rootRect: GeometryRect;
}

function UsesManagedChildLayout(type: string): boolean {
	const normalized = type.toLowerCase();
	return normalized.includes("gridspacerwidget")
		|| normalized.includes("wrapspacerwidget")
		|| normalized.includes("scrollwidget")
		|| normalized.includes("spacerwidget")
		|| normalized.includes("contentwidget")
		|| normalized.includes("embededwidget");
}

/**
 * Read-only hierarchy diagnostic for ordinary authored widget geometry.
 * Pure and deterministic: no DOM, React, font loading, or asset resolution.
 *
 * This snapshot deliberately DOES NOT position children using native
 * GridSpacer, WrapSpacer, ScrollWidget or other layout manager semantics.
 * Callers must inspect issues before treating rectangles as render-ready.
 */
export function BuildAuthoredGeometrySnapshot(
	roots: readonly GeometryWidget[],
	rootRect: GeometryRect
): AuthoredGeometrySnapshot {
	const entries: ArrangedWidget[] = [];
	const byId = new Map<string, ArrangedWidget>();
	const issues: GeometryIssue[] = [];

	function Visit(
		nodes: readonly GeometryWidget[],
		parentRect: GeometryRect,
		parentId: string | null,
		inheritedClip: GeometryRect | null,
		parentVisible: boolean
	): void {
		for (const node of nodes) {
			if (!node.type.toLowerCase().includes("widgetclass"))
				continue;

			const authored = DecodeAuthoredGeometry(node);
			const localRect = ResolveAuthoredRect(authored, parentRect);
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
			}

			if (node.children.length > 0 && UsesManagedChildLayout(node.type)) {
				issues.push({
					code: "unresolved-layout-strategy",
					id: node.id,
					type: node.type,
					detail: "Children are shown at authored positions; native container measurement/arrangement is not applied."
				});
			}

			const clip = ResolveChildClip(inheritedClip, absoluteRect, authored.clipChildren);
			Visit(node.children, absoluteRect, node.id, clip, arranged.visible);
		}
	}

	// The editor root is a clipping viewport; nested widgets use absolute
	// coordinates in that root's coordinate system.
	Visit(roots, rootRect, null, { ...rootRect }, true);
	return {
		entries,
		byId,
		issues,
		rootRect: { ...rootRect }
	};
}
