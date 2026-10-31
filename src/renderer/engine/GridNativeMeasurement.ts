import type { MeasuredLayoutNode } from "./LayoutMeasurement.js";
import { SelectManagedChildIndices } from "./ManagedVisibility.js";
export interface GridNativeMeasurementPrototype {
	id: string;
	width: number;
	height: number;
	evidence: "dayz-client-grid-variations-2026-10-30";
	caseKind: "fixed-child-content";
	/** Maxima for configured columns, including unoccupied zero-width columns. */
	columnWidths: readonly number[];
	/** Maxima only for occupied rows; unused configured rows do not grow content. */
	rowHeights: readonly number[];
	participatingIndices: readonly number[];
}
export function ProbeGridNativeMeasurement(parent: MeasuredLayoutNode): GridNativeMeasurementPrototype | null {
	const grid = parent.nativeGrid;
	if (!grid || parent.strategy.kind !== "grid" || (!parent.unresolvedContentWidth && !parent.unresolvedContentHeight))
		return null;
	const indices = SelectManagedChildIndices(parent.children, parent.nativeIgnoreInvisible);
	if (!indices || !indices.length || indices.length > grid.columns * grid.rows)
		return null;
	const widths = Array<number>(grid.columns).fill(0);
	const heights = Array<number>(grid.rows).fill(0);
	for (let i = 0; i < indices.length; ++i) {
		const child = parent.children[indices[i]];
		const a = child.authored;
		if (child.strategy.requiresArrangement || !a.exactSizeX || !a.exactSizeY
			|| a.sizeToContentWidth || a.sizeToContentHeight || !Number.isFinite(a.sizeX)
			|| !Number.isFinite(a.sizeY) || a.sizeX < 0 || a.sizeY < 0)
			return null;
		const column = i % grid.columns;
		const row = Math.floor(i / grid.columns);
		widths[column] = Math.max(widths[column], a.sizeX);
		heights[row] = Math.max(heights[row], a.sizeY);
	}
	const occupiedRows = Math.ceil(indices.length / grid.columns);
	const contentWidth = widths.reduce((sum, n) => sum + n, 0) + (grid.columns - 1) * grid.padding + 2 * grid.margin;
	const contentHeight = heights.slice(0, occupiedRows).reduce((sum, n) => sum + n, 0)
		+ (occupiedRows - 1) * grid.padding + 2 * grid.margin;
	const width = parent.unresolvedContentWidth ? contentWidth : parent.authored.sizeX;
	const height = parent.unresolvedContentHeight ? contentHeight : parent.authored.sizeY;
	if (!Number.isFinite(width) || !Number.isFinite(height))
		return null;
	return { id: parent.node.id, width, height,
		columnWidths: widths, rowHeights: heights.slice(0, occupiedRows),
		participatingIndices: indices, caseKind: "fixed-child-content",
		evidence: "dayz-client-grid-variations-2026-10-30" };
}
