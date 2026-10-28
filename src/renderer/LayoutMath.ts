import type { LayoutNode } from "../model/LayoutTypes";
import type { GeometryRect } from "./engine/GeometryCore.js";
import { DecodeAuthoredGeometry, EncodeAuthoredRect, ResolveAuthoredRect } from "./engine/WidgetGeometry.js";

/** Stable public type for existing renderer and editor callers. */
export type Rect = GeometryRect;

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

/**
 * Compatibility boundary: the canvas and geometry editor use the same
 * authored geometry rules as the new engine. Container-specific arrangement
 * remains separate, and the live renderer behavior is unchanged.
 */
export function ResolveRect(node: LayoutNode, parent: Rect): Rect {
	return ResolveAuthoredRect(DecodeAuthoredGeometry(node), parent);
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

/** Encode edits through the shared inverse geometry transform. */
export function RectToLayoutGeometry(node: LayoutNode, parent: Rect, rect: Rect): { position: string; size: string } {
	return EncodeAuthoredRect(DecodeAuthoredGeometry(node), parent, rect);
}
