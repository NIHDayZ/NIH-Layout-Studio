import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
	ResolveSdfGlyphAtlasSample,
	ResolveSdfGlyphCacheKey,
	RasterizeSdfGlyphAlpha
} from "../.geometry-engine-test-build/SdfGlyphRasterPlan.js";

const base = {
	nativeOrigin: { x: 76, y: 38 },
	useExperimentalCells: false,
	hasFnt5PixelMetrics: false,
	fnt5CellSize: 38,
	fnt5Name: "sdf_metronbook24",
	nominalFontSize: 24,
	charScale: 1.375,
	glyphX: 36,
	glyphY: 1,
	referenceAtlasWidth: 512,
	atlasWidth: 1024,
	atlasHeight: 1024
};

test("legacy FSDF atlas selection preserves cooked reference-pixel scaling", () => {
	const result = ResolveSdfGlyphAtlasSample(base);
	assert.equal(result.origin, undefined);
	assert.equal(result.selected, "FSDF fallback");
	assert.deepEqual(result.rect, { left: 72, top: 2, size: 66, scale: 2 });
});

test("standalone FNT5 atlas cells remain selected even without experimental TCRD-cell flag", () => {
	const result = ResolveSdfGlyphAtlasSample({
		...base, hasFnt5PixelMetrics: true, fnt5CellSize: 38
	});
	assert.equal(result.origin, undefined);
	assert.equal(result.selected, "Standalone FNT5 cell");
	assert.deepEqual(result.rect, { left: 76, top: 38, size: 38, scale: 1 });
});

test("legacy MetronBook24-only TCRD route retains its atlas and flag restrictions", () => {
	const selected = ResolveSdfGlyphAtlasSample({ ...base, useExperimentalCells: true });
	assert.equal(selected.selected, "TCRD");
	assert.deepEqual(selected.origin, { x: 76, y: 38 });
	assert.deepEqual(selected.rect, { left: 76, top: 38, size: 38, scale: 1 });
	assert.equal(ResolveSdfGlyphAtlasSample({ ...base, fnt5Name: "sdf_metronlight24", useExperimentalCells: true }).selected, "FSDF fallback");
	assert.equal(ResolveSdfGlyphAtlasSample({ ...base, atlasWidth: 2048, useExperimentalCells: true }).selected, "FSDF fallback");
	assert.equal(ResolveSdfGlyphAtlasSample({ ...base, nominalFontSize: 72, useExperimentalCells: true }).selected, "FSDF fallback");
});

test("missing origin, missing cell size and invalid FSDF cells preserve fallback and null handling", () => {
	const noOrigin = ResolveSdfGlyphAtlasSample({ ...base, nativeOrigin: undefined, hasFnt5PixelMetrics: true, useExperimentalCells: true });
	assert.equal(noOrigin.selected, "FSDF fallback");
	assert.deepEqual(noOrigin.rect, { left: 72, top: 2, size: 66, scale: 2 });
	const noCellSize = ResolveSdfGlyphAtlasSample({ ...base, hasFnt5PixelMetrics: true, fnt5CellSize: undefined });
	assert.equal(noCellSize.selected, "FSDF fallback");
	const invalid = ResolveSdfGlyphAtlasSample({ ...base, referenceAtlasWidth: 0 });
	assert.equal(invalid.rect, null);
});

test("glyph cache keys retain the legacy one-entry and size-varying MSDF policies", () => {
	assert.equal(ResolveSdfGlyphCacheKey(65, 24, false, false, false), "65");
	assert.equal(ResolveSdfGlyphCacheKey(65, 72, true, false, false), "65");
	assert.equal(ResolveSdfGlyphCacheKey(65, 24, true, true, false), "65:24");
	assert.equal(ResolveSdfGlyphCacheKey(65, 72, true, false, true), "65:72");
	assert.equal(ResolveSdfGlyphCacheKey(65, 24, false, true, true), "65");
});

test("legacy red-channel raster keeps whitening, inversion and original alpha values", () => {
	const data = new Uint8ClampedArray([0, 255, 255, 24, 128, 0, 0, 8, 255, 0, 0, 16]);
	RasterizeSdfGlyphAlpha(data, { msdf: false, smoothing: false, stroke: false, inverted: false, displayedFontSize: 24, nominalFontSize: 24 });
	assert.deepEqual([...data], [255,255,255,0, 255,255,255,128, 255,255,255,255]);
	const inverted = new Uint8ClampedArray([0, 9, 10, 1, 255, 0, 0, 2]);
	RasterizeSdfGlyphAlpha(inverted, { msdf: false, smoothing: true, stroke: true, inverted: true, displayedFontSize: 48, nominalFontSize: 24 });
	assert.deepEqual([...inverted], [255,255,255,255,255,255,255,0]);
});

test("median MSDF and alpha bias preserve the exact experimental pixel values", () => {
	const sample = new Uint8ClampedArray([120,130,140,0, 0,128,255,0]);
	RasterizeSdfGlyphAlpha(sample, { msdf: true, smoothing: false, stroke: false, inverted: false, displayedFontSize: 24, nominalFontSize: 24 });
	assert.deepEqual([...sample], [255,255,255,189, 255,255,255,128]);
	const biased = new Uint8ClampedArray([120,130,140,0]);
	RasterizeSdfGlyphAlpha(biased, { msdf: true, smoothing: false, stroke: true, inverted: false, displayedFontSize: 24, nominalFontSize: 24 });
	assert.deepEqual([...biased], [255,255,255,236]);
});

test("MSDF inverse distance and displayed-font-size smoothing are unchanged", () => {
	const inverted = new Uint8ClampedArray([120,130,140,0]);
	RasterizeSdfGlyphAlpha(inverted, { msdf: true, smoothing: false, stroke: false, inverted: true, displayedFontSize: 24, nominalFontSize: 24 });
	assert.deepEqual([...inverted], [255,255,255,66]);
	const scale = new Uint8ClampedArray([120,130,140,0]);
	RasterizeSdfGlyphAlpha(scale, { msdf: true, smoothing: true, stroke: false, inverted: false, displayedFontSize: 48, nominalFontSize: 24 });
	assert.deepEqual([...scale], [255,255,255,236]);
});

test("glyph alpha transform edits its provided ImageData buffer without reallocating atlas data", () => {
	const pixels = new Uint8ClampedArray([0,128,255,40]);
	const underlying = pixels.buffer;
	const returned = RasterizeSdfGlyphAlpha(pixels, { msdf: true, smoothing: false, stroke: false, inverted: false, displayedFontSize: 24, nominalFontSize: 24 });
	assert.equal(returned, undefined);
	assert.equal(pixels.buffer, underlying);
	assert.deepEqual([...pixels], [255,255,255,128]);
});

test("canvas uses the shared atlas sampler and alpha transformer while retaining its cache and draw pipeline", () => {
	const source = readFileSync(new URL("../src/project/SdfTextCanvas.tsx", import.meta.url), "utf8");
	assert.equal((source.match(/ResolveSdfGlyphAtlasSample\(/g) ?? []).length, 1);
	assert.equal((source.match(/RasterizeSdfGlyphAlpha\(/g) ?? []).length, 1);
	assert.equal((source.match(/ResolveSdfGlyphCacheKey\(/g) ?? []).length, 1);
	assert.ok(source.includes("atlas.glyphs.set(cacheKey, canvas);"));
	assert.ok(source.includes("LogFnt5Placement(resource, glyph, character, plan.mode"));
	assert.ok(source.includes("ink.drawImage(sprite, plan.x, plan.y, plan.width, plan.height);"));
});
