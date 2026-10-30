import type { SdfFontMetadata, SdfGlyphMetric } from "./Fnt5Metadata";

/**
 * Renderer-independent SDF/FNT5 resource contract. Keeps resource decoding,
 * indexing and drawing coupled to a shared data type, not a React component.
 */
export interface SdfFontResource {
	metadata: SdfFontMetadata;
	glyphs: Map<number, SdfGlyphMetric>;
	atlasUrl: string;
	fnt5Origins?: Map<number, { x: number; y: number }>;
	fnt5Name?: string;
	fnt5CellSize?: number;
	fnt5PixelMetrics?: boolean;
}
