import type { MeasuredLayoutNode } from "./LayoutMeasurement.js";
import { ProbeGridContentCandidate } from "./LayoutArrangers.js";
import { SelectManagedChildIndices } from "./ManagedVisibility.js";

/**
 * Phase 2F: observation-bounded native Grid content measurement experiment.
 * Corrections below are supported ONLY by the 2026-10-30 DayZ 2x2/1x3
 * three-child matrix. Do not extrapolate them to arbitrary grid dimensions.
 */
export interface GridNativeMeasurementPrototype {
	id: string;
	width: number;
	height: number;
	evidence: "dayz-client-grid-matrix-2026-10-30";
	caseKind: "2x2-three-visible" | "2x2-hidden-second" | "1x3-three-visible";
}

export function ProbeGridNativeMeasurement(parent: MeasuredLayoutNode): GridNativeMeasurementPrototype | null {
	const candidate = ProbeGridContentCandidate(parent);
	const grid = parent.nativeGrid;
	if (!candidate || !grid || parent.children.length !== 3
		|| grid.padding !== 3 || grid.margin !== 4)
		return null;
	const selected = SelectManagedChildIndices(parent.children, parent.nativeIgnoreInvisible);
	if (!selected)
		return null;
	let caseKind: GridNativeMeasurementPrototype["caseKind"];
	let width: number;
	let height: number;
	if (grid.columns === 2 && grid.rows === 2 && selected.length === 3) {
		caseKind = "2x2-three-visible";
		width = candidate.width + 1;
		height = candidate.height + 1;
	} else if (grid.columns === 2 && grid.rows === 2
		&& selected.length === 2 && selected[0] === 0 && selected[1] === 2) {
		caseKind = "2x2-hidden-second";
		width = candidate.width + 1;
		height = candidate.height - 2;
	} else if (grid.columns === 1 && grid.rows === 3 && selected.length === 3) {
		caseKind = "1x3-three-visible";
		width = candidate.width + 2;
		height = candidate.height;
	} else {
		return null;
	}
	if (!parent.unresolvedContentWidth)
		width = parent.authored.sizeX;
	if (!parent.unresolvedContentHeight)
		height = parent.authored.sizeY;
	return { id: parent.node.id, width, height, caseKind,
		evidence: "dayz-client-grid-matrix-2026-10-30" };
}
