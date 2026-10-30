import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ParseFnt5ResearchOptions } from "../.geometry-engine-test-build/Fnt5ResearchOptions.js";
import { ResolveExperimentalFnt5FontSize } from "../.geometry-engine-test-build/Fnt5FontSizingExperiment.js";
import { ResolveExperimentalFnt5LineOrigin } from "../.geometry-engine-test-build/Fnt5LineOriginExperiment.js";
import { ResolveSdfGlyphAtlasSample, ResolveSdfGlyphCacheKey, RasterizeSdfGlyphAlpha } from "../.geometry-engine-test-build/SdfGlyphRasterPlan.js";
import { ResolveSdfGlyphDrawPlan } from "../.geometry-engine-test-build/SdfGlyphDrawPlan.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const holdout = JSON.parse(read("./fixtures/native-font-line-origin/capture.holdout.2026-10-29.json"));
const clipping = JSON.parse(read("./fixtures/native-font-descender/capture.visual.2026-10-29.json"));
const query = "?experimentalStandaloneFnt5=1&experimentalMsdf=1&experimentalFnt5Placement=1" +
	"&experimentalFnt5Fit=height&experimentalFnt5LineOrigin=0.08&debugFnt5Sampling=1";

function nominalSize(id) {
	return id.includes("Book72") ? 72 : 24;
}

function atlasInput(nominal, hasPixelMetrics, research) {
	return {
		nativeOrigin: { x: 76, y: 38 },
		useExperimentalCells: research.cells,
		hasFnt5PixelMetrics: hasPixelMetrics,
		fnt5CellSize: nominal === 72 ? 95 : 38,
		fnt5Name: nominal === 72 ? "sdf_metronbook72" : "sdf_metronbook24",
		nominalFontSize: nominal,
		charScale: 1.375,
		glyphX: 36,
		glyphY: 1,
		referenceAtlasWidth: 512,
		atlasWidth: nominal === 72 ? 4096 : 1024,
		atlasHeight: nominal === 72 ? 2048 : 1024
	};
}

function drawInput(nominal, size, baseline, research, hasPixelMetrics) {
	return {
		cellLayout: research.cellLayout,
		bearingPlacement: research.placement,
		hasFnt5PixelMetrics: hasPixelMetrics,
		cellSize: nominal === 72 ? 95 : 38,
		glyphWidth: nominal === 72 ? 46 : 15,
		glyphHeight: nominal === 72 ? 51 : 18,
		bearingX: 0,
		bearingY: nominal === 72 ? 50 : 17,
		nominalFontSize: nominal,
		requestedFontSize: size,
		penX: 10,
		baseY: baseline,
		spriteWidth: nominal === 72 ? 95 : 38,
		spriteHeight: nominal === 72 ? 95 : 38,
		atlasWidth: nominal === 72 ? 4096 : 1024,
		referenceAtlasWidth: nominal === 72 ? 4096 : 512
	};
}

test("integration gate keeps every FNT5 research feature disabled with no URL flags", () => {
	const options = ParseFnt5ResearchOptions("");
	assert.equal(options.standalone, false);
	assert.equal(options.msdf, false);
	assert.equal(options.placement, false);
	assert.equal(options.fit, null);
	assert.equal(options.lineOrigin, null);
	assert.equal(options.debugClip, false);
	assert.equal(options.debugSampling, false);
});

test("default FSDF composition retains nominal sizes and unmodified one-line origins across all 20 holdout controls", () => {
	const options = ParseFnt5ResearchOptions("");
	assert.equal(holdout.cases.length, 20);
	for (const c of holdout.cases) {
		const nominal = nominalSize(c.id);
		const originalBase = c.id.startsWith("Button") ? (c.height - nominal * 1.25) / 2 : 0;
		const size = ResolveExperimentalFnt5FontSize(options.fit, nominal, c.height, false, false);
		const baseline = ResolveExperimentalFnt5LineOrigin(options.lineOrigin, c.height, originalBase, false, 1);
		assert.equal(size, nominal, c.id);
		assert.equal(baseline, originalBase, c.id);
		const sample = ResolveSdfGlyphAtlasSample(atlasInput(nominal, false, options));
		assert.equal(sample.selected, "FSDF fallback", c.id);
		const plan = ResolveSdfGlyphDrawPlan(drawInput(nominal, size, baseline, options, false));
		assert.equal(plan?.mode, "legacy", c.id);
	}
});

test("validated research profile composes height sizing, common line origin, standalone atlas and bearing placement on all 20 controls", () => {
	const options = ParseFnt5ResearchOptions(query);
	assert.equal(options.standalone && options.msdf && options.placement, true);
	for (const c of holdout.cases) {
		const nominal = nominalSize(c.id);
		const size = ResolveExperimentalFnt5FontSize(options.fit, nominal, c.height, true, false);
		const originalBase = c.id.startsWith("Button") ? (c.height - size * 1.25) / 2 : 0;
		const baseline = ResolveExperimentalFnt5LineOrigin(options.lineOrigin, c.height, originalBase, true, 1);
		assert.equal(size, c.height, c.id);
		assert.ok(Math.abs(baseline + 0.08 * c.height) < 1e-10, c.id);
		const sample = ResolveSdfGlyphAtlasSample(atlasInput(nominal, true, options));
		assert.equal(sample.selected, "Standalone FNT5 cell", c.id);
		const plan = ResolveSdfGlyphDrawPlan(drawInput(nominal, size, baseline, options, true));
		assert.equal(plan?.mode, "bearing", c.id);
		assert.ok(plan && [plan.x, plan.y, plan.width, plan.height].every(Number.isFinite), c.id);
	}
});

test("standalone FNT5 does not depend on the historical MetronBook24 TCRD switch", () => {
	const options = ParseFnt5ResearchOptions(query);
	assert.equal(options.cells, false);
	for (const nominal of [24, 72]) {
		const selected = ResolveSdfGlyphAtlasSample(atlasInput(nominal, true, options));
		assert.equal(selected.selected, "Standalone FNT5 cell");
		assert.equal(selected.rect?.size, nominal === 72 ? 95 : 38);
	}
});

test("research switches cannot force bearing or cell placement on non-FNT5 pixel metrics", () => {
	const options = ParseFnt5ResearchOptions(query + "&experimentalFnt5Layout=cell");
	const plan = ResolveSdfGlyphDrawPlan(drawInput(24, 24, 0, options, false));
	assert.equal(plan?.mode, "legacy");
	assert.equal(ResolveSdfGlyphAtlasSample(atlasInput(24, false, options)).selected, "FSDF fallback");
	assert.equal(ResolveExperimentalFnt5FontSize(options.fit, 24, 68, false, false), 24);
	assert.equal(ResolveExperimentalFnt5LineOrigin(options.lineOrigin, 68, 7, false, 1), 7);
});

test("explicit authored font size does not get replaced by experimental height fitting", () => {
	const options = ParseFnt5ResearchOptions(query);
	assert.equal(ResolveExperimentalFnt5FontSize(options.fit, 24, 110, true, true), 24);
	assert.equal(ResolveExperimentalFnt5FontSize(options.fit, 72, 34, true, true), 72);
});

test("multiple text lines retain the existing line origin even with the shared-origin experiment", () => {
	const options = ParseFnt5ResearchOptions(query);
	for (const lines of [2, 3, 5])
		assert.equal(ResolveExperimentalFnt5LineOrigin(options.lineOrigin, 68, 12.5, true, lines), 12.5);
});

test("cell-placement diagnostics still win when both experimental draw modes are requested", () => {
	const options = ParseFnt5ResearchOptions(query + "&experimentalFnt5Layout=cell");
	const plan = ResolveSdfGlyphDrawPlan(drawInput(24, 68, -5.44, options, true));
	assert.equal(plan?.mode, "cell");
});

test("default red-channel alpha remains separate from median MSDF with identical source pixels", () => {
	const sample = [120, 130, 140, 25];
	const legacy = new Uint8ClampedArray(sample);
	const research = new Uint8ClampedArray(sample);
	RasterizeSdfGlyphAlpha(legacy, { msdf: false, smoothing: false, stroke: false, inverted: false, displayedFontSize: 24, nominalFontSize: 24 });
	RasterizeSdfGlyphAlpha(research, { msdf: true, smoothing: false, stroke: false, inverted: false, displayedFontSize: 24, nominalFontSize: 24 });
	assert.deepEqual([...legacy], [255, 255, 255, 64]);
	assert.deepEqual([...research], [255, 255, 255, 189]);
	assert.equal(ResolveSdfGlyphCacheKey(103, 68, true, false, false), "103");
	assert.equal(ResolveSdfGlyphCacheKey(103, 68, true, true, false), "103:68");
});

test("previous independent Hg9 comparisons remain evidence rather than synthetic native claims", () => {
	assert.equal(holdout.comparison.holdoutCases, 20);
	assert.equal(holdout.comparison.nativeRuleRecovered, false);
	assert.equal(holdout.disposition.nativePixelParity, "not-established");
	assert.ok(holdout.comparison.currentMeanAbsGlyphTopError < holdout.comparison.projectedLegacyMeanAbsGlyphTopError);
	assert.equal(holdout.browserLog.rawInkOutsideWidgetCount, 20);
});

test("prior 32-case native clipping evidence retains its behavioural result and boundary uncertainty", () => {
	assert.equal(clipping.cases.length, 32);
	assert.equal(clipping.summary.deepUnclippedInkPixels.workbench > 0, true);
	assert.equal(clipping.summary.deepUnclippedInkPixels.studio > 0, true);
	assert.equal(clipping.summary.deepClippedInkPixels.studio, 0);
	assert.equal(clipping.summary.clippedInkMoreThanOneScreenshotRowPastBoundary.workbench, 0);
	assert.equal(clipping.conclusions.sameExactRasterScissor, "not-proven");
	assert.equal(clipping.conclusions.productionRendererAltered, false);
});

test("workspace indexes FNT5 options once and reads each FSDF sidecar once", () => {
	const workspace = read("../src/project/ProjectWorkspace.ts");
	assert.equal((workspace.match(/ReadFnt5ResearchOptions\(\)\.standalone/g) ?? []).length, 1);
	assert.ok(workspace.includes("if (standaloneFnt5Enabled)"));
	assert.equal((workspace.match(/await sidecar\.file\.text\(\)/g) ?? []).length, 1);
	assert.ok(workspace.includes("ParseFsdf(sidecarText)"));
	assert.ok(workspace.includes("ParseFsdfGlyphMetrics(sidecarText)"));
	assert.ok(workspace.includes("!standaloneFnt5Loaded"));
});

test("integrated production path still uses a single shared draw, independent resource type and atlas context", () => {
	const sdf = read("../src/project/SdfTextCanvas.tsx");
	const resource = read("../src/project/SdfFontResource.ts");
	const parser = read("../src/project/Fnt5Standalone.ts");
	assert.equal((sdf.match(/ink\.drawImage\(sprite,/g) ?? []).length, 1);
	assert.ok(sdf.includes("ResolveSdfGlyphDrawPlan({"));
	assert.ok(sdf.includes("ResolveSdfGlyphAtlasSample({"));
	assert.ok(sdf.includes("RasterizeSdfGlyphAlpha(pixels.data"));
	assert.ok(sdf.includes("atlas.sourceContext.getImageData("));
	assert.ok(resource.includes("export interface SdfFontResource {"));
	assert.ok(parser.includes('import type { SdfFontResource } from "./SdfFontResource";'));
});
