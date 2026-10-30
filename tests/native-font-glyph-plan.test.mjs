import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ResolveSdfGlyphDrawPlan } from "../.geometry-engine-test-build/SdfGlyphDrawPlan.js";

const base = {
	cellLayout: false, bearingPlacement: false, hasFnt5PixelMetrics: true,
	cellSize: 38, glyphWidth: 15, glyphHeight: 18, bearingX: 2, bearingY: 17,
	nominalFontSize: 24, requestedFontSize: 48, penX: 10, baseY: -3,
	spriteWidth: 38, spriteHeight: 38, atlasWidth: 2048, referenceAtlasWidth: 1024
};

test("legacy SDF draw plan preserves glyph bearings and cooked-atlas ratio", () => {
	assert.deepEqual(ResolveSdfGlyphDrawPlan(base), {
		mode: "legacy", x: 14, y: 11, width: 38, height: 38
	});
});

test("legacy draw plan scales non-square sprites using original independent width and height", () => {
	const input = { ...base, spriteWidth: 20, spriteHeight: 40, requestedFontSize: 12 };
	assert.deepEqual(ResolveSdfGlyphDrawPlan(input), {
		mode: "legacy", x: 11, y: 0.5, width: 5, height: 10
	});
});

test("cell mode positions padded atlas origin without bearings and bypasses cooked-atlas scaling", () => {
	assert.deepEqual(ResolveSdfGlyphDrawPlan({ ...base, cellLayout: true }), {
		mode: "cell", x: 10, y: -3, width: 76, height: 76
	});
});

test("bearing mode keeps the existing FNT5 padded-cell placement exactly", () => {
	assert.deepEqual(ResolveSdfGlyphDrawPlan({ ...base, bearingPlacement: true }), {
		mode: "bearing", x: -9, y: -9, width: 76, height: 76
	});
});

test("experimental cell mode retains precedence when bearing and cell switches are both set", () => {
	assert.equal(ResolveSdfGlyphDrawPlan({ ...base, cellLayout: true, bearingPlacement: true })?.mode, "cell");
});

test("non-FNT5 and missing-cell resources always retain the original legacy route", () => {
	assert.equal(ResolveSdfGlyphDrawPlan({ ...base, cellLayout: true, bearingPlacement: true, hasFnt5PixelMetrics: false })?.mode, "legacy");
	assert.equal(ResolveSdfGlyphDrawPlan({ ...base, cellLayout: true, bearingPlacement: true, cellSize: undefined })?.mode, "legacy");
	assert.equal(ResolveSdfGlyphDrawPlan({ ...base, cellLayout: true, bearingPlacement: true, cellSize: 0 })?.mode, "legacy");
});

test("invalid FNT5 bearing placement returns null without silently switching to legacy rendering", () => {
	const invalid = { ...base, bearingPlacement: true, nominalFontSize: 0 };
	assert.equal(ResolveSdfGlyphDrawPlan(invalid), null);
	assert.equal(ResolveSdfGlyphDrawPlan({ ...invalid, cellLayout: true })?.mode, "cell");
});

test("negative or fractional legal baselines preserve exact draw-position arithmetic", () => {
	const input = { ...base, bearingPlacement: true, requestedFontSize: 34, baseY: -2.72, penX: 10.5 };
	const result = ResolveSdfGlyphDrawPlan(input);
	assert.ok(result);
	const scale = 34 / 24;
	assert.ok(Math.abs(result.x - (10.5 + (2 - 11.5) * scale)) < 1e-12);
	assert.ok(Math.abs(result.y - (-2.72 + (24 - 17 - 10) * scale)) < 1e-12);
	assert.ok(Math.abs(result.width - 38 * scale) < 1e-12);
});

test("live canvas uses a single draw call and retains debug mode, line origin and advance", () => {
	const source = readFileSync(new URL("../src/project/SdfTextCanvas.tsx", import.meta.url), "utf8");
	assert.ok(source.includes('import { ResolveSdfGlyphDrawPlan } from "./SdfGlyphDrawPlan";'));
	assert.equal((source.match(/ink\.drawImage\(sprite,/g) ?? []).length, 1);
	assert.ok(source.includes("LogFnt5Placement(resource, glyph, character, plan.mode"));
	assert.ok(source.includes("penX += resource.fnt5PixelMetrics ? glyph.advance * scale : SdfGlyphAdvance(glyph.advance, fontSize);"));
	assert.ok(source.includes("ResolveExperimentalFnt5LineOrigin(experimentalFnt5LineOrigin"));
});
