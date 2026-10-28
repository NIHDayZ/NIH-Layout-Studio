import type { GeometryRect } from "./GeometryCore.js";

/**
 * Shared native Spacer/Scroll child eligibility.
 *
 * The pinned Workbench Spacer property loader reads a boolean from its
 * "Ignore invisible" reflected property into widget byte +0x159 and
 * defaults it to 1. The Grid, Wrap, and Scroll native child traversals
 * all branch on the same byte before invoking child eligibility checks.
 *
 * A disabled flag includes hidden children in measurement/slot allocation;
 * the existing visibility hierarchy still controls whether they draw.
 */
export function DecodeNativeIgnoreInvisible(
	properties: readonly { name: string; value: string }[]
): boolean | null {
	for (const property of properties) {
		if (property.name.trim().toLowerCase() !== "ignore invisible")
			continue;
		const raw = property.value.trim();
		if (raw === "1")
			return true;
		if (raw === "0")
			return false;
		return null;
	}
	return true;
}

export interface VisibilityCandidate {
	readonly authored: { readonly visible: boolean };
}

/**
 * Returns original document indices. Plans may allocate only eligible
 * children, but snapshots keep every original widget in document order.
 * Unknown native flags are not silently interpreted.
 */
export function SelectManagedChildIndices(
	children: readonly VisibilityCandidate[],
	ignoreInvisible: boolean | null
): readonly number[] | null {
	if (ignoreInvisible === null)
		return null;
	const indices: number[] = [];
	for (let index = 0; index < children.length; ++index) {
		if (!ignoreInvisible || children[index].authored.visible)
			indices.push(index);
	}
	return indices;
}

/**
 * Reinsert allocated geometry into the original child-index slots.
 * Ineligible children retain their authored fallback rectangle. This keeps
 * parent and child traversal independent of strategy-specific filtering.
 */
export function ScatterManagedRects(
	indices: readonly number[],
	eligibleRects: readonly GeometryRect[],
	totalChildren: number
): readonly GeometryRect[] | null {
	if (indices.length !== eligibleRects.length || indices.length > totalChildren)
		return null;
	const result: GeometryRect[] = new Array(totalChildren);
	const seen = new Set<number>();
	for (let i = 0; i < indices.length; ++i) {
		const original = indices[i];
		if (!Number.isInteger(original) || original < 0 || original >= totalChildren || seen.has(original))
			return null;
		seen.add(original);
		result[original] = eligibleRects[i];
	}
	return result;
}
