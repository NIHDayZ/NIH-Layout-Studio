import type { LayoutNode } from "../model/LayoutTypes";

export interface Rect {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface TextStyleInfo {
	hAlign: "left" | "center" | "right";
	vAlign: "top" | "center" | "bottom";
	fontSize: number;
	fontWeight: number;
	fontFamily: string;
	shadowSize: number;
	shadowColor?: string;
	shadowOffsetX: number;
	shadowOffsetY: number;
}

function ParseNumbers(value?: string): number[] {
	if (!value)
		return [];

	return value
		.split(/\s+/)
		.map(Number)
		.filter((part) => Number.isFinite(part));
}

function NormalizeAlign(value: string | undefined, fallback: "left" | "center" | "right"): "left" | "center" | "right" {
	const normalized = (value ?? fallback).toLowerCase();
	if (normalized.includes("right"))
		return "right";
	if (normalized.includes("center"))
		return "center";
	return "left";
}

function NormalizeVAlign(value: string | undefined): "top" | "center" | "bottom" {
	const normalized = (value ?? "top").toLowerCase();
	if (normalized.includes("bottom"))
		return "bottom";
	if (normalized.includes("center"))
		return "center";
	return "top";
}

function FontFamilyFromPath(font?: string): string {
	if (!font)
		return '"Arial Narrow", Arial, sans-serif';

	const normalized = font.toLowerCase();
	if (normalized.includes("metron"))
		return '"Arial Narrow", Arial, sans-serif';
	if (normalized.includes("etelka"))
		return 'Arial, Helvetica, sans-serif';
	return 'Arial, Helvetica, sans-serif';
}

function InferFontSize(node: LayoutNode, rect: Rect): number {
	const explicitSizeNames = ["exact text size", "exact size", "fontsize", "font size"];
	for (const propertyName of explicitSizeNames) {
		const explicitSize = Number(GetNodeProperty(node, propertyName));
		if (Number.isFinite(explicitSize) && explicitSize > 0)
			return explicitSize;
	}

	const font = GetNodeProperty(node, "font") ?? "";
	const fontSizeMatch = font.match(/(\d{2})(?:bold|book|light)?$/i);
	if (fontSizeMatch) {
		const parsed = Number(fontSizeMatch[1]);
		if (Number.isFinite(parsed) && parsed > 0)
			return parsed;
	}

	return Math.max(10, Math.min(32, rect.height * 0.58));
}

export function GetNodeProperty(node: LayoutNode, name: string): string | undefined {
	return node.properties.find((property) => property.name.toLowerCase() === name.toLowerCase())?.value;
}

export function GetNumber(node: LayoutNode, name: string, fallback = 0): number {
	const parsed = Number(GetNodeProperty(node, name));
	return Number.isFinite(parsed) ? parsed : fallback;
}

export function GetNumberPair(node: LayoutNode, name: string, fallbackA: number, fallbackB: number): [number, number] {
	const parts = ParseNumbers(GetNodeProperty(node, name));
	return [parts[0] ?? fallbackA, parts[1] ?? fallbackB];
}

export function GetFlag(node: LayoutNode, name: string): boolean {
	return GetNodeProperty(node, name) === "1";
}

export function ParseColor(value?: string): string | undefined {
	const parts = ParseNumbers(value);
	if (parts.length < 3)
		return undefined;

	const [r, g, b, a = 1] = parts;
	return `rgba(${Math.round(Math.max(0, Math.min(1, r)) * 255)}, ${Math.round(Math.max(0, Math.min(1, g)) * 255)}, ${Math.round(Math.max(0, Math.min(1, b)) * 255)}, ${Math.max(0, Math.min(1, a))})`;
}

function ResolveAxis(position: number, size: number, parentSize: number, exactPosition: boolean, align: string): number {
	const offset = exactPosition ? position : parentSize * position;
	const normalized = align.toLowerCase().trim();

	// Enfusion has two related alignment forms:
	//   *_ref : position is an offset from a parent reference point.
	//   plain  : position is a coordinate in the parent, then the widget is aligned
	//            around that coordinate. This distinction matters for proportional
	//            positions such as `position 1 0; halign right`.
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

export function ResolveRect(node: LayoutNode, parent: Rect): Rect {
	const [posX, posY] = GetNumberPair(node, "position", 0, 0);
	const [sizeX, sizeY] = GetNumberPair(node, "size", 1, 1);
	const exactPosX = GetFlag(node, "hexactpos");
	const exactPosY = GetFlag(node, "vexactpos");
	const exactSizeX = GetFlag(node, "hexactsize");
	const exactSizeY = GetFlag(node, "vexactsize");

	const width = exactSizeX ? sizeX : parent.width * sizeX;
	const height = exactSizeY ? sizeY : parent.height * sizeY;
	const hAlign = GetNodeProperty(node, "halign") ?? "left_ref";
	const vAlign = GetNodeProperty(node, "valign") ?? "top_ref";

	const x = ResolveAxis(posX, width, parent.width, exactPosX, hAlign);
	const y = ResolveAxis(posY, height, parent.height, exactPosY, vAlign);

	return { x, y, width, height };
}

export function ResolveTextStyle(node: LayoutNode, rect: Rect, fontFamilyOverride?: string): TextStyleInfo {
	const [shadowOffsetX, shadowOffsetY] = GetNumberPair(node, "shadow offset", 0, 0);
	return {
		hAlign: NormalizeAlign(GetNodeProperty(node, "text halign"), "left"),
		vAlign: NormalizeVAlign(GetNodeProperty(node, "text valign")),
		fontSize: InferFontSize(node, rect),
		fontWeight: GetFlag(node, "bold text") ? 700 : 400,
		fontFamily: fontFamilyOverride ?? FontFamilyFromPath(GetNodeProperty(node, "font")),
		shadowSize: GetNumber(node, "shadow size", 0),
		shadowColor: ParseColor(GetNodeProperty(node, "shadow color")),
		shadowOffsetX,
		shadowOffsetY
	};
}

export function IsRenderableNode(node: LayoutNode): boolean {
	return node.type.toLowerCase().includes("widgetclass");
}

function InverseResolvedAxis(resolvedStart: number, resolvedSize: number, parentSize: number, exactPosition: boolean, align: string): number {
	const normalized = align.toLowerCase().trim();
	let coordinate = resolvedStart;
	if (normalized.endsWith("_ref")) {
		if (normalized.startsWith("right") || normalized.startsWith("bottom"))
			coordinate = parentSize - resolvedStart - resolvedSize;
		else if (normalized.startsWith("center"))
			coordinate = resolvedStart + resolvedSize * 0.5 - parentSize * 0.5;
	} else {
		if (normalized === "right" || normalized === "bottom")
			coordinate = resolvedStart + resolvedSize;
		else if (normalized === "center")
			coordinate = resolvedStart + resolvedSize * 0.5;
	}
	return exactPosition ? coordinate : (parentSize > 0 ? coordinate / parentSize : 0);
}

function FormatLayoutNumber(value: number): string {
	if (!Number.isFinite(value))
		return "0";
	const rounded = Math.abs(value) < 0.0000005 ? 0 : value;
	return Number(rounded.toFixed(6)).toString();
}

export function RectToLayoutGeometry(node: LayoutNode, parent: Rect, rect: Rect): { position: string; size: string } {
	const exactPosX = GetFlag(node, "hexactpos");
	const exactPosY = GetFlag(node, "vexactpos");
	const exactSizeX = GetFlag(node, "hexactsize");
	const exactSizeY = GetFlag(node, "vexactsize");
	const hAlign = GetNodeProperty(node, "halign") ?? "left_ref";
	const vAlign = GetNodeProperty(node, "valign") ?? "top_ref";

	const posX = InverseResolvedAxis(rect.x, rect.width, parent.width, exactPosX, hAlign);
	const posY = InverseResolvedAxis(rect.y, rect.height, parent.height, exactPosY, vAlign);
	const sizeX = exactSizeX ? rect.width : (parent.width > 0 ? rect.width / parent.width : 0);
	const sizeY = exactSizeY ? rect.height : (parent.height > 0 ? rect.height / parent.height : 0);

	return {
		position: `${FormatLayoutNumber(posX)} ${FormatLayoutNumber(posY)}`,
		size: `${FormatLayoutNumber(sizeX)} ${FormatLayoutNumber(sizeY)}`
	};
}
