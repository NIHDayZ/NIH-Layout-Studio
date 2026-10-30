import { Fnt5Placement } from "./Fnt5Placement";

/**
 * One pure draw-rectangle selector for the existing SDF and research FNT5
 * render paths. Coordinates, mode precedence and null handling intentionally
 * mirror SdfTextCanvas; this does not introduce native engine assumptions.
 */
export type SdfGlyphDrawMode = "legacy" | "cell" | "bearing";

export interface SdfGlyphDrawPlanInput {
	cellLayout: boolean;
	bearingPlacement: boolean;
	hasFnt5PixelMetrics: boolean;
	cellSize: number | undefined;
	glyphWidth: number;
	glyphHeight: number;
	bearingX: number;
	bearingY: number;
	nominalFontSize: number;
	requestedFontSize: number;
	penX: number;
	baseY: number;
	spriteWidth: number;
	spriteHeight: number;
	atlasWidth: number;
	referenceAtlasWidth: number;
}

export interface SdfGlyphDrawPlan {
	mode: SdfGlyphDrawMode;
	x: number;
	y: number;
	width: number;
	height: number;
}

export function ResolveSdfGlyphDrawPlan(input: SdfGlyphDrawPlanInput): SdfGlyphDrawPlan | null {
	const scale = input.requestedFontSize / input.nominalFontSize;
	if (input.cellLayout && input.hasFnt5PixelMetrics && input.cellSize) {
		const size = input.cellSize * scale;
		return { mode: "cell", x: input.penX, y: input.baseY, width: size, height: size };
	}

	if (input.bearingPlacement && input.hasFnt5PixelMetrics && input.cellSize) {
		const placement = Fnt5Placement(
			input.cellSize, input.glyphWidth, input.glyphHeight,
			input.bearingX, input.bearingY, input.nominalFontSize,
			input.requestedFontSize, input.penX, input.baseY
		);
		if (!placement)
			return null;
		return { mode: "bearing", x: placement.x, y: placement.y, width: placement.size, height: placement.size };
	}

	// The original FSDF/legacy path scales the source sprite by the cooked
	// atlas/reference-atlas ratio, unlike FNT5's nominal padded cell size.
	const atlasScale = input.atlasWidth / input.referenceAtlasWidth;
	return {
		mode: "legacy",
		x: input.penX + input.bearingX * scale,
		y: input.baseY + (input.nominalFontSize - input.bearingY) * scale,
		width: input.spriteWidth * scale / atlasScale,
		height: input.spriteHeight * scale / atlasScale
	};
}
