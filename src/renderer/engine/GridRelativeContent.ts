import type { GeometryRect } from "./GeometryCore.js";

/**
 * Phase 2L: native-observed GridSpacer relative-child content sizing.
 * Pure, ID-independent, one bottom-up measurement and one arrangement pass.
 * This module is not wired into the production snapshot or Canvas.
 *
 * Callers must select eligible children in compact native order and resolve
 * nested content-sized child dimensions before invoking this planner.
 */
export interface NativeRelativeGridChild {
	readonly width: number;
	readonly height: number;
	readonly exactWidth: boolean;
	readonly exactHeight: boolean;
}

export interface NativeRelativeGridInput {
	readonly columns: number;
	readonly rows: number;
	readonly padding: number;
	readonly margin: number;
	readonly authoredWidth: number;
	readonly authoredHeight: number;
	readonly contentWidth: boolean;
	readonly contentHeight: boolean;
	readonly children: readonly NativeRelativeGridChild[];
}

export interface NativeRelativeGridPlan {
	readonly width: number;
	readonly height: number;
	readonly columnWidths: readonly number[];
	readonly rowHeights: readonly number[];
	readonly fixedWidthBaseline: number;
	readonly fixedHeightBaseline: number;
	readonly rects: readonly GeometryRect[];
}

/**
 * Measured from the independent DayZ client Phase 2K+2L matrices:
 * 1) Build fixed-size maxima by column/occupied row.
 * 2) Compute available relative space against AUTHORED parent dimensions,
 *    subtracting fixed maxima, margins and inter-cell spacing.
 * 3) Grow each column/row to the maximum applicable relative request.
 * 4) Size relative children to the full resulting column/row; exact children
 *    retain exact dimensions on content-sized axes.
 * 5) Use equal cells on axes without Size To Content.
 *
 * Overflow creates occupied rows beyond the configured count on content
 * axes. Overflow with fixed-height layout is not yet native-verified.
 */
export function PlanNativeRelativeGrid(input: NativeRelativeGridInput): NativeRelativeGridPlan | null {
	const { columns, rows, padding, margin, authoredWidth, authoredHeight, children } = input;
	if (!Number.isInteger(columns) || columns <= 0
		|| !Number.isInteger(rows) || rows <= 0
		|| ![padding, margin, authoredWidth, authoredHeight].every(Number.isFinite)
		|| padding < 0 || margin < 0 || authoredWidth < 0 || authoredHeight < 0
		|| children.length === 0)
		return null;
	const occupiedRows = Math.ceil(children.length / columns);
	if (!input.contentHeight && occupiedRows > rows)
		return null;

	const fixedColumnWidths = Array<number>(columns).fill(0);
	const fixedRowHeights = Array<number>(occupiedRows).fill(0);
	for (let i = 0; i < children.length; ++i) {
		const child = children[i];
		if (![child.width, child.height].every(Number.isFinite)
			|| child.width < 0 || child.height < 0
			|| typeof child.exactWidth !== "boolean" || typeof child.exactHeight !== "boolean")
			return null;
		const column = i % columns;
		const row = Math.floor(i / columns);
		if (child.exactWidth)
			fixedColumnWidths[column] = Math.max(fixedColumnWidths[column], child.width);
		if (child.exactHeight)
			fixedRowHeights[row] = Math.max(fixedRowHeights[row], child.height);
	}

	const fixedWidthBaseline = fixedColumnWidths.reduce((sum, value) => sum + value, 0)
		+ (columns - 1) * padding + 2 * margin;
	const fixedHeightBaseline = fixedRowHeights.reduce((sum, value) => sum + value, 0)
		+ (occupiedRows - 1) * padding + 2 * margin;
	const availableWidth = Math.max(0, authoredWidth - fixedWidthBaseline);
	const availableHeight = Math.max(0, authoredHeight - fixedHeightBaseline);
	const columnWidths = fixedColumnWidths.slice();
	const rowHeights = fixedRowHeights.slice();

	for (let i = 0; i < children.length; ++i) {
		const child = children[i];
		const column = i % columns;
		const row = Math.floor(i / columns);
		if (!child.exactWidth)
			columnWidths[column] = Math.max(columnWidths[column], child.width * availableWidth);
		if (!child.exactHeight)
			rowHeights[row] = Math.max(rowHeights[row], child.height * availableHeight);
	}
	if (!input.contentWidth) {
		const equalWidth = (authoredWidth - 2 * margin - (columns - 1) * padding) / columns;
		if (!Number.isFinite(equalWidth) || equalWidth < 0)
			return null;
		columnWidths.fill(equalWidth);
	}
	if (!input.contentHeight) {
		const equalHeight = (authoredHeight - 2 * margin - (rows - 1) * padding) / rows;
		if (!Number.isFinite(equalHeight) || equalHeight < 0)
			return null;
		rowHeights.fill(equalHeight);
	}

	const width = input.contentWidth
		? columnWidths.reduce((sum, value) => sum + value, 0) + (columns - 1) * padding + 2 * margin
		: authoredWidth;
	const height = input.contentHeight
		? rowHeights.reduce((sum, value) => sum + value, 0) + (occupiedRows - 1) * padding + 2 * margin
		: authoredHeight;
	if (!Number.isFinite(width) || !Number.isFinite(height) || width < 0 || height < 0)
		return null;

	const xPositions = Array<number>(columns).fill(margin);
	const yPositions = Array<number>(occupiedRows).fill(margin);
	for (let i = 1; i < columns; ++i)
		xPositions[i] = xPositions[i - 1] + columnWidths[i - 1] + padding;
	for (let i = 1; i < occupiedRows; ++i)
		yPositions[i] = yPositions[i - 1] + rowHeights[i - 1] + padding;

	const rects: GeometryRect[] = [];
	for (let i = 0; i < children.length; ++i) {
		const child = children[i];
		const col = i % columns;
		const row = Math.floor(i / columns);
		rects.push({
			x: xPositions[col],
			y: yPositions[row],
			width: input.contentWidth && child.exactWidth ? child.width : columnWidths[col],
			height: input.contentHeight && child.exactHeight ? child.height : rowHeights[row]
		});
	}
	return { width, height, columnWidths, rowHeights, fixedWidthBaseline, fixedHeightBaseline, rects };
}
