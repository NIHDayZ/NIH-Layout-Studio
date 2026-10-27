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
 function walk(items: LayoutNode[], parent: Rect, absoluteX: number, absoluteY: number, parentName: string | null, depth: number, chain: GeometryDiagnostic[]): boolean {
  for (const node of items) {
   const localBounds = ResolveRect(node, parent);
   const absoluteBounds = { ...localBounds, x: absoluteX + localBounds.x, y: absoluteY + localBounds.y };
   const entry: GeometryDiagnostic = {
    id: node.id, name: node.name, type: node.type, depth, parentName,
    parentBounds: { ...parent }, localBounds, absoluteBounds,
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
   if (walk(node.children, childParent, absoluteBounds.x, absoluteBounds.y, node.name, depth + 1, next)) return true;
  }
  return false;
 }
 walk(nodes, { x: 0, y: 0, width, height }, 0, 0, null, 0, []);
 return result;
}
