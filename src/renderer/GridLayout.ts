export interface GridRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface GridSize {
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

/**
 * Provisional DayZ grid model: explicit row/column counts take precedence.
 * The 3-column implicit arrangement is based on the shipped SpacerTest2
 * Workbench reference (nine children without authored Columns/Rows).
 *
 * measurementChildren represent intrinsic/exact sizes. A zero measurement
 * for a positive rendered size denotes a parent-relative child. With an
 * availableSize, those children consume remaining grid-cell space rather
 * than a fraction of the entire grid. Measurement stays independent from
 * the parent's own relative dimensions.
 */
export function PlanGrid(
	children: GridRect[],
	columnsSetting: number,
	rowsSetting: number,
	gap: number,
	measurementChildren: GridRect[] = children,
	availableSize?: GridSize
): GridPlan {
	if (measurementChildren.length !== children.length)
		throw new Error("Grid measurements must match the children being laid out.");

	const count = children.length;
	const safeColumns = Number.isFinite(columnsSetting) ? Math.max(0, Math.floor(columnsSetting)) : 0;
	const safeRows = Number.isFinite(rowsSetting) ? Math.max(0, Math.floor(rowsSetting)) : 0;
	let columns = 1;
	if (count > 0) {
		if (safeColumns > 0)
			columns = safeColumns;
		else if (safeRows > 0)
			columns = Math.max(1, Math.ceil(count / safeRows));
		else
			columns = 3;
	}
	const rows = Math.ceil(count / columns);
	const spacing = Number.isFinite(gap) ? Math.max(0, gap) : 0;

	const columnWidths = Array<number>(columns).fill(0);
	const rowHeights = Array<number>(rows).fill(0);
	const flexibleColumns = Array<boolean>(columns).fill(false);
	const flexibleRows = Array<boolean>(rows).fill(false);
	for (let i = 0; i < count; ++i) {
		const col = i % columns;
		const row = Math.floor(i / columns);
		const intrinsic = measurementChildren[i];
		const rendered = children[i];
		columnWidths[col] = Math.max(columnWidths[col], Math.max(0, intrinsic.width));
		rowHeights[row] = Math.max(rowHeights[row], Math.max(0, intrinsic.height));
		if (intrinsic.width === 0 && rendered.width > 0)
			flexibleColumns[col] = true;
		if (intrinsic.height === 0 && rendered.height > 0)
			flexibleRows[row] = true;
	}

	function DistributeRemainder(sizes: number[], flexible: boolean[], available: number) {
		if (!Number.isFinite(available) || available < 0)
			return;
		const flexCount = flexible.filter(Boolean).length;
		if (flexCount === 0)
			return;
		const fixedTotal = sizes.reduce((sum, value) => sum + value, 0);
		const freeSpace = Math.max(0, available - fixedTotal - Math.max(0, sizes.length - 1) * spacing);
		for (let i = 0; i < sizes.length; ++i) {
			if (flexible[i])
				sizes[i] += freeSpace / flexCount;
		}
	}

	if (availableSize) {
		DistributeRemainder(columnWidths, flexibleColumns, availableSize.width);
		DistributeRemainder(rowHeights, flexibleRows, availableSize.height);
	}

	function Offsets(sizes: number[]): number[] {
		const offsets: number[] = [];
		let offset = 0;
		for (const size of sizes) {
			offsets.push(offset);
			offset += size + spacing;
		}
		return offsets;
	}
	const xOffsets = Offsets(columnWidths);
	const yOffsets = Offsets(rowHeights);
	const rects = children.map((child, i) => {
		const col = i % columns;
		const row = Math.floor(i / columns);
		let width = child.width;
		let height = child.height;
		if (availableSize && measurementChildren[i].width === 0 && availableSize.width > 0)
			width = columnWidths[col] * child.width / availableSize.width;
		if (availableSize && measurementChildren[i].height === 0 && availableSize.height > 0)
			height = rowHeights[row] * child.height / availableSize.height;
		return { x: xOffsets[col], y: yOffsets[row], width, height };
	});
	return {
		rects,
		columns,
		rows,
		contentWidth: columnWidths.reduce((sum, size) => sum + size, 0) + Math.max(0, columns - 1) * spacing,
		contentHeight: rowHeights.reduce((sum, size) => sum + size, 0) + Math.max(0, rows - 1) * spacing
	};
}


/** Native grid defaults and constrained arithmetic live in one shared engine module. */
export { ResolveNativeGridCounts, PlanConstrainedGrid } from "./engine/ConstrainedGrid.js";
