import type { GeometryRect } from "./GeometryCore.js";
import { DecodeNativeSpacerSpacing } from "./SpacerSettings.js";

export interface NativeWrapSettings {
	padding: number;
	margin: number;
	/** Compiled modes: 0=start, 1=end, 2=center. */
	horizontalAlign: 0 | 1 | 2 | null;
	/** Non-start vertical alignment is deliberately not implemented yet. */
	verticalAlign: 0 | 1 | 2 | null;
}

export interface FixedWrapPlan {
	rects: readonly GeometryRect[];
	lineCount: number;
	usedHeight: number;
}

/** Candidate vertical size for fixed-child Wrap under an already resolved width. */
export interface FixedWrapContentPlan extends FixedWrapPlan {
	requiredHeight: number;
}

/** Do not interpret a malformed or unknown native enum as its default. */
function ReadAlign(
	properties: readonly { name: string; value: string }[],
	key: string
): 0 | 1 | 2 | null {
	for (const property of properties) {
		if (property.name.toLowerCase() !== key)
			continue;
		const value = property.value.trim();
		if (value === "0")
			return 0;
		if (value === "1")
			return 1;
		if (value === "2")
			return 2;
		return null;
	}
	return 0;
}

export function DecodeNativeWrapSettings(
	properties: readonly { name: string; value: string }[]
): NativeWrapSettings {
	return {
		...DecodeNativeSpacerSpacing(properties),
		horizontalAlign: ReadAlign(properties, "content_halign"),
		verticalAlign: ReadAlign(properties, "content_valign")
	};
}

/**
 * Narrow, native-derived WrapSpacer fixed-child prototype.
 *
 * Based on WorkbenchApp.exe 0x1408E0E80 line packing and alignment trace:
 * measure a line's maximum height, wrap when adding a child overflows,
 * and advance line y by max height + margin. The container itself has a
 * fixed outer rectangle and padding inset. No size-to-content feedback,
 * hidden-child filtering, DPI, or non-start vertical align is inferred.
 *
 * Refuse overflow and unknown layout modes instead of inventing a result.
 */
export function MeasureFixedWrapContent(
	children: readonly Pick<GeometryRect, "width" | "height">[],
	resolvedWidth: number,
	settings: NativeWrapSettings
): FixedWrapContentPlan | null {
	const { padding, margin, horizontalAlign, verticalAlign } = settings;
	if (horizontalAlign === null || verticalAlign !== 0)
		return null;
	if (!Number.isFinite(resolvedWidth) || resolvedWidth <= 0
		|| !Number.isFinite(padding) || padding < 0 || !Number.isFinite(margin) || margin < 0
		|| children.length === 0)
		return null;
	const availableWidth = resolvedWidth - 2 * padding;
	if (availableWidth <= 0)
		return null;

	interface Line { indices: number[]; width: number; height: number }
	const lines: Line[] = [];
	let current: Line = { indices: [], width: 0, height: 0 };
	for (let index = 0; index < children.length; ++index) {
		const child = children[index];
		if (!Number.isFinite(child.width) || child.width <= 0
			|| !Number.isFinite(child.height) || child.height <= 0
			|| child.width > availableWidth)
			return null;
		const nextWidth = current.width + (current.indices.length > 0 ? margin : 0) + child.width;
		if (current.indices.length > 0 && nextWidth > availableWidth) {
			lines.push(current);
			current = { indices: [], width: 0, height: 0 };
		}
		current.width += (current.indices.length > 0 ? margin : 0) + child.width;
		current.height = Math.max(current.height, child.height);
		current.indices.push(index);
	}
	if (current.indices.length > 0)
		lines.push(current);

	const usedHeight = lines.reduce((sum, line) => sum + line.height, 0)
		+ margin * Math.max(0, lines.length - 1);
	const requiredHeight = usedHeight + 2 * padding;
	if (!Number.isFinite(requiredHeight) || requiredHeight <= 0)
		return null;

	const result: GeometryRect[] = new Array(children.length);
	let y = padding;
	for (const line of lines) {
		const remainder = availableWidth - line.width;
		const offset = horizontalAlign === 1 ? remainder : horizontalAlign === 2 ? remainder / 2 : 0;
		let x = padding + offset;
		for (const index of line.indices) {
			const child = children[index];
			result[index] = { x, y, width: child.width, height: child.height };
			x += child.width + margin;
		}
		y += line.height + margin;
	}
	return { rects: result, lineCount: lines.length, usedHeight, requiredHeight };
}

/**
 * Fixed-height Wrap uses exactly the same measured line packing, but may
 * only apply it when the measured content fits inside the authored height.
 */
export function PlanFixedWrap(
	children: readonly Pick<GeometryRect, "width" | "height">[],
	container: Pick<GeometryRect, "width" | "height">,
	settings: NativeWrapSettings
): FixedWrapPlan | null {
	const measured = MeasureFixedWrapContent(children, container.width, settings);
	if (!measured || !Number.isFinite(container.height) || container.height <= 0
		|| measured.requiredHeight > container.height)
		return null;
	return { rects: measured.rects, lineCount: measured.lineCount, usedHeight: measured.usedHeight };
}
