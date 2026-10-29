import type { GeometryRect, MeasuredWidget } from "./GeometryCore.js";
import { DecodeNativeAspectMode, ResolveNativeAspectSize, type NativeAspectMode } from "./NativeAspectSizing.js";

/** Minimal structural widget shape accepted by layout parsing and test fixtures. */
export interface GeometryProperty {
	name: string;
	value: string;
}

export interface GeometryWidget {
	id: string;
	name: string;
	type: string;
	properties: readonly GeometryProperty[];
	children: readonly GeometryWidget[];
}

/**
 * Decoded, authored geometry properties. Keep these independent of a parent
 * rectangle so relative values are never mistaken for intrinsic dimensions.
 * Rules currently mirror LayoutMath; they are NOT yet native-verified.
 */
export interface AuthoredGeometry {
	positionX: number;
	positionY: number;
	sizeX: number;
	sizeY: number;
	exactPositionX: boolean;
	exactPositionY: boolean;
	exactSizeX: boolean;
	exactSizeY: boolean;
	hAlign: string;
	vAlign: string;
	visible: boolean;
	clipChildren: boolean;
	/** Native content sizing still requires specialized measurement. */
	sizeToContentWidth: boolean;
	sizeToContentHeight: boolean;
	/** Native fixaspect property: verified Workbench flags bits 13:12. */
	fixAspectMode: NativeAspectMode;
	sortOrder: number;
}

function ReadProperties(properties: readonly GeometryProperty[]): Map<string, string> {
	const values = new Map<string, string>();
	for (const property of properties) {
		const name = property.name.toLowerCase();
		// LayoutMath.GetNodeProperty uses find(): first occurrence wins.
		if (!values.has(name))
			values.set(name, property.value);
	}
	return values;
}

function NumberPair(raw: string | undefined, first: number, second: number): [number, number] {
	if (!raw)
		return [first, second];
	const values = raw.split(/\s+/).map(Number).filter(Number.isFinite);
	return [values[0] ?? first, values[1] ?? second];
}

function NumberOr(raw: string | undefined, fallback: number): number {
	if (raw === undefined)
		return fallback;
	const value = Number(raw);
	return Number.isFinite(value) ? value : fallback;
}

export function DecodeAuthoredGeometry(node: Pick<GeometryWidget, "properties">): AuthoredGeometry {
	const properties = ReadProperties(node.properties);
	const [positionX, positionY] = NumberPair(properties.get("position"), 0, 0);
	const [sizeX, sizeY] = NumberPair(properties.get("size"), 1, 1);
	return {
		positionX,
		positionY,
		sizeX,
		sizeY,
		exactPositionX: properties.get("hexactpos") === "1",
		exactPositionY: properties.get("vexactpos") === "1",
		exactSizeX: properties.get("hexactsize") === "1",
		exactSizeY: properties.get("vexactsize") === "1",
		hAlign: properties.get("halign") ?? "left_ref",
		vAlign: properties.get("valign") ?? "top_ref",
		visible: properties.get("visible") !== "0",
		clipChildren: properties.get("clipchildren") === "1",
		sizeToContentWidth: properties.get("size to content h") === "1",
		sizeToContentHeight: properties.get("size to content v") === "1",
		fixAspectMode: DecodeNativeAspectMode(properties.get("fixaspect")),
		sortOrder: NumberOr(properties.get("priority"), 0)
	};
}

/**
 * The *_ref alignment names refer to a parent reference edge or center.
 * Plain alignment names refer to a coordinate, then align the widget there.
 */
function ResolveAxis(position: number, size: number, parentSize: number, exactPosition: boolean, align: string): number {
	const offset = exactPosition ? position : parentSize * position;
	const normalized = align.toLowerCase().trim();
	if (normalized.endsWith("_ref")) {
		if (normalized.startsWith("right") || normalized.startsWith("bottom"))
			return parentSize - offset - size;
		if (normalized.startsWith("center"))
			return parentSize * 0.5 + offset - size * 0.5;
		return offset;
	}
	if (normalized === "right" || normalized === "bottom")
		return offset - size;
	if (normalized === "center")
		return offset - size * 0.5;
	return offset;
}

/**
 * Conservative authored-size measurement. Exact sizes provide preferred
 * dimensions; relative sizes remain dependent on the parent and contribute
 * no intrinsic width/height. The zero minimums intentionally do NOT claim
 * native text/image intrinsic sizes or fixed-grid minimum constraints.
 *
 * This is a first measurement step, not content-based Size To Content.
 */
export function MeasureAuthoredSize(geometry: AuthoredGeometry): MeasuredWidget {
	const preferredWidth = geometry.exactSizeX ? Math.max(0, geometry.sizeX) : 0;
	const preferredHeight = geometry.exactSizeY ? Math.max(0, geometry.sizeY) : 0;
	return {
		minWidth: 0,
		minHeight: 0,
		preferredWidth,
		preferredHeight,
		dependsOnParentWidth: !geometry.exactSizeX,
		dependsOnParentHeight: !geometry.exactSizeY
	};
}

/**
 * One alignment implementation for authored sizes and for a separately
 * measured content size. Alignment must be re-evaluated when size changes,
 * especially with right_ref and center_ref positioning.
 */
export function ResolveAuthoredRectWithSize(
	geometry: AuthoredGeometry,
	parent: Pick<GeometryRect, "width" | "height">,
	size: Pick<GeometryRect, "width" | "height">
): GeometryRect {
	return {
		x: ResolveAxis(geometry.positionX, size.width, parent.width, geometry.exactPositionX, geometry.hAlign),
		y: ResolveAxis(geometry.positionY, size.height, parent.height, geometry.exactPositionY, geometry.vAlign),
		width: size.width,
		height: size.height
	};
}

/** Parent-local rectangle; parent x/y are intentionally ignored. */
export function ResolveAuthoredRect(geometry: AuthoredGeometry, parent: Pick<GeometryRect, "width" | "height">): GeometryRect {
	const width = geometry.exactSizeX ? geometry.sizeX : parent.width * geometry.sizeX;
	const height = geometry.exactSizeY ? geometry.sizeY : parent.height * geometry.sizeY;
	const size = ResolveNativeAspectSize(
		{ width: geometry.sizeX, height: geometry.sizeY },
		{ width, height }, parent, geometry.fixAspectMode,
		geometry.exactSizeX, geometry.exactSizeY
	);
	return ResolveAuthoredRectWithSize(geometry, parent, size);
}

function InvertAxis(start: number, size: number, parentSize: number, exact: boolean, align: string): number {
	const normalized = align.toLowerCase().trim();
	let position = start;
	if (normalized.endsWith("_ref")) {
		if (normalized.startsWith("right") || normalized.startsWith("bottom"))
			position = parentSize - start - size;
		else if (normalized.startsWith("center"))
			position = start + size * 0.5 - parentSize * 0.5;
	} else {
		if (normalized === "right" || normalized === "bottom")
			position = start + size;
		else if (normalized === "center")
			position = start + size * 0.5;
	}
	if (exact)
		return position;
	return parentSize > 0 ? position / parentSize : 0;
}

function FormatNumber(value: number): string {
	if (!Number.isFinite(value))
		return "0";
	const rounded = Math.abs(value) < 0.0000005 ? 0 : value;
	return Number(rounded.toFixed(6)).toString();
}

/** Round-trip a resolved rectangle without changing authored exact/relative flags. */
export function EncodeAuthoredRect(
	geometry: AuthoredGeometry,
	parent: Pick<GeometryRect, "width" | "height">,
	rect: GeometryRect
): { position: string; size: string } {
	const x = InvertAxis(rect.x, rect.width, parent.width, geometry.exactPositionX, geometry.hAlign);
	const y = InvertAxis(rect.y, rect.height, parent.height, geometry.exactPositionY, geometry.vAlign);
	const width = geometry.exactSizeX ? rect.width : (parent.width > 0 ? rect.width / parent.width : 0);
	const height = geometry.exactSizeY ? rect.height : (parent.height > 0 ? rect.height / parent.height : 0);
	return {
		position: `${FormatNumber(x)} ${FormatNumber(y)}`,
		size: `${FormatNumber(width)} ${FormatNumber(height)}`
	};
}
