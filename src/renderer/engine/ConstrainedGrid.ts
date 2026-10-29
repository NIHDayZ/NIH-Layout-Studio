import type { GeometryRect } from "./GeometryCore.js";
import { DecodeNativeSpacerSpacing, ReadFirstIntegerProperty } from "./SpacerSettings.js";

export interface GridSize {
	width: number;
	height: number;
}
export interface ConstrainedGridPlan {
	rects: GeometryRect[];
	contentWidth: number;
	contentHeight: number;
	columns: number;
	rows: number;
}

/**
 * Shared native-derived GridSpacer formula.
 * Original standalone GridLayout.ts exports these functions by re-export.
 * This does not implement native content sizing or child filtering.
 */
/** Defaults recovered at WorkbenchApp.exe image VA 0x1408DED50. */
export function ResolveNativeGridCounts(columnsSetting: number, rowsSetting: number): { columns: number; rows: number } {
	return {
		columns: Number.isFinite(columnsSetting) && columnsSetting > 0 ? Math.max(1, Math.floor(columnsSetting)) : 3,
		rows: Number.isFinite(rowsSetting) && rowsSetting > 0 ? Math.max(1, Math.floor(rowsSetting)) : 3
	};
}

/**
 * Equal-cell arrangement reconstructed from the GridSpacerWidget native
 * arrangement loop (WorkbenchApp.exe RVA 0x8E0960).
 *
 * Intended for constrained grids without Size To Content on either axis.
 * The observed native routine divides available width by its horizontal
 * count and height by its vertical count after edge insets and cell gaps.
 *
 * Native property loading defaults both count fields to three; see
 * ResolveNativeGridCounts and DecodeNativeGridSettings below. Callers still
 * supply resolved positive counts to keep this arithmetic side-effect free.
 */
export function PlanConstrainedGrid(
	childCount: number,
	columns: number,
	rows: number,
	availableSize: GridSize,
	gap: number,
	inset = 0
): ConstrainedGridPlan {
	const count = Number.isFinite(childCount) ? Math.max(0, Math.floor(childCount)) : 0;
	const resolvedColumns = Number.isFinite(columns) ? Math.max(1, Math.floor(columns)) : 1;
	const resolvedRows = Number.isFinite(rows) ? Math.max(1, Math.floor(rows)) : 1;
	const spacing = Number.isFinite(gap) ? Math.max(0, gap) : 0;
	const edgeInset = Number.isFinite(inset) ? Math.max(0, inset) : 0;
	const width = Number.isFinite(availableSize.width) ? Math.max(0, availableSize.width) : 0;
	const height = Number.isFinite(availableSize.height) ? Math.max(0, availableSize.height) : 0;
	const cellWidth = Math.max(0, (width - 2 * edgeInset - (resolvedColumns - 1) * spacing) / resolvedColumns);
	const cellHeight = Math.max(0, (height - 2 * edgeInset - (resolvedRows - 1) * spacing) / resolvedRows);
	const rects: GeometryRect[] = [];
	for (let i = 0; i < count; ++i) {
		const column = i % resolvedColumns;
		const row = Math.floor(i / resolvedColumns);
		rects.push({
			x: edgeInset + column * (cellWidth + spacing),
			y: edgeInset + row * (cellHeight + spacing),
			width: cellWidth,
			height: cellHeight
		});
	}
	return {
		rects, columns: resolvedColumns, rows: resolvedRows,
		contentWidth: width, contentHeight: height
	};
}

export interface NativeGridSettings {
	columns: number;
	rows: number;
	padding: number;
	margin: number;
}

/**
 * Parse only the native GridSpacer options, independently of the common
 * widget geometry decoder. Call once in the measurement/preparation pass.
 * Compiled Workbench defaults: rows=columns=3, Padding=Margin=2.
 */
export function DecodeNativeGridSettings(properties: readonly { name: string; value: string }[]): NativeGridSettings {
	const { columns, rows } = ResolveNativeGridCounts(
		ReadFirstIntegerProperty(properties, "columns", 3),
		ReadFirstIntegerProperty(properties, "rows", 3)
	);
	return { columns, rows, ...DecodeNativeSpacerSpacing(properties) };
}
