import { SdfAtlasCell, SdfCellSize, SdfSampleAlpha } from "./SdfRasterMath";
import { MsdfAlpha, MsdfAlphaWithBias, MsdfScaledSmoothing } from "./SdfMsdfMath";

/**
 * Shared, pure atlas-sample selector. Preserve legacy FSDF cells and the
 * original standalone FNT5/TCRD precedence without generalizing the
 * MetronBook24-only experimental TCRD fallback.
 */
export interface SdfGlyphAtlasSampleInput {
	nativeOrigin: { x: number; y: number } | undefined;
	useExperimentalCells: boolean;
	hasFnt5PixelMetrics: boolean;
	fnt5CellSize: number | undefined;
	fnt5Name: string | undefined;
	nominalFontSize: number;
	charScale: number;
	glyphX: number;
	glyphY: number;
	referenceAtlasWidth: number;
	atlasWidth: number;
	atlasHeight: number;
}

export type SdfGlyphAtlasSelection = "Standalone FNT5 cell" | "TCRD" | "FSDF fallback";

export function ResolveSdfGlyphAtlasSample(input: SdfGlyphAtlasSampleInput) {
	const origin = input.useExperimentalCells ? input.nativeOrigin : undefined;
	const usesTcrd = !!(origin &&
		input.fnt5Name?.toLowerCase() === "sdf_metronbook24" &&
		input.nominalFontSize === 24 &&
		input.atlasWidth === 1024 &&
		input.atlasHeight === 1024);
	const usesStandalone = !!(input.hasFnt5PixelMetrics && input.fnt5CellSize && input.nativeOrigin);

	const rect = usesStandalone
		? { left: input.nativeOrigin!.x, top: input.nativeOrigin!.y, size: input.fnt5CellSize!, scale: 1 }
		: usesTcrd
			? { left: origin!.x, top: origin!.y, size: 38, scale: 1 }
			: SdfAtlasCell(
				input.glyphX, input.glyphY,
				SdfCellSize(input.nominalFontSize, input.charScale),
				input.referenceAtlasWidth, input.atlasWidth, input.atlasHeight
			);

	const selected: SdfGlyphAtlasSelection = usesStandalone
		? "Standalone FNT5 cell"
		: usesTcrd ? "TCRD" : "FSDF fallback";

	return { origin, rect, selected };
}

/** Exact cache-key policy used before the sampling/raster extraction. */
export function ResolveSdfGlyphCacheKey(
	codePoint: number,
	displayedFontSize: number,
	msdf: boolean,
	smoothing: boolean,
	stroke: boolean
): string {
	return msdf && (smoothing || stroke)
		? `${codePoint}:${displayedFontSize}`
		: `${codePoint}`;
}

export interface SdfGlyphAlphaOptions {
	msdf: boolean;
	smoothing: boolean;
	stroke: boolean;
	inverted: boolean;
	displayedFontSize: number;
	nominalFontSize: number;
}

/**
 * Convert an ImageData RGBA buffer to white-ink glyph alpha in place.
 * Keeping the exact legacy and MSDF formulas preserves all render modes.
 * Source pixels are already a private getImageData copy, not the atlas.
 */
export function RasterizeSdfGlyphAlpha(pixels: Uint8ClampedArray, options: SdfGlyphAlphaOptions): void {
	const smoothing = options.smoothing
		? MsdfScaledSmoothing(options.displayedFontSize, options.nominalFontSize)
		: 12;
	for (let p = 0; p < pixels.length; p += 4) {
		const alpha = options.msdf
			? options.stroke
				? MsdfAlphaWithBias(pixels[p], pixels[p + 1], pixels[p + 2], options.inverted, smoothing, 2)
				: MsdfAlpha(pixels[p], pixels[p + 1], pixels[p + 2], options.inverted, smoothing)
			: SdfSampleAlpha(pixels[p], options.inverted);
		pixels[p] = 255;
		pixels[p + 1] = 255;
		pixels[p + 2] = 255;
		pixels[p + 3] = alpha;
	}
}
