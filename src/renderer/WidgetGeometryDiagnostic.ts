import type { LayoutNode } from "../model/LayoutTypes";
import { GetNodeProperty, GetFlag, ResolveRect, type Rect } from "../renderer/LayoutMath";

export interface GeometryDiagnostic {
 id: string;
 name: string;
 type: string;
 depth: number;
 parentName: string | null;
 parentBounds: Rect;
 localBounds: Rect;
 absoluteBounds: Rect;
 renderedLocalBounds: Rect;
 renderedAbsoluteBounds: Rect;
 position: string | null;
 size: string | null;
 halign: string;
 valign: string;
 hexactpos: boolean;
 vexactpos: boolean;
 hexactsize: boolean;
 vexactsize: boolean;
 notes: string[];
}

/** Report the selected widget and ancestor chain without changing rendering. */
export function TraceWidgetGeometry(nodes: LayoutNode[], id: string, width: number, height: number): GeometryDiagnostic[] {
 const result: GeometryDiagnostic[] = [];
 function walk(items: LayoutNode[], parent: Rect, renderedParent: Rect, absoluteX: number, absoluteY: number, renderedX: number, renderedY: number, parentName: string | null, depth: number, chain: GeometryDiagnostic[], forced: Rect | null = null): boolean {
  for (const node of items) {
   const localBounds = ResolveRect(node, parent);
   const absoluteBounds = { ...localBounds, x: absoluteX + localBounds.x, y: absoluteY + localBounds.y };
   const renderedLocalBounds = forced ?? ResolveRect(node, renderedParent);
   const renderedAbsoluteBounds = { ...renderedLocalBounds, x: renderedX + renderedLocalBounds.x, y: renderedY + renderedLocalBounds.y };
   const entry: GeometryDiagnostic = {
    id: node.id, name: node.name, type: node.type, depth, parentName,
    parentBounds: { ...parent }, localBounds, absoluteBounds, renderedLocalBounds, renderedAbsoluteBounds,
    position: GetNodeProperty(node, "position") ?? null,
    size: GetNodeProperty(node, "size") ?? null,
    halign: GetNodeProperty(node, "halign") ?? "left_ref",
    valign: GetNodeProperty(node, "valign") ?? "top_ref",
    hexactpos: GetFlag(node, "hexactpos"), vexactpos: GetFlag(node, "vexactpos"),
    hexactsize: GetFlag(node, "hexactsize"), vexactsize: GetFlag(node, "vexactsize"),
    notes: []
   };
   const next = [...chain, entry];
   if (node.id === id) {
    result.push(...next);
    for (const item of result) {
     if (item.type.toLowerCase().includes("spacerwidget"))
      item.notes.push("Spacer children may be positioned by native layout; this trace shows ResolveRect, not spacer overrides");
    }
    return true;
   }
   const childParent: Rect = { x: 0, y: 0, width: Math.max(0, localBounds.width), height: Math.max(0, localBounds.height) };
   const renderedChildParent: Rect = { x: 0, y: 0, width: Math.max(0, renderedLocalBounds.width), height: Math.max(0, renderedLocalBounds.height) };
   const spacer = node.type.toLowerCase().includes("spacerwidget");
   const orientation = (GetNodeProperty(node, "orientation") ?? "").toLowerCase();
   const row = orientation.includes("horizontal") || orientation === "h" || orientation === "0";
   const rawGap = Number(GetNodeProperty(node, "Spacing") ?? GetNodeProperty(node, "spacing") ?? GetNodeProperty(node, "Gap") ?? 0);
   const gap = Number.isFinite(rawGap) ? Math.max(0, rawGap) : 0;
   let cursor = 0;
   for (const child of node.children) {
    const natural = ResolveRect(child, renderedChildParent);
    let override: Rect | null = null;
    if (spacer) {
     if (row) {
      const childWidth = natural.width > 0 ? natural.width : renderedChildParent.width;
      override = { x: cursor, y: natural.y, width: childWidth, height: natural.height };
      cursor += childWidth + gap;
     } else {
      const childHeight = natural.height > 0 ? natural.height : renderedChildParent.height;
      override = { x: natural.x, y: cursor, width: natural.width, height: childHeight };
      cursor += childHeight + gap;
     }
    }
    if (walk([child], childParent, renderedChildParent, absoluteBounds.x, absoluteBounds.y, renderedAbsoluteBounds.x, renderedAbsoluteBounds.y, node.name, depth + 1, next, override)) return true;
   }
  }
  return false;
 }
 walk(nodes, { x: 0, y: 0, width, height }, { x: 0, y: 0, width, height }, 0, 0, 0, 0, null, 0, []);
 return result;
}
