import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ParseFnt5ResearchOptions, ReadFnt5ResearchOptions } from "../.geometry-engine-test-build/Fnt5ResearchOptions.js";

test("FNT5 research settings default to legacy behavior with no URL parameters", () => {
	assert.deepEqual(ParseFnt5ResearchOptions(""), {
		standalone: false, cells: false, placement: false, cellLayout: false,
		lineOrigin: null, debugClip: false, debugSampling: false,
		msdf: false, msdfSmoothing: false, msdfStroke: false, fit: null
	});
	assert.deepEqual(ReadFnt5ResearchOptions(), ParseFnt5ResearchOptions(""));
});

test("validated research URL preserves every opt-in switch and raw research coefficients", () => {
	const query = "?experimentalStandaloneFnt5=1&experimentalMsdf=1&experimentalFnt5Placement=1" +
		"&experimentalFnt5Fit=height&experimentalFnt5LineOrigin=0.08&debugFnt5Sampling=1";
	const cfg = ParseFnt5ResearchOptions(query);
	assert.equal(cfg.standalone, true);
	assert.equal(cfg.msdf, true);
	assert.equal(cfg.placement, true);
	assert.equal(cfg.fit, "height");
	assert.equal(cfg.lineOrigin, "0.08");
	assert.equal(cfg.debugSampling, true);
	assert.equal(cfg.msdfSmoothing, false);
	assert.equal(cfg.debugClip, false);
	assert.equal(cfg.cellLayout, false);
});

test("secondary research switches retain exactly their previous URL values", () => {
	const cfg = ParseFnt5ResearchOptions(
		"?experimentalFnt5Cells=1&experimentalFnt5Layout=cell&debugFnt5Clip=1" +
		"&experimentalMsdfSmoothing=1&experimentalMsdfStroke=1&experimentalFnt5Fit=1");
	assert.equal(cfg.cells, true);
	assert.equal(cfg.cellLayout, true);
	assert.equal(cfg.debugClip, true);
	assert.equal(cfg.msdfSmoothing, true);
	assert.equal(cfg.msdfStroke, true);
	assert.equal(cfg.fit, "1");
	assert.equal(cfg.standalone, false);
});

test("boolean modes are strict, and unvalidated sizing and baseline inputs remain raw", () => {
	const cfg = ParseFnt5ResearchOptions(
		"?experimentalStandaloneFnt5=true&experimentalMsdf=TRUE&experimentalFnt5Placement=0" +
		"&experimentalFnt5Layout=Cell&experimentalFnt5Fit=nope" +
		"&experimentalFnt5LineOrigin=-5&debugFnt5Sampling=true");
	assert.equal(cfg.standalone, false);
	assert.equal(cfg.msdf, false);
	assert.equal(cfg.placement, false);
	assert.equal(cfg.cellLayout, false);
	assert.equal(cfg.fit, "nope");
	assert.equal(cfg.lineOrigin, "-5");
	assert.equal(cfg.debugSampling, false);
	assert.equal(ParseFnt5ResearchOptions("?experimentalMsdf=0&experimentalMsdf=1").msdf, false);
});

test("Canvas, SDF renderer and workspace load one shared parsing policy", () => {
	const canvas = readFileSync(new URL("../src/components/Canvas.tsx", import.meta.url), "utf8");
	const sdf = readFileSync(new URL("../src/project/SdfTextCanvas.tsx", import.meta.url), "utf8");
	const workspace = readFileSync(new URL("../src/project/ProjectWorkspace.ts", import.meta.url), "utf8");
	assert.ok(canvas.includes('fit: experimentalFnt5FitRaw, debugSampling: debugTextResolution'));
	assert.ok(sdf.includes('lineOrigin: experimentalFnt5LineOrigin'));
	assert.ok(sdf.includes('msdf: experimentalMsdf'));
	assert.ok(workspace.includes('ReadFnt5ResearchOptions().standalone'));
	assert.equal(workspace.includes('get("experimentalStandaloneFnt5")'), false);
	assert.equal(sdf.includes('new URLSearchParams(window.location.search)'), false);
});
