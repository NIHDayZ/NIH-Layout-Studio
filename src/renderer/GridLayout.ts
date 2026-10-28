interface GridRect {
 x: number;
 y: number;
 width: number;
 height: number;
}

export interface GridPlan {
 rects: GridRect[];
 contentWidth: number;
 contentHeight: number;
 columns: number;
 rows: number;
}

/** Provisional editor grid model. Rows is a configured hint, not a hard child cap. */
export function PlanGrid(children: GridRect[], columnsSetting: number, rowsSetting: number, gap: number): GridPlan {
 const count = children.length;
 const safeColumns = Number.isFinite(columnsSetting) ? Math.floor(columnsSetting) : 0;
 const safeRows = Number.isFinite(rowsSetting) ? Math.floor(rowsSetting) : 0;
 const columns = Math.max(1, safeColumns > 0 ? safeColumns : safeRows > 0 ? Math.ceil(count / safeRows) : 1);
 const rows = Math.ceil(count / columns);
 const spacing = Number.isFinite(gap) ? Math.max(0, gap) : 0;
 const columnWidths = Array(columns).fill(0) as number[];
 const rowHeights = Array(rows).fill(0) as number[];
 for (let i = 0; i < count; ++i) {
  const col = i % columns, row = Math.floor(i / columns);
  columnWidths[col] = Math.max(columnWidths[col], Math.max(0, children[i].width));
  rowHeights[row] = Math.max(rowHeights[row], Math.max(0, children[i].height));
 }
 const xOffsets = columnWidths.map((_, i) => columnWidths.slice(0, i).reduce((s, w) => s + w + spacing, 0));
 const yOffsets = rowHeights.map((_, i) => rowHeights.slice(0, i).reduce((s, h) => s + h + spacing, 0));
 const rects = children.map((child, i) => ({
  x: xOffsets[i % columns], y: yOffsets[Math.floor(i / columns)],
  width: child.width, height: child.height
 }));
 return {
  rects, columns, rows,
  contentWidth: columnWidths.reduce((s, w) => s + w, 0) + Math.max(0, columns - 1) * spacing,
  contentHeight: rowHeights.reduce((s, h) => s + h, 0) + Math.max(0, rows - 1) * spacing
 };
}
